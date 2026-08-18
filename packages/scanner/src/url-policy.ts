import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ScannerError } from "./errors.js";

const maximumUrlLength = 2_048;

interface Ipv6Cidr {
  network: readonly number[];
  prefixLength: number;
}

const prohibitedIpv6Cidrs = [
  "::/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "100:0:0:1::/64",
  "2001::/32",
  "2001:2::/48",
  "2001:10::/28",
  "2001:20::/28",
  "2001:db8::/32",
  "3fff::/20",
  "5f00::/16",
  "fc00::/7",
  "fe80::/10",
  "fec0::/10",
  "ff00::/8",
].map(parseIpv6Cidr);

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostnameResolver = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export interface DestinationPolicy {
  assertAllowed(url: string): Promise<void>;
}

interface DestinationPolicyOptions {
  resolveHostname?: HostnameResolver;
  trustedTestOrigin?: string;
}

export function canonicalizeScanUrl(input: string): string {
  if (
    typeof input !== "string" ||
    input.trim().length === 0 ||
    input.length > maximumUrlLength
  ) {
    throw invalidUrl();
  }

  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch (error) {
    throw invalidUrl(error);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.hostname.length === 0
  ) {
    throw invalidUrl();
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ScannerError(
      "INVALID_INPUT",
      "URLs containing embedded credentials are not accepted.",
    );
  }

  parsed.hash = "";
  return parsed.href;
}

export function createDestinationPolicy(
  options: DestinationPolicyOptions = {},
): DestinationPolicy {
  const resolver = options.resolveHostname ?? resolveAllAddresses;
  const trustedTestOrigin = readTrustedTestOrigin(options.trustedTestOrigin);
  const resolutions = new Map<string, Promise<readonly ResolvedAddress[]>>();

  return {
    async assertAllowed(input) {
      let parsed: URL;

      try {
        parsed = new URL(input);
      } catch (error) {
        throw new ScannerError(
          "BLOCKED_TARGET",
          "A browser request had an invalid destination URL.",
          error,
        );
      }

      if (!isAllowedBrowserNetworkProtocol(parsed.protocol)) {
        throw new ScannerError(
          "BLOCKED_TARGET",
          "A browser request used a prohibited network scheme.",
        );
      }

      if (parsed.username.length > 0 || parsed.password.length > 0) {
        throw new ScannerError(
          "BLOCKED_TARGET",
          "A browser request contained embedded credentials.",
        );
      }

      if (
        trustedTestOrigin !== undefined &&
        isTrustedTestDestination(parsed, trustedTestOrigin)
      ) {
        return;
      }

      const hostname = normalizeHostname(parsed.hostname);

      if (isLocalhostName(hostname)) {
        throw blockedTarget();
      }

      const ipVersion = isIP(hostname);

      if (ipVersion !== 0) {
        if (isProhibitedAddress(hostname)) {
          throw blockedTarget();
        }
        return;
      }

      let addressesPromise = resolutions.get(hostname);

      if (addressesPromise === undefined) {
        addressesPromise = resolver(hostname);
        resolutions.set(hostname, addressesPromise);
      }

      let addresses: readonly ResolvedAddress[];

      try {
        addresses = await addressesPromise;
      } catch (error) {
        throw new ScannerError(
          "DNS_RESOLUTION_FAILED",
          "The destination hostname could not be resolved.",
          error,
        );
      }

      if (addresses.length === 0) {
        throw new ScannerError(
          "DNS_RESOLUTION_FAILED",
          "The destination hostname did not resolve to an address.",
        );
      }

      for (const result of addresses) {
        if (isIP(result.address) === 0) {
          throw new ScannerError(
            "DNS_RESOLUTION_FAILED",
            "The destination hostname resolved to an invalid address.",
          );
        }

        if (isProhibitedAddress(result.address)) {
          throw blockedTarget();
        }
      }
    },
  };
}

