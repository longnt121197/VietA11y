# Good First Issue Candidates

These are review candidates, not automatically created GitHub issues. Each item
is based on the v0.1.0 repository and stays within the current single-page scan,
Vietnamese guidance, testing, documentation, and contributor-experience scope.

Maintainers should confirm the scope and labels before publishing an issue.

## 1. Add real README screenshots with useful alt text

- **Suggested labels:** `good first issue`, `documentation`
- **Why it matters:** Real images would help a new visitor recognize the input,
  report, and guidance experience without implying features that do not exist.
- **Scope:** Capture the released app using a maintainer-controlled or
  deterministic target, remove sensitive data, add compact image files, and
  replace the README placeholder with useful alt text and captions.
- **Likely files:** `README.md`, `docs/images/README.md`, `docs/images/*`
- **Acceptance criteria:** Two or three real v0.1.0 screenshots cover the input
  page, completed report, and curated guidance; no private data or invented
  result appears; images remain legible and reasonably sized; alt text explains
  the relevant interface state.
- **Difficulty:** beginner

## 2. Document Chromium installation troubleshooting

- **Suggested labels:** `good first issue`, `documentation`, `developer-experience`
- **Why it matters:** Playwright's browser installation is the most unusual
  setup step and can fail differently across operating systems.
- **Scope:** Add a short troubleshooting subsection for missing Chromium,
  platform dependencies, and how to retry the existing install command. Link to
  official Playwright documentation; do not add scripts or dependencies.
- **Likely files:** `CONTRIBUTING.md`, optionally `README.md`
- **Acceptance criteria:** Guidance covers the common missing-browser message,
  keeps the supported Node/npm versions accurate, distinguishes local setup
  from CI's Linux dependency install, and does not recommend bypassing URL or
  browser security controls.
- **Difficulty:** beginner

## 3. Add a worked example explaining report counts

- **Suggested labels:** `good first issue`, `documentation`, `accessibility`
- **Why it matters:** “Affected-element occurrence” is intentionally not a
  unique-element count, and new users can misinterpret it.
- **Scope:** Add a small, synthetic text example showing two violated rules and
  repeated elements. Explain the rule count, occurrence count, and impact
  distribution without inventing a real scan or numeric score.
- **Likely files:** `README.md` or a focused file under `docs/`
- **Acceptance criteria:** The arithmetic matches `ScanSummary`; the example
  clearly says an element can count once per violated rule; it does not imply
  WCAG conformance or certification.
- **Difficulty:** beginner

## 4. Add an original Vietnamese example for `color-contrast`

- **Suggested labels:** `good first issue`, `accessibility`, `vietnamese-guidance`
- **Why it matters:** This curated entry explains remediation but is one of four
  entries without a concrete example.
- **Scope:** Verify installed axe metadata and authoritative WCAG contrast
  references, then add one concise original example that does not oversimplify
  contrast requirements for text size, states, gradients, or images.
- **Likely files:** `packages/scanner/src/knowledge/rules.vi.ts`,
  `packages/scanner/test/knowledge.test.mjs`
- **Acceptance criteria:** The record key and rule ID remain unchanged; wording
  is technically accurate and original; a test asserts the example is returned;
  every unsupported finding still uses the unavailable state.
- **Difficulty:** beginner-intermediate

## 5. Add an original Vietnamese example for `heading-order`

- **Suggested labels:** `good first issue`, `accessibility`, `vietnamese-guidance`
- **Why it matters:** A short before/after structure can clarify that heading
  levels represent content hierarchy, not visual size.
- **Scope:** Review the axe rule and authoritative heading guidance, then add a
  safe, concise example that preserves the existing nuance about page context.
- **Likely files:** `packages/scanner/src/knowledge/rules.vi.ts`,
  `packages/scanner/test/knowledge.test.mjs`
- **Acceptance criteria:** The example demonstrates a logical hierarchy, avoids
  presenting a page-independent pattern as universally correct, and is covered
  by a focused knowledge test.
- **Difficulty:** beginner

## 6. Add examples for the two curated ARIA naming rules

- **Suggested labels:** `accessibility`, `vietnamese-guidance`, `good first issue`
- **Why it matters:** `aria-command-name` and `aria-input-field-name` describe
  custom widgets; examples can reinforce the preference for native HTML and the
  need for complete keyboard behavior.
- **Scope:** Add one original, technically accurate example to each existing
  entry after reviewing axe metadata and the relevant WAI-ARIA patterns. Do not
  add a new rule or change scanner behavior.
- **Likely files:** `packages/scanner/src/knowledge/rules.vi.ts`,
  `packages/scanner/test/knowledge.test.mjs`
- **Acceptance criteria:** Examples have accessible names, do not suggest that
  ARIA alone supplies interaction behavior, use safe excerpt text, and are
  returned by the knowledge lookup tests.
- **Difficulty:** beginner-intermediate

## 7. Review Vietnamese accessible-name terminology for consistency

- **Suggested labels:** `accessibility`, `documentation`, `vietnamese-guidance`
- **Why it matters:** Several curated rules discuss accessible names; consistent
  Vietnamese terminology makes related guidance easier to learn and compare.
- **Scope:** Review only the existing naming-related entries (`button-name`,
  `link-name`, `aria-command-name`, and `aria-input-field-name`). Propose small
  wording changes backed by axe/WAI references; do not rewrite unrelated rules.
- **Likely files:** `packages/scanner/src/knowledge/rules.vi.ts`,
  `packages/scanner/test/knowledge.test.mjs`
- **Acceptance criteria:** Terms are consistent without losing rule-specific
  meaning; changes are original and technically sourced; no claim is made that
  an accessible name alone makes a custom control accessible; tests pass.
