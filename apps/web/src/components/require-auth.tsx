import { useSession } from "@/hooks/use-session";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
