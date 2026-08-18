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
scanner synchronously, and presents transparent rule, affected-element
occurrence, and impact counts. The occurrence count sums axe nodes across
violated rules; it is not a count of unique DOM elements. Findings retain their
authoritative axe reference and show
curated Vietnamese guidance when it exists or an explicit unavailable state
when it does not.

The v0.1 application is intended for local development or controlled
self-hosting. It includes application-level destination and resource guards,
but it is **not approved for public arbitrary-URL hosting**. Exposing scanning
to untrusted users requires a separate public-hosting security gate and
deployment-level network controls.

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
submit the form. The scan runs in the server-side Node.js process and returns a
bounded, serializable `ScanReport` to the browser.

Each scan launches headless Chromium with a fresh, non-persistent browser
context. The installed Playwright Chromium build is required; VietA11y does not
use or inherit a maintainer's normal browser profile.

## Self-hosted v0.1 safeguards

- The platform URL parser canonicalizes input. Only HTTP and HTTPS are accepted;
  embedded credentials are rejected and fragments are discarded. Default ports
  are normalized; other syntactically valid ports are preserved and checked
  under the same destination policy.
- Literal and DNS-resolved loopback, private, link-local, multicast, and
  selected reserved IPv4/IPv6 destinations are rejected. Every returned DNS
  address must pass the policy.
- Browser-context routing applies the same policy before HTTP(S) navigation,
  redirects, frames, subresources, and popup/new-page requests are dispatched.
  WebSocket routing validates `ws://` and `wss://` destinations before a
  handshake is allowed.
- Navigation is limited to 30 seconds and the overall scan to 60 seconds.
  Pages, contexts, and browsers are closed on success, error, and timeout.
- One process accepts at most two active scans. Excess work fails immediately;
  there is no in-memory queue that can grow without bound.
- Reports retain at most 100 node details per violated rule. The true affected
  element total remains in `totalNodeCount` and in the report summary. Titles,
  selectors, excerpts, failure summaries, and rule text also have deterministic
  length limits.
- The API uses stable Vietnamese error messages and does not return exception
  messages, causes, or stacks. Application code does not log submitted URLs or
  scan-derived page content.

These are defense-in-depth controls, not a complete SSRF boundary. See
[SECURITY.md](SECURITY.md) before exposing a self-hosted instance beyond a
controlled environment.

## Verification

Run the same checks used by CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Scanner integration and Web MVP browser tests use deterministic HTTP fixtures
served on the local loopback interface. Production policy still blocks
loopback. A helper that exists only under scanner test sources requires an
explicit marker and trusts one exact loopback origin; it is not exported by the
scanner package. The Web API has no environment or request-body switch that can
activate this helper. The browser smoke test starts a production Next.js server
and has the test runner fulfill its scan request with the test-only scanner
helper; API mapping is covered separately by service tests. The test suite does
not scan public websites.

## Current limitations

- Automated results cover one captured state of one page and cannot prove full
  WCAG conformance or replace manual testing.
- Only selected axe rules have curated Vietnamese guidance; all other findings
  remain visible with an honest unavailable state.
- Scans are synchronous and have no history, accounts, queue, export, numeric
  score, crawling, authenticated flow, or user cancellation.
- DNS validation and browser dispatch are separate operations. DNS rebinding,
  time-of-check/time-of-use changes, browser/network-stack behavior, and a
  compromised host cannot be fully controlled in application code.
- The two-scan capacity limit is per Node.js process. Multiple instances need
  deployment-level admission and resource controls.
- Chromium is resource-intensive. Operators should set process/container limits
  and restrict outbound network access. Public arbitrary-URL scanning remains
  outside the v0.1 approval boundary.

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
