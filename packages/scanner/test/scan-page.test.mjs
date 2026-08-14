import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { errors as playwrightErrors } from "playwright";

import { ScannerError, scanPage } from "../dist/index.js";
import { createScanCapacityLimiter } from "../dist/capacity.js";
import { scanPageWithDependencies } from "../dist/scan-page.js";
import {
  scanTrustedLocalFixture,
  trustedLocalFixtureMarker,
} from "../dist/internal-test-support.js";
import { startFixtureServer } from "./fixture-server.mjs";

let fixtureServer;

before(async () => {
  fixtureServer = await startFixtureServer();
});

after(async () => {
  await fixtureServer.close();
});

function scanFixture(pathname, options) {
  return scanTrustedLocalFixture(
    fixtureServer.url(pathname),
    fixtureServer.origin,
    trustedLocalFixtureMarker,
    options,
  );
}

test("production defaults reject loopback before launching Chromium", async () => {
  await assert.rejects(
    scanPage(fixtureServer.url("/baseline")),
    (error) => error instanceof ScannerError && error.code === "BLOCKED_TARGET",
  );
});

test("the loopback helper requires its explicit marker", () => {
  assert.throws(
    () => scanTrustedLocalFixture(
      fixtureServer.url("/baseline"),
      fixtureServer.origin,
      "not-the-marker",
    ),
    /explicit test marker/,
  );
});

