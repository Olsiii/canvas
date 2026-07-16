import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

function HomePage() {
  const health = trpc.health.useQuery();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Canvas</h1>
      <p className="text-muted-foreground text-sm">
        api status: {health.isLoading ? "checking…" : health.data?.ok ? "connected" : "unreachable"}
      </p>
      <Button onClick={() => health.refetch()}>Recheck</Button>
    </main>
  );
}
