import { env } from "../env";

export interface ParsedPullRequestUrl {
  owner: string;
  repo: string;
  number: number;
}

const PR_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

/** Pure so it's unit-testable without a live API — see automation-engine.ts's own pure/impure split. */
export function parsePullRequestUrl(url: string): ParsedPullRequestUrl {
  const match = PR_URL_PATTERN.exec(url.trim());
  if (!match) {
    throw new Error(
      "That doesn't look like a GitHub pull request URL (expected github.com/owner/repo/pull/123)",
    );
  }
  const [, owner, repo, number] = match;
  return { owner: owner!, repo: repo!, number: Number(number) };
}

export interface FetchedPullRequest {
  title: string;
  state: "open" | "closed" | "merged";
}

/**
 * Thin wrapper over the public GitHub REST API. `baseUrl` defaults to the
 * real API but is injectable (and overridden in test envs via
 * GITHUB_API_BASE_URL — see env.ts) so the PR-link spec can point it at a
 * local mock server instead of the real GitHub, the same seam
 * clickup-client.ts's CLICKUP_API_BASE_URL established. No auth token —
 * public-repo PRs only for now (see PROGRESS.md, M5.6 decisions); a
 * private/nonexistent repo or rate-limit simply leaves the link's state as
 * "unknown" rather than failing the whole request.
 */
export class GitHubClient {
  constructor(private readonly baseUrl: string = env.GITHUB_API_BASE_URL) {}

  async getPullRequest(owner: string, repo: string, number: number): Promise<FetchedPullRequest> {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "canvas-app" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API returned status ${response.status} for ${owner}/${repo}#${number}`,
      );
    }
    const body = (await response.json()) as {
      title: string;
      state: "open" | "closed";
      merged: boolean;
    };
    return { title: body.title, state: body.merged ? "merged" : body.state };
  }
}
