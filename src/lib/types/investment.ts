// ── gcsim investment comparison types ────────────────────────────────────────
// Shape of investment.json.gz served from R2 (sim/investment.json.gz)

export interface InvestmentFile {
  teams: InvestmentTeam[];
  /** Sorted unique sim costs across all teams (merge-time). */
  available_costs?: number[];
}

export interface InvestmentTeam {
  version: number;
  team_key: string;
  team_name: string;
  /** Total cost to acquire the baseline team (limited5 = 1 copy each). */
  baseline_cost: number;
  /** Character keys in the team, sorted alphabetically. */
  characters: string[];
  /**
   * Characters for whom this team's floor-tier DPS (`results[0]`) is their
   * global best (merge-time). Ties include all winners.
   */
  is_best_for?: string[];
  /**
   * Per exact cost: characters for whom this team's DPS at that cost is best.
   * Keys are cost strings (e.g. `"2"`).
   */
  is_best_for_at_cost?: Record<string, string[]>;
  /** All simulated investment levels for this team, sorted by cost → dps descending. */
  results: InvestmentSim[];
}

export type SimKind = "baseline" | "f2p" | "vertical" | "talent";

export interface InvestmentSim {
  /** Stable key: characters sorted, Char~C{cons}~{weapon}, joined by __ */
  state_key: string;
  /**
   * Human-readable label.
   * - baseline: full config (every char C / weapon / R)
   * - f2p / vertical: diffs from baseline only (e.g. "Flins C1", "Aino C2")
   */
  label: string;
  /**
   * baseline = canonical starting build;
   * f2p = floor-cost alternative (free weapon / 4★ budget cons, etc.);
   * vertical = limited-pull upgrades (extra cost above floor);
   * talent = one-step talent drop from baseline (single char, one talent at 1).
   */
  kind: SimKind;
  /** Total cost in limited5 copies (baseline + upgrades). */
  cost: number;
  /** Simulated DPS from gcsim. */
  dps: number;
  /** Per-character build snapshot for this simulation. */
  characters: CharacterBuild[];
}

export interface CharacterBuild {
  key: string;
  cons: number;
  weapon: {
    key: string;
    refinement: number;
    level: number;
  };
  set: {
    key: string;
    count: number;
  };
  /** Second 2pc set when running 2pc/2pc (flat fields from pipeline summaries). */
  set2?: string;
  set2_count?: number;
  main_stats: {
    sands: string;
    goblet: string;
    circlet: string;
  };
  level: number;
  talents: {
    auto: number;
    skill: number;
    burst: number;
  };
  /**
   * Total substat rolls from gcsim OptimFull (`stat=*N` in config).
   * Includes the fixed baseline (default 2 per substat).
   * Keys are GOOD StatKey values (e.g. critDMG_, atk_).
   */
  substat_rolls?: Record<string, number>;
  /** Liquid rolls only (total minus fixed baseline of 2). */
  substat_rolls_liquid?: Record<string, number>;
}

/** Shape of `output/characters.json` (aggregate character summaries). */
export interface CharacterIndexFile {
  characters: Record<string, CharacterIndex>;
}

export interface CharacterIndex {
  key: string;
  /**
   * Weapons ranked by distinct team count. Baseline weapons always count;
   * F2P weapon alts only count teams where that f2p config beats baseline DPS;
   * vertical/sig weapons still count every appearance.
   */
  weapons: CharacterWeaponRank[];
  /**
   * Artifact sets from each team's baseline sim only
   * (one vote per team). Ranked by team count; `count` is 2 or 4 pieces.
   */
  sets: CharacterSetRank[];
  /**
   * Per-slot main-stat frequency from each team's baseline sim only
   * (one vote per team). Ranked by team count.
   */
  main_stats: {
    sands: CharacterStatRank[];
    goblet: CharacterStatRank[];
    circlet: CharacterStatRank[];
  };
  /**
   * Mean OptimFull liquid rolls: average f2p + bp_limited-weapon configs
   * within a team, then average those team-means across teams.
   */
  substat_rolls_liquid: CharacterLiquidSubstats;
  /**
   * How much DPS drops when each talent is lowered to 1 (others stay baseline),
   * aggregated across teams. Character level is tracked separately.
   */
  talent_importance?: CharacterTalentImportance;
  /**
   * How much DPS drops when the character runs at level 80 (talents stay
   * baseline), aggregated across teams.
   */
  level_importance?: CharacterLevelImportance;
  /**
   * One-step vertical gains: constellations are stepwise vs the previous
   * constellation (C2 vs C1); sig weapons are vs baseline. Combined cons+sig
   * and multi-char verticals are excluded.
   */
  vertical_importance?: CharacterVerticalImportance;
  /** Optional editorial blurb from hand-authored guide (merge-time). */
  notes?: string;
}

export type TalentSlot = "auto" | "skill" | "burst";

export interface CharacterTalentSlotImportance {
  /** Average % DPS drop vs baseline across teams. */
  mean_pct_drop: number;
  /** Median % DPS drop vs baseline across teams. */
  median_pct_drop: number;
  /** Smallest % DPS drop on any contributing team. */
  min_pct_drop: number;
  /** Largest % DPS drop on any contributing team. */
  max_pct_drop: number;
}

export interface CharacterTalentImportance {
  /** Teams with baseline + all three talent drops for this character. */
  teams: number;
  auto: CharacterTalentSlotImportance;
  skill: CharacterTalentSlotImportance;
  burst: CharacterTalentSlotImportance;
  /** Talent slots ranked by mean % drop (highest first). */
  priority: TalentSlot[];
}

export interface CharacterLevelImportance extends CharacterTalentSlotImportance {
  /** Teams with a level-80 drop sample for this character. */
  teams: number;
}

export interface CharacterVerticalGain {
  /** Teams that contributed a one-step vertical sample for this entry. */
  teams: number;
  /** Average % DPS gain vs that team's baseline. */
  mean_pct_gain: number;
  /** Median % DPS gain vs that team's baseline. */
  median_pct_gain: number;
  /** Smallest % DPS gain on any contributing team. */
  min_pct_gain: number;
  /** Largest % DPS gain on any contributing team. */
  max_pct_gain: number;
}

export interface CharacterConsGain extends CharacterVerticalGain {
  /** Absolute constellation level reached (e.g. 1 for C1). Gain is vs C{cons-1}. */
  cons: number;
}

export interface CharacterSigGain extends CharacterVerticalGain {
  /** Signature weapon GOOD key. */
  key: string;
}

export interface CharacterVerticalImportance {
  /** Cons-only upgrades, sorted by cons ascending. */
  constellations: CharacterConsGain[];
  /** Sig-weapon-only upgrades, sorted by mean gain descending. */
  sig_weapons: CharacterSigGain[];
}

export interface CharacterWeaponRank {
  key: string;
  teams: number;
}

export interface CharacterSetRank {
  key: string;
  /** Piece count bucket: 2 (from 2–3) or 4 (from 4–5). */
  count: number;
  teams: number;
}

export interface CharacterStatRank {
  key: string;
  teams: number;
}

export interface CharacterLiquidSubstats {
  /** Teams that contributed at least one liquid sample. */
  teams: number;
  /** Total configs averaged before the per-team collapse. */
  configs: number;
  mean: Record<string, number>;
  ranked: Array<{ key: string; mean: number }>;
}
