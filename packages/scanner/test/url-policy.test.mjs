import assert from "node:assert/strict";
import test from "node:test";

import { ScannerError } from "../dist/index.js";
import {
  canonicalizeScanUrl,
  createDestinationPolicy,
  isProhibitedAddress,
} from "../dist/url-policy.js";

test("canonicalizes HTTP(S), strips fragments, and normalizes default ports", () => {
  assert.equal(canonicalizeScanUrl(" http://Example.COM:80/a#private "), "http://example.com/a");
  assert.equal(canonicalizeScanUrl("https://Example.COM:443/a?q=1#section"), "https://example.com/a?q=1");
});

test("rejects malformed, unsupported, credentialed, and oversized URLs", () => {
  const inputs = [
    "not-a-url",
    "file:///tmp/page.html",
    "ftp://example.com/file",
    "https://user@example.com/",
    "https://user:secret@example.com/",
    `https://example.com/${"a".repeat(2_100)}`,
  ];

  for (const input of inputs) {
    assert.throws(
      () => canonicalizeScanUrl(input),
      (error) => error instanceof ScannerError && error.code === "INVALID_INPUT",
    );
  }
});

test("classifies representative IPv4 and IPv6 prohibited destinations", () => {
  const prohibited = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "::1",
    "::",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "2002:7f00:1::",
  ];

  for (const address of prohibited) {
    assert.equal(isProhibitedAddress(address), true, address);
  }

  assert.equal(isProhibitedAddress("93.184.216.34"), false);
  assert.equal(isProhibitedAddress("2606:4700:4700::1111"), false);
});

test("blocks localhost names and normalized IPv4 literal variants", async () => {
  const policy = createDestinationPolicy();

  for (const url of [
    "http://localhost/",
    "http://api.localhost./",
    "http://127.1/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
  ]) {
    await assert.rejects(
      policy.assertAllowed(url),
      (error) => error instanceof ScannerError && error.code === "BLOCKED_TARGET",
      url,
    );
  }
});

test("checks every DNS answer and rejects if any address is prohibited", async () => {
  const allowed = createDestinationPolicy({
    async resolveHostname() {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:4700:4700::1111", family: 6 },
      ];
    },
  });
  await allowed.assertAllowed("https://public.example/");

  const mixed = createDestinationPolicy({
    async resolveHostname() {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.2", family: 4 },
      ];
    },
  });
  await assert.rejects(
    mixed.assertAllowed("https://mixed.example/"),
    (error) => error instanceof ScannerError && error.code === "BLOCKED_TARGET",
  );
});

test("reports DNS failures and empty results with a typed error", async () => {
  for (const resolveHostname of [
    async () => { throw new Error("internal resolver detail"); },
    async () => [],
  ]) {
    const policy = createDestinationPolicy({ resolveHostname });
    await assert.rejects(
      policy.assertAllowed("https://unresolved.example/"),
      (error) => error instanceof ScannerError && error.code === "DNS_RESOLUTION_FAILED",
    );
  }
});

test("the test seam trusts only one exact origin", async () => {
  const policy = createDestinationPolicy({ trustedTestOrigin: "http://127.0.0.1:4321" });
  await policy.assertAllowed("http://127.0.0.1:4321/fixture");
  await assert.rejects(
    policy.assertAllowed("http://127.0.0.1:4322/fixture"),
    (error) => error instanceof ScannerError && error.code === "BLOCKED_TARGET",
  );
});
