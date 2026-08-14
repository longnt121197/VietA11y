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

const knownImpacts = new Set<NormalizedImpact>([
  "minor",
  "moderate",
  "serious",
  "critical",
]);

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
    affectedElementCount += violation.nodes.length;
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
  const violations = rawViolations
    .map(normalizeViolation)
    .filter((violation): violation is AccessibilityViolation =>
      violation !== undefined,
    );
  const ignoredViolationCount = rawViolations.length - violations.length;

  return {
    metadata: { ...metadata },
    summary: summarizeViolations(violations),
    violations,
    warnings:
      ignoredViolationCount === 0
        ? []
        : [
            `Ignored ${ignoredViolationCount} malformed violation ${ignoredViolationCount === 1 ? "entry" : "entries"}.`,
          ],
  };
}

function normalizeViolation(input: unknown): AccessibilityViolation | undefined {
  const violation = asRecord(input);
  const ruleId = readNonEmptyString(violation?.id);

  if (violation === undefined || ruleId === undefined) {
    return undefined;
  }

  const normalized: AccessibilityViolation = {
    ruleId,
    impact: normalizeImpact(violation.impact),
    wcagReferences: deriveWcagReferences(violation.tags),
    nodes: Array.isArray(violation.nodes)
      ? violation.nodes.map(normalizeNode)
      : [],
  };

  assignOptionalString(normalized, "description", violation.description);
  assignOptionalString(normalized, "help", violation.help);
  assignOptionalString(normalized, "helpUrl", violation.helpUrl);

  return normalized;
}

function normalizeNode(input: unknown): AffectedNode {
  const node = asRecord(input);
  const normalized: AffectedNode = {
    target: normalizeTarget(node?.target),
  };

  assignOptionalString(normalized, "html", node?.html);
  assignOptionalString(normalized, "failureSummary", node?.failureSummary);

  return normalized;
}

function normalizeTarget(input: unknown): SelectorTarget {
  if (!Array.isArray(input)) {
    return [];
  }

  const target: SelectorTarget = [];

  for (const part of input) {
    if (typeof part === "string") {
      target.push(part);
      continue;
    }

    if (Array.isArray(part) && part.every((item) => typeof item === "string")) {
      target.push([...part]);
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

function readNonEmptyString(input: unknown): string | undefined {
  return typeof input === "string" && input.length > 0 ? input : undefined;
}

function assignOptionalString<
  TObject extends object,
  TKey extends keyof TObject,
>(object: TObject, key: TKey, input: unknown): void {
  if (typeof input === "string") {
    object[key] = input as TObject[TKey];
  }
}
