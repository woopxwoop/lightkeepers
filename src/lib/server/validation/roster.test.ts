import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requireBaseRev,
  requireExpectedAccount,
  requireRosterEntries,
  requireInventoryWeapons,
  requireInventoryArtifacts,
} from "./roster.ts";
import {
  MAX_ARTIFACT_SUBSTATS,
  MAX_INVENTORY_ARTIFACTS,
  MAX_INVENTORY_WEAPONS,
  MAX_SUBSTAT_INPUT_ROWS,
  MAX_UNACTIVATED_SUBSTATS,
} from "../../roster-inventory.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

const hasStatus =
  (status: number) =>
  (value: unknown): boolean =>
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === status;

describe("roster request validation", () => {
  it("validates roster entries and rejects extra or wrong-typed keys", () => {
    assert.deepEqual(
      requireRosterEntries([{ name_id: "furina", isOwned: true }]),
      [{ name_id: "furina", isOwned: true }],
    );
    assert.deepEqual(
      requireRosterEntries([
        {
          name_id: "furina",
          isOwned: true,
          progress: {
            level: 90,
            ascension: 6,
            constellation: 2,
            talents: { normal: 6, skill: 8, burst: 8 },
            weapon: {
              key: "SplendorOfTranquilWaters",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ]),
      [
        {
          name_id: "furina",
          isOwned: true,
          progress: {
            level: 90,
            ascension: 6,
            constellation: 2,
            talents: { normal: 6, skill: 8, burst: 8 },
            weapon: {
              key: "SplendorOfTranquilWaters",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ],
    );
    assert.throws(() => requireRosterEntries(null), isBadRequest);
    assert.throws(
      () => requireRosterEntries([{ name_id: "furina" }]),
      isBadRequest,
    );
    assert.throws(
      () => requireRosterEntries([{ name_id: "furina", isOwned: "yes" }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([{ name_id: "furina", isOwned: true, extra: 1 }]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([
          {
            name_id: "furina",
            isOwned: true,
            progress: {
              level: 90,
              ascension: 6,
              constellation: 2,
              talents: { normal: 6, skill: 8, burst: 8 },
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([
          {
            name_id: "furina",
            isOwned: true,
            progress: {
              level: 90,
              ascension: 6,
              constellation: 2,
              talents: { normal: 6, skill: 8, burst: 8 },
              weapon: {
                key: "X",
                level: 90,
                ascension: 6,
                refinement: 1,
              },
              extra: true,
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([
          {
            name_id: "furina",
            isOwned: true,
            progress: {
              level: 90,
              ascension: 6,
              constellation: 2,
              talents: { normal: 0, skill: 8, burst: 8 },
              weapon: null,
            },
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireRosterEntries([
          {
            name_id: "furina",
            isOwned: true,
            progress: {
              level: 90,
              ascension: 6,
              constellation: 99,
              talents: { normal: 6, skill: 8, burst: 8 },
              weapon: null,
            },
          },
        ]),
      isBadRequest,
    );
  });

  it("rejects oversized weapon inventory", () => {
    const row = {
      key: "StaffOfHoma",
      level: 90,
      ascension: 6,
      refinement: 1,
      location: "",
      lock: false,
    };
    assert.throws(
      () =>
        requireInventoryWeapons(
          Array.from({ length: MAX_INVENTORY_WEAPONS + 1 }, () => row),
        ),
      isBadRequest,
    );
  });

  it("rejects invalid weapon refinement bounds", () => {
    assert.throws(
      () =>
        requireInventoryWeapons([
          {
            key: "StaffOfHoma",
            level: 90,
            ascension: 6,
            refinement: 0,
            location: "",
            lock: false,
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireInventoryWeapons([
          {
            key: "StaffOfHoma",
            level: 90,
            ascension: 6,
            refinement: 6,
            location: "",
            lock: false,
          },
        ]),
      isBadRequest,
    );
  });

  it("rejects oversized artifact inventory and substat rows", () => {
    const base = {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "goblet" as const,
      level: 20,
      rarity: 5,
      mainStatKey: "pyro_dmg_",
      location: "",
      lock: true,
      substats: [{ key: "critRate_", value: 10.5 }],
    };
    assert.throws(
      () =>
        requireInventoryArtifacts(
          Array.from({ length: MAX_INVENTORY_ARTIFACTS + 1 }, () => base),
        ),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireInventoryArtifacts([
          {
            ...base,
            substats: Array.from({ length: MAX_ARTIFACT_SUBSTATS + 1 }, () => ({
              key: "critRate_",
              value: 1,
            })),
          },
        ]),
      isBadRequest,
    );
    // Placeholders are filtered before the effective max — 6 real + empties OK.
    const withPlaceholders = requireInventoryArtifacts([
      {
        ...base,
        substats: [
          ...Array.from({ length: MAX_ARTIFACT_SUBSTATS }, () => ({
            key: "critRate_",
            value: 1,
          })),
          { key: "", value: 0 },
        ],
      },
    ]);
    assert.equal(withPlaceholders[0]?.substats.length, MAX_ARTIFACT_SUBSTATS);
    assert.throws(
      () =>
        requireInventoryArtifacts([
          {
            ...base,
            substats: Array.from(
              { length: MAX_SUBSTAT_INPUT_ROWS + 1 },
              () => ({ key: "", value: 0 }),
            ),
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () =>
        requireInventoryArtifacts([
          {
            ...base,
            unactivatedSubstats: Array.from(
              { length: MAX_UNACTIVATED_SUBSTATS + 1 },
              () => ({ key: "eleMas", value: 16 }),
            ),
          },
        ]),
      isBadRequest,
    );
  });

  it("rejects invalid artifact level and rarity bounds", () => {
    const base = {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "goblet" as const,
      mainStatKey: "pyro_dmg_",
      location: "",
      lock: true,
      substats: [{ key: "critRate_", value: 10.5 }],
    };
    assert.throws(
      () => requireInventoryArtifacts([{ ...base, level: 21, rarity: 5 }]),
      isBadRequest,
    );
    assert.throws(
      () => requireInventoryArtifacts([{ ...base, level: 20, rarity: 6 }]),
      isBadRequest,
    );
  });

  it("validates GOOD weapon and artifact inventory slices", () => {
    assert.deepEqual(
      requireInventoryWeapons([
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "HuTao",
          lock: false,
        },
      ]),
      [
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "HuTao",
          lock: false,
        },
      ],
    );
    assert.throws(
      () =>
        requireInventoryWeapons([
          {
            key: "StaffOfHoma",
            level: 90,
            ascension: 6,
            refinement: 1,
            location: "HuTao",
          },
        ]),
      isBadRequest,
    );
    const artifact = requireInventoryArtifacts([
      {
        setKey: "CrimsonWitchOfFlames",
        slotKey: "goblet",
        level: 20,
        rarity: 5,
        mainStatKey: "pyro_dmg_",
        location: "",
        lock: true,
        substats: [{ key: "critRate_", value: 10.5 }],
      },
    ]);
    assert.equal(artifact[0]?.setKey, "CrimsonWitchOfFlames");
    const hpFlower = requireInventoryArtifacts([
      {
        setKey: "GladiatorsFinale",
        slotKey: "flower",
        level: 20,
        rarity: 5,
        mainStatKey: "hp",
        location: "HuTao",
        lock: false,
        substats: [{ key: "hp", value: 4780 }],
      },
    ]);
    assert.equal(hpFlower[0]?.substats[0]?.value, 4780);
    const goPlaceholders = requireInventoryArtifacts([
      {
        setKey: "GladiatorsFinale",
        slotKey: "flower",
        level: 20,
        rarity: 5,
        mainStatKey: "hp",
        location: "HuTao",
        lock: false,
        substats: [{ key: "hp", value: 1076 }],
        unactivatedSubstats: [
          { key: "", value: 0 },
          { key: "", value: 0 },
          { key: "eleMas", value: 16 },
          { key: "", value: 0 },
        ],
        id: "artifact-1",
      },
    ]);
    assert.equal(goPlaceholders[0]?.substats[0]?.value, 1076);
    assert.deepEqual(goPlaceholders[0]?.unactivatedSubstats, [
      { key: "eleMas", value: 16 },
    ]);
    assert.throws(
      () =>
        requireInventoryArtifacts([
          {
            setKey: "GladiatorsFinale",
            slotKey: "flower",
            level: 0,
            rarity: 5,
            mainStatKey: "hp",
            location: "",
            lock: false,
            substats: [{ value: 10 }],
          },
        ]),
      isBadRequest,
    );
    assert.throws(
      () => requireInventoryArtifacts([{ setKey: "x" }]),
      isBadRequest,
    );
    assert.equal(
      requireInventoryWeapons([
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "HuTao",
          lock: false,
          id: "extra",
        },
      ])[0]?.key,
      "StaffOfHoma",
    );
  });

  it("requireBaseRev keeps absent/null and accepts revision strings", () => {
    assert.equal(requireBaseRev(undefined), undefined);
    assert.equal(requireBaseRev(null), null);
    const rev = "2026-11-12T10:00:00.123456+00:00";
    assert.equal(requireBaseRev(rev), rev);
    assert.throws(() => requireBaseRev(""), isBadRequest);
    assert.throws(() => requireBaseRev("not a date"), isBadRequest);
    assert.throws(() => requireBaseRev(123), isBadRequest);
    assert.throws(
      () => requireBaseRev("2026-11-12".padEnd(65, "0")),
      isBadRequest,
    );
  });

  it("requireExpectedAccount allows absent or matching ids only", () => {
    assert.doesNotThrow(() => requireExpectedAccount(undefined, "u1"));
    assert.doesNotThrow(() => requireExpectedAccount("u1", "u1"));
    assert.throws(() => requireExpectedAccount("u2", "u1"), hasStatus(403));
    assert.throws(() => requireExpectedAccount(null, "u1"), hasStatus(403));
  });
});
