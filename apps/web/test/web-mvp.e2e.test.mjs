import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { startFixtureServer } from "../../../packages/scanner/test/fixture-server.mjs";
import {
  scanTrustedLocalFixture,
  trustedLocalFixtureMarker,
} from "../../../packages/scanner/test/scan-trusted-local-fixture.mjs";

const requireFromWeb = createRequire(import.meta.url);
const requireFromScanner = createRequire(
  new URL("../../../packages/scanner/package.json", import.meta.url),
);
const { chromium } = requireFromScanner("playwright");
const axe = requireFromScanner("axe-core");
const webRoot = fileURLToPath(new URL("..", import.meta.url));

test(
  "Web MVP completes the keyboard-driven browser-to-report flow",
  { timeout: 120_000 },
  async () => {
    let fixtureServer;
    let appServer;
    let browser;
    let releaseScanRequest = () => {};

    try {
      fixtureServer = await startFixtureServer();
      appServer = await startNextServer();
      browser = await chromium.launch({ headless: true });

      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });

      await page.goto(appServer.url, { waitUntil: "domcontentloaded" });

      await assertVisible(page.getByRole("heading", { name: "VietA11y", exact: true }));

      const urlInput = page.getByLabel("URL trang cần quét", { exact: true });
      await assertVisible(urlInput);
      assert.equal(await urlInput.getAttribute("id"), "scan-url");
      await assertNoAxeViolations(page, "initial page");

      await urlInput.focus();
      await urlInput.fill("not-a-url");
      await urlInput.press("Enter");

      const validationError = page.locator("#scan-error");
      await assertVisible(validationError);
      assert.match(await validationError.innerText(), /URL đầy đủ và hợp lệ/);
      assert.equal(await urlInput.getAttribute("aria-invalid"), "true");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "scan-url");

      let responseMode = "invalid-input";
      let interceptedRequest;
      let markRequestIntercepted;
      const requestIntercepted = new Promise((resolve) => {
        markRequestIntercepted = resolve;
      });
      const holdRequest = new Promise((resolve) => {
        releaseScanRequest = resolve;
      });

      await page.route("**/api/scans", async (route) => {
        interceptedRequest = route.request();

        if (responseMode === "invalid-input") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "INVALID_INPUT",
                message: "URL thử nghiệm không đáp ứng giới hạn của máy chủ.",
              },
            }),
          });
          return;
        }

        if (responseMode === "scan-failed") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "SCAN_FAILED",
                message: "Không thể hoàn tất lần quét do lỗi máy chủ.",
              },
            }),
          });
          return;
        }

        markRequestIntercepted();
        await holdRequest;
        const requestBody = route.request().postDataJSON();
        const report = await scanTrustedLocalFixture(
          requestBody.url,
          fixtureServer.origin,
          trustedLocalFixtureMarker,
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ report }),
        });
      });

      const serverRejectedValue = "https://example.test/server-rejected";
      await urlInput.fill(serverRejectedValue);
      await urlInput.press("Enter");

      const serverValidationError = page.locator("#scan-error");
      await assertVisible(serverValidationError);
      assert.match(await serverValidationError.innerText(), /giới hạn của máy chủ/);
      assert.equal(await urlInput.getAttribute("aria-invalid"), "true");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "scan-url");
      assert.equal(await urlInput.inputValue(), serverRejectedValue);

      responseMode = "scan-failed";
      await urlInput.fill(fixtureServer.url("/web-e2e"));
      await urlInput.press("Enter");

      const scanFailure = page.locator("#scan-error");
      await assertVisible(scanFailure);
      assert.match(await scanFailure.innerText(), /lỗi máy chủ/);
      assert.equal(
        await page.getByText(/Không phát hiện vi phạm tự động/).count(),
        0,
      );

      responseMode = "success";
      await urlInput.fill(fixtureServer.url("/web-e2e"));
      await urlInput.press("Tab");

      const submitButton = page.getByRole("button", { name: "Quét trang" });
      assert.equal(
        await submitButton.evaluate((element) => element === document.activeElement),
        true,
      );

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/scans") &&
          response.request().method() === "POST",
      );

      await submitButton.press("Enter");
      await requestIntercepted;

      assert.equal(interceptedRequest.method(), "POST");
      assert.deepEqual(interceptedRequest.postDataJSON(), {
        url: fixtureServer.url("/web-e2e"),
      });
      await assertVisible(page.getByRole("status"));
      assert.match(await page.getByRole("status").innerText(), /đang tải trang/i);

      releaseScanRequest();
      const apiResponse = await responsePromise;
      const apiBody = await apiResponse.json();
      assert.equal(apiResponse.status(), 200, JSON.stringify(apiBody));
      const { report } = apiBody;

      const reportHeading = page.getByRole("heading", {
        name: "Kết quả quét",
        exact: true,
      });
      await assertVisible(reportHeading);
      assert.equal(
        await reportHeading.evaluate((element) => element === document.activeElement),
        true,
      );

      assert.ok(report.violations.some(({ ruleId }) => ruleId === "image-alt"));
      assert.notEqual(
        report.summary.violatedRuleCount,
        report.summary.affectedElementCount,
      );
      assert.equal(
        await readDefinitionValue(page, "Quy tắc phát hiện vi phạm"),
        String(report.summary.violatedRuleCount),
      );
      assert.equal(
        await readDefinitionValue(page, "Lượt phần tử bị ảnh hưởng"),
        String(report.summary.affectedElementCount),
      );
      await assertVisible(
        page.getByText(/không phải số phần tử duy nhất trên trang/i),
      );

      await assertVisible(page.getByText("Hướng dẫn tiếng Việt đã biên soạn").first());
      assert.ok(
        report.violations.some(({ guidance }) => guidance.status === "UNAVAILABLE"),
      );
      await assertVisible(
        page.getByRole("heading", { name: "Hướng dẫn tiếng Việt: Chưa có" }).first(),
      );

      const imageAltCard = page.locator("article").filter({
        has: page.locator("code", { hasText: "image-alt" }),
      });
      await imageAltCard.locator("summary").first().click();
      const htmlExcerpt = imageAltCard.locator("pre").filter({
        hasText: '<img id="unsafe-excerpt"',
      });
      await assertVisible(htmlExcerpt);
      assert.equal(await page.locator("#unsafe-excerpt").count(), 0);
      assert.equal(await page.locator("#interpreted-probe").count(), 0);

      await assertVisible(page.getByText("Giới hạn của kiểm tra tự động:", { exact: true }));
      await assertVisible(page.getByText(/không chứng minh trang tuân thủ đầy đủ WCAG/i));

      await reportHeading.focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => {
          const reportSection = document.querySelector('[aria-labelledby="report-title"]');
          return (
            document.activeElement !== document.body &&
            reportSection?.contains(document.activeElement) === true
          );
        }),
        true,
      );

      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        true,
      );
      await assertNoAxeViolations(page, "successful report");
    } finally {
      releaseScanRequest();
      const cleanupResults = await Promise.allSettled([
        browser?.close(),
        appServer?.close(),
        fixtureServer?.close(),
      ]);
      const cleanupErrors = cleanupResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);

      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "E2E process cleanup failed");
      }
    }
  },
);

