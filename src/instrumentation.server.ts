import * as Sentry from "@sentry/sveltekit";
import { PUBLIC_SENTRY_DSN } from "$app/env/public";

// Optional — use dynamic public so builds work when PUBLIC_SENTRY_DSN is unset (e.g. Playwright CI).
// Skip init entirely in dev: `enabled: false` still installs Sentry's ESM loader hook
// (module.register → DEP0205 warning + import-in-the-middle overhead on every SSR import).
if (PUBLIC_SENTRY_DSN && !import.meta.env.DEV) {
  Sentry.init({
    dsn: PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableLogs: true,
  });
}
