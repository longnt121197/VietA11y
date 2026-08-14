import axe from "axe-core";
import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

import { ScannerError } from "./errors.js";
import type { ScanReport } from "./model.js";
import { normalizeAxeResults } from "./normalize.js";

const defaultNavigationTimeoutMs = 30_000;

export interface ScanPageOptions {
  navigationTimeoutMs?: number;
}

type BrowserLauncher = () => Promise<Browser>;

export function scanPage(
  url: string,
  options: ScanPageOptions = {},
): Promise<ScanReport> {
  return scanPageWithBrowserLauncher(url, options, () =>
    chromium.launch({ headless: true }),
  );
}

/** @internal Exported from this module only so lifecycle behavior can be tested. */
export async function scanPageWithBrowserLauncher(
  url: string,
  options: ScanPageOptions,
  launchBrowser: BrowserLauncher,
): Promise<ScanReport> {
  const submittedUrl = validateUrl(url);
  const navigationTimeoutMs = validateNavigationTimeout(
    options.navigationTimeoutMs,
  );
  const startedAt = new Date();
  const startedTime = performance.now();

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    browser = await launchBrowser();
    context = await browser.newContext();
    page = await context.newPage();

    await navigate(page, submittedUrl, navigationTimeoutMs);

    const documentTitle = await page.title();
    const axeResults = await runAxe(page);

    try {
      return normalizeAxeResults(axeResults, {
        submittedUrl,
        finalUrl: page.url(),
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
  }
}

function validateUrl(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new ScannerError(
      "INVALID_INPUT",
      "A non-empty absolute HTTP or HTTPS URL is required.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch (error) {
    throw new ScannerError(
      "INVALID_INPUT",
      "A non-empty absolute HTTP or HTTPS URL is required.",
      error,
    );
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.hostname.length === 0
  ) {
    throw new ScannerError(
      "INVALID_INPUT",
      "A non-empty absolute HTTP or HTTPS URL is required.",
    );
  }

  return input;
}

function validateNavigationTimeout(input: number | undefined): number {
  const timeout = input ?? defaultNavigationTimeoutMs;

  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new ScannerError(
      "INVALID_INPUT",
      "navigationTimeoutMs must be a positive finite number.",
    );
  }

  return timeout;
}

async function navigate(
  page: Page,
  url: string,
  timeout: number,
): Promise<void> {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });
  } catch (error) {
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
    await page.addScriptTag({ content: axe.source });

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

async function closeQuietly(
  resource: Page | BrowserContext | Browser | undefined,
): Promise<void> {
  try {
    await resource?.close();
  } catch {
    // Continue closing outer resources and preserve the primary scan outcome.
  }
}
