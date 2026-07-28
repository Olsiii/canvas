import * as Sentry from "@sentry/node";
import { env } from "../env";

let initialized = false;

/** No-op when SENTRY_DSN is unset — safe for local/dev without keys. */
export function initSentry(service: "api" | "worker") {
  if (initialized || !env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    initialScope: { tags: { service } },
  });
  initialized = true;
}

export function captureException(error: unknown) {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(error);
}

export { Sentry };
