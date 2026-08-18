# Changelog

## [0.1.0] - 2026-08-18

### Added

- Single-page automated accessibility scanning with Playwright and axe-core.
- A normalized, serializable `ScanReport` model with transparent violated-rule,
  affected-element occurrence, and impact summaries.
- Ten curated Vietnamese accessibility guidance entries, with an honest
  unavailable state for unsupported axe rules while retaining every finding.
- A web scanning interface with accessible loading, error, and report states.
- Deterministic local scanner, API, and browser end-to-end tests.

### Security

- An HTTP/HTTPS destination policy with credential rejection and blocking for
  local, private, link-local, multicast, and selected reserved networks.
- DNS answer validation and browser-context protections for redirects, frames,
  subresources, popups/new pages, and WebSocket destinations.
- Bounded navigation and total scan times, report-data retention limits, and a
  per-process concurrency limit.
- Fixed API error messages that redact scanner internals and isolated,
  non-persistent Playwright browser contexts with cleanup on every outcome.

These application-level controls provide defense in depth; they do not
guarantee protection against every SSRF or network attack.

### Documentation

- Documented the controlled self-hosting position and the limitations of
  automated accessibility testing.
- Added the public-hosting warning, remaining security limitations, deployment
  guidance, and private vulnerability-reporting instructions.
