import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type BodyInit, type HeadersInit } from "undici";

async function resolveAndValidate(rawUrl: string): Promise<{ url: URL; address: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid outbound URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked outbound URL scheme: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata"
  ) {
    throw new Error(`Blocked outbound hostname: ${hostname}`);
  }

  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true })).map((r) => r.address);

  if (addresses.length === 0) {
    throw new Error(`Could not resolve outbound hostname: ${hostname}`);
  }

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Blocked outbound address for ${hostname}: ${address}`);
    }
  }

  return { url, address: addresses[0]! };
}

/**
 * Blocks outbound fetches to private/link-local/metadata targets (SSRF).
 * Used before webhook + Slack deliveries that take admin-configured URLs.
 *
 * Note this only validates — it doesn't perform the request, so a caller
 * that validates here and then calls plain `fetch()` separately has a
 * DNS-rebinding TOCTOU gap (a fresh lookup at fetch time could resolve
 * somewhere different than what was just validated). Prefer `safeFetch`
 * below, which closes that gap; this export stays for the one caller
 * (import.ts) that needs the validated URL before deciding how to proceed,
 * not to fetch it immediately.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<URL> {
  const { url } = await resolveAndValidate(rawUrl);
  return url;
}

/**
 * Validates `rawUrl` via the same rules as `assertSafeOutboundUrl`, then
 * fetches it pinned to the exact IP address that was just validated —
 * closing the DNS-rebinding TOCTOU gap a separate assertSafeOutboundUrl()
 * + fetch() would have (the second, independent DNS lookup `fetch()` does
 * internally could resolve a different, private address if an attacker's
 * DNS server changes its answer between the two lookups). `Host`/SNI still
 * use the original hostname — only the connection's IP is pinned.
 */
export async function safeFetch(
  rawUrl: string,
  init?: {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    signal?: AbortSignal;
    redirect?: "follow" | "error" | "manual";
  },
): Promise<Response> {
  const { url, address } = await resolveAndValidate(rawUrl);
  const family = isIP(address) === 6 ? 6 : 4;
  const dispatcher = new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    },
  });

  try {
    return (await undiciFetch(url, { ...init, dispatcher })) as unknown as Response;
  } finally {
    void dispatcher.close();
  }
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // "this" network
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local

  // IPv4-mapped addresses — real ones are double-colon-compressed
  // (`::ffff:a.b.c.d`) or, less commonly, fully written out
  // (`0:0:0:0:0:ffff:a.b.c.d`). A single leading colon never occurs; check
  // both real forms rather than the malformed one, so a private IPv4
  // address smuggled through its IPv6-mapped form doesn't slip past this
  // SSRF guard entirely.
  const mappedDotted = normalized.match(/(?:^::ffff:|(?:^|:)0:ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted?.[1]) return isPrivateIpv4(mappedDotted[1]);

  // Same mapping, but with the trailing 32 bits written as two hex groups
  // instead of dotted-decimal (e.g. `::ffff:7f00:1` for 127.0.0.1) — some
  // platforms normalize to this form.
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1]!, 16);
    const lo = Number.parseInt(mappedHex[2]!, 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIpv4(dotted);
  }

  return false;
}
