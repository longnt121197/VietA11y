import { chromium } from "playwright";
import { isIP } from "node:net";

import type { ScanReport } from "./model.js";
import {
  scanPageWithDependencies,
  type ScanPageOptions,
} from "./scan-page.js";

const requiredTestMarker = "vieta11y-explicit-local-fixture";

/**
 * Test-only exact-origin seam. It is intentionally absent from the package root
 * and never accepts a request-controlled allowlist.
 */
export function scanTrustedLocalFixture(
  url: string,
  trustedOrigin: string,
  marker: string,
  options: ScanPageOptions = {},
): Promise<ScanReport> {
  if (marker !== requiredTestMarker) {
    throw new Error("The trusted local fixture seam requires its explicit test marker.");
  }

  const fixtureUrl = new URL(trustedOrigin);
  const hostname = fixtureUrl.hostname.replace(/^\[|\]$/g, "");

  if (
    fixtureUrl.origin !== trustedOrigin ||
    !(
      (isIP(hostname) === 4 && hostname.startsWith("127.")) ||
      (isIP(hostname) === 6 && hostname === "::1")
    )
  ) {
    throw new Error("The trusted test fixture must use one exact loopback origin.");
  }

  return scanPageWithDependencies(url, options, {
    launchBrowser: (timeoutMs) => chromium.launch({ headless: true, timeout: timeoutMs }),
    trustedTestOrigin: trustedOrigin,
  });
}

export const trustedLocalFixtureMarker = requiredTestMarker;
