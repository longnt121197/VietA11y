# VietA11y

> Vietnamese Web Accessibility Scanner with WCAG Guidance

VietA11y is an open-source tool built for Vietnamese developers. It scans one
captured state of one web page for automated accessibility issues and provides
curated Vietnamese guidance for selected findings.

Automated scanning cannot prove full WCAG conformance or provide accessibility
certification.

## Project status

VietA11y is currently under active development. The local Web MVP accepts one
HTTP or HTTPS URL, runs the framework-independent Playwright and axe-core
scanner synchronously, and presents transparent rule, affected-element, and
impact counts. Findings retain their authoritative axe reference and show
curated Vietnamese guidance when it exists or an explicit unavailable state
when it does not.

The Web MVP is intended for local development or controlled self-hosting. It is
**not ready for public arbitrary-URL hosting**. Exposing URL scanning to
untrusted users requires the later public-hosting security gate, including the
network and resource controls that are outside this milestone.

## Repository structure

- `apps/web`: Next.js user interface and synchronous `POST /api/scans` boundary.
- `packages/scanner`: framework-independent Playwright/axe scanner, report
  model, normalization, summaries, and Vietnamese guidance lookup.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer

## Development

Install workspace dependencies:

```sh
npm install
```

Install the Chromium binary used by scanner integration tests and local scans:

```sh
npm run browser:install --workspace @vieta11y/scanner
```

Start the web application in development mode:

```sh
npm run dev
```

Open the local URL printed by Next.js, enter an absolute HTTP or HTTPS URL, and
submit the form. The scan runs in the server-side Node.js process and returns
the existing `ScanReport` to the browser. Keep this development server in a
trusted environment; basic URL input validation is not an SSRF defense.

## Verification

Run the same checks used by CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Scanner integration tests use deterministic HTTP fixtures served on the local
loopback interface. Web API tests inject deterministic reports and scanner
errors. The test suite does not scan public websites.

## Current limitations

- Automated results cover one captured state of one page and cannot prove full
  WCAG conformance or replace manual testing.
- Only selected axe rules have curated Vietnamese guidance; all other findings
  remain visible with an honest unavailable state.
- Scans are synchronous and have no history, accounts, queue, export, numeric
  score, crawling, authenticated flow, or cancellation.
- Public-hosting hardening for untrusted arbitrary URLs is not implemented.

## Goals

- Scan websites for automated accessibility issues.
- Explain selected findings in Vietnamese.
- Provide practical remediation examples.
- Build a Vietnamese accessibility knowledge base.
- Keep findings and counts transparent without claiming certification.

## Roadmap

- [ ] v0.1 — Web accessibility scanner
- [ ] v0.2 — Vietnamese WCAG knowledge base
- [ ] v0.3 — CLI
- [ ] v0.4 — GitHub Action
- [ ] v0.5 — Browser extension

## Contributing

VietA11y is an open-source community project. Contributions, bug reports,
accessibility knowledge, documentation improvements, and ideas are welcome.

### Add Vietnamese guidance for an axe rule

1. Confirm the exact rule ID and purpose in the installed `axe-core` version.
2. Add one typed entry to
   `packages/scanner/src/knowledge/rules.vi.ts`. Keep the Vietnamese guidance
   concise, practical, and original; include an example only when it clarifies
   the remediation.
3. Add or update a knowledge/normalization test. Unsupported rules must keep
   returning `UNAVAILABLE` without guessed remediation.
4. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

The record key and its `ruleId` must match. All required Vietnamese fields must
be non-empty. Adding curated guidance never changes which axe rules are run or
which findings appear in a report.

## License

MIT
