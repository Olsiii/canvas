import * as Sentry from "@sentry/react";

/** No-op when VITE_SENTRY_DSN is unset — paste the real DSN in .env for prod. */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
  });
}
