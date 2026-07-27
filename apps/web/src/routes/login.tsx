import { JUST_LOGGED_IN_KEY } from "@/components/login-summary-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { rootRoute } from "./__root";

const loginSearchSchema = z.object({
  error: z.string().optional(),
  redirect: z.string().optional(),
});

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { error: oauthError, redirect } = loginRoute.useSearch();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const logIn = trpc.auth.logIn.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      sessionStorage.setItem(JUST_LOGGED_IN_KEY, "1");
      if (redirect) {
        window.location.assign(redirect);
      } else {
        navigate({ to: "/" });
      }
    },
    onError: (err) => setError(err.message),
  });

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <Card className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-xl font-semibold">Log in</h1>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            logIn.mutate({ email, password });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {(error || oauthError) && (
            <p className="text-sm text-red-500">{error ?? "Google sign-in failed. Try again."}</p>
          )}
          <Button type="submit" className="w-full" disabled={logIn.isPending}>
            {logIn.isPending ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <a href="/auth/google" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Continue with Google
        </a>

        <p className="text-muted-foreground text-center text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-foreground underline">
            Sign up
          </Link>
        </p>
      </Card>
    </main>
  );
}
