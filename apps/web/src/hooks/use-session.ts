import { trpc } from "@/lib/trpc";

export function useSession() {
  const query = trpc.auth.me.useQuery();
  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
