import axe from "axe-core";
import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Request,
  type Route,
  type WebSocketRoute,
} from "playwright";

import {
  createScanCapacityLimiter,
  type ScanCapacityLimiter,
} from "./capacity.js";
import { ScannerError } from "./errors.js";
import type { ScanReport } from "./model.js";
import { normalizeAxeResults, reportLimits } from "./normalize.js";
import {
  canonicalizeScanUrl,
  createDestinationPolicy,
  type HostnameResolver,
} from "./url-policy.js";

const defaultNavigationTimeoutMs = 30_000;
const defaultOverallScanTimeoutMs = 60_000;
const productionCapacity = createScanCapacityLimiter(2);

export interface ScanPageOptions {
  navigationTimeoutMs?: number;
  overallTimeoutMs?: number;
}

type BrowserLauncher = (timeoutMs: number) => Promise<Browser>;

interface ScanPageDependencies {
  launchBrowser: BrowserLauncher;
  resolveHostname?: HostnameResolver;
  capacity?: ScanCapacityLimiter;
  trustedTestOrigin?: string;
}

export function scanPage(
  url: string,
  options: ScanPageOptions = {},
): Promise<ScanReport> {
  return scanPageWithDependencies(url, options, {
    launchBrowser: (timeoutMs) => chromium.launch({ headless: true, timeout: timeoutMs }),
    capacity: productionCapacity,
  });
}

/** @internal Available outside the package root for deterministic lifecycle tests. */
export async function scanPageWithDependencies(
  url: string,
  options: ScanPageOptions,
  dependencies: ScanPageDependencies,
): Promise<ScanReport> {
  const submittedUrl = canonicalizeScanUrl(url);
  const navigationTimeoutMs = validateTimeout(
    options.navigationTimeoutMs,
    defaultNavigationTimeoutMs,
    defaultNavigationTimeoutMs,
    "navigationTimeoutMs",
  );
  const overallTimeoutMs = validateTimeout(
    options.overallTimeoutMs,
    defaultOverallScanTimeoutMs,
    defaultOverallScanTimeoutMs,
    "overallTimeoutMs",
  );
  const startedAt = new Date();
  const startedTime = performance.now();
  const policy = createDestinationPolicy({
    ...(dependencies.resolveHostname === undefined
      ? {}
      : { resolveHostname: dependencies.resolveHostname }),
    ...(dependencies.trustedTestOrigin === undefined
      ? {}
      : { trustedTestOrigin: dependencies.trustedTestOrigin }),
  });
  const releaseCapacity = (dependencies.capacity ?? productionCapacity).acquire();

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let blockedMainRequest: ScannerError | undefined;
  let overallTimeoutReached = false;

  try {
    return await withOverallTimeout(overallTimeoutMs, async () => {
      await policy.assertAllowed(submittedUrl);
      throwIfOverallTimeout(overallTimeoutReached);

      browser = await dependencies.launchBrowser(overallTimeoutMs);
      await closeLateResource(browser, () => overallTimeoutReached);
      context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: "block",
      });
      await closeLateResource(context, () => overallTimeoutReached);

      const ensurePageRequestPolicy = await installContextRequestPolicy(
        context,
        policy,
        () => page,
        (error) => {
          blockedMainRequest ??= error;
        },
      );

      page = await context.newPage();
      await closeLateResource(page, () => overallTimeoutReached);
      await ensurePageRequestPolicy(page);
      await navigate(page, submittedUrl, navigationTimeoutMs, () => blockedMainRequest);

      const finalUrl = canonicalizeScanUrl(page.url());
      await policy.assertAllowed(finalUrl);

      const documentTitle = await readBoundedDocumentTitle(page);
      const axeResults = await runAxe(page);

      try {
        return normalizeAxeResults(axeResults, {
          submittedUrl,
          finalUrl,
          documentTitle,
          scannedAt: startedAt.toISOString(),
          durationMs: Math.max(0, Math.round(performance.now() - startedTime)),
        });
      } catch (error) {
        throw new ScannerError(
          "SCAN_FAILED",
          "The accessibility results could not be normalized.",
          error,
        );
      }
    }, () => {
      overallTimeoutReached = true;
    });
  } catch (error) {
    if (error instanceof ScannerError) {
      throw error;
    }

    throw new ScannerError(
      "SCAN_FAILED",
      "The page scan failed unexpectedly.",
      error,
    );
  } finally {
    await closeQuietly(page);
    await closeQuietly(context);
    await closeQuietly(browser);
    releaseCapacity();
  }
}

