import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient, parsePullRequestUrl } from "./github-client";

describe("parsePullRequestUrl", () => {
  it("parses owner/repo/number out of a PR URL", () => {
    expect(parsePullRequestUrl("https://github.com/acme/widgets/pull/42")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  it("tolerates a trailing slash or query string", () => {
    expect(parsePullRequestUrl("https://github.com/acme/widgets/pull/42/")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
    expect(parsePullRequestUrl("https://github.com/acme/widgets/pull/42?diff=split")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  it("throws for a non-PR GitHub URL", () => {
    expect(() => parsePullRequestUrl("https://github.com/acme/widgets/issues/42")).toThrow();
  });

  it("throws for a non-GitHub URL", () => {
    expect(() => parsePullRequestUrl("https://gitlab.com/acme/widgets/pull/42")).toThrow();
  });
});

describe("GitHubClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps merged:true to state 'merged' regardless of the raw state field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ title: "Fix bug", state: "closed", merged: true }),
      }),
    );
    const client = new GitHubClient("https://fake.github.test");

    const pr = await client.getPullRequest("acme", "widgets", 42);

    expect(pr).toEqual({ title: "Fix bug", state: "merged" });
  });

  it("passes through the raw state when not merged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ title: "WIP", state: "open", merged: false }),
      }),
    );
    const client = new GitHubClient("https://fake.github.test");

    const pr = await client.getPullRequest("acme", "widgets", 7);

    expect(pr).toEqual({ title: "WIP", state: "open" });
  });

  it("throws with the failing status when the API responds non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );
    const client = new GitHubClient("https://fake.github.test");

    await expect(client.getPullRequest("acme", "widgets", 999)).rejects.toThrow(/404/);
  });
});
