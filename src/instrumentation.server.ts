import * as Sentry from "@sentry/sveltekit";
import { PUBLIC_SENTRY_DSN } from "$app/env/public";

// Optional — use dynamic public so builds work when PUBLIC_SENTRY_DSN is unset (e.g. Playwright CI).
if (PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: PUBLIC_SENTRY_DSN,
    // Keep DSN in .env for prod parity, but never report from vite/sveltekit dev.
    enabled: !import.meta.env.DEV,
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
    enableLogs: true,
  });
}