async function installContextRequestPolicy(
  context: BrowserContext,
  policy: ReturnType<typeof createDestinationPolicy>,
  readMainPage: () => Page | undefined,
  recordBlockedMainRequest: (error: ScannerError) => void,
): Promise<(page: Page) => Promise<void>> {
  const pagePolicies = new WeakMap<Page, Promise<void>>();
  const ensurePageRequestPolicy = (page: Page): Promise<void> => {
    let installation = pagePolicies.get(page);

    if (installation === undefined) {
      installation = installPageRequestPolicy(page, policy, (error) => {
        if (page === readMainPage()) {
          recordBlockedMainRequest(error);
        }
      });
      pagePolicies.set(page, installation);
    }

    return installation;
  };

  context.on("page", (openedPage) => {
    void ensurePageRequestPolicy(openedPage).catch(() => {
      // A popup can close before its request guard finishes installing.
    });
  });

  await context.route(
    (url) => url.protocol === "http:" || url.protocol === "https:",
    async (route, request) => {
      try {
        await policy.assertAllowed(request.url());
      } catch (error) {
        const scannerError = asBlockedRequestError(error);

        if (isMainPageNavigation(request, readMainPage())) {
          recordBlockedMainRequest(scannerError);
        }

        await abortQuietly(route);
        return;
      }

      if (request.isNavigationRequest()) {
        const navigationPage = readNavigationPage(request);

        if (navigationPage === undefined) {
          await fulfillUnframedNavigation(route, request, policy);
          return;
        }

        try {
          await ensurePageRequestPolicy(navigationPage);
        } catch (error) {
          const scannerError = asBlockedRequestError(error);

          if (isMainPageNavigation(request, readMainPage())) {
            recordBlockedMainRequest(scannerError);
          }

          await abortQuietly(route);
          return;
        }
      }

      try {
        await route.continue();
      } catch {
        // The scan may have timed out and closed the context while DNS was pending.
      }
    },
  );

  await context.routeWebSocket(/^wss?:\/\//i, async (webSocket) => {
    try {
      await policy.assertAllowed(webSocket.url());
    } catch {
      await closeWebSocketQuietly(webSocket);
      return;
    }

    webSocket.connectToServer();
  });

  return ensurePageRequestPolicy;
}

function readNavigationPage(request: Request): Page | undefined {
  try {
    return request.frame().page();
  } catch {
    return undefined;
  }
}

async function fulfillUnframedNavigation(
  route: Route,
  request: Request,
  policy: ReturnType<typeof createDestinationPolicy>,
): Promise<void> {
  const maximumRedirects = 20;
  let currentUrl = request.url();

  try {
    let response = await route.fetch({ maxRedirects: 0 });

    for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount += 1) {
      const location = response.headers().location;

      if (!isRedirectStatus(response.status()) || location === undefined) {
        await route.fulfill({ response });
        return;
      }

      if (redirectCount === maximumRedirects) {
        await abortQuietly(route);
        return;
      }

      currentUrl = new URL(location, currentUrl).href;
      await policy.assertAllowed(currentUrl);
      response = await route.fetch({ url: currentUrl, maxRedirects: 0 });
    }
  } catch {
    await abortQuietly(route);
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

interface PausedRequest {
  requestId: string;
  frameId: string;
  resourceType: string;
  request: { url: string };
}

async function installPageRequestPolicy(
  page: Page,
  policy: ReturnType<typeof createDestinationPolicy>,
  recordBlockedMainRequest: (error: ScannerError) => void,
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const frameTree = (await session.send("Page.getFrameTree")) as {
    frameTree: { frame: { id: string } };
  };
  const mainFrameId = frameTree.frameTree.frame.id;

  session.on("Fetch.requestPaused", (event: PausedRequest) => {
    void handlePausedRequest(
      session,
      event,
      mainFrameId,
      policy,
      recordBlockedMainRequest,
    );
  });

  await session.send("Fetch.enable", {
    patterns: [
      { urlPattern: "http://*", requestStage: "Request" },
      { urlPattern: "https://*", requestStage: "Request" },
    ],
  });
}

async function handlePausedRequest(
  session: CDPSession,
  event: PausedRequest,
  mainFrameId: string,
  policy: ReturnType<typeof createDestinationPolicy>,
  recordBlockedMainRequest: (error: ScannerError) => void,
): Promise<void> {
  try {
    await policy.assertAllowed(event.request.url);
    await session.send("Fetch.continueRequest", { requestId: event.requestId });
  } catch (error) {
    const scannerError = asBlockedRequestError(error);

    if (event.resourceType === "Document" && event.frameId === mainFrameId) {
      recordBlockedMainRequest(scannerError);
    }

    try {
      await session.send("Fetch.failRequest", {
        requestId: event.requestId,
        errorReason: "BlockedByClient",
      });
    } catch {
      // The page may have closed while DNS resolution was pending.
    }
  }
}

function asBlockedRequestError(error: unknown): ScannerError {
  return error instanceof ScannerError
    ? error
    : new ScannerError(
        "BLOCKED_TARGET",
        "A browser request was blocked by the destination policy.",
        error,
      );
}

function isMainPageNavigation(
  request: Request,
  mainPage: Page | undefined,
): boolean {
  if (mainPage === undefined || !request.isNavigationRequest()) {
    return false;
  }

  try {
    return request.frame() === mainPage.mainFrame();
  } catch {
    return false;
  }
}

async function abortQuietly(route: Route): Promise<void> {
  try {
    await route.abort("blockedbyclient");
  } catch {
    // The context may already be closing after a timeout or navigation failure.
  }
}

async function closeWebSocketQuietly(webSocket: WebSocketRoute): Promise<void> {
  try {
    await webSocket.close({ code: 1008, reason: "Blocked by destination policy" });
  } catch {
    // The context may already be closing after a timeout or navigation failure.
  }
}

function validateTimeout(
  input: number | undefined,
  fallback: number,
  maximum: number,
  optionName: string,
): number {
  const timeout = input ?? fallback;

  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > maximum) {
    throw new ScannerError(
      "INVALID_INPUT",
      `${optionName} must be a positive finite number no greater than ${maximum}.`,
    );
  }

  return timeout;
}

