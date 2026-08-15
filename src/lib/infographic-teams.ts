/**
 * Meta team picks for Abyss / Stygian marketing summaries.
 * Per side/field: On-Field DPS by best team (usage_index = slot% × usage),
 * each with alternate teams that clear the same floors.
 */
import { MIN_USAGE_RATE } from "$lib/solver";
import { teamSlotFieldRate } from "$lib/slot-fields";
import { ON_FIELD_DPS_NAME_IDS } from "$lib/on-field-dps";

export type InfographicSlot = "top" | "middle" | "bottom";

export type InfographicTeam = {
  members: string[] | null;
  usage_rate?: number | null;
  usage_total?: number | null;
  field_1_rate?: number | null;
  field_2_rate?: number | null;
  field_3_rate?: number | null;
};

export type MainDpsTeamGroup<T extends InfographicTeam = InfographicTeam> = {
  /** Catalog `name_id` of the On-Field DPS this group is about. */
  mainDps: string;
  /** Best eligible team featuring `mainDps` for this slot. */
  primary: T;
  /** Other eligible teams featuring `mainDps`, score-sorted. */
  alternates: T[];
};

export type PickTopMainDpsGroupsOptions = {
  /**
   * How many distinct main DPS to keep. Omit / null = list all that qualify.
   */
  topN?: number | null;
  /** Max alternate teams per main DPS (default 10). */
  maxAlternates?: number;
  /**
   * Minimum slot field_*_rate for primary and alternates (percentage points).
   * Default 40.
   */
  minSlotRate?: number;
  /**
   * Teams must have usage_index = (slot%/100) × usage_rate **strictly greater**
   * than this (default 0.1). Slot is converted from percentage points; usage_rate
   * stays in its board units (also percentage points, e.g. 12.5 for 12.5%).
   */
  minUsageIndex?: number;
  /**
   * Catalog `name_id`s treated as On-Field DPS. Defaults to the Prydwen-seeded
   * allowlist in `on-field-dps.ts`.
   */
  onFieldDpsIds?: ReadonlySet<string>;
  /**
   * 4★ catalog `name_id`s. For these main DPS, usage_rate and usage_index floors
   * are halved.
   */
  fourStarNameIds?: ReadonlySet<string>;
  /** Abyss-only: drop near-zero sample totals (default false). */
  requireAbyssUsageTotal?: boolean;
};

const DEFAULT_MAX_ALTERNATES = 10;
const DEFAULT_MIN_SLOT_RATE = 40;
const DEFAULT_MIN_USAGE_INDEX = 0.1;
const MIN_ABYSS_USAGE_TOTAL = 0.001;
/** Dual on-field DPS is allowed only when Mavuika is on the team. */
const MAVUIKA_NAME_ID = "Mavuika";
/** 4★ main DPS get usage / usage_index floors divided by this. */
const FOUR_STAR_FLOOR_DIVISOR = 2;

function teamUsageRate(team: InfographicTeam): number {
  const value = Number(team.usage_rate);
  return Number.isFinite(value) ? value : 0;
}

/** usage_index = (slot%/100) × overall usage_rate. */
export function teamUsageIndex(
  team: InfographicTeam,
  slot: InfographicSlot,
): number {
  return (teamSlotFieldRate(team, slot) / 100) * teamUsageRate(team);
}

/** @deprecated Prefer `teamUsageIndex` — same value. */
export function teamRankScore(
  team: InfographicTeam,
  slot: InfographicSlot,
): number {
  return teamUsageIndex(team, slot);
}

function isEligibleTeam(
  team: InfographicTeam,
  requireAbyssUsageTotal: boolean,
): boolean {
  if ((team.members ?? []).length !== 4) return false;
  if (
    requireAbyssUsageTotal &&
    (team.usage_total ?? 0) < MIN_ABYSS_USAGE_TOTAL
  ) {
    return false;
  }
  return true;
}

function usageFloorsForMainDps(
  mainDps: string,
  minUsageIndex: number,
  fourStarNameIds: ReadonlySet<string>,
): { minUsageRate: number; minUsageIndex: number } {
  const divisor = fourStarNameIds.has(mainDps) ? FOUR_STAR_FLOOR_DIVISOR : 1;
  return {
    minUsageRate: MIN_USAGE_RATE / divisor,
    minUsageIndex: minUsageIndex / divisor,
  };
}