function secondScanReport(ruleId) {
  return {
    metadata: {
      submittedUrl: "https://fixture.test/second",
      finalUrl: "https://fixture.test/second",
      documentTitle: "Second scan fixture",
      scannedAt: "2026-08-18T10:00:00.000Z",
      durationMs: 21,
    },
    summary: {
      violatedRuleCount: 1,
      affectedElementCount: 1,
      impactDistribution: {
        minor: 0, moderate: 0, serious: 0, critical: 1, unknown: 0,
      },
    },
    violations: [
      {
        ruleId,
        impact: "critical",
        help: "Ảnh phải có văn bản thay thế",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
        wcagReferences: [],
        totalNodeCount: 1,
        nodes: [{ target: ["img"], html: "<img />" }],
        guidance: { status: "UNAVAILABLE" },
      },
    ],
    warnings: [],
  };
}

test(
  "A second scan clears the previous report and moves focus to the new outcome",
  { timeout: 120_000 },
  async () => {
    let appServer;
    let browser;
    let releaseSecondScan = () => {};

    try {
      appServer = await startNextServer();
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

      let scanCount = 0;
      let markSecondScanStarted;
      const secondScanStarted = new Promise((resolve) => {
        markSecondScanStarted = resolve;
      });
      const holdSecondScan = new Promise((resolve) => {
        releaseSecondScan = resolve;
      });

      await page.route("**/api/scans", async (route) => {
        scanCount += 1;

        if (scanCount === 1) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ report: secondScanReport("image-alt") }),
          });
          return;
        }

        // Hold the second request open so the in-progress state is observable
        // rather than raced past.
        markSecondScanStarted();
        await holdSecondScan;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "SCAN_FAILED",
              message: "Không thể hoàn tất lần quét do lỗi máy chủ.",
            },
          }),
        });
      });

      await page.goto(appServer.url, { waitUntil: "domcontentloaded" });

      const urlInput = page.getByLabel("URL trang cần quét", { exact: true });
      const reportHeading = page.getByRole("heading", { name: "Kết quả quét", exact: true });
      const firstResult = page.locator("code", { hasText: "image-alt" });

      // --- first scan: succeeds, focus lands on the report heading ---
      await urlInput.fill("https://fixture.test/first");
      await urlInput.press("Enter");

      await assertVisible(reportHeading);
      await assertVisible(firstResult.first());
      assert.equal(
        await reportHeading.evaluate((element) => element === document.activeElement),
        true,
        "the first report heading should take focus",
      );

      // --- second scan: submitted from the keyboard while a report is shown ---
      await urlInput.focus();
      await urlInput.fill("https://fixture.test/second");
      await urlInput.press("Enter");
      await secondScanStarted;

      // Stale results must not linger next to a running scan.
      await assertVisible(page.getByRole("status"));
      assert.equal(
        await reportHeading.count(),
        0,
        "the previous report must be cleared while the next scan runs",
      );
      assert.equal(await firstResult.count(), 0);

      // --- the second scan fails: focus moves to the error, not back to a report ---
      releaseSecondScan();

      const scanError = page.locator("#scan-error");
      await assertVisible(scanError);
      assert.match(await scanError.innerText(), /lỗi máy chủ/);
      assert.equal(
        await scanError.evaluate((element) => element === document.activeElement),
        true,
        "the newest outcome should receive focus, so a screen reader announces it",
      );
      assert.equal(await reportHeading.count(), 0);

      // The flow is still keyboard operable afterwards. The alert is the last
      // node in the form, so Shift+Tab is the way back to the controls -- it
      // must land on the submit button, not somewhere outside the form.
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Quét trang",
        "Shift+Tab from the alert should return to the submit button",
      );

      // And the input can still be edited for a retry.
      await urlInput.focus();
      await urlInput.fill("https://fixture.test/third");
      assert.equal(await urlInput.inputValue(), "https://fixture.test/third");

      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        true,
      );
      await assertNoAxeViolations(page, "second scan failed");
    } finally {
      releaseSecondScan();
      const cleanupResults = await Promise.allSettled([browser?.close(), appServer?.close()]);
      const cleanupErrors = cleanupResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);

      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "E2E process cleanup failed");
      }
    }
  },
);

