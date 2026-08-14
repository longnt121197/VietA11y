# VietA11y

> Vietnamese Web Accessibility Scanner with WCAG Guidance

VietA11y is an open-source tool built for Vietnamese developers. It will scan
one captured state of a web page for automated accessibility issues and provide
curated Vietnamese guidance for selected findings.

Automated scanning cannot prove full WCAG conformance or provide accessibility
certification.

## Project status

VietA11y is currently under active development. The scanner package can run one
framework-independent Playwright and axe-core scan, but it is not connected to
the web application and is not ready for public arbitrary-URL hosting.

## Repository structure

- `apps/web`: Next.js application and future web interface.
- `packages/scanner`: framework-independent TypeScript scanner package shell.

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

## Verification

Run the same checks used by CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Scanner integration tests use deterministic HTTP fixtures served on the local
loopback interface. They do not scan public websites.

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
