import { MEMBERSHIP_ROLES, type MembershipRole } from "@canvas/shared";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rootRoute } from "./__root";

type InvitableRole = Exclude<MembershipRole, "owner">;
const INVITABLE_ROLES = MEMBERSHIP_ROLES.filter((r): r is InvitableRole => r !== "owner");

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Canvas</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => logOut.mutate()}>
          Log out
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Your workspaces</h2>
          <Link to="/workspaces/new" className="text-sm underline">
            New workspace
          </Link>
        </div>

        {workspaces.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {workspaces.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            You're not in a workspace yet — create one to get started.
          </p>
        )}

        <ul className="divide-border divide-y rounded-md border">
          {workspaces.data?.map(({ workspace, role }) => (
            <li key={workspace.id}>
              <WorkspaceRow workspaceId={workspace.id} name={workspace.name} role={role} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const canInvite = role === "owner" || role === "admin";

  const invite = trpc.workspace.invite.useMutation({
    onSuccess: (data) => {
      setInviteLink(`${window.location.origin}/invite/${data.id}`);
      setInviteEmail("");
    },
    onError: (err) => setInviteError(err.message),
  });

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{name}</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs uppercase">{role}</span>
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="text-sm underline">
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
            invite.mutate({ workspaceId, email: inviteEmail, role: inviteRole });
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
            value={inviteRole}
            aria-label="Invite role"
            onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
            className="border-border bg-background h-9 rounded-md border px-2 text-sm"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
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
