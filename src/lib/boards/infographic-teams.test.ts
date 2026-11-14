import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orderMembersLeadFirst,
  pickTopMainDpsGroups,
  type InfographicTeam,
} from "./infographic-teams.ts";

function team(
  members: string[],
  slotRate: number,
  usage = 5,
  extras: Partial<InfographicTeam> = {},
): InfographicTeam {
  return {
    members,
    usage_rate: usage,
    usage_total: 1,
    field_1_rate: slotRate,
    field_2_rate: 0,
    field_3_rate: 0,
    ...extras,
  };
}

const ON_FIELD = new Set(["carryA", "carryB", "carryC"]);

describe("pickTopMainDpsGroups", () => {
  it("returns empty for an empty pool", () => {
    assert.deepEqual(pickTopMainDpsGroups([], "top"), []);
  });

  it("drops teams at the 0.1% overall usage floor", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 50, 0.1),
        team(["carryB", "s4", "s5", "s6"], 50, 0.11),
      ],
      "top",
      { minSlotRate: 0, minUsageIndex: 0, onFieldDpsIds: ON_FIELD },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.mainDps, "carryB");
  });

  it("rejects dual on-field DPS teams unless Mavuika is present", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "carryB", "s1", "s2"], 50, 10),
        team(["Mavuika", "carryA", "s3", "s4"], 48, 9),
        team(["carryB", "s5", "s6", "s7"], 45, 8),
      ],
      "top",
      {
        minSlotRate: 0,
        minUsageIndex: 0,
        onFieldDpsIds: new Set(["carryA", "carryB", "Mavuika"]),
      },
    );
    assert.deepEqual(groups.map((g) => g.mainDps).sort(), [
      "Mavuika",
      "carryA",
      "carryB",
    ]);
    const carryA = groups.find((g) => g.mainDps === "carryA");
    assert.deepEqual(carryA?.primary.members, [
      "Mavuika",
      "carryA",
      "s3",
      "s4",
    ]);
    const carryB = groups.find((g) => g.mainDps === "carryB");
    assert.deepEqual(carryB?.primary.members, ["carryB", "s5", "s6", "s7"]);
  });

  it("halves usage floors for 4★ main DPS", () => {
    // 5★ needs usage > 0.1 and index > 0.1; 4★ needs > 0.05 and > 0.05.
    // slot 80 → index = 0.8 * usage; usage 0.08 → index 0.064
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 80, 0.08),
        team(["carryB", "s4", "s5", "s6"], 80, 0.08),
      ],
      "top",
      {
        minSlotRate: 0,
        minUsageIndex: 0.1,
        onFieldDpsIds: ON_FIELD,
        fourStarNameIds: new Set(["carryB"]),
      },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.mainDps, "carryB");
  });

  it("lists all qualifying main DPS when topN is omitted", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 40, 2),
        team(["carryB", "s4", "s5", "s6"], 20, 9),
        team(["carryC", "s7", "s8", "s9"], 40, 8),
      ],
      "top",
      { minSlotRate: 10, onFieldDpsIds: ON_FIELD },
    );
    assert.equal(groups.length, 3);
  });

  it("requires usage_index strictly greater than minUsageIndex", () => {
    // usage_index = (slot/100) * usage
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 42, 0.1), // 0.042
        team(["carryB", "s4", "s5", "s6"], 50, 5), // 2.5
      ],
      "top",
      {
        minSlotRate: 0,
        minUsageIndex: 0.1,
        onFieldDpsIds: ON_FIELD,
      },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.mainDps, "carryB");
  });

  it("ranks main DPS by their best team's usage_index", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 40, 2), // 0.8
        team(["carryB", "s4", "s5", "s6"], 20, 9), // 1.8
        team(["carryC", "s7", "s8", "s9"], 40, 8), // 3.2
      ],
      "top",
      {
        topN: 3,
        minSlotRate: 10,
        onFieldDpsIds: ON_FIELD,
      },
    );
    assert.deepEqual(
      groups.map((g) => g.mainDps),
      ["carryC", "carryB", "carryA"],
    );
  });

  it("keeps one primary per main DPS and lists alternates", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 50, 10),
        team(["carryA", "s4", "s5", "s6"], 45, 8),
        team(["carryA", "s7", "s8", "s9"], 42, 6),
        team(["carryB", "t1", "t2", "t3"], 40, 5),
      ],
      "top",
      {
        topN: 2,
        maxAlternates: 10,
        minSlotRate: 10,
        onFieldDpsIds: ON_FIELD,
      },
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.mainDps, "carryA");
    assert.deepEqual(groups[0]?.primary.members, ["carryA", "s1", "s2", "s3"]);
    assert.equal(groups[0]?.alternates.length, 2);
    assert.deepEqual(groups[0]?.alternates[0]?.members, [
      "carryA",
      "s4",
      "s5",
      "s6",
    ]);
  });

  it("caps topN main DPS and maxAlternates", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 50),
        team(["carryA", "a1", "a2", "a3"], 48),
        team(["carryA", "b1", "b2", "b3"], 46),
        team(["carryB", "s4", "s5", "s6"], 45),
        team(["carryC", "s7", "s8", "s9"], 44),
      ],
      "top",
      {
        topN: 2,
        maxAlternates: 1,
        minSlotRate: 10,
        onFieldDpsIds: ON_FIELD,
      },
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.alternates.length, 1);
  });

  it("drops teams below minSlotRate for primary and alternates", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 50),
        team(["carryA", "s4", "s5", "s6"], 30),
      ],
      "top",
      {
        topN: 5,
        minSlotRate: 40,
        onFieldDpsIds: ON_FIELD,
      },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.alternates.length, 0);
  });

  it("skips teams with no allowlisted on-field DPS", () => {
    const groups = pickTopMainDpsGroups(
      [team(["flex", "s1", "s2", "s3"], 50)],
      "top",
      { topN: 5, minSlotRate: 10, onFieldDpsIds: ON_FIELD },
    );
    assert.equal(groups.length, 0);
  });

  it("applies Abyss usage_total floor when requested", () => {
    const groups = pickTopMainDpsGroups(
      [
        team(["carryA", "s1", "s2", "s3"], 50, 5, { usage_total: 0 }),
        team(["carryB", "s4", "s5", "s6"], 40, 5, { usage_total: 0.002 }),
      ],
      "top",
      {
        topN: 5,
        minSlotRate: 10,
        onFieldDpsIds: ON_FIELD,
        requireAbyssUsageTotal: true,
      },
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.mainDps, "carryB");
  });

  it("uses the requested slot's field rate", () => {
    const groups = pickTopMainDpsGroups(
      [
        {
          members: ["carryA", "s1", "s2", "s3"],
          usage_rate: 5,
          field_1_rate: 5,
          field_2_rate: 50,
          field_3_rate: 5,
        },
        {
          members: ["carryB", "s4", "s5", "s6"],
          usage_rate: 5,
          field_1_rate: 40,
          field_2_rate: 10,
          field_3_rate: 5,
        },
      ],
      "bottom",
      { topN: 2, minSlotRate: 10, onFieldDpsIds: ON_FIELD },
    );
    assert.equal(groups[0]?.mainDps, "carryA");
  });
});

describe("orderMembersLeadFirst", () => {
  it("moves the lead character to the front", () => {
    assert.deepEqual(orderMembersLeadFirst(["a", "carry", "b", "c"], "carry"), [
      "carry",
      "a",
      "b",
      "c",
    ]);
  });

  it("is a no-op when the lead is absent", () => {
    assert.deepEqual(orderMembersLeadFirst(["a", "b", "c", "d"], "carry"), [
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});