const UNSAFE_HELP_URL = "javascript:alert('axe')";
const SAFE_HELP_URL = "https://dequeuniversity.com/rules/axe/4.10/image-alt";

function helpUrlReport() {
  const node = (selector) => ({ target: [selector], html: `<${selector} />` });
  return {
    metadata: {
      submittedUrl: "https://fixture.test/help-urls",
      finalUrl: "https://fixture.test/help-urls",
      documentTitle: "Help URL fixture",
      scannedAt: "2026-08-18T10:00:00.000Z",
      durationMs: 12,
    },
    summary: {
      violatedRuleCount: 2,
      affectedElementCount: 2,
      impactDistribution: {
        minor: 0, moderate: 0, serious: 1, critical: 1, unknown: 0,
      },
    },
    violations: [
      {
        ruleId: "image-alt",
        impact: "critical",
        help: "Ảnh phải có văn bản thay thế",
        helpUrl: SAFE_HELP_URL,
        wcagReferences: [],
        totalNodeCount: 1,
        nodes: [node("img")],
        guidance: { status: "UNAVAILABLE" },
      },
      {
        ruleId: "unsafe-reference-fixture",
        impact: "serious",
        help: "Tham chiếu không dùng lược đồ HTTP",
        helpUrl: UNSAFE_HELP_URL,
        wcagReferences: [],
        totalNodeCount: 1,
        nodes: [node("main")],
        guidance: { status: "UNAVAILABLE" },
      },
    ],
    warnings: [],
  };
}

