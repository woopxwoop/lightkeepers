import { defineEnvVars } from "@sveltejs/kit/env";

/**
 * Optional vars coerce a missing value to "" so existing truthiness checks
 * still mean "unset". Auth secrets stay undefined until `getAuth()` so a
 * build without private env can still succeed.
 */
export const variables = defineEnvVars({
  PUBLIC_SENTRY_DSN: { public: true, schema: (input) => input ?? "" },
  METRICS_TOKEN: { schema: (input) => input ?? "" },
  RESEARCH_AGENT_URL: { schema: (input) => input ?? "" },
  RESEARCH_API_TOKEN: { schema: (input) => input ?? "" },
  PUBLIC_SUPABASE_URL: { public: true, static: true },
  PUBLIC_SUPABASE_KEY: { public: true, static: true },
  PRIVATE_SUPABASE_KEY: { schema: (input) => input ?? "" },
  VALKEY_URL: { schema: (input) => input ?? "" },
  REDIS_URL: { schema: (input) => input ?? "" },
  DATABASE_URL: { schema: (input) => input },
  BETTER_AUTH_SECRET: { schema: (input) => input },
  BETTER_AUTH_URL: { schema: (input) => input },
  GOOGLE_CLIENT_ID: { schema: (input) => input },
  GOOGLE_CLIENT_SECRET: { schema: (input) => input },
  DISCORD_CLIENT_ID: { schema: (input) => input },
  DISCORD_CLIENT_SECRET: { schema: (input) => input },
});