async function navigate(
  page: Page,
  url: string,
  timeout: number,
  readBlockedMainRequest: () => ScannerError | undefined,
): Promise<void> {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });
  } catch (error) {
    const blockedRequest = readBlockedMainRequest();

    if (blockedRequest !== undefined) {
      throw blockedRequest;
    }

    if (error instanceof playwrightErrors.TimeoutError) {
      throw new ScannerError(
        "NAVIGATION_TIMEOUT",
        `Navigation exceeded the ${timeout} ms timeout.`,
        error,
      );
    }

    throw new ScannerError(
      "NAVIGATION_FAILED",
      "The page could not be reached or loaded.",
      error,
    );
  }
}

async function runAxe(page: Page): Promise<unknown> {
  try {
    await page.evaluate(axe.source);

    return await page.evaluate(async () => {
      const axeApi = (
        globalThis as typeof globalThis & {
          axe?: { run(root: Document): Promise<unknown> };
        }
      ).axe;

      if (axeApi === undefined) {
        throw new Error("axe-core was not available in the page context.");
      }

      return axeApi.run(document);
    });
  } catch (error) {
    throw new ScannerError(
      "AXE_EXECUTION_FAILED",
      "axe-core could not analyze the captured page state.",
      error,
    );
  }
}

async function readBoundedDocumentTitle(page: Page): Promise<string> {
  return page.evaluate(
    (maximumLength) => document.title.slice(0, maximumLength + 1),
    reportLimits.documentTitleLength,
  );
}

async function withOverallTimeout<T>(
  timeoutMs: number,
  operation: () => Promise<T>,
  onTimeout: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(
        new ScannerError(
          "SCAN_TIMEOUT",
          `The overall scan exceeded ${timeoutMs} ms.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function closeLateResource(
  resource: Page | BrowserContext | Browser,
  isTimedOut: () => boolean,
): Promise<void> {
  if (isTimedOut()) {
    await closeQuietly(resource);
    throw new ScannerError("SCAN_TIMEOUT", "The overall scan deadline has passed.");
  }
}

function throwIfOverallTimeout(isTimedOut: boolean): void {
  if (isTimedOut) {
    throw new ScannerError("SCAN_TIMEOUT", "The overall scan deadline has passed.");
  }
}

async function closeQuietly(
  resource: Page | BrowserContext | Browser | undefined,
): Promise<void> {
  try {
    if (resource === undefined) {
      return;
    }

    const closePromise = resource.close();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        closePromise,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 5_000);
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  } catch {
    // Continue closing outer resources and preserve the primary scan outcome.
  }
}
