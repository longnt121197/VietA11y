import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAxeResults,
  normalizeImpact,
  summarizeViolations,
} from "../dist/normalize.js";

const metadata = {
  submittedUrl: "https://example.test/start",
  finalUrl: "https://example.test/final",
  documentTitle: "Example document",
  scannedAt: "2026-08-14T10:00:00.000Z",
  durationMs: 125,
};

test("normalizes one violation with one affected node", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        {
          id: "image-alt",
          impact: "critical",
          description: "Ensure images have alternative text",
          help: "Images must have alternative text",
          helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
          tags: ["cat.text-alternatives", "wcag2a", "wcag111"],
          nodes: [
            {
              impact: "critical",
              any: [{ id: "has-alt", data: null }],
              all: [],
              none: [],
              target: ["img.hero"],
              html: '<img class="hero">',
              failureSummary: "Fix the missing alt attribute.",
            },
          ],
        },
      ],
      passes: [{ id: "document-title" }],
      incomplete: [],
    },
    metadata,
  );

  assert.deepEqual(report, {
    metadata,
    summary: {
      violatedRuleCount: 1,
      affectedElementCount: 1,
      impactDistribution: {
        minor: 0,
        moderate: 0,
        serious: 0,
        critical: 1,
        unknown: 0,
      },
    },
    violations: [
      {
        ruleId: "image-alt",
        impact: "critical",
        description: "Ensure images have alternative text",
        help: "Images must have alternative text",
        helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
        wcagReferences: [
          { standard: "WCAG", successCriterion: "1.1.1" },
        ],
        totalNodeCount: 1,
        nodes: [
          {
            target: ["img.hero"],
            html: '<img class="hero">',
            failureSummary: "Fix the missing alt attribute.",
          },
        ],
        guidance: {
          status: "CURATED",
          title: "Hình ảnh thiếu văn bản thay thế",
          explanation:
            "Phần tử <img> chưa có nội dung thay thế để truyền đạt mục đích hoặc thông tin của hình ảnh.",
          whyItMatters:
            "Screen reader cần văn bản thay thế để người không nhìn thấy hình vẫn hiểu được nội dung. Văn bản này cũng hữu ích khi hình ảnh không tải được.",
          remediation:
            'Viết thuộc tính alt ngắn gọn theo mục đích của hình trong ngữ cảnh. Nếu hình chỉ để trang trí, dùng alt rỗng (alt="") để công nghệ hỗ trợ có thể bỏ qua. Không dùng alt rỗng cho hình có thông tin hoặc chức năng.',
          example: '<img src="search.svg" alt="Tìm kiếm">',
        },
      },
    ],
    warnings: [],
  });

  assert.equal("passes" in report, false);
  assert.equal("any" in report.violations[0].nodes[0], false);
});

test("counts one violated rule separately from multiple affected nodes", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        {
          id: "button-name",
          impact: "serious",
          nodes: [
            { target: ["#save"] },
            { target: ["iframe", ["#shadow-host", "button"]] },
            { target: ["#cancel"] },
          ],
        },
      ],
    },
    metadata,
  );

  assert.equal(report.summary.violatedRuleCount, 1);
  assert.equal(report.summary.affectedElementCount, 3);
  assert.deepEqual(report.violations[0].nodes[1].target, [
    "iframe",
    ["#shadow-host", "button"],
  ]);
});

test("normalizes multiple violations and calculates impact distribution", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        { id: "color-contrast", impact: "serious", nodes: [{ target: ["p"] }] },
        { id: "html-has-lang", impact: "serious", nodes: [{ target: ["html"] }] },
        { id: "landmark-one-main", impact: "moderate", nodes: [] },
      ],
    },
    metadata,
  );

  assert.deepEqual(report.summary, {
    violatedRuleCount: 3,
    affectedElementCount: 2,
    impactDistribution: {
      minor: 0,
      moderate: 1,
      serious: 2,
      critical: 0,
      unknown: 0,
    },
  });
});

test("maps null, missing, and unexpected impacts to unknown", () => {
  assert.equal(normalizeImpact(null), "unknown");
  assert.equal(normalizeImpact(undefined), "unknown");
  assert.equal(normalizeImpact("catastrophic"), "unknown");

  const report = normalizeAxeResults(
    {
      violations: [
        { id: "null-impact", impact: null, nodes: [] },
        { id: "missing-impact", nodes: [] },
        { id: "unexpected-impact", impact: "catastrophic", nodes: [] },
      ],
    },
    metadata,
  );

  assert.equal(report.summary.impactDistribution.unknown, 3);
});

test("derives only conservative WCAG success-criterion references", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        {
          id: "label",
          tags: [
            "wcag2a",
            "wcag412",
            "wcag1410",
            "best-practice",
            "ACT",
            "wcag412",
            "wcag21aa",
            "wcag999",
            "wcag-not-a-criterion",
          ],
          nodes: [],
        },
      ],
    },
    metadata,
  );

  assert.deepEqual(report.violations[0].wcagReferences, [
    { standard: "WCAG", successCriterion: "4.1.2" },
    { standard: "WCAG", successCriterion: "1.4.10" },
  ]);
});

