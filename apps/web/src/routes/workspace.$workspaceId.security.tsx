import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const securityRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/security",
  component: SecurityPage,
});

function SecurityPage() {
  const { workspaceId } = securityRoute.useParams();

  return (
    <div className="max-w-2xl space-y-8 p-6" data-testid="security-page">
      <div className="flex items-center gap-2">
        <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Security</h1>
          <p className="text-muted-foreground text-xs">
            Single sign-on and automatic user provisioning for this workspace.
          </p>
        </div>
      </div>
      <SsoSection workspaceId={workspaceId} />
      <ScimSection workspaceId={workspaceId} />
    </div>
  );
}

const SSO_ROLES = MEMBERSHIP_ROLES.filter((r) => r !== "owner") as Exclude<
  MembershipRole,
  "owner"
>[];

function SsoSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const data = trpc.sso.get.useQuery({ workspaceId });

  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [defaultRole, setDefaultRole] = useState<Exclude<MembershipRole, "owner">>("member");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const config = data.data?.config;
    if (!config) return;
    setIdpEntityId(config.idpEntityId);
    setIdpSsoUrl(config.idpSsoUrl);
    setIdpCertificate(config.idpCertificate);
    setDefaultRole(config.defaultRole as Exclude<MembershipRole, "owner">);
    setEnabled(config.enabled);
  }, [data.data?.config]);

  const upsert = trpc.sso.upsert.useMutation({
    onSuccess: () => void utils.sso.get.invalidate({ workspaceId }),
  });
  const remove = trpc.sso.delete.useMutation({
    onSuccess: () => void utils.sso.get.invalidate({ workspaceId }),
  });

  function handleSave(e: FormEvent) {
    e.preventDefault();
    upsert.mutate({
      workspaceId,
      idpEntityId: idpEntityId.trim(),
      idpSsoUrl: idpSsoUrl.trim(),
      idpCertificate: idpCertificate.trim(),
      defaultRole,
      enabled,
    });
  }

  // Relative to this origin — proxied to the API in dev (vite.config.ts),
  // same-origin behind the prod reverse proxy, same convention every other
  // non-tRPC route in this app already follows (/uploads, /imports, ...).
  const loginUrl = `${window.location.origin}/auth/saml/${workspaceId}/login`;

  return (
    <section className="space-y-3" data-testid="sso-section">
      <h2 className="text-sm font-semibold">Single sign-on</h2>
      <p className="text-muted-foreground text-xs">
        Connect your company's login system (like Okta or Google Workspace) so people sign in here
        with the account they already use for work — no separate Canvas password.
      </p>
      <p className="text-muted-foreground text-xs">
        Technical detail: configure one SAML identity provider for this workspace. Give your IdP
        this service provider entity id / metadata URL:
      </p>
      <Input readOnly value={data.data?.spEntityId ?? ""} className="h-8 font-mono text-xs" />

      <form onSubmit={handleSave} className="space-y-2">
        <Input
          value={idpEntityId}
          onChange={(e) => setIdpEntityId(e.target.value)}
          placeholder="IdP entity id"
          className="h-8 text-sm"
          data-testid="sso-idp-entity-id"
        />
        <Input
          value={idpSsoUrl}
          onChange={(e) => setIdpSsoUrl(e.target.value)}
          placeholder="IdP SSO URL"
          className="h-8 text-sm"
          data-testid="sso-idp-sso-url"
        />
        <textarea
          value={idpCertificate}
          onChange={(e) => setIdpCertificate(e.target.value)}
          placeholder="IdP signing certificate (PEM)"
          className="border-border bg-background h-24 w-full rounded border p-2 font-mono text-xs"
          data-testid="sso-idp-certificate"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs">
            Default role for new members
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value as Exclude<MembershipRole, "owner">)}
              className="border-border bg-background h-7 rounded border text-xs"
              data-testid="sso-default-role"
            >
              {SSO_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              data-testid="sso-enabled"
            />
            Enabled
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={upsert.isPending} data-testid="sso-save">
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
          {data.data?.config && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => remove.mutate({ workspaceId })}
              data-testid="sso-remove"
            >
              Remove
            </Button>
          )}
        </div>
      </form>
      {upsert.error && <p className="text-xs text-red-500">{upsert.error.message}</p>}

      {data.data?.config?.enabled && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">Share this login link with your team:</p>
          <Input
            readOnly
            value={loginUrl}
            className="h-8 font-mono text-xs"
            data-testid="sso-login-url"
          />
        </div>
      )}
    </section>
  );
}

function ScimSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const tokens = trpc.scimToken.list.useQuery({ workspaceId });
  const [name, setName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const create = trpc.scimToken.create.useMutation({
    onSuccess: (created) => {
      void utils.scimToken.list.invalidate({ workspaceId });
      setRevealedToken(created.token);
      setName("");
    },
  });
  const remove = trpc.scimToken.delete.useMutation({
    onSuccess: () => void utils.scimToken.list.invalidate({ workspaceId }),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({ workspaceId, name: name.trim() || "Untitled token" });
  }

  const scimBaseUrl = `${window.location.origin}/scim/v2/${workspaceId}`;

  return (
    <section className="space-y-3" data-testid="scim-section">
      <h2 className="text-sm font-semibold">Automatic member sync</h2>
      <p className="text-muted-foreground text-xs">
        Keep this workspace's members in sync with your company directory automatically — add
        someone there and they're added here; deactivate them there and they lose access here.
      </p>
      <p className="text-muted-foreground text-xs">
        Technical detail: point your IdP&apos;s SCIM connector at this base URL, with a token below
        as its bearer credential.
      </p>
      <Input
        readOnly
        value={scimBaseUrl}
        className="h-8 font-mono text-xs"
        data-testid="scim-base-url"
      />

      {revealedToken && (
        <div
          className="border-border space-y-1 rounded-md border p-3"
          data-testid="revealed-scim-token"
        >
          <p className="text-xs font-medium">Copy this now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={revealedToken} className="h-8 font-mono text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealedToken);
              }}
            >
              Copy
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name, e.g. Okta"
          className="h-8 max-w-xs text-sm"
          data-testid="scim-token-new-name"
        />
        <Button type="submit" size="sm" disabled={create.isPending} data-testid="scim-token-create">
          {create.isPending ? "Creating…" : "New token"}
        </Button>
      </form>
      {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}

      {(tokens.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">No SCIM tokens yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border text-sm">
          {tokens.data?.map((token) => (
            <li
              key={token.id}
              data-testid={`scim-token-row-${token.id}`}
              className="flex items-center justify-between px-3 py-2"
            >
              <div>
                <span className="font-medium">{token.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {token.lastUsedAt
                    ? `last used ${new Date(token.lastUsedAt).toLocaleString()}`
                    : "never used"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate({ scimTokenId: token.id })}
                aria-label={`Delete token ${token.name}`}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
