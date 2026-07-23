/**
 * Server helpers for /team-configs/[slug] (slug = InvestmentSim.state_key).
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

export async function getSimConfigText(
  stateKey: string,
): Promise<string | null> {
  return configCache.getOrSet(stateKey, async () => {
    try {
      const res = await fetchWithTimeout(getSimConfigUrl(stateKey));
      if (!res.ok) {
        configCache.set(stateKey, null);
        return null;
      }
      return await res.text();
    } catch {
      configCache.set(stateKey, null);
      return null;
    }
  });
}
