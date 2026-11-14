import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AbyssEnemies,
  AbyssTeam,
  Enemy,
  StygianTeam,
} from "#lib/definitions.js";
import {
  buildAbyssSummaryColumns,
  buildStygianSummaryColumns,
  dpsDisplayName,
  fourStarNameIds,
  prepareSummaryColumns,
  slotLabel,
  summaryDpsOptions,
  summaryHeaderMeta,
  summarySideOptions,
  toDisplayGroups,
  ownedTeamsOnly,
  type BoardTeam,
  type DisplayGroup,
} from "./summary-columns.ts";

function team(members: string[], extras: Record<string, unknown> = {}) {
  return {
    members,
    usage_rate: 5,
    usage_total: 1,
    field_1_rate: 80,
    field_2_rate: 80,
    field_3_rate: 80,
    ...extras,
  } as unknown as BoardTeam;
}

function group(
  mainDps: string,
  primary: BoardTeam,
  alternates: BoardTeam[] = [],
): DisplayGroup {
  return { mainDps, primary, alternates };
}

const emptyAbyss: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};

describe("slotLabel / dpsDisplayName / fourStarNameIds", () => {
  it("labels Stygian fields", () => {
    assert.equal(slotLabel("top"), "Field 1");
    assert.equal(slotLabel("middle"), "Field 2");
    assert.equal(slotLabel("bottom"), "Field 3");
  });

  it("falls back to the name_id when the catalog has no name", () => {
    const mapping = new Map([
      ["Neuvillette", { name: "Neuvillette (Hydro)" }],
      ["Nameless", { name: null }],
    ]);
    assert.equal(dpsDisplayName(mapping, "Neuvillette"), "Neuvillette (Hydro)");
    assert.equal(dpsDisplayName(mapping, "Nameless"), "Nameless");
    assert.equal(dpsDisplayName(mapping, "Missing"), "Missing");
  });

  it("collects 4★ name_ids only", () => {
    const ids = fourStarNameIds([
      { name_id: "A", rarity: 4 },
      { name_id: "B", rarity: 5 },
      { name_id: "C", rarity: null },
    ]);
    assert.deepEqual([...ids], ["A"]);
  });
});

describe("toDisplayGroups", () => {
  it("puts the main DPS first in primary and alternates", () => {
    const [g] = toDisplayGroups([
      group("X", team(["a", "X", "b", "c"]), [team(["d", "e", "X", "f"])]),
    ]);
    assert.deepEqual(g!.primary.members, ["X", "a", "b", "c"]);
    assert.deepEqual(g!.alternates[0]!.members, ["X", "d", "e", "f"]);
  });
});

describe("build*SummaryColumns", () => {
  it("builds one Abyss column per half with chambers and lead-first groups", () => {
    const teams = [
      team(["a", "Neuvillette", "b", "c"], { field_2_rate: 0 }),
    ] as AbyssTeam[];
    const enemies: AbyssEnemies = {
      ...emptyAbyss,
      top: [{ chamber: 1 } as AbyssEnemies["top"][number]],
    };
    const cols = buildAbyssSummaryColumns(teams, enemies, new Set());
    assert.deepEqual(
      cols.map((c) => [c.slot, c.label, c.chambers.length]),
      [
        ["top", "First Half", 1],
        ["bottom", "Second Half", 0],
      ],
    );
    assert.equal(cols[0]!.groups[0]!.mainDps, "Neuvillette");
    assert.deepEqual(cols[0]!.groups[0]!.primary.members, [
      "Neuvillette",
      "a",
      "b",
      "c",
    ]);
    assert.equal(cols[1]!.groups.length, 0);
  });

  it("drops Abyss teams without a usage total", () => {
    const teams = [
      team(["Neuvillette", "a", "b", "c"], { usage_total: 0 }),
    ] as AbyssTeam[];
    const cols = buildAbyssSummaryColumns(teams, emptyAbyss, new Set());
    assert.equal(cols[0]!.groups.length, 0);
  });

  it("labels Stygian columns by boss, else by field", () => {
    const boss = { enemy_name: "Boss", asset: "x" } as Enemy;
    const teams = [team(["Neuvillette", "a", "b", "c"])] as StygianTeam[];
    const cols = buildStygianSummaryColumns(
      teams,
      { top: boss, middle: null, bottom: null },
      new Set(),
    );
    assert.deepEqual(
      cols.map((c) => [c.slot, c.label, c.enemy]),
      [
        ["top", "Boss", boss],
        ["middle", "Field 2", null],
        ["bottom", "Field 3", null],
      ],
    );
    assert.equal(cols[2]!.groups[0]!.mainDps, "Neuvillette");
  });
});

