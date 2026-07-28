import { describe, expect, it } from "vitest";
import { assertSafeOutboundUrl, isPrivateOrReservedIp } from "./safe-outbound-url";

describe("isPrivateOrReservedIp", () => {
  it("flags common private IPv4 ranges", () => {
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
  });

  it("allows public IPv4", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
  });

  it("flags loopback and ULA IPv6", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("flags an IPv4-mapped IPv6 address wrapping a private/metadata IP", () => {
    // The real, double-colon-compressed form.
    expect(isPrivateOrReservedIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
    // Fully uncompressed form.
    expect(isPrivateOrReservedIp("0:0:0:0:0:ffff:127.0.0.1")).toBe(true);
    // Trailing 32 bits as hex groups instead of dotted-decimal.
    expect(isPrivateOrReservedIp("::ffff:7f00:1")).toBe(true);
  });

  it("allows an IPv4-mapped IPv6 address wrapping a public IP", () => {
    expect(isPrivateOrReservedIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("assertSafeOutboundUrl", () => {
  it("rejects non-http schemes and localhost hostnames", async () => {
    await expect(assertSafeOutboundUrl("file:///etc/passwd")).rejects.toThrow(/scheme/i);
    await expect(assertSafeOutboundUrl("http://localhost/hook")).rejects.toThrow(/hostname/i);
    await expect(assertSafeOutboundUrl("http://127.0.0.1/hook")).rejects.toThrow(/address/i);
    await expect(assertSafeOutboundUrl("http://169.254.169.254/latest")).rejects.toThrow(
      /address/i,
    );
  });

  it("allows a public https URL", async () => {
    const url = await assertSafeOutboundUrl("https://example.com/hooks/canvas");
    expect(url.hostname).toBe("example.com");
  });
});
