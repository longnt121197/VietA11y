# Security

## v0.1 security position

VietA11y v0.1 scans one captured state of one page. It is designed for local
development and controlled self-hosting. Automated accessibility scanning does
not prove WCAG conformance and does not provide certification.

The v0.1 hardening controls are application-level defense in depth. Completing
them does not declare unrestricted public arbitrary-URL hosting safe.

## Current controls

The scanner accepts canonical HTTP and HTTPS URLs only, removes fragments, and
rejects embedded credentials. Default ports are normalized and other valid
ports remain subject to the same destination checks. It rejects obvious local, private, link-local,
loopback, multicast, and selected reserved IPv4 and IPv6 destinations, including
IPv4-mapped IPv6 forms. Hostnames are resolved before navigation; an empty,
failed, malformed, or mixed public/prohibited answer set is rejected.

Chromium request-stage interception repeats the destination policy for main
navigation, redirect targets, frames, and HTTP(S) subresources before dispatch.
Each scan uses a fresh, non-persistent context with downloads and service workers
disabled. Browser, context, and page cleanup is attempted for every outcome.

Navigation is bounded to 30 seconds and the overall scan deadline is 60 seconds.
One process permits two active scans and rejects excess work without queuing.
Normalized reports bound retained node details and untrusted string lengths while
preserving true affected-element counts.

The Web API returns fixed user-facing messages rather than internal exception
text, causes, or stacks. Scan-derived values are rendered as React text. Axe
reference links become clickable only after an HTTP/HTTPS protocol check. The
application does not intentionally log submitted URLs, query strings, fragments,
page HTML, selectors, axe excerpts, or browsing state.

## Remaining limitations

Application checks cannot eliminate DNS rebinding or the time-of-check/time-of-
use gap between Node.js resolution and Chromium's connection. They also cannot
guarantee that every future browser/network-stack behavior will pass through the
same interception path. A compromised runtime or host is outside this boundary.

The concurrency guard is process-local. It does not coordinate multiple Node.js
instances and is not distributed rate limiting. Chromium also consumes material
CPU, memory, process, file-descriptor, and network resources even when deadlines
are enforced.

For any exposure beyond a controlled environment, use deployment-level outbound
network policy that denies private/internal/metadata networks, isolate the
scanner runtime, apply request/body and process/container limits, bound replicas
and admission, keep Node.js and Playwright Chromium patched, and monitor resource
use without recording sensitive scan data. A public service needs a separate
threat review and security gate.

## Test-only loopback seam

Production `scanPage()` always blocks loopback. Deterministic integration and E2E
tests use an internal helper that requires an explicit marker and one exact
loopback origin. It is not a general allowlist and is not accepted from the
`POST /api/scans` request body. Do not set the internal fixture environment
variables in a deployed instance.

## Supported runtime

The supported v0.1 development runtime is Node.js 22 or newer, npm 10 or newer,
and the Chromium build installed by the repository's Playwright dependency:

```sh
npm run browser:install --workspace @vieta11y/scanner
```

Review dependency updates and run the complete lint, typecheck, test, build, and
browser E2E checks before release.

## Reporting a vulnerability

Please avoid including secrets, private URLs, page content, or reproduction data
from systems you do not own in a public report. Use the repository host's private
security-reporting channel when available; otherwise contact a maintainer before
sharing sensitive details.
