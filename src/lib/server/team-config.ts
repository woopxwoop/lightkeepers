/**
 * Server helpers for /teams/configs/[slug] (slug = InvestmentSim.state_key).
 */
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import { getSimConfigUrl } from "$lib/utils";
import type {
  InvestmentFile,
  InvestmentSim,
  InvestmentTeam,
} from "$lib/types/investment";

const gunzipAsync = promisify(gunzip);
const CDN_INVESTMENT = "https://api.lightkeepers.moe/sim/investment.json.gz";
const investmentCache = new LRUCache<InvestmentFile>(1, 15 * 60 * 1000, {
  redisNamespace: "investment",
});
const configCache = new LRUCache<string | null>(200, 15 * 60 * 1000, {
  redisNamespace: "team-config",
});

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
