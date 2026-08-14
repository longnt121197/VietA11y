import type {
  AccessibilityViolation,
  AffectedNode,
  NormalizedImpact,
  ScanMetadata,
  ScanReport,
  ScanSummary,
  SelectorTarget,
  WcagReference,
} from "./model.js";
import { getVietnameseGuidance } from "./knowledge/index.js";

const knownImpacts = new Set<NormalizedImpact>([
  "minor",
  "moderate",
  "serious",
  "critical",
]);

export const reportLimits = {
  documentTitleLength: 300,
  ruleTextLength: 1_000,
  helpUrlLength: 2_048,
  nodesPerViolation: 100,
  selectorPartsPerTarget: 20,
  selectorLength: 500,
  htmlExcerptLength: 2_000,
  failureSummaryLength: 2_000,
} as const;

type UnknownRecord = Record<string, unknown>;

export function normalizeImpact(impact: unknown): NormalizedImpact {
  return typeof impact === "string" &&
    knownImpacts.has(impact as NormalizedImpact)
    ? (impact as NormalizedImpact)
    : "unknown";
}

export function summarizeViolations(
  violations: readonly AccessibilityViolation[],
): ScanSummary {
  const impactDistribution: ScanSummary["impactDistribution"] = {
    minor: 0,
    moderate: 0,
    serious: 0,
    critical: 0,
    unknown: 0,
  };

  let affectedElementCount = 0;

  for (const violation of violations) {
    impactDistribution[violation.impact] += 1;
    affectedElementCount += violation.totalNodeCount ?? violation.nodes.length;
  }

  return {
    violatedRuleCount: violations.length,
    affectedElementCount,
    impactDistribution,
  };
}

export function normalizeAxeResults(
  input: unknown,
  metadata: ScanMetadata,
): ScanReport {
  const result = asRecord(input);
  const rawViolations = Array.isArray(result?.violations)
    ? result.violations
    : [];
  const truncation = { nodes: false, strings: false };
  const violations = rawViolations
    .map((violation) => normalizeViolation(violation, truncation))
    .filter((violation): violation is AccessibilityViolation =>
      violation !== undefined,
    );
  const ignoredViolationCount = rawViolations.length - violations.length;

  return {
    metadata: {
      ...metadata,
      documentTitle: truncate(
        metadata.documentTitle,
        reportLimits.documentTitleLength,
        truncation,
      ),
    },
    summary: summarizeViolations(violations),
    violations,
    warnings: buildWarnings(ignoredViolationCount, truncation),
  };
}

function normalizeViolation(
  input: unknown,
  truncation: TruncationState,
): AccessibilityViolation | undefined {
  const violation = asRecord(input);
  const ruleId = readLimitedString(
    violation?.id,
    reportLimits.ruleTextLength,
    truncation,
  );

  if (violation === undefined || ruleId === undefined) {
    return undefined;
  }

  const rawNodes = Array.isArray(violation.nodes) ? violation.nodes : [];
  const retainedNodes = rawNodes.slice(0, reportLimits.nodesPerViolation);

  if (retainedNodes.length < rawNodes.length) {
    truncation.nodes = true;
  }

  const normalized: AccessibilityViolation = {
    ruleId,
    impact: normalizeImpact(violation.impact),
    wcagReferences: deriveWcagReferences(violation.tags),
    totalNodeCount: rawNodes.length,
    nodes: retainedNodes.map((node) => normalizeNode(node, truncation)),
    guidance: getVietnameseGuidance(ruleId),
  };

  assignLimitedString(
    normalized,
    "description",
    violation.description,
    reportLimits.ruleTextLength,
    truncation,
  );
  assignLimitedString(
    normalized,
    "help",
    violation.help,
    reportLimits.ruleTextLength,
    truncation,
  );
  assignBoundedHelpUrl(normalized, violation.helpUrl, truncation);

  return normalized;
}

function normalizeNode(input: unknown, truncation: TruncationState): AffectedNode {
  const node = asRecord(input);
  const normalized: AffectedNode = {
    target: normalizeTarget(node?.target, truncation),
  };

  assignLimitedString(
    normalized,
    "html",
    node?.html,
    reportLimits.htmlExcerptLength,
    truncation,
  );
  assignLimitedString(
    normalized,
    "failureSummary",
    node?.failureSummary,
    reportLimits.failureSummaryLength,
    truncation,
  );

  return normalized;
}

