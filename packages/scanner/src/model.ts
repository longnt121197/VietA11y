export type NormalizedImpact =
  | "minor"
  | "moderate"
  | "serious"
  | "critical"
  | "unknown";

export interface WcagReference {
  standard: "WCAG";
  successCriterion: string;
}

export type SelectorTarget = Array<string | string[]>;

export interface AffectedNode {
  target: SelectorTarget;
  html?: string;
  failureSummary?: string;
}

export interface CuratedVietnameseGuidance {
  status: "CURATED";
  title: string;
  explanation: string;
  whyItMatters: string;
  remediation: string;
  example?: string;
}

export interface UnavailableVietnameseGuidance {
  status: "UNAVAILABLE";
}

export type VietnameseGuidance =
  | CuratedVietnameseGuidance
  | UnavailableVietnameseGuidance;

export interface AccessibilityViolation {
  ruleId: string;
  impact: NormalizedImpact;
  description?: string;
  help?: string;
  helpUrl?: string;
  wcagReferences: WcagReference[];
  totalNodeCount: number;
  nodes: AffectedNode[];
  guidance: VietnameseGuidance;
}

export interface ImpactDistribution {
  minor: number;
  moderate: number;
  serious: number;
  critical: number;
  unknown: number;
}

export interface ScanSummary {
  violatedRuleCount: number;
  affectedElementCount: number;
  impactDistribution: ImpactDistribution;
}

export interface ScanMetadata {
  submittedUrl: string;
  finalUrl: string;
  documentTitle: string;
  scannedAt: string;
  durationMs: number;
}

export interface ScanReport {
  metadata: ScanMetadata;
  summary: ScanSummary;
  violations: AccessibilityViolation[];
  warnings: string[];
}