- **Difficulty:** beginner-intermediate

## 8. Test lookup behavior for all 10 curated rule IDs

- **Suggested labels:** `good first issue`, `tests`, `vietnamese-guidance`
- **Why it matters:** The current lookup test samples one supported rule while a
  separate structural test checks all entries. A table-driven test would connect
  every registered ID to the public lookup behavior.
- **Scope:** Add a concise table-driven test over the existing curated record.
  Assert each ID returns `CURATED`, the same rule ID, and its expected fields.
- **Likely files:** `packages/scanner/test/knowledge.test.mjs`
- **Acceptance criteria:** All 10 entries are exercised through
  `getVietnameseGuidance`; the test remains deterministic and does not duplicate
  complete guidance paragraphs; unknown-rule behavior remains covered.
- **Difficulty:** beginner

## 9. Add a narrow-viewport report reflow test

- **Suggested labels:** `good first issue`, `tests`, `accessibility`, `web`
- **Why it matters:** Reports contain long URLs, selectors, code excerpts, and
  five impact summaries that must remain usable under WCAG reflow conditions.
- **Scope:** Extend the existing browser test with a narrow viewport and verify
  the form and completed report do not create page-level horizontal scrolling.
  Test a representative long value without relying on a public website.
- **Likely files:** `apps/web/test/web-mvp.e2e.test.mjs`, and only if a real bug
  is found, `apps/web/app/scan-experience.tsx`
- **Acceptance criteria:** The deterministic test covers both input and report
  states at a documented narrow width; it checks content remains reachable by
  keyboard; any CSS change is minimal and preserves visible focus.
- **Difficulty:** beginner-intermediate

## 10. Cover long untrusted report strings in the browser test

- **Suggested labels:** `tests`, `accessibility`, `security`, `web`
- **Why it matters:** Titles, final URLs, selectors, and excerpts are untrusted
  strings. Normalization bounds them, while the UI must still render them as text
  and wrap them safely.
- **Scope:** Add deterministic mocked report values containing long unbroken
  text and HTML-like probes. Verify they are displayed as text, do not create DOM
  elements, and do not cause page-level horizontal overflow.
- **Likely files:** `apps/web/test/web-mvp.e2e.test.mjs`, and only if needed,
  `apps/web/app/scan-experience.tsx`
- **Acceptance criteria:** Tests cover at least metadata and one node detail;
  injection probes remain inert; long content stays readable; no unsafe raw-HTML
  rendering is introduced.
- **Difficulty:** beginner-intermediate

## 11. Test focus behavior when running a second scan

- **Suggested labels:** `good first issue`, `tests`, `accessibility`, `web`
- **Why it matters:** The E2E test covers validation, request error, and first
  success, but repeated use should also announce and focus the newest result or
  error predictably.
- **Scope:** Extend the deterministic browser workflow to submit again after a
  successful report and cover one second-success or second-error transition.
- **Likely files:** `apps/web/test/web-mvp.e2e.test.mjs`, and only if a defect is
  demonstrated, `apps/web/app/scan-experience.tsx`
- **Acceptance criteria:** Stale results disappear while scanning; the new
  result heading or error receives focus; keyboard operation remains possible;
  the page has no automated axe violations in the tested state.
- **Difficulty:** beginner-intermediate

## 12. Add browser coverage for unsafe axe help URLs

- **Suggested labels:** `good first issue`, `tests`, `security`, `accessibility`
- **Why it matters:** The UI intentionally links only HTTP/HTTPS axe references
  and displays other values as inert text. This boundary deserves an explicit
  browser assertion.
- **Scope:** Feed the existing mocked report path a non-HTTP help URL and assert
  no clickable link is created, the value is rendered as text, and surrounding
  report navigation remains accessible.
- **Likely files:** `apps/web/test/web-mvp.e2e.test.mjs`
- **Acceptance criteria:** At least one unsafe scheme and one valid HTTPS URL are
  covered; tests do not navigate to an external site; no production URL policy
  or API behavior changes.
- **Difficulty:** beginner

## 13. Add a root `verify` command for contributor checks

- **Suggested labels:** `good first issue`, `developer-experience`, `documentation`
- **Why it matters:** Contributors currently copy four npm commands from the
  docs. A single discoverable command can reduce missed checks while preserving
  the individual CI steps.
- **Scope:** Add a root npm script that runs lint, typecheck, tests, and build in
  the documented order, then document it as a convenience. Do not add a package
  or change CI unless maintainers explicitly request it.
- **Likely files:** `package.json`, `CONTRIBUTING.md`
- **Acceptance criteria:** The command fails when any child check fails, uses
  existing scripts only, works on supported platforms, and leaves the four
  explicit commands documented for diagnosis.
- **Difficulty:** beginner

## 14. Add a manual accessibility review checklist for UI contributions

- **Suggested labels:** `good first issue`, `documentation`, `accessibility`
- **Why it matters:** Automated axe checks cannot cover keyboard flow, focus
  order, announcements, zoom/reflow, or the clarity of Vietnamese status text.
- **Scope:** Add a short contributor checklist tailored to the existing input,
  loading, error, report, disclosure, and external-link states. Avoid claiming a
  full audit methodology.
- **Likely files:** `CONTRIBUTING.md` or a focused file under `docs/`
- **Acceptance criteria:** The checklist includes keyboard-only use, visible
  focus, loading/error/result announcements, heading order, 200% zoom or narrow
  reflow, and safe code/excerpt rendering; it clearly supplements rather than
  replaces assistive-technology testing.
- **Difficulty:** beginner
