import { beforeEach, describe, expect, it, vi } from "vitest";

const agentConstructorMock = vi.fn();
const dispatcherCloseMock = vi.fn();
const undiciFetchMock = vi.fn();

vi.mock("undici", () => ({
  Agent: class {
    constructor(opts: unknown) {
      agentConstructorMock(opts);
    }
    close = dispatcherCloseMock;
  },
  fetch: (...args: unknown[]) => undiciFetchMock(...args),
}));

const { assertSafeOutboundUrl, isPrivateOrReservedIp, safeFetch } =
  await import("./safe-outbound-url");

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

describe("safeFetch", () => {
  beforeEach(() => {
    agentConstructorMock.mockReset();
    dispatcherCloseMock.mockReset();
    undiciFetchMock.mockReset();
    undiciFetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  it("pins the connection's DNS lookup to the exact address it just validated", async () => {
    await safeFetch("https://example.com/hooks/canvas", { method: "POST" });

    expect(agentConstructorMock).toHaveBeenCalledTimes(1);
    const options = agentConstructorMock.mock.calls[0]![0] as {
      connect: { lookup: (hostname: string, opts: unknown, cb: (...a: unknown[]) => void) => void };
    };

    // The pinned lookup never re-resolves — it answers from the address
    // resolveAndValidate already found and checked, whatever hostname is
    // asked (this is what closes the DNS-rebinding TOCTOU gap: undici's
    // own connection logic can't get a different answer than what was
    // just validated, no matter when it asks).
    const callback = vi.fn();
    options.connect.lookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    const [err, address, family] = callback.mock.calls[0]!;
    expect(err).toBeNull();
    expect(typeof address).toBe("string");
    expect([4, 6]).toContain(family);
  });

  it("passes the request through to undici's fetch with the pinned dispatcher", async () => {
    await safeFetch("https://example.com/hooks/canvas", { method: "POST" });

    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = undiciFetchMock.mock.calls[0]! as [URL, { dispatcher: unknown }];
    expect(url.hostname).toBe("example.com");
    expect(init.dispatcher).toBeDefined();
  });

  it("closes the pinned dispatcher after the request settles", async () => {
    await safeFetch("https://example.com/hooks/canvas");
    expect(dispatcherCloseMock).toHaveBeenCalledTimes(1);
  });

  it("closes the pinned dispatcher even when the fetch itself throws", async () => {
    undiciFetchMock.mockRejectedValue(new Error("network error"));
    await expect(safeFetch("https://example.com/hooks/canvas")).rejects.toThrow("network error");
    expect(dispatcherCloseMock).toHaveBeenCalledTimes(1);
  });

  it("still rejects a blocked address before ever constructing a dispatcher", async () => {
    await expect(safeFetch("http://127.0.0.1/hook")).rejects.toThrow(/address/i);
    expect(agentConstructorMock).not.toHaveBeenCalled();
    expect(undiciFetchMock).not.toHaveBeenCalled();
  });
});
