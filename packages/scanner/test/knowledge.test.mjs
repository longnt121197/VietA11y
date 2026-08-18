import assert from "node:assert/strict";
import test from "node:test";

import { getVietnameseGuidance } from "../dist/knowledge/index.js";
import { curatedVietnameseRules } from "../dist/knowledge/rules.vi.js";
import { normalizeAxeResults } from "../dist/normalize.js";

const metadata = {
  submittedUrl: "https://example.test/page",
  finalUrl: "https://example.test/page",
  documentTitle: "Knowledge fixture",
  scannedAt: "2026-08-14T10:00:00.000Z",
  durationMs: 25,
};

test("curated records have unique matching IDs and non-empty Vietnamese fields", () => {
  const entries = Object.entries(curatedVietnameseRules);
  const ruleIds = entries.map(([, entry]) => entry.ruleId);

  assert.equal(entries.length, 11);
  assert.equal(new Set(ruleIds).size, entries.length);

  for (const [key, entry] of entries) {
    assert.equal(entry.ruleId, key);
    assert.ok(entry.title.trim());
    assert.ok(entry.explanation.trim());
    assert.ok(entry.whyItMatters.trim());
    assert.ok(entry.remediation.trim());

    if (entry.example !== undefined) {
      assert.ok(entry.example.trim());
    }
  }
});

test("known rule returns curated Vietnamese guidance", () => {
  const guidance = getVietnameseGuidance("button-name");

  assert.equal(guidance.status, "CURATED");
  assert.match(guidance.title, /Nút/);
  assert.ok(guidance.remediation.length > 0);
});

test("html-lang-valid returns curated Vietnamese guidance", () => {
  const guidance = getVietnameseGuidance("html-lang-valid");

  assert.equal(guidance.status, "CURATED");
  assert.match(guidance.title, /ngôn ngữ/);
  assert.ok(guidance.remediation.includes("BCP 47"));
});

test("unknown rule returns only the explicit unavailable state", () => {
  const guidance = getVietnameseGuidance("future-axe-rule");

  assert.deepEqual(guidance, { status: "UNAVAILABLE" });
  assert.equal("remediation" in guidance, false);
  assert.equal("example" in guidance, false);
});

test("normalization preserves supported and unsupported findings", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        {
          id: "image-alt",
          impact: "critical",
          helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
          nodes: [{ target: ["img"] }],
        },
        {
          id: "unsupported-fixture-rule",
          impact: "moderate",
          help: "Authoritative axe help remains available",
          helpUrl: "https://example.test/axe-reference",
          nodes: [{ target: ["main"] }],
        },
      ],
    },
    metadata,
  );

  assert.equal(report.violations.length, 2);
  assert.equal(report.summary.violatedRuleCount, 2);
  assert.equal(report.summary.affectedElementCount, 2);
  assert.equal(report.violations[0].guidance.status, "CURATED");
  assert.deepEqual(report.violations[1], {
    ruleId: "unsupported-fixture-rule",
    impact: "moderate",
    help: "Authoritative axe help remains available",
    helpUrl: "https://example.test/axe-reference",
    wcagReferences: [],
    totalNodeCount: 1,
    nodes: [{ target: ["main"] }],
    guidance: { status: "UNAVAILABLE" },
  });
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});
