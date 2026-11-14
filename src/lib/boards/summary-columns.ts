/**
 * Column model for the Abyss / Stygian summary tool: per side/field On-Field
 * DPS groups (lead-first lineups), roster + DPS-tag filtering, and the
 * infographic header line.
 */
import type {
  AbyssChamberEnemies,
  AbyssEnemies,
  AbyssTeam,
  Enemy,
  StygianEnemies,
  StygianSchedule,
  StygianTeam,
} from "#lib/definitions.js";
import {
  orderMembersLeadFirst,
  pickTopMainDpsGroups,
  type InfographicSlot,
  type MainDpsTeamGroup,
} from "#lib/boards/infographic-teams.js";
import { isOwnedNameId } from "#lib/utils.js";

export type SummaryMode = "abyss" | "stygian";
export type SummaryRosterFilter = "all" | "owned";

export const ABYSS_SUMMARY_SLOTS = ["top", "bottom"] as const;
export const STYGIAN_SUMMARY_SLOTS = ["top", "middle", "bottom"] as const;

const ABYSS_HALF_LABEL: Record<
  (typeof ABYSS_SUMMARY_SLOTS)[number],
  string
> = {
  top: "First Half",
  bottom: "Second Half",
};

export type BoardTeam = AbyssTeam | StygianTeam;
export type DisplayGroup = MainDpsTeamGroup<BoardTeam> & {
  primary: BoardTeam;
  alternates: BoardTeam[];
};

export type AbyssSummaryColumn = {
  slot: (typeof ABYSS_SUMMARY_SLOTS)[number];
  label: string;
  groups: DisplayGroup[];
  chambers: AbyssChamberEnemies[];
};

export type StygianSummaryColumn = {
  slot: (typeof STYGIAN_SUMMARY_SLOTS)[number];
  label: string;
  enemy: Enemy | null;
  groups: DisplayGroup[];
};

export type PreparedSummaryColumn<
  C extends { groups: DisplayGroup[] } =
    AbyssSummaryColumn | StygianSummaryColumn,
> = C & { pool: DisplayGroup[] };

export type SummaryHeaderMeta = {
  title: string;
  version: string | null;
  buff: string | null;
  date: string | null;
};

/** Algorithm floors — not exposed in the public tool chrome. */
const SUMMARY_GROUP_OPTIONS = {
  topN: null,
  maxAlternates: 10,
  minSlotRate: 40,
  minUsageIndex: 0.2,
};

export function slotLabel(slot: InfographicSlot): string {
  if (slot === "top") return "Field 1";
  if (slot === "middle") return "Field 2";
  return "Field 3";
}

export function dpsDisplayName(
  mapping: ReadonlyMap<string, { name: string | null }>,
  mainDps: string,
): string {
  return mapping.get(mainDps)?.name ?? mainDps;
}

export function fourStarNameIds(
  characters: Iterable<{ rarity: number | null; name_id: string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const c of characters) {
    if (c.rarity === 4) ids.add(c.name_id);
  }
  return ids;
}

function withLeadFirst(team: BoardTeam, mainDps: string): BoardTeam {
  return {
    ...team,
    members: orderMembersLeadFirst(team.members ?? [], mainDps),
  };
}

export function toDisplayGroups(
  groups: MainDpsTeamGroup<BoardTeam>[],
): DisplayGroup[] {
  return groups.map((g) => ({
    mainDps: g.mainDps,
    primary: withLeadFirst(g.primary, g.mainDps),
    alternates: g.alternates.map((t) => withLeadFirst(t, g.mainDps)),
  }));
}

export function buildAbyssSummaryColumns(
  teams: readonly AbyssTeam[],
  enemies: AbyssEnemies,
  fourStarIds: ReadonlySet<string>,
): AbyssSummaryColumn[] {
  return ABYSS_SUMMARY_SLOTS.map((slot) => ({
    slot,
    label: ABYSS_HALF_LABEL[slot],
    groups: toDisplayGroups(
      pickTopMainDpsGroups<BoardTeam>(teams, slot, {
        ...SUMMARY_GROUP_OPTIONS,
        fourStarNameIds: fourStarIds,
        requireAbyssUsageTotal: true,
      }),
    ),
    chambers: enemies[slot] ?? [],
  }));
}

