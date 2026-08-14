import type { VietnameseGuidance } from "../model.js";
import {
  curatedVietnameseRules,
  type VietnameseKnowledgeEntry,
} from "./rules.vi.js";

const requiredTextFields = [
  "title",
  "explanation",
  "whyItMatters",
  "remediation",
] as const satisfies readonly (keyof VietnameseKnowledgeEntry)[];

validateCuratedRules();

export function getVietnameseGuidance(ruleId: string): VietnameseGuidance {
  const entry = curatedVietnameseRules[ruleId];

  if (entry === undefined) {
    return { status: "UNAVAILABLE" };
  }

  const guidance = {
    status: "CURATED" as const,
    title: entry.title,
    explanation: entry.explanation,
    whyItMatters: entry.whyItMatters,
    remediation: entry.remediation,
  };

  return entry.example === undefined
    ? guidance
    : { ...guidance, example: entry.example };
}

function validateCuratedRules(): void {
  for (const [key, entry] of Object.entries(curatedVietnameseRules)) {
    if (key !== entry.ruleId) {
      throw new Error(
        `Vietnamese guidance key "${key}" does not match ruleId "${entry.ruleId}".`,
      );
    }

    for (const field of requiredTextFields) {
      if (entry[field].trim().length === 0) {
        throw new Error(
          `Vietnamese guidance for "${key}" has an empty ${field} field.`,
        );
      }
    }

    if (entry.example !== undefined && entry.example.trim().length === 0) {
      throw new Error(
        `Vietnamese guidance for "${key}" has an empty example field.`,
      );
    }
  }
}
