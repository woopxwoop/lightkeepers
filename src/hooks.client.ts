import * as Sentry from "@sentry/sveltekit";
import { PUBLIC_SENTRY_DSN } from "$app/env/public";

// Optional — dynamic public so client builds succeed without PUBLIC_SENTRY_DSN.
// Never report from vite/sveltekit dev (mirrors instrumentation.server.ts).
if (PUBLIC_SENTRY_DSN && !import.meta.env.DEV) {
  Sentry.init({
    dsn: PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });

  // Replay is ~75 KB gz — keep it off the entry chunk. Fetched from Sentry's CDN
  // (pinned to the installed SDK version) after init; errors before it lands
  // simply have no replay attached. A blocked fetch must not surface as an error.
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => Sentry.addIntegration(replayIntegration()))
    .catch(() => {});
}

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = Sentry.handleErrorWithSentry();