function normalizeTarget(
  input: unknown,
  truncation: TruncationState,
): SelectorTarget {
  if (!Array.isArray(input)) {
    return [];
  }

  const target: SelectorTarget = [];

  const retainedParts = input.slice(0, reportLimits.selectorPartsPerTarget);

  if (retainedParts.length < input.length) {
    truncation.strings = true;
  }

  for (const part of retainedParts) {
    if (typeof part === "string") {
      target.push(truncate(part, reportLimits.selectorLength, truncation));
      continue;
    }

    if (Array.isArray(part) && part.every((item) => typeof item === "string")) {
      const retainedNestedParts = part.slice(
        0,
        reportLimits.selectorPartsPerTarget,
      );

      if (retainedNestedParts.length < part.length) {
        truncation.strings = true;
      }

      target.push(
        retainedNestedParts.map((item) =>
          truncate(item, reportLimits.selectorLength, truncation),
        ),
      );
    }
  }

  return target;
}

function deriveWcagReferences(input: unknown): WcagReference[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const criteria = new Set<string>();

  for (const tag of input) {
    if (typeof tag !== "string") {
      continue;
    }

    const match = /^wcag([1-4])(\d)(\d{1,2})$/.exec(tag.toLowerCase());
    const principle = match?.[1];
    const guideline = match?.[2];
    const criterion = match?.[3];

    if (
      principle !== undefined &&
      guideline !== undefined &&
      criterion !== undefined &&
      isPossibleWcagCriterion(principle, guideline, criterion)
    ) {
      criteria.add(`${principle}.${guideline}.${criterion}`);
    }
  }

  return [...criteria].map((successCriterion) => ({
    standard: "WCAG",
    successCriterion,
  }));
}

function isPossibleWcagCriterion(
  principle: string,
  guideline: string,
  criterion: string,
): boolean {
  const maximumGuidelineByPrinciple: Record<string, number> = {
    "1": 4,
    "2": 5,
    "3": 3,
    "4": 1,
  };
  const maximumGuideline = maximumGuidelineByPrinciple[principle];

  return (
    maximumGuideline !== undefined &&
    Number(guideline) >= 1 &&
    Number(guideline) <= maximumGuideline &&
    Number(criterion) >= 1
  );
}

function asRecord(input: unknown): UnknownRecord | undefined {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as UnknownRecord)
    : undefined;
}

interface TruncationState {
  nodes: boolean;
  strings: boolean;
}

function readLimitedString(
  input: unknown,
  maximumLength: number,
  truncation: TruncationState,
): string | undefined {
  return typeof input === "string" && input.length > 0
    ? truncate(input, maximumLength, truncation)
    : undefined;
}

function assignLimitedString<
  TObject extends object,
  TKey extends keyof TObject,
>(
  object: TObject,
  key: TKey,
  input: unknown,
  maximumLength: number,
  truncation: TruncationState,
): void {
  if (typeof input === "string") {
    object[key] = truncate(input, maximumLength, truncation) as TObject[TKey];
  }
}

function assignBoundedHelpUrl(
  violation: AccessibilityViolation,
  input: unknown,
  truncation: TruncationState,
): void {
  if (typeof input !== "string") {
    return;
  }

  if (input.length > reportLimits.helpUrlLength) {
    truncation.strings = true;
    return;
  }

  violation.helpUrl = input;
}

function truncate(
  input: string,
  maximumLength: number,
  truncation: TruncationState,
): string {
  if (input.length <= maximumLength) {
    return input;
  }

  truncation.strings = true;
  return `${input.slice(0, maximumLength - 1)}…`;
}

function buildWarnings(
  ignoredViolationCount: number,
  truncation: TruncationState,
): string[] {
  const warnings: string[] = [];

  if (ignoredViolationCount > 0) {
    warnings.push(
      `Ignored ${ignoredViolationCount} malformed violation ${ignoredViolationCount === 1 ? "entry" : "entries"}.`,
    );
  }

  if (truncation.nodes) {
    warnings.push(
      `Retained at most ${reportLimits.nodesPerViolation} affected-node details per violation; total affected-element counts remain unchanged.`,
    );
  }

  if (truncation.strings) {
    warnings.push("Truncated oversized scan-derived text to bounded report limits.");
  }

  return warnings;
}