function passesUsageFloorsForMainDps(
  team: InfographicTeam,
  slot: InfographicSlot,
  mainDps: string,
  minUsageIndex: number,
  fourStarNameIds: ReadonlySet<string>,
): boolean {
  const floors = usageFloorsForMainDps(
    mainDps,
    minUsageIndex,
    fourStarNameIds,
  );
  // Strict greater-than (0.1% overall is noise for 5★ sheets).
  return (
    teamUsageRate(team) > floors.minUsageRate &&
    teamUsageIndex(team, slot) > floors.minUsageIndex
  );
}

function onFieldOnTeam(
  members: string[],
  onFieldDpsIds: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of members) {
    if (!onFieldDpsIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * True when 2+ allowlisted On-Field DPS share a team and none is Mavuika
 * (wheelchair / dual-carry noise). Mavuika dual-role comps are allowed.
 */
export function isWheelchairDualDpsTeam(
  members: readonly string[],
  onFieldDpsIds: ReadonlySet<string> = ON_FIELD_DPS_NAME_IDS,
): boolean {
  const carries = onFieldOnTeam([...members], onFieldDpsIds);
  if (carries.length < 2) return false;
  return !carries.includes(MAVUIKA_NAME_ID);
}

function compareTeamsByScore(
  a: InfographicTeam,
  b: InfographicTeam,
  slot: InfographicSlot,
): number {
  const scoreDiff = teamUsageIndex(b, slot) - teamUsageIndex(a, slot);
  if (scoreDiff !== 0) return scoreDiff;
  const rateDiff = teamSlotFieldRate(b, slot) - teamSlotFieldRate(a, slot);
  if (rateDiff !== 0) return rateDiff;
  return teamUsageRate(b) - teamUsageRate(a);
}

/**
 * Put `mainDps` first when present; otherwise leave order unchanged.
 */
export function orderMembersLeadFirst(
  members: readonly string[],
  mainDps: string,
): string[] {
  if (!members.includes(mainDps)) return [...members];
  return [mainDps, ...members.filter((id) => id !== mainDps)];
}

/**
 * On-Field DPS for a side/field, each with a primary team and score-sorted
 * alternates that clear the same eligibility floors. Ordered by primary
 * usage_index. Optional `topN` caps how many DPS are returned.
 */
export function pickTopMainDpsGroups<T extends InfographicTeam>(
  teams: readonly T[],
  slot: InfographicSlot,
  options: PickTopMainDpsGroupsOptions = {},
): MainDpsTeamGroup<T>[] {
  const topN = options.topN;
  const maxAlternates = options.maxAlternates ?? DEFAULT_MAX_ALTERNATES;
  const minSlotRate = options.minSlotRate ?? DEFAULT_MIN_SLOT_RATE;
  const minUsageIndex = options.minUsageIndex ?? DEFAULT_MIN_USAGE_INDEX;
  const onFieldDpsIds = options.onFieldDpsIds ?? ON_FIELD_DPS_NAME_IDS;
  const fourStarNameIds = options.fourStarNameIds ?? new Set<string>();
  const requireAbyssUsageTotal = options.requireAbyssUsageTotal ?? false;

  const unlimited =
    topN == null || (typeof topN === "number" && !Number.isFinite(topN));
  if (!unlimited && (topN as number) <= 0) return [];
  if (maxAlternates < 0) return [];

  const candidates = teams
    .filter((t) => isEligibleTeam(t, requireAbyssUsageTotal))
    .filter((t) => teamSlotFieldRate(t, slot) >= minSlotRate)
    .filter(
      (t) => !isWheelchairDualDpsTeam(t.members ?? [], onFieldDpsIds),
    );

  const byMain = new Map<string, T[]>();
  for (const team of candidates) {
    const carries = onFieldOnTeam(team.members ?? [], onFieldDpsIds);
    for (const mainDps of carries) {
      if (
        !passesUsageFloorsForMainDps(
          team,
          slot,
          mainDps,
          minUsageIndex,
          fourStarNameIds,
        )
      ) {
        continue;
      }
      const list = byMain.get(mainDps);
      if (list) list.push(team);
      else byMain.set(mainDps, [team]);
    }
  }

  const groups: MainDpsTeamGroup<T>[] = [];
  for (const [mainDps, list] of byMain) {
    const sorted = [...list].sort((a, b) => compareTeamsByScore(a, b, slot));
    const primary = sorted[0];
    if (!primary) continue;
    groups.push({
      mainDps,
      primary,
      alternates: sorted.slice(1, 1 + maxAlternates),
    });
  }

  groups.sort((a, b) => compareTeamsByScore(a.primary, b.primary, slot));
  return unlimited ? groups : groups.slice(0, topN as number);
}
