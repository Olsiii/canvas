import { MEMBERSHIP_ROLES, type MembershipRole } from "@canvas/shared";
import { CanvasLogo } from "@/components/canvas-logo";
import { RequireAuth } from "@/components/require-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, LogOut, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { rootRoute } from "./__root";

type InvitableRole = Exclude<MembershipRole, "owner">;
const INVITABLE_ROLES = MEMBERSHIP_ROLES.filter((r): r is InvitableRole => r !== "owner");

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: "bg-accent-soft text-accent",
  admin: "bg-status-warning/15 text-status-warning",
  member: "bg-muted text-muted-foreground",
  guest: "bg-muted text-muted-foreground",
};

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

function Dashboard() {
  const { user } = useSession();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspace.listMine.useQuery();

  const logOut = trpc.auth.logOut.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate({ to: "/login" });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 py-16">
      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <CanvasLogo size={72} />
          <div>
            <h1 className="text-xl font-semibold">Canvas</h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/account"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm"
            aria-label="Account settings"
            title="Account settings"
          >
            <User className="h-3.5 w-3.5" aria-hidden />
            Account
          </Link>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => logOut.mutate()}>
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Log out
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </span>
            <CardTitle>Your workspaces</CardTitle>
          </div>
          <Link
            to="/workspaces/new"
            className="text-accent flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            New workspace
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspaces.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {workspaces.data?.length === 0 && (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              You're not in a workspace yet — create one to get started.
            </div>
          )}

          <ul className="divide-border divide-y rounded-md border">
            {workspaces.data?.map(({ workspace, role }) => (
              <li key={workspace.id}>
                <WorkspaceRow workspaceId={workspace.id} name={workspace.name} role={role} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

// Custom-role option values are prefixed so they can't collide with a bare
// base-role value (e.g. "member") — selecting one still needs a base role
// too (invites.role stays required, see workspaces.ts's schema comment), so
// choosing a custom role option looks up that role's own baseRole to fill it.
const CUSTOM_ROLE_PREFIX = "custom:";

function WorkspaceRow({
  workspaceId,
  name,
  role,
}: {
  workspaceId: string;
  name: string;
  role: string;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("member");
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const canInvite = role === "owner" || role === "admin";

  const customRoles = trpc.role.list.useQuery({ workspaceId }, { enabled: canInvite });

  const invite = trpc.workspace.invite.useMutation({
    onSuccess: (data) => {
      setInviteLink(`${window.location.origin}/invite/${data.id}`);
      setInviteEmail("");
      setInviteCustomRoleId(null);
    },
    onError: (err) => setInviteError(err.message),
  });

  function handleRoleChange(value: string) {
    if (value.startsWith(CUSTOM_ROLE_PREFIX)) {
      const customRoleId = value.slice(CUSTOM_ROLE_PREFIX.length);
      const customRole = customRoles.data?.find((r) => r.id === customRoleId);
      if (!customRole) return;
      setInviteRole(customRole.baseRole as InvitableRole);
      setInviteCustomRoleId(customRoleId);
    } else {
      setInviteRole(value as InvitableRole);
      setInviteCustomRoleId(null);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-medium">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${ROLE_BADGE_CLASS[role] ?? "bg-muted text-muted-foreground"}`}
          >
            {role}
          </span>
          <Link
            to="/w/$workspaceId"
            params={{ workspaceId }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open
          </Link>
        </div>
      </div>

      {canInvite && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setInviteError(null);
            setInviteLink(null);
            invite.mutate({
              workspaceId,
              email: inviteEmail,
              role: inviteRole,
              customRoleId: inviteCustomRoleId ?? undefined,
            });
          }}
        >
          <Input
            type="email"
            placeholder="teammate@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select
            value={inviteCustomRoleId ? `${CUSTOM_ROLE_PREFIX}${inviteCustomRoleId}` : inviteRole}
            aria-label="Invite role"
            onChange={(e) => handleRoleChange(e.target.value)}
            className="border-border bg-background h-9 rounded-md border px-2 text-sm"
          >
            <optgroup label="Role">
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </optgroup>
            {(customRoles.data?.length ?? 0) > 0 && (
              <optgroup label="Custom role">
                {customRoles.data?.map((r) => (
                  <option key={r.id} value={`${CUSTOM_ROLE_PREFIX}${r.id}`}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <Button type="submit" size="sm" disabled={invite.isPending}>
            Invite
          </Button>
        </form>
      )}
      {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
      {inviteLink && (
        <p className="text-muted-foreground break-all text-xs">
          Invite link: <span className="text-foreground">{inviteLink}</span>
        </p>
      )}
    </div>
  );
}
