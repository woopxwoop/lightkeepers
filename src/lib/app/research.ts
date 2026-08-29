/** Client fetch for dev research chat → /api/research proxy. */

import type { InventoryWeapon, RosterProgress } from "$lib/definitions";
import type {
  ResearchOwnedCharacter,
  ResearchOwnedWeapon,
  ResearchRequest,
  ResearchResponse,
  ResearchLlmProvider,
} from "$lib/research-types";

/** Match server research agent budget so stalled chat requests recover. */
const RESEARCH_FETCH_TIMEOUT_MS = 120_000;

/** Soft caps aligned with agent ResearchRequest max_length (after weapon dedupe). */
const MAX_OWNED_CHARACTERS = 200;
const MAX_OWNED_WEAPONS = 300;

/** Minimal roster row for research personalization mapping. */
export type ResearchRosterCharacter = {
  isOwned: boolean;
  name_id: string;
  progress?: RosterProgress | null;
};

export type ResearchPersonalizationFields = Pick<
  ResearchRequest,
  "roster_name_ids" | "owned_characters" | "owned_weapons" | "personalize"
>;

function mapOwnedWeapon(
  weapon: Pick<InventoryWeapon, "key" | "level" | "ascension" | "refinement">,
  copies = 1,
): ResearchOwnedWeapon {
  const row: ResearchOwnedWeapon = {
    key: weapon.key,
    refinement: weapon.refinement,
    level: weapon.level,
    ascension: weapon.ascension,
  };
  if (copies > 1) row.copies = copies;
  return row;
}

function mapOwnedCharacter(
  character: ResearchRosterCharacter,
  weaponCopiesByKey?: ReadonlyMap<string, number>,
): ResearchOwnedCharacter {
  const row: ResearchOwnedCharacter = { name_id: character.name_id };
  const progress = character.progress;
  if (!progress) return row;
  row.constellation = progress.constellation;
  row.level = progress.level;
  row.ascension = progress.ascension;
  row.talents = { ...progress.talents };
  if (progress.weapon) {
    const copies = weaponCopiesByKey?.get(progress.weapon.key) ?? 1;
    row.weapon = mapOwnedWeapon(progress.weapon, copies);
  } else {
    row.weapon = null;
  }
  return row;
}

/**
 * Build agent personalization fields from local roster (+ optional inventory).
 * Empty owned roster → `{ personalize: false }` with no owned payloads.
 * Inventory is deduped by GOOD key (best R + copy count). Keys equipped on a
 * character are omitted from `owned_weapons` but their total copies are attached
 * to that character's weapon.
 */
export function buildResearchPersonalization(input: {
  characters: ReadonlyArray<ResearchRosterCharacter>;
  inventoryWeapons?: ReadonlyArray<InventoryWeapon> | null;
}): ResearchPersonalizationFields {
  const owned = input.characters.filter((c) => c.isOwned);
  if (owned.length === 0) {
    return { personalize: false };
  }

  // Total copies + best instance per GOOD key across the full bag.
  const copiesByKey = new Map<string, number>();
  const bestByKey = new Map<
    string,
    Pick<InventoryWeapon, "key" | "level" | "ascension" | "refinement">
  >();
  for (const weapon of input.inventoryWeapons ?? []) {
    if (!weapon.key) continue;
    copiesByKey.set(weapon.key, (copiesByKey.get(weapon.key) ?? 0) + 1);
    const prev = bestByKey.get(weapon.key);
    if (!prev || weapon.refinement > prev.refinement) {
      bestByKey.set(weapon.key, weapon);
    }
  }

  const owned_characters = owned
    .slice(0, MAX_OWNED_CHARACTERS)
    .map((c) => mapOwnedCharacter(c, copiesByKey));
  const roster_name_ids = owned_characters.map((c) => c.name_id);
  const equippedKeys = new Set(
    owned_characters
      .map((c) => c.weapon?.key)
      .filter((key): key is string => Boolean(key)),
  );

  const fields: ResearchPersonalizationFields = {
    personalize: true,
    roster_name_ids,
    owned_characters,
  };

  if (!input.inventoryWeapons?.length) return fields;

  const extras: ResearchOwnedWeapon[] = [];
  for (const [key, best] of [...bestByKey.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (equippedKeys.has(key)) continue;
    extras.push(mapOwnedWeapon(best, copiesByKey.get(key) ?? 1));
    if (extras.length >= MAX_OWNED_WEAPONS) break;
  }
  if (extras.length > 0) {
    fields.owned_weapons = extras;
  }
  return fields;
}

function parseApiError(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const payload = JSON.parse(trimmed) as {
      message?: string;
      detail?: string | { msg?: string }[];
    };
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (Array.isArray(payload.detail)) {
      const msgs = payload.detail
        .map((d) => d?.msg)
        .filter((m): m is string => typeof m === "string" && Boolean(m));
      if (msgs.length > 0) return msgs.join("; ");
    }
  } catch {
    // plain text / html from upstream
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

function parseOkJson<T>(status: number, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(parseApiError(status, text));
  }
}

export async function postResearchChat(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  let res: Response;
  try {
    res = await fetch("/api/research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEARCH_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (
      (err instanceof Error && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "TimeoutError")
    ) {
      throw new Error("Research request timed out.");
    }
    throw err instanceof Error ? err : new Error("Research request failed");
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }

  return parseOkJson<ResearchResponse>(res.status, text);
}

export type ResearchProxyHealth = {
  configured: boolean;
  agentUrl: string | null;
  agent: {
    ok: boolean;
    body?: unknown;
    geminiConfigured?: boolean;
    deepseekConfigured?: boolean;
    defaultLlmProvider?: ResearchLlmProvider;
    error?: string;
  };
};

export async function fetchResearchProxyHealth(): Promise<ResearchProxyHealth> {
  const res = await fetch("/api/research", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }
  return parseOkJson<ResearchProxyHealth>(res.status, text);
}