export function isProhibitedAddress(input: string): boolean {
  const version = isIP(input);

  if (version === 4) {
    return isProhibitedIpv4(parseIpv4(input));
  }

  if (version !== 6) {
    return true;
  }

  const words = parseIpv6(input);

  if (words === undefined) {
    return true;
  }

  const first = words[0] ?? 0;

  const isMappedIpv4 =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;

  if (isMappedIpv4) {
    return isProhibitedIpv4([
      (words[6] ?? 0) >> 8,
      (words[6] ?? 0) & 0xff,
      (words[7] ?? 0) >> 8,
      (words[7] ?? 0) & 0xff,
    ]);
  }

  if (prohibitedIpv6Cidrs.some((cidr) => isIpv6InCidr(words, cidr))) {
    return true;
  }

  const isSixToFour = first === 0x2002;

  if (isSixToFour) {
    return isProhibitedIpv4([
      (words[1] ?? 0) >> 8,
      (words[1] ?? 0) & 0xff,
      (words[2] ?? 0) >> 8,
      (words[2] ?? 0) & 0xff,
    ]);
  }

  return false;
}

function parseIpv6Cidr(input: string): Ipv6Cidr {
  const [address, prefixText, ...extra] = input.split("/");
  const prefixLength = Number(prefixText);
  const network = address === undefined ? undefined : parseIpv6(address);

  if (
    extra.length > 0 ||
    network === undefined ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 128
  ) {
    throw new Error(`Invalid internal IPv6 CIDR: ${input}`);
  }

  return { network, prefixLength };
}

function isIpv6InCidr(
  address: readonly number[],
  cidr: Ipv6Cidr,
): boolean {
  const completeWords = Math.floor(cidr.prefixLength / 16);

  for (let index = 0; index < completeWords; index += 1) {
    if (address[index] !== cidr.network[index]) {
      return false;
    }
  }

  const remainingBits = cidr.prefixLength % 16;

  if (remainingBits === 0) {
    return true;
  }

  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return (
    ((address[completeWords] ?? 0) & mask) ===
    ((cidr.network[completeWords] ?? 0) & mask)
  );
}

async function resolveAllAddresses(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function readTrustedTestOrigin(input: string | undefined): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  const parsed = new URL(input);

  if (
    parsed.origin !== input ||
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new Error("The internal test origin must be one exact HTTP(S) origin.");
  }

  return parsed.origin;
}

function isAllowedBrowserNetworkProtocol(protocol: string): boolean {
  return (
    protocol === "http:" ||
    protocol === "https:" ||
    protocol === "ws:" ||
    protocol === "wss:"
  );
}

function isTrustedTestDestination(url: URL, trustedOrigin: string): boolean {
  const trusted = new URL(trustedOrigin);
  const equivalentProtocol =
    url.protocol === "ws:"
      ? "http:"
      : url.protocol === "wss:"
        ? "https:"
        : url.protocol;

  return equivalentProtocol === trusted.protocol && url.host === trusted.host;
}

function normalizeHostname(input: string): string {
  const withoutBrackets =
    input.startsWith("[") && input.endsWith("]") ? input.slice(1, -1) : input;
  return withoutBrackets.toLowerCase().replace(/\.$/, "");
}

function isLocalhostName(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

function parseIpv4(input: string): number[] {
  return input.split(".").map(Number);
}

function isProhibitedIpv4(parts: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function parseIpv6(input: string): number[] | undefined {
  const ipv4Match = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(input);
  let normalized = input;

  if (ipv4Match?.[1] !== undefined) {
    const ipv4 = parseIpv4(ipv4Match[1]);
    normalized = normalized.slice(0, -ipv4Match[1].length) +
      `${(((ipv4[0] ?? 0) << 8) | (ipv4[1] ?? 0)).toString(16)}:` +
      `${(((ipv4[2] ?? 0) << 8) | (ipv4[3] ?? 0)).toString(16)}`;
  }

  const halves = normalized.split("::");

  if (halves.length > 2) {
    return undefined;
  }

  const left = halves[0]?.length === 0 ? [] : halves[0]?.split(":") ?? [];
  const right = halves.length === 1 || halves[1]?.length === 0
    ? []
    : halves[1]?.split(":") ?? [];
  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0;
  const parts = [
    ...left,
    ...Array.from({ length: zeroCount }, () => "0"),
    ...right,
  ];

  if (parts.length !== 8) {
    return undefined;
  }

  const words = parts.map((part) => Number.parseInt(part, 16));
  return words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)
    ? words
    : undefined;
}

function invalidUrl(cause?: unknown): ScannerError {
  return new ScannerError(
    "INVALID_INPUT",
    "A valid absolute HTTP or HTTPS URL is required.",
    cause,
  );
}

function blockedTarget(): ScannerError {
  return new ScannerError(
    "BLOCKED_TARGET",
    "The destination is prohibited by the scanner network policy.",
  );
}
