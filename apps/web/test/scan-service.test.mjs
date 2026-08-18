import assert from "node:assert/strict";
import test from "node:test";

import { ScannerError } from "@vieta11y/scanner";

import {
  createInvalidJsonResult,
  createScanApiResult,
} from "../app/api/scans/scan-service.ts";

const report = {
  metadata: {
    submittedUrl: "https://example.test",
    finalUrl: "https://example.test/",
    documentTitle: "Fixture",
    scannedAt: "2026-08-14T12:00:00.000Z",
    durationMs: 42,
  },
  summary: {
    violatedRuleCount: 2,
    affectedElementCount: 2,
    impactDistribution: {
      minor: 0,
      moderate: 1,
      serious: 1,
      critical: 0,
      unknown: 0,
    },
  },
  violations: [
    {
      ruleId: "html-has-lang",
      impact: "serious",
      help: "The html element must have a lang attribute",
      helpUrl: "https://dequeuniversity.com/rules/axe/html-has-lang",
      wcagReferences: [{ standard: "WCAG", successCriterion: "3.1.1" }],
      totalNodeCount: 1,
      nodes: [{ target: ["html"], html: "<html>" }],
      guidance: {
        status: "CURATED",
        title: "Khai báo ngôn ngữ chính của trang",
        explanation: "Nội dung biên soạn.",
        whyItMatters: "Nội dung biên soạn.",
        remediation: "Nội dung biên soạn.",
      },
    },
    {
      ruleId: "future-rule",
      impact: "moderate",
      helpUrl: "https://example.test/axe-reference",
      wcagReferences: [],
      totalNodeCount: 1,
      nodes: [{ target: ["#fixture"] }],
      guidance: { status: "UNAVAILABLE" },
    },
  ],
  warnings: [],
};

test("rejects malformed request bodies without starting a scan", async () => {
  const invalidInputs = [
    undefined,
    null,
    [],
    {},
    { url: "" },
    { url: "   " },
    { url: 42 },
    { url: "https://example.test", extra: true },
    { url: "https://example.test", trustedOrigin: "http://127.0.0.1" },
  ];
  let callCount = 0;

  for (const input of invalidInputs) {
    const result = await createScanApiResult(input, async () => {
      callCount += 1;
      return report;
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_REQUEST");
  }

  assert.equal(callCount, 0);
  assert.equal(createInvalidJsonResult().status, 400);
});

test("production API cannot enable loopback through fixture environment variables", async () => {
  const originKey = "VIETA11Y_INTERNAL_TEST_FIXTURE_ORIGIN";
  const markerKey = "VIETA11Y_INTERNAL_TEST_FIXTURE_MARKER";
  const previousOrigin = process.env[originKey];
  const previousMarker = process.env[markerKey];

  process.env[originKey] = "http://127.0.0.1:4321";
  process.env[markerKey] = "vieta11y-explicit-local-fixture";

  try {
    const result = await createScanApiResult({ url: "http://127.0.0.1:4321/" });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "BLOCKED_TARGET");
  } finally {
    restoreEnvironment(originKey, previousOrigin);
    restoreEnvironment(markerKey, previousMarker);
  }
});

test("serializes the existing ScanReport without dropping unsupported guidance", async () => {
  const result = await createScanApiResult(
    { url: "https://example.test" },
    async () => report,
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { report });

  const serialized = JSON.parse(JSON.stringify(result.body));
  assert.equal(
    serialized.report.violations[1].guidance.status,
    "UNAVAILABLE",
  );
  assert.equal(
    serialized.report.violations[1].helpUrl,
    "https://example.test/axe-reference",
  );
});

test("maps ScannerError codes to stable, user-safe HTTP results", async () => {
  const cases = [
    ["INVALID_INPUT", 400],
    ["BLOCKED_TARGET", 400],
    ["DNS_RESOLUTION_FAILED", 502],
    ["NAVIGATION_TIMEOUT", 504],
    ["NAVIGATION_FAILED", 502],
    ["AXE_EXECUTION_FAILED", 500],
    ["SCAN_TIMEOUT", 504],
    ["CAPACITY_EXCEEDED", 503],
    ["SCAN_FAILED", 500],
  ];

  for (const [code, expectedStatus] of cases) {
    const secret = `internal-${code}-C:\\private\\browser.log`;
    const result = await createScanApiResult(
      { url: "https://example.test" },
      async () => {
        throw new ScannerError(code, secret, new Error("browser internals"));
      },
    );
    const serialized = JSON.stringify(result.body);

    assert.equal(result.status, expectedStatus);
    assert.equal(result.body.error.code, code);
    assert.doesNotMatch(serialized, /internal-|private|browser internals/i);
    assert.equal("stack" in result.body.error, false);
  }
});

test("redacts details from unexpected internal errors", async () => {
  const result = await createScanApiResult(
    { url: "https://example.test" },
    async () => {
      throw new Error("SECRET_TOKEN at C:\\sensitive\\server.ts:99");
    },
  );
  const serialized = JSON.stringify(result.body);

  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "SCAN_FAILED");
  assert.doesNotMatch(serialized, /SECRET_TOKEN|sensitive|server\.ts/i);
});

test("redacts malformed axe integrity details from the API response", async () => {
  const result = await createScanApiResult(
    { url: "https://example.test" },
    async () => {
      throw new ScannerError(
        "SCAN_FAILED",
        "axe-core violation 0 has an invalid private selector",
      );
    },
  );
  const serialized = JSON.stringify(result.body);

  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "SCAN_FAILED");
  assert.doesNotMatch(serialized, /axe-core|private selector/i);
});

test("does not echo sensitive submitted URL components in errors", async () => {
  const sensitiveUrl = "https://example.test/path?token=TOP_SECRET#private-fragment";
  const result = await createScanApiResult(
    { url: sensitiveUrl },
    async () => {
      throw new ScannerError(
        "BLOCKED_TARGET",
        `Blocked ${sensitiveUrl}`,
        new Error("credential-like internal detail"),
      );
    },
  );
  const serialized = JSON.stringify(result.body);

  assert.equal(result.status, 400);
  assert.doesNotMatch(serialized, /TOP_SECRET|private-fragment|credential-like|example\.test/);
});

function restoreEnvironment(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
