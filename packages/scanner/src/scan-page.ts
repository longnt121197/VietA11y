import axe from "axe-core";
import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
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

      page = await context.newPage();
      await closeLateResource(page, () => overallTimeoutReached);
      const cdpSession = await context.newCDPSession(page);
      await installRequestPolicy(
        cdpSession,
        policy,
        (error) => {
          blockedMainRequest ??= error;
        },
      );
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

interface PausedRequest {
  requestId: string;
  frameId: string;
  resourceType: string;
  request: { url: string };
}

async function installRequestPolicy(
  session: CDPSession,
  policy: ReturnType<typeof createDestinationPolicy>,
  recordBlockedMainRequest: (error: ScannerError) => void,
): Promise<void> {
  const frameTree = (await session.send("Page.getFrameTree")) as {
    frameTree: { frame: { id: string } };
  };
  const mainFrameId = frameTree.frameTree.frame.id;

  session.on("Fetch.requestPaused", (event: PausedRequest) => {
    void (async () => {
      try {
        await policy.assertAllowed(event.request.url);
        await session.send("Fetch.continueRequest", {
          requestId: event.requestId,
        });
      } catch (error) {
        const scannerError =
          error instanceof ScannerError
            ? error
            : new ScannerError(
                "BLOCKED_TARGET",
                "A browser request was blocked by the destination policy.",
                error,
              );

        if (event.resourceType === "Document" && event.frameId === mainFrameId) {
          recordBlockedMainRequest(scannerError);
        }

        try {
          await session.send("Fetch.failRequest", {
            requestId: event.requestId,
            errorReason: "BlockedByClient",
          });
        } catch {
          // The scan may have timed out and closed the page while DNS was pending.
        }
      }
    })();
  });

  await session.send("Fetch.enable", {
    patterns: [
      { urlPattern: "http://*", requestStage: "Request" },
      { urlPattern: "https://*", requestStage: "Request" },
    ],
  });

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
