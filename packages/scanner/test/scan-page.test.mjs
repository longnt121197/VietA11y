import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { errors as playwrightErrors } from "playwright";

import { ScannerError, scanPage } from "../dist/index.js";
import { scanPageWithBrowserLauncher } from "../dist/scan-page.js";
import { startFixtureServer } from "./fixture-server.mjs";

let fixtureServer;

before(async () => {
  fixtureServer = await startFixtureServer();
});

after(async () => {
  await fixtureServer.close();
});

test("scans a local HTTP page with real axe-core output", async () => {
  const submittedUrl = fixtureServer.url("/baseline");
  const report = await scanPage(submittedUrl);

  assert.equal(report.metadata.submittedUrl, submittedUrl);
  assert.equal(report.metadata.finalUrl, submittedUrl);
  assert.equal(report.metadata.documentTitle, "Baseline fixture");
  assert.match(report.metadata.scannedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(report.metadata.durationMs >= 0);
  assert.equal(report.summary.violatedRuleCount, report.violations.length);
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});

test("normalizes the real axe image-alt violation without raw axe structures", async () => {
  const report = await scanPage(fixtureServer.url("/missing-alt"));
  const violation = report.violations.find(
    (candidate) => candidate.ruleId === "image-alt",
  );

  assert.ok(violation);
  assert.equal(violation.nodes.length, 1);
  assert.equal(violation.nodes[0].target[0], "img");
  assert.equal("passes" in report, false);
  assert.equal("any" in violation.nodes[0], false);
  assert.ok(violation.helpUrl?.startsWith("https://dequeuniversity.com/"));
});

test("injects axe-core on a page with a restrictive CSP", async () => {
  const report = await scanPage(fixtureServer.url("/restrictive-csp"));

  assert.equal(report.metadata.documentTitle, "Restrictive CSP fixture");
  assert.ok(
    report.violations.some(({ ruleId }) => ruleId === "image-alt"),
  );
});

test("detects the label and html language rules in focused fixtures", async () => {
  const [inputReport, languageReport] = await Promise.all([
    scanPage(fixtureServer.url("/unlabeled-input")),
    scanPage(fixtureServer.url("/missing-lang")),
  ]);

  assert.ok(inputReport.violations.some(({ ruleId }) => ruleId === "label"));
  assert.ok(
    languageReport.violations.some(({ ruleId }) => ruleId === "html-has-lang"),
  );
});

test("keeps multiple violations distinct and reports transparent counts", async () => {
  const report = await scanPage(fixtureServer.url("/multiple"));
  const ruleIds = new Set(report.violations.map(({ ruleId }) => ruleId));
  const affectedElementCount = report.violations.reduce(
    (count, violation) => count + violation.nodes.length,
    0,
  );

  assert.ok(ruleIds.has("image-alt"));
  assert.ok(ruleIds.has("label"));
  assert.ok(ruleIds.has("html-has-lang"));
  assert.equal(ruleIds.size, report.violations.length);
  assert.equal(report.summary.violatedRuleCount, report.violations.length);
  assert.equal(report.summary.affectedElementCount, affectedElementCount);
});

test("records the final URL after navigation redirects", async () => {
  const submittedUrl = fixtureServer.url("/redirect");
  const report = await scanPage(submittedUrl);

  assert.equal(report.metadata.submittedUrl, submittedUrl);
  assert.equal(report.metadata.finalUrl, fixtureServer.url("/missing-alt"));
  assert.equal(report.metadata.documentTitle, "Missing alt fixture");
});

test("reports a typed timeout for bounded navigation", async () => {
  await assert.rejects(
    scanPage(fixtureServer.url("/hang"), { navigationTimeoutMs: 100 }),
    (error) =>
      error instanceof ScannerError && error.code === "NAVIGATION_TIMEOUT",
  );
});

test("reports a typed navigation failure", async () => {
  await assert.rejects(
    scanPage(fixtureServer.url("/disconnect")),
    (error) =>
      error instanceof ScannerError && error.code === "NAVIGATION_FAILED",
  );
});

test("rejects unusable inputs before launching Chromium", async () => {
  let launchCount = 0;

  await assert.rejects(
    scanPageWithBrowserLauncher("file:///tmp/fixture.html", {}, async () => {
      launchCount += 1;
      throw new Error("must not launch");
    }),
    (error) => error instanceof ScannerError && error.code === "INVALID_INPUT",
  );
  assert.equal(launchCount, 0);
});

test("closes page, context, and browser after a successful scan", async () => {
  const events = [];
  const browser = createFakeBrowser(events);

  const report = await scanPageWithBrowserLauncher(
    "https://fixture.test/page",
    {},
    async () => browser,
  );

  assert.equal(report.summary.violatedRuleCount, 0);
  assert.deepEqual(events.slice(-3), ["page.close", "context.close", "browser.close"]);
});

test("attempts every cleanup layer after navigation and axe failures", async () => {
  for (const failure of ["navigation", "axe"]) {
    const events = [];
    const browser = createFakeBrowser(events, failure);

    await assert.rejects(
      scanPageWithBrowserLauncher(
        "https://fixture.test/page",
        {},
        async () => browser,
      ),
      (error) => {
        const expectedCode =
          failure === "navigation" ? "NAVIGATION_TIMEOUT" : "AXE_EXECUTION_FAILED";
        return error instanceof ScannerError && error.code === expectedCode;
      },
    );

    assert.deepEqual(events.slice(-3), [
      "page.close",
      "context.close",
      "browser.close",
    ]);
  }
});

function createFakeBrowser(events, failure) {
  const page = {
    async goto() {
      events.push("page.goto");
      if (failure === "navigation") {
        throw new playwrightErrors.TimeoutError("fixture timeout");
      }
    },
    async title() {
      return "Fake fixture";
    },
    url() {
      return "https://fixture.test/page";
    },
    async evaluate() {
      events.push("page.evaluate");
      if (failure === "axe") {
        throw new Error("fixture axe failure");
      }

      return { violations: [] };
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
    async close() {
      events.push("context.close");
    },
  };

  return {
    async newContext() {
      events.push("browser.newContext");
      return context;
    },
    async close() {
      events.push("browser.close");
    },
  };
}