test("handles missing optional fields when required axe structure is valid", () => {
  const report = normalizeAxeResults(
    {
      violations: [
        {
          id: "partial-rule",
          tags: null,
          nodes: [{ target: [] }, { target: ["#fixture"] }],
        },
      ],
    },
    metadata,
  );

  assert.deepEqual(report.violations, [
    {
      ruleId: "partial-rule",
      impact: "unknown",
      wcagReferences: [],
      totalNodeCount: 2,
      nodes: [{ target: [] }, { target: ["#fixture"] }],
      guidance: { status: "UNAVAILABLE" },
    },
  ]);
  assert.deepEqual(report.warnings, []);
});

test("summary calculation uses normalized violations only", () => {
  const summary = summarizeViolations([
    {
      ruleId: "first",
      impact: "minor",
      wcagReferences: [],
      nodes: [{ target: ["a"] }, { target: ["button"] }],
    },
    {
      ruleId: "second",
      impact: "unknown",
      wcagReferences: [],
      nodes: [{ target: ["input"] }],
    },
  ]);

  assert.equal(summary.violatedRuleCount, 2);
  assert.equal(summary.affectedElementCount, 3);
  assert.equal(summary.impactDistribution.minor, 1);
  assert.equal(summary.impactDistribution.unknown, 1);
});

test("normalization is deterministic, JSON serializable, and does not mutate input", () => {
  const input = {
    violations: [
      {
        id: "nested-target",
        impact: "moderate",
        tags: ["wcag131", "cat.semantics"],
        nodes: [
          {
            target: [["iframe#payment", "button.submit"]],
            html: "<button>Pay</button>",
          },
        ],
      },
    ],
  };
  const snapshot = JSON.parse(JSON.stringify(input));

  const first = normalizeAxeResults(input, metadata);
  const second = normalizeAxeResults(input, metadata);

  assert.deepEqual(first, second);
  assert.deepEqual(input, snapshot);
  assert.notEqual(first.metadata, metadata);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  input.violations[0].nodes[0].target[0].push("span");
  assert.deepEqual(first.violations[0].nodes[0].target, [
    ["iframe#payment", "button.submit"],
  ]);
});

test("returns a legitimate clean report for a valid empty violations array", () => {
  const report = normalizeAxeResults({ violations: [] }, metadata);

  assert.deepEqual(report.summary, {
    violatedRuleCount: 0,
    affectedElementCount: 0,
    impactDistribution: {
      minor: 0,
      moderate: 0,
      serious: 0,
      critical: 0,
      unknown: 0,
    },
  });
  assert.deepEqual(report.violations, []);
});

test("rejects missing or invalid violations collections", () => {
  for (const input of [{}, { violations: null }, { violations: {} }]) {
    assert.throws(
      () => normalizeAxeResults(input, metadata),
      /violations array/,
    );
  }
});

test("rejects malformed violation and affected-node structure", () => {
  const malformedViolations = [
    null,
    { id: "", nodes: [] },
    { id: "missing-nodes" },
    { id: "invalid-nodes", nodes: null },
    { id: "invalid-node", nodes: [null] },
    { id: "invalid-target", nodes: [{ target: null }] },
    { id: "invalid-target-part", nodes: [{ target: [42] }] },
  ];

  for (const violation of malformedViolations) {
    assert.throws(() =>
      normalizeAxeResults({ violations: [violation] }, metadata),
    );
  }
});

test("bounds retained node details and strings while preserving true totals", () => {
  const oversizedText = "x".repeat(3_000);
  const nodes = Array.from({ length: 125 }, (_, index) => ({
    target: [`#node-${index}-${oversizedText}`],
    html: oversizedText,
    failureSummary: oversizedText,
  }));
  const report = normalizeAxeResults(
    {
      violations: [{
        id: "oversized",
        description: oversizedText,
        helpUrl: `https://example.test/${oversizedText}`,
        nodes,
      }],
    },
    { ...metadata, documentTitle: oversizedText },
  );
  const violation = report.violations[0];

  assert.equal(violation.totalNodeCount, 125);
  assert.equal(violation.nodes.length, 100);
  assert.equal(report.summary.affectedElementCount, 125);
  assert.equal(report.metadata.documentTitle.length, 300);
  assert.equal(violation.description.length, 1_000);
  assert.equal(violation.helpUrl, undefined);
  assert.equal(violation.nodes[0].target[0].length, 500);
  assert.equal(violation.nodes[0].html.length, 2_000);
  assert.equal(violation.nodes[0].failureSummary.length, 2_000);
  assert.ok(report.warnings.some((warning) => /occurrence counts remain unchanged/.test(warning)));
  assert.ok(report.warnings.some((warning) => /Truncated oversized/.test(warning)));
});