export function buildStygianSummaryColumns(
  teams: readonly StygianTeam[],
  enemies: StygianEnemies,
  fourStarIds: ReadonlySet<string>,
): StygianSummaryColumn[] {
  return STYGIAN_SUMMARY_SLOTS.map((slot) => {
    const enemy = enemies[slot];
    return {
      slot,
      label: enemy?.enemy_name ?? slotLabel(slot),
      enemy,
      groups: toDisplayGroups(
        pickTopMainDpsGroups<BoardTeam>(teams, slot, {
          ...SUMMARY_GROUP_OPTIONS,
          fourStarNameIds: fourStarIds,
        }),
      ),
    };
  });
}

function teamFullyOwned(
  team: BoardTeam,
  ownedIds: ReadonlySet<string>,
): boolean {
  const members = team.members ?? [];
  return (
    members.length > 0 &&
    members.every((member) => isOwnedNameId(member, ownedIds))
  );
}

/** Keep only fully owned lineups; promote the best remaining as primary. */
export function toOwnedGroups(
  groups: DisplayGroup[],
  ownedIds: ReadonlySet<string>,
): DisplayGroup[] {
  const next: DisplayGroup[] = [];
  for (const group of groups) {
    const ownedTeams = [group.primary, ...group.alternates].filter((team) =>
      teamFullyOwned(team, ownedIds),
    );
    if (ownedTeams.length === 0) continue;
    const [primary, ...alternates] = ownedTeams;
    next.push({
      mainDps: group.mainDps,
      primary: primary!,
      alternates,
    });
  }
  return next;
}

/**
 * `pool` is the roster-filtered column (autocomplete + raw count); `groups`
 * additionally keeps only the selected DPS tags.
 */
export function prepareSummaryColumns<C extends { groups: DisplayGroup[] }>(
  columns: C[],
  filter: {
    rosterFilter: SummaryRosterFilter;
    ownedIds: ReadonlySet<string>;
    dpsTags: readonly string[];
  },
): PreparedSummaryColumn<C>[] {
  return columns.map((col) => {
    const pool =
      filter.rosterFilter === "owned"
        ? toOwnedGroups(col.groups, filter.ownedIds)
        : col.groups;
    return {
      ...col,
      pool,
      groups:
        filter.dpsTags.length === 0
          ? pool
          : pool.filter((g) => filter.dpsTags.includes(g.mainDps)),
    };
  });
}

/** Autocomplete pool: On-Field DPS across every column's pool, by label. */
export function summaryDpsOptions(
  columns: readonly { pool: DisplayGroup[] }[],
  labelOf: (mainDps: string) => string,
): string[] {
  const ids = new Set<string>();
  for (const col of columns) {
    for (const g of col.pool) ids.add(g.mainDps);
  }
  return [...ids].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
}

export function summarySideOptions(
  mode: SummaryMode,
): { value: InfographicSlot; label: string }[] {
  if (mode === "abyss") {
    return ABYSS_SUMMARY_SLOTS.map((slot) => ({
      value: slot,
      label: ABYSS_HALF_LABEL[slot],
    }));
  }
  return STYGIAN_SUMMARY_SLOTS.map((slot) => ({
    value: slot,
    label: slotLabel(slot),
  }));
}

function formatOpenDate(openTime: string | null | undefined): string | null {
  return openTime
    ? new Date(openTime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
}

export function summaryHeaderMeta(
  mode: SummaryMode,
  abyssEnemies: AbyssEnemies,
  stygianSchedule: StygianSchedule,
): SummaryHeaderMeta {
  if (mode === "abyss") {
    const open = formatOpenDate(abyssEnemies.openTime);
    return {
      title: "Spiral Abyss",
      version: null,
      buff: abyssEnemies.buffName,
      date: open ? `Opened ${open}` : null,
    };
  }
  const open = formatOpenDate(stygianSchedule?.openTime);
  return {
    title: "Stygian Onslaught",
    version: stygianSchedule?.challengeName?.trim() || null,
    buff: null,
    date: open ? `Opened ${open}` : null,
  };
}
