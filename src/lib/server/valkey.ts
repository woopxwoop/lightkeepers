/**
 * Optional Valkey / Redis client for shared cache across pm2 workers.
 *
 * Set VALKEY_URL (preferred) or REDIS_URL, e.g. redis://127.0.0.1:6379
 * or redis://valkey:6379 when the app shares a Docker network with the
 * valkey service in docker-compose.yml.
 *
 * When unset, callers fall back to in-process LRU only.
 */

import { createClient, type RedisClientType } from "redis";
import { env } from "$env/dynamic/private";

let client: RedisClientType | null | undefined;
let connecting: Promise<RedisClientType | null> | null = null;

function redisUrl(): string | undefined {
  const url = env.VALKEY_URL?.trim() || env.REDIS_URL?.trim();
  return url || undefined;
}

/** Lazy-connect once per process. Returns null if URL missing or connect fails. */
export async function getValkey(): Promise<RedisClientType | null> {
  if (client !== undefined) return client;
  if (connecting) return connecting;

  const url = redisUrl();
  if (!url) {
    client = null;
    return null;
  }

  connecting = (async () => {
    try {
      const c = createClient({
        url,
        socket: {
          connectTimeout: 2_000,
          reconnectStrategy: (retries) => {
            if (retries >= 3) return false;
            return Math.min(retries * 200, 1_000);
          },
        },
      });
      c.on("error", (err) => {
        console.error("[valkey] client error:", err);
      });
      await c.connect();
      client = c;
      return c;
    } catch (err) {
      console.error("[valkey] connect failed — using memory cache only:", err);
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export async function valkeyGetJson<T>(key: string): Promise<T | undefined> {
  const c = await getValkey();
  if (!c) return undefined;
  try {
    const raw = await c.get(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[valkey] GET failed:", key, err);
    return undefined;
  }
}

export async function valkeySetJson(
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  const c = await getValkey();
  if (!c) return;
  try {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    await c.set(key, JSON.stringify(value), { EX: ttlSec });
  } catch (err) {
    console.error("[valkey] SET failed:", key, err);
  }
}
