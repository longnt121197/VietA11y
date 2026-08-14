export {
  normalizeAxeResults,
  normalizeImpact,
  summarizeViolations,
} from "./normalize.js";
export { ScannerError } from "./errors.js";
export { scanPage } from "./scan-page.js";
export type {
  AccessibilityViolation,
  AffectedNode,
  CuratedVietnameseGuidance,
  ImpactDistribution,
  NormalizedImpact,
  ScanMetadata,
  ScanReport,
  ScanSummary,
  SelectorTarget,
  UnavailableVietnameseGuidance,
  VietnameseGuidance,
  WcagReference,
} from "./model.js";
export type { ScannerErrorCode } from "./errors.js";
export type { ScanPageOptions } from "./scan-page.js";
