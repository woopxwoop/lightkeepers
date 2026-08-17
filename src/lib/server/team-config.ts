/**
 * Server helpers for /teams/configs/[slug] (slug = InvestmentSim.state_key).
 */
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import { getSimConfigUrl, getSimRotationUrl } from "$lib/utils";
import type {
  InvestmentFile,
  InvestmentSim,
  InvestmentTeam,
  RotationAction,
  RotationSample,
  RotationSampleEvent,
} from "$lib/types/investment";

const gunzipAsync = promisify(gunzip);
const CDN_INVESTMENT = "https://api.lightkeepers.moe/sim/investment.json.gz";
const investmentCache = new LRUCache<InvestmentFile>(1, 15 * 60 * 1000, {
  redisNamespace: "investment",
});
const configCache = new LRUCache<string | null>(200, 15 * 60 * 1000, {
  redisNamespace: "team-config",
});
const rotationCache = new LRUCache<RotationSample | null>(200, 15 * 60 * 1000, {
  redisNamespace: "team-rotation",
});

const ROTATION_ACTIONS = new Set<RotationAction>([
  "swap",
  "skill",
  "hold_skill",
  "burst",
  "attack",
  "charge",
  "aim",
  "dash",
  "jump",
  "walk",
  "low_plunge",
  "high_plunge",
  "wait",
  "delay",
  "other",
]);

function isGzipped(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

async function fetchInvestment(): Promise<InvestmentFile> {
  const res = await fetchWithTimeout(CDN_INVESTMENT);
  if (!res.ok) throw new Error(`investment CDN HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const raw = isGzipped(buf)
    ? (await gunzipAsync(buf)).toString("utf-8")
    : buf.toString("utf-8");
  return JSON.parse(raw) as InvestmentFile;
}

export async function getInvestmentFile(): Promise<InvestmentFile> {
  return investmentCache.getOrSet("investment", fetchInvestment);
}

export function findInvestmentTeam(
  file: InvestmentFile,
  teamKey: string,
): InvestmentTeam | null {
  return file.teams.find((t) => t.team_key === teamKey) ?? null;
}

/** Resolve a sim by its unique `state_key` (cons + weapons). */
export function findInvestmentSim(
  file: InvestmentFile,
  stateKey: string,
): { team: InvestmentTeam; sim: InvestmentSim } | null {
  for (const team of file.teams) {
    const sim = team.results.find((r) => r.state_key === stateKey);
    if (sim) return { team, sim };
  }
  return null;
}

/** Prefer kind===baseline; else lowest-cost result. */
export function pickBaselineSim(team: InvestmentTeam): InvestmentSim | null {
  const baseline = team.results.find((r) => r.kind === "baseline");
  if (baseline) return baseline;
  if (!team.results.length) return null;
  return [...team.results].sort((a, b) => a.cost - b.cost || b.dps - a.dps)[0];
}

/**
 * Concurrent misses share one request. 404/410 cache as null; transport / 5xx
 * stay uncached (getOrSet would poison L1 on thrown errors — use inflight map).
 */
const configInflight = new Map<string, Promise<string | null>>();

export async function getSimConfigText(
  stateKey: string,
): Promise<string | null> {
  const cached = configCache.get(stateKey);
  if (cached !== undefined) return cached;

  const inflight = configInflight.get(stateKey);
  if (inflight) return inflight;

  const pending = loadSimConfigFromCdn(stateKey).finally(() => {
    configInflight.delete(stateKey);
  });
  configInflight.set(stateKey, pending);
  return pending;
}

async function loadSimConfigFromCdn(stateKey: string): Promise<string | null> {
  const res = await fetchWithTimeout(getSimConfigUrl(stateKey));
  if (res.status === 404 || res.status === 410) {
    configCache.set(stateKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`sim config ${stateKey} unavailable: HTTP ${res.status}`);
  }
  const text = await res.text();
  configCache.set(stateKey, text);
  return text;
}

const rotationInflight = new Map<string, Promise<RotationSample | null>>();

export async function getSimRotationSample(
  stateKey: string,
): Promise<RotationSample | null> {
  const cached = rotationCache.get(stateKey);
  if (cached !== undefined) return cached;

  const inflight = rotationInflight.get(stateKey);
  if (inflight) return inflight;

  const pending = loadSimRotationFromCdn(stateKey).finally(() => {
    rotationInflight.delete(stateKey);
  });
  rotationInflight.set(stateKey, pending);
  return pending;
}

function asRotationAction(value: unknown): RotationAction {
  if (
    typeof value === "string" &&
    ROTATION_ACTIONS.has(value as RotationAction)
  ) {
    return value as RotationAction;
  }
  return "other";
}

function parseRotationSample(raw: unknown): RotationSample | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.seed !== "string") return null;
  if (typeof o.sample_dps !== "number" || !Number.isFinite(o.sample_dps)) {
    return null;
  }
  if (typeof o.target_dps !== "number" || !Number.isFinite(o.target_dps)) {
    return null;
  }
  if (typeof o.rel_err !== "number" || !Number.isFinite(o.rel_err)) return null;
  if (typeof o.attempts !== "number" || !Number.isFinite(o.attempts)) {
    return null;
  }
  if (typeof o.duration_s !== "number" || !Number.isFinite(o.duration_s)) {
    return null;
  }
  if (!Array.isArray(o.characters) || !Array.isArray(o.events)) return null;

  const characters = o.characters.filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  const events: RotationSampleEvent[] = [];
  for (const entry of o.events) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.t !== "number" || !Number.isFinite(e.t)) continue;
    if (typeof e.char !== "string" || !e.char) continue;
    const event: RotationSampleEvent = {
      t: e.t,
      char: e.char,
      action: asRotationAction(e.action),
    };
    if (typeof e.label === "string" && e.label) event.label = e.label;
    events.push(event);
  }

  const sample: RotationSample = {
    seed: o.seed,
    sample_dps: o.sample_dps,
    target_dps: o.target_dps,
    rel_err: o.rel_err,
    attempts: o.attempts,
    duration_s: o.duration_s,
    characters,
    events,
  };
  if (typeof o.config_hash === "string" && o.config_hash) {
    sample.config_hash = o.config_hash;
  }
  return sample;
}

async function loadSimRotationFromCdn(
  stateKey: string,
): Promise<RotationSample | null> {
  const res = await fetchWithTimeout(getSimRotationUrl(stateKey));
  if (res.status === 404 || res.status === 410) {
    rotationCache.set(stateKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `sim rotation ${stateKey} unavailable: HTTP ${res.status}`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text = isGzipped(buf)
    ? (await gunzipAsync(buf)).toString("utf-8")
    : buf.toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    rotationCache.set(stateKey, null);
    return null;
  }
  const sample = parseRotationSample(parsed);
  rotationCache.set(stateKey, sample);
  return sample;
}