test("scans a local fixture only through the exact-origin test seam", async () => {
  const submittedUrl = fixtureServer.url("/baseline");
  const report = await scanFixture("/baseline");

  assert.equal(report.metadata.submittedUrl, submittedUrl);
  assert.equal(report.metadata.finalUrl, submittedUrl);
  assert.equal(report.metadata.documentTitle, "Baseline fixture");
  assert.match(report.metadata.scannedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(report.metadata.durationMs >= 0);
  assert.equal(report.summary.violatedRuleCount, report.violations.length);
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});

test("normalizes real axe findings without raw axe structures", async () => {
  const report = await scanFixture("/missing-alt");
  const violation = report.violations.find(({ ruleId }) => ruleId === "image-alt");

  assert.ok(violation);
  assert.equal(violation.totalNodeCount, 1);
  assert.equal(violation.nodes.length, 1);
  assert.equal(violation.nodes[0].target[0], "img");
  assert.equal("passes" in report, false);
  assert.equal("any" in violation.nodes[0], false);
  assert.ok(violation.helpUrl?.startsWith("https://dequeuniversity.com/"));
  assert.equal(violation.guidance.status, "CURATED");
});

test("keeps axe coverage working with CSP and focused fixtures", async () => {
  const cspReport = await scanFixture("/restrictive-csp");
  const inputReport = await scanFixture("/unlabeled-input");
  const languageReport = await scanFixture("/missing-lang");

  assert.ok(cspReport.violations.some(({ ruleId }) => ruleId === "image-alt"));
  assert.ok(inputReport.violations.some(({ ruleId }) => ruleId === "label"));
  assert.ok(languageReport.violations.some(({ ruleId }) => ruleId === "html-has-lang"));
});

test("preserves transparent rule and affected-element counts", async () => {
  const report = await scanFixture("/multiple");
  const ruleIds = new Set(report.violations.map(({ ruleId }) => ruleId));
  const affectedElementCount = report.violations.reduce(
    (count, violation) => count + violation.totalNodeCount,
    0,
  );

  assert.ok(ruleIds.has("image-alt"));
  assert.ok(ruleIds.has("label"));
  assert.ok(ruleIds.has("html-has-lang"));
  assert.equal(ruleIds.size, report.violations.length);
  assert.equal(report.summary.affectedElementCount, affectedElementCount);
});

test("allows same-origin redirects but blocks a redirect to a prohibited origin", async () => {
  const allowed = await scanFixture("/redirect");
  assert.equal(allowed.metadata.finalUrl, fixtureServer.url("/missing-alt"));

  const blockedServer = await startFixtureServer();
  try {
    const target = blockedServer.url("/baseline");
    const path = `/redirect-to?url=${encodeURIComponent(target)}`;
    await assert.rejects(
      scanFixture(path),
      (error) => error instanceof ScannerError && error.code === "BLOCKED_TARGET",
    );
    assert.equal(blockedServer.requestCount("/baseline"), 0);
  } finally {
    await blockedServer.close();
  }
});

test("blocks prohibited subresources before they reach a local server", async () => {
  const blockedServer = await startFixtureServer();
  try {
    const path = `/subresource?url=${encodeURIComponent(blockedServer.url("/probe.png"))}`;
    const report = await scanFixture(path);

    assert.equal(report.metadata.documentTitle, "Subresource fixture");
    assert.equal(blockedServer.requestCount("/probe.png"), 0);
  } finally {
    await blockedServer.close();
  }
});

test("reports typed navigation and overall timeouts", async () => {
  await assert.rejects(
    scanFixture("/hang", { navigationTimeoutMs: 100 }),
    (error) => error instanceof ScannerError && error.code === "NAVIGATION_TIMEOUT",
  );

  const events = [];
  const browser = createFakeBrowser(events, "hang-axe");
  await assert.rejects(
    scanWithFakeBrowser(browser, { overallTimeoutMs: 25 }),
    (error) => error instanceof ScannerError && error.code === "SCAN_TIMEOUT",
  );
  assert.deepEqual(events.slice(-3), ["page.close", "context.close", "browser.close"]);
});

test("reports a typed navigation failure", async () => {
  await assert.rejects(
    scanFixture("/disconnect"),
    (error) => error instanceof ScannerError && error.code === "NAVIGATION_FAILED",
  );
});

test("rejects unusable inputs before launching Chromium", async () => {
  let launchCount = 0;
  await assert.rejects(
    scanPageWithDependencies("file:///tmp/fixture.html", {}, {
      async launchBrowser() {
        launchCount += 1;
        throw new Error("must not launch");
      },
    }),
    (error) => error instanceof ScannerError && error.code === "INVALID_INPUT",
  );
  assert.equal(launchCount, 0);

  for (const options of [
    { navigationTimeoutMs: 30_001 },
    { overallTimeoutMs: 60_001 },
  ]) {
    await assert.rejects(
      scanPageWithDependencies("https://fixture.test/page", options, {
        async launchBrowser() {
          launchCount += 1;
          throw new Error("must not launch");
        },
      }),
      (error) => error instanceof ScannerError && error.code === "INVALID_INPUT",
    );
  }
  assert.equal(launchCount, 0);
});

test("closes every browser layer after success and failure", async () => {
  for (const failure of [undefined, "navigation", "axe"]) {
    const events = [];
    const browser = createFakeBrowser(events, failure);

    if (failure === undefined) {
      const report = await scanWithFakeBrowser(browser);
      assert.equal(report.summary.violatedRuleCount, 0);
      assert.deepEqual(events.contextOptions, {
        acceptDownloads: false,
        serviceWorkers: "block",
      });
    } else {
      await assert.rejects(scanWithFakeBrowser(browser), (error) => {
        const expected = failure === "navigation" ? "NAVIGATION_TIMEOUT" : "AXE_EXECUTION_FAILED";
        return error instanceof ScannerError && error.code === expected;
      });
    }

    assert.deepEqual(events.slice(-3), ["page.close", "context.close", "browser.close"]);
  }
});

test("enforces fail-fast in-process capacity without a wait queue", async () => {
  const capacity = createScanCapacityLimiter(1);
  let releaseNavigation;
  const navigationGate = new Promise((resolve) => {
    releaseNavigation = resolve;
  });
  const first = scanWithFakeBrowser(createFakeBrowser([], "held-navigation", navigationGate), {}, capacity);

  await assert.rejects(
    scanWithFakeBrowser(createFakeBrowser([]), {}, capacity),
    (error) => error instanceof ScannerError && error.code === "CAPACITY_EXCEEDED",
  );

  releaseNavigation();
  await first;
  await scanWithFakeBrowser(createFakeBrowser([]), {}, capacity);
});

function scanWithFakeBrowser(browser, options = {}, capacity) {
  return scanPageWithDependencies("https://fixture.test/page", options, {
    async launchBrowser() {
      return browser;
    },
    async resolveHostname() {
      return [{ address: "93.184.216.34", family: 4 }];
    },
    ...(capacity === undefined ? {} : { capacity }),
  });
}

function createFakeBrowser(events, failure, navigationGate) {
  let routeHandler;
  let evaluationCount = 0;
  const page = {
    async goto() {
      events.push("page.goto");
      if (failure === "navigation") {
        throw new playwrightErrors.TimeoutError("fixture timeout");
      }
      if (failure === "held-navigation") {
        await navigationGate;
      }
    },
    url() {
      return "https://fixture.test/page";
    },
    mainFrame() {
      return page;
    },
    async evaluate(_expression, argument) {
      events.push("page.evaluate");
      evaluationCount += 1;
      if (argument !== undefined) {
        return "Fake fixture";
      }
      if (failure === "axe") {
        throw new Error("fixture axe failure");
      }
      if (failure === "hang-axe" && evaluationCount === 2) {
        return new Promise(() => {});
      }
      return evaluationCount === 1 ? undefined : { violations: [] };
    },
    async close() {
      events.push("page.close");
    },
  };
  const context = {
    async newPage() {
      events.push("context.newPage");
      return page;
    },
    async newCDPSession() {
      events.push("context.newCDPSession");
      return {
        on(_event, handler) {
          routeHandler = handler;
        },
        async send(method) {
          if (method === "Page.getFrameTree") {
            return { frameTree: { frame: { id: "main" } } };
          }
          return {};
        },
      };
    },
    async close() {
      events.push("context.close");
    },
  };

  return {
    get routeHandler() {
      return routeHandler;
    },
    async newContext(options) {
      events.push("browser.newContext");
      events.contextOptions = options;
      return context;
    },
    async close() {
      events.push("browser.close");
    },
  };
}