test(
  "Report links only HTTP(S) axe references and shows other schemes as inert text",
  { timeout: 120_000 },
  async () => {
    let appServer;
    let browser;

    try {
      appServer = await startNextServer();
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

      // The report is served straight from the route handler. The point of this
      // test is the rendering boundary, so the scanner is deliberately not
      // involved and nothing outside the app is ever contacted.
      await page.route("**/api/scans", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ report: helpUrlReport() }),
        });
      });

      await page.goto(appServer.url, { waitUntil: "domcontentloaded" });

      const urlInput = page.getByLabel("URL trang cần quét", { exact: true });
      await urlInput.fill("https://fixture.test/help-urls");
      await urlInput.press("Enter");

      await assertVisible(
        page.getByRole("heading", { name: "Kết quả quét", exact: true }),
      );

      const safeCard = page.locator("article").filter({
        has: page.locator("code", { hasText: "image-alt" }),
      });
      const unsafeCard = page.locator("article").filter({
        has: page.locator("code", { hasText: "unsafe-reference-fixture" }),
      });

      // The valid HTTPS reference stays a real, reachable link.
      const safeLink = safeCard.getByRole("link", { name: /tài liệu chính thức của axe/i });
      await assertVisible(safeLink);
      assert.equal(await safeLink.getAttribute("href"), SAFE_HELP_URL);

      // The javascript: reference must not become a link in any form...
      assert.equal(await unsafeCard.getByRole("link").count(), 0);
      assert.equal(
        await page.locator(`a[href^="javascript:"]`).count(),
        0,
        "a javascript: URL must never reach an href",
      );

      // ...and must still be visible to the reader as plain text.
      const inertText = unsafeCard.getByText(/không có URL HTTP\/HTTPS hợp lệ/);
      await assertVisible(inertText);
      assert.ok(
        (await inertText.innerText()).includes(UNSAFE_HELP_URL),
        "the rejected value should stay legible rather than being dropped",
      );

      // The link that does exist remains keyboard reachable.
      await safeLink.focus();
      assert.equal(
        await safeLink.evaluate((element) => element === document.activeElement),
        true,
      );

      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        true,
      );
      await assertNoAxeViolations(page, "report with a rejected help URL");
    } finally {
      const cleanupResults = await Promise.allSettled([browser?.close(), appServer?.close()]);
      const cleanupErrors = cleanupResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);

      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "E2E process cleanup failed");
      }
    }
  },
);

async function assertVisible(locator) {
  await locator.waitFor({ state: "visible" });
  assert.equal(await locator.isVisible(), true);
}

async function assertNoAxeViolations(page, stateName) {
  await page.evaluate(axe.source);
  const results = await page.evaluate(async () => globalThis.axe.run(document));
  assert.deepEqual(
    results.violations.map(({ id }) => id),
    [],
    `${stateName} has automated axe violations: ${JSON.stringify(
      results.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map(({ target }) => target),
      })),
    )}`,
  );
}

async function readDefinitionValue(page, label) {
  const term = page.locator("dt", { hasText: label }).filter({ hasText: label }).first();
  return term.evaluate((element) => element.nextElementSibling?.textContent?.trim());
}

async function startNextServer() {
  const port = await allocatePort();
  const nextBin = requireFromWeb.resolve("next/dist/bin/next");
  const logs = [];
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: path.resolve(webRoot),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  const url = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(url, child, logs);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    url,
    async close() {
      await stopChild(child);
      assert.equal(
        child.exitCode !== null || child.signalCode !== null,
        true,
        "Next.js process did not exit",
      );
    },
  };
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not allocate a local port for the Next.js fixture.");
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${logs.join("")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The local server has not bound its port yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Next.js did not become ready.\n${logs.join("")}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  const exitPromise = new Promise((resolve) => child.once("exit", () => resolve(true)));
  child.kill();
  const exited = await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!exited) {
    const forcedExit = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGKILL");
    await forcedExit;
  }
}