describe("ownedTeamsOnly / Owned columns", () => {
  const owned = new Set(["Neuvillette", "a", "b", "c", "PlayerGirl"]);

  it("keeps fully owned lineups, Traveler elements included", () => {
    const traveler = team(["Neuvillette", "PlayerBoy-Hydro", "a", "b"]);
    const missing = team(["Neuvillette", "a", "b", "z"]);
    assert.deepEqual(ownedTeamsOnly([traveler, missing, team([])], owned), [
      traveler,
    ]);
  });

  it("finds an owned team below the top 11 for its DPS", () => {
    const unowned = Array.from({ length: 12 }, (_, i) =>
      team(["Neuvillette", "a", "b", `u${i}`], { usage_rate: 10 }),
    );
    const ownedTeam = team(["Neuvillette", "a", "b", "c"], { usage_rate: 5 });
    const teams = [...unowned, ownedTeam] as AbyssTeam[];
    const all = buildAbyssSummaryColumns(teams, emptyAbyss, new Set());
    const allTop = all[0]!.groups[0]!;
    assert.equal(allTop.alternates.length, 10);
    assert.ok(![allTop.primary, ...allTop.alternates].includes(ownedTeam));

    const [col] = buildAbyssSummaryColumns(teams, emptyAbyss, new Set(), owned);
    assert.equal(col!.groups.length, 1);
    assert.deepEqual(col!.groups[0]!.primary.members, [
      "Neuvillette",
      "a",
      "b",
      "c",
    ]);
  });
});

describe("prepareSummaryColumns", () => {
  const ownedTeam = team(["X", "a", "b", "c"]);
  const cols = [
    {
      slot: "top",
      groups: [group("X", ownedTeam), group("Y", team(["Y", "q", "r", "s"]))],
    },
  ];

  it("keeps everything with no filters", () => {
    const [col] = prepareSummaryColumns(cols, { dpsTags: [] });
    assert.equal(col!.slot, "top");
    assert.equal(col!.pool, cols[0]!.groups);
    assert.equal(col!.groups, col!.pool);
  });

  it("filters the groups by DPS tags, keeping the pool", () => {
    const [tagged] = prepareSummaryColumns(cols, { dpsTags: ["Y"] });
    assert.equal(tagged!.pool.length, 2);
    assert.deepEqual(
      tagged!.groups.map((g) => g.mainDps),
      ["Y"],
    );
  });
});

describe("summaryDpsOptions", () => {
  it("dedupes across columns and sorts by label", () => {
    const t = team(["a", "b", "c", "d"]);
    const labels: Record<string, string> = { A: "Zed", B: "Amy", C: "Mo" };
    const options = summaryDpsOptions(
      [
        { pool: [group("A", t), group("B", t)] },
        { pool: [group("A", t), group("C", t)] },
      ],
      (id) => labels[id]!,
    );
    assert.deepEqual(options, ["B", "C", "A"]);
  });
});

describe("summarySideOptions", () => {
  it("lists halves for Abyss and fields for Stygian", () => {
    assert.deepEqual(summarySideOptions("abyss"), [
      { value: "top", label: "First Half" },
      { value: "bottom", label: "Second Half" },
    ]);
    assert.deepEqual(
      summarySideOptions("stygian").map((o) => o.label),
      ["Field 1", "Field 2", "Field 3"],
    );
  });
});

describe("summaryHeaderMeta", () => {
  const openTime = "2026-03-15T12:00:00Z";

  it("shows the Abyss buff and open date", () => {
    assert.deepEqual(
      summaryHeaderMeta(
        "abyss",
        { ...emptyAbyss, buffName: "Moon", openTime },
        null,
      ),
      {
        title: "Spiral Abyss",
        version: null,
        buff: "Moon",
        date: "Opened Mar 15, 2026",
      },
    );
  });

  it("shows the trimmed Stygian challenge name", () => {
    assert.deepEqual(
      summaryHeaderMeta("stygian", emptyAbyss, {
        scheduleId: 1,
        openTime,
        closeTime: null,
        challengeName: "  Lunar  ",
      }),
      {
        title: "Stygian Onslaught",
        version: "Lunar",
        buff: null,
        date: "Opened Mar 15, 2026",
      },
    );
  });

  it("nulls missing fields", () => {
    assert.deepEqual(summaryHeaderMeta("stygian", emptyAbyss, null), {
      title: "Stygian Onslaught",
      version: null,
      buff: null,
      date: null,
    });
    assert.equal(summaryHeaderMeta("abyss", emptyAbyss, null).date, null);
  });
});
