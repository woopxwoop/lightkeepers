// ── gcsim investment comparison types ────────────────────────────────────────
// Shape of investment.json.gz served from R2 (sim/investment.json.gz)

export interface InvestmentFile {
  teams: InvestmentTeam[];
}

export interface InvestmentTeam {
  version: number;
  team_key: string;
  team_name: string;
  /** Total cost to acquire the baseline team (limited5 = 1 copy each). */
  baseline_cost: number;
  /** Character keys in the team, sorted alphabetically. */
  characters: string[];
  /** All simulated investment levels for this team, sorted by cost → dps descending. */
  results: InvestmentSim[];
}

export interface InvestmentSim {
  /** Stable key: characters sorted, Char~C{cons}~{weapon}, joined by __ */
  state_key: string;
  /** Human-readable label, e.g. "Flins C1" or "Flins C1 + Ineffa C0R1" */
  label: string;
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
}
