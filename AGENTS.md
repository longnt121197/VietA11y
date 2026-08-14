# VietA11y Repository Instructions

VietA11y is an open-source **Vietnamese Web Accessibility Scanner**. It scans one captured state of one web page, presents automated axe-core findings, and provides curated Vietnamese guidance where available. Never imply that automated scanning proves full WCAG conformance or provides accessibility certification.

## Current target and boundaries

The current target is `v0.1.0`.

- `apps/web`: Next.js UI, HTTP/API boundary, report presentation, and deployment-specific controls.
- `packages/scanner`: framework-independent Playwright and axe-core scanner, public report/error types, normalization, summaries, and Vietnamese knowledge lookup.

`apps/web` may depend on `packages/scanner`. The scanner must not depend on Next.js, React, UI code, or application-specific HTTP logic. Do not add workspace packages without a demonstrated need.

Prefer one primary public function, `scanPage(...)`. Export only the serializable report and error types consumers need. Keep axe-native structures internal and never expose raw axe results through the normal application API.

## v0.1 scope

Implement only:

- one URL, one page, and one captured page state;
- automated axe-core findings normalized into the VietA11y report;
- transparent violated-rule, affected-element, and impact counts;
- approximately 8–12 curated, high-value Vietnamese rule entries;
- honest fallback behavior for unsupported rules;
- an accessible web report.

Unless explicitly requested, do not add crawling, authenticated or scripted scans, accounts, databases, history, queues, CLI, GitHub Actions, browser extensions, exports, screenshots, numeric scores, AI-generated remediation, advanced filtering, or browser pooling.

## Engineering approach

- Prefer readable TypeScript, explicit types, small focused functions, deterministic behavior, minimal dependencies, incremental changes, and straightforward tests.
- Prefer understandable code over clever code.
- Avoid speculative abstractions, plugin systems, dependency-injection frameworks, and repositories/services/providers/factories without a current need.
- Do not build generic infrastructure for hypothetical CLI or GitHub Action consumers. Scanner framework independence is sufficient preparation.
- Keep public interfaces small and avoid unrelated refactors or roadmap work.

Before adding a dependency, confirm that the platform or an existing dependency cannot reasonably provide the capability. Add only maintained, narrowly scoped dependencies that materially improve the implementation. Do not include major upgrades in unrelated work, and explain new dependencies.

## Vietnamese guidance

Use a simple typed record keyed by axe rule ID unless real implementation needs justify another structure. Content should be easy for contributors to extend.

All axe findings must remain visible. For an unsupported rule, retain the finding and authoritative reference, clearly state that curated Vietnamese guidance is unavailable, and do not guess or generate remediation.

## Accessibility

VietA11y must not introduce accessibility regressions while reporting them. UI changes should use semantic HTML, keyboard-operable controls, visible labels, accessible errors, appropriate focus and status behavior, logical headings, and safe readable code/HTML excerpts.

Treat page titles, URLs, selectors, excerpts, and axe messages as untrusted strings. Never render scanned HTML through an unsafe raw-HTML mechanism.

## Security

Treat every submitted URL and remote page as untrusted. Account for SSRF, local/private/internal networks, redirects, private-network subresources, unsafe schemes, DNS bypasses, malicious content, browser/process leaks, resource exhaustion, and sensitive URL data in logs.

Do not weaken URL or network protections to make a scan succeed. Clean up every browser, context, and page on success, failure, timeout, and cancellation.

Self-hosting is not automatically safe: operators who expose scanning to untrusted users inherit the same SSRF and resource-exhaustion risks. Public arbitrary-URL hosting is a separate security gate after the self-hosted v0.1 functionality is complete.

## Testing and change discipline

Use deterministic local fixtures; tests must not depend on arbitrary public websites. Cover relevant normalization, summaries, knowledge lookup, malformed or partial axe data, scan errors, timeouts, browser cleanup, URL policy, API behavior, and accessible UI behavior. Behavior changes should normally add or update tests.

For each task:

1. Read this file and inspect relevant code before editing.
2. Stay within the requested milestone; do not silently broaden scope.
3. Avoid unrelated changes and keep public interfaces small.
4. Update documentation only when behavior or contributor workflow requires it.
5. Review the final diff for accidental changes.

A task is done only when its scope is satisfied and applicable tests, typecheck, lint, and production build succeed; resources are cleaned up; documentation is accurate where necessary; and no unrelated changes remain. State explicitly when a required check cannot be run.

## Implementation order

1. Foundation
2. Scanner model and normalization
3. Working Playwright/axe scan
4. Vietnamese guidance
5. Web MVP
6. Hardening and self-hosted `v0.1.0` release
7. Public-hosting security gate, if pursued

Do not skip ahead unless explicitly instructed.
