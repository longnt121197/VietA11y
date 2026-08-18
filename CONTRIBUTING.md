# Contributing to VietA11y

Thank you for helping make web accessibility knowledge more useful for
Vietnamese teams. Focused bug fixes, tests, documentation, interface feedback,
and carefully researched Vietnamese guidance are welcome.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites and setup

- Node.js 22 or newer
- npm 10 or newer
- Git

```sh
git clone https://github.com/longnt121197/vieta11y.git
cd vieta11y
npm ci
npm run browser:install --workspace @vieta11y/scanner
```

Start the development server with `npm run dev`, then open the local URL printed
by Next.js. The app runs locally, but its production policy intentionally blocks
scanning localhost and private-network destinations.

### Chromium installation troubleshooting

The scanner drives a real Chromium through Playwright, so `npm ci` alone is not
enough to run the tests. Installing that browser is the setup step most likely
to fail, and it fails differently on each operating system.

**The browser is missing.** The scanner's integration tests do not report this
as a setup problem. They fail as ordinary assertion failures inside
`packages/scanner/test/scan-page.test.mjs`, and the real cause appears further
down the output as a `[cause]` on the error:

```
browserType.launch: Executable doesn't exist at
  ...\ms-playwright\chromium_headless_shell-...\chrome-headless-shell...
```

If you see that, the fix is to run the install step:

```sh
npm run browser:install --workspace @vieta11y/scanner
```

The command is safe to re-run. It downloads only what is missing, so it is also
the first thing to try after a Playwright version bump in `package-lock.json` —
a new Playwright expects a matching browser build, and the old one no longer
satisfies it.

**Platform dependencies are missing (Linux).** On Linux the download can succeed
while Chromium still refuses to start, because the shared libraries it links
against are not present. The failure names a missing `lib*.so` rather than a
missing executable. Install the system packages alongside the browser:

```sh
npx playwright install --with-deps chromium
```

`--with-deps` uses the system package manager and will ask for elevation. It is
Linux-only; on macOS and Windows the plain `browser:install` above is all that
is needed, and this is why CI — which runs on Linux — uses the `--with-deps`
form while local setup does not.

**Still failing.** Check that `npx playwright --version` matches the
`playwright` version resolved in `package-lock.json` (the scanner depends on
`playwright`, not `@playwright/test`), and see the official
[Playwright browser installation
guide](https://playwright.dev/docs/browsers#install-browsers) and its
[system requirements](https://playwright.dev/docs/intro#system-requirements).
If a check genuinely cannot run in your environment, say which one and why in
the pull request rather than working around the browser or URL protections.

## Verification

Run the same checks as CI before submitting a pull request:

```sh
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Tests use deterministic local fixtures and must not depend on arbitrary public
websites. If a required check cannot run in your environment, explain exactly
which check and why in the pull request.

## Project structure

- `apps/web`: Next.js UI, `POST /api/scans`, and accessible report presentation.
- `apps/web/test`: API and browser end-to-end tests.
- `packages/scanner`: framework-independent Playwright/axe scanner and public
  serializable report/error types.
- `packages/scanner/src/knowledge`: curated Vietnamese knowledge lookup.
- `packages/scanner/test`: scanner, normalization, URL-policy, and knowledge
  tests.

The web app may depend on the scanner. The scanner must not depend on Next.js,
React, or application-specific HTTP behavior.

## Report a bug

Use the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml). Include the
VietA11y version, environment, Node.js version, expected and actual behavior,
and the smallest safe reproduction you can provide.

Remove secrets, query strings, private URLs, page content, selectors, and other
sensitive scan data from logs and examples. Security vulnerabilities belong in
[GitHub private vulnerability reporting](https://github.com/longnt121197/vieta11y/security/advisories/new),
not a public issue; see [SECURITY.md](SECURITY.md).

## Propose a change

Use the [feature request form](.github/ISSUE_TEMPLATE/feature_request.yml) to
describe the problem before proposing a large change. Search existing issues
first. Small documentation or test corrections can go directly to a focused
pull request when their purpose is clear.

VietA11y v0.1 covers one URL, one page, and one captured state. Do not quietly
add crawling, authenticated flows, accounts, history, queues, exports, scores,
AI remediation, a CLI, a GitHub Action, a browser extension, or public-hosting
behavior. Security-sensitive changes need explicit maintainer agreement and
review.

## Add or improve Vietnamese guidance

Curated entries are original project content, not translations copied from axe
documentation. Keep the wording practical, technically accurate, and easy for
Vietnamese readers to apply. Every automated finding must remain visible even
when VietA11y has no curated entry.

1. Verify the exact axe-core rule ID against the version installed by this
   repository.
2. Inspect authoritative axe rule metadata and its linked accessibility
   references; do not infer a fix from the rule name alone.
3. Add or update the typed entry in
   `packages/scanner/src/knowledge/rules.vi.ts`. Its record key and `ruleId`
   must match.
4. Write technically accurate, original Vietnamese explanation, impact, and
   remediation text. Add a safe example only when it makes the fix clearer.
5. Add or update tests in `packages/scanner/test/knowledge.test.mjs` and any
   normalization test affected by the change.
6. Run lint, typecheck, tests, build, and `git diff --check`.
7. Submit a focused pull request that names the references reviewed and explains
   important wording decisions.

For early feedback, use the
[Vietnamese guidance proposal form](.github/ISSUE_TEMPLATE/vietnamese_guidance.yml).

## Accessibility expectations

VietA11y must not introduce accessibility regressions while reporting them.
Use semantic HTML, keyboard-operable controls, visible labels, logical headings,
accessible errors and status updates, visible focus, and readable code excerpts.
Treat every scanned string as untrusted text; never render scanned HTML as raw
HTML.

For interface changes, describe keyboard and screen-reader considerations and
add deterministic browser coverage where practical. Automated axe checks are
useful but do not replace manual review.

## Pull request expectations

- Keep the change small and within the agreed issue or v0.1 scope.
- Add or update tests for behavior changes.
- Update documentation only where behavior or contributor workflow requires it.
- Do not add dependencies unless the platform and current dependencies cannot
  reasonably solve the need; explain any addition.
- Preserve public API boundaries and avoid unrelated refactors.
- Complete the pull request checklist and respond constructively to review.

The project favors readable TypeScript, explicit types, deterministic behavior,
small functions, and straightforward tests over speculative abstractions.
