import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { env } from "$env/dynamic/private";

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function createAuth() {
  const pool = new Pool({
    connectionString: required("DATABASE_URL"),
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (err) => {
    console.error("[auth] idle pg client error:", err);
  });

  return betterAuth({
    database: pool,
    secret: required("BETTER_AUTH_SECRET"),
    socialProviders: {
      google: {
        clientId: required("GOOGLE_CLIENT_ID"),
        clientSecret: required("GOOGLE_CLIENT_SECRET"),
      },
      discord: {
        clientId: required("DISCORD_CLIENT_ID"),
        clientSecret: required("DISCORD_CLIENT_SECRET"),
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

let _auth: Auth | undefined;

/** Lazy so `vite build` does not need private secrets in the image. */
export function getAuth(): Auth {
  return (_auth ??= createAuth());
}
