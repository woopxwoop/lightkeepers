/**
 * Roster synced document: entry parsing, catalog join, and the one-time
 * move from the old `charactersOwned` key.
 *
 * Run: pnpm exec tsx --test src/lib/app/roster-sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Character } from "../definitions.ts";
import { memorySlotStorage } from "../sync/storage.ts";
import {
  parseRosterDoc,
  rosterDocSpec,
  rosterOwnedFrom,
} from "../sync/roster-doc.ts";
import { migrateLegacyRoster } from "./roster-sync.ts";

const character = (name_id: string, released_at = "2020-09-28") =>
  ({ name_id, name: name_id, released_at }) as unknown as Character;

type Slot = { data: { name_id: string }[]; dirty: boolean };

describe("parseRosterDoc", () => {
  it("keeps synced fields only, sorted, from the old full-row cache", () => {
    const doc = parseRosterDoc([
      { name_id: "Zhongli", isOwned: true, rarity: 5, element: "Geo" },
      { id: "Albedo", isOwned: false },
      { name_id: "Bad" },
      "junk",
    ]);
    assert.deepEqual(doc, [
      { name_id: "Albedo", isOwned: false, progress: null },
      { name_id: "Zhongli", isOwned: true, progress: null },
    ]);
  });

  it("ignores order when comparing", () => {
    const a = [
      { name_id: "B", isOwned: true, progress: null },
      { name_id: "A", isOwned: false, progress: null },
    ];
    assert.equal(rosterDocSpec.equal(a, [...a].reverse()), true);
  });
});

describe("rosterOwnedFrom", () => {
  it("joins stored entries onto the catalog; unconfigured rows default", () => {
    const owned = rosterOwnedFrom(
      [
        character("Albedo"),
        character("Zhongli"),
        character("Brand", new Date(Date.now() - 5 * 86_400_000).toISOString()),
      ],
      [{ name_id: "Albedo", isOwned: false, progress: null }],
    );
    assert.deepEqual(
      owned.map((c) => [c.name_id, c.isOwned]),
      [
        ["Albedo", false],
        ["Zhongli", true],
        ["Brand", false],
      ],
    );
  });
});

describe("migrateLegacyRoster", () => {
  const legacy = [{ name_id: "Albedo", isOwned: true }];

  it("moves an unstamped roster into the guest slot as saved", () => {
    const storage = memorySlotStorage();
    storage.write("charactersOwned", legacy);
    storage.write("hasSavedRoster", true);
    migrateLegacyRoster(storage);
    const slot = storage.read("lk:roster:guest") as Slot;
    assert.deepEqual(
      slot.data.map((e) => e.name_id),
      ["Albedo"],
    );
    assert.equal(slot.dirty, false);
    assert.equal(storage.read("charactersOwned"), null);
    assert.equal(storage.read("hasSavedRoster"), null);
  });

  it("gives a stamped roster to its owner, unsent", () => {
    const storage = memorySlotStorage();
    storage.write("charactersOwned", legacy);
    storage.write("rosterOwnerUserId", "u1");
    migrateLegacyRoster(storage);
    const slot = storage.read("lk:roster:u1") as Slot;
    assert.equal(slot.dirty, true);
    assert.equal(storage.read("lk:roster:guest"), null);
    assert.equal(storage.read("rosterOwnerUserId"), null);
  });

  it("never overwrites an existing slot", () => {
    const storage = memorySlotStorage();
    storage.write("lk:roster:guest", { v: 1, data: [] });
    storage.write("charactersOwned", legacy);
    migrateLegacyRoster(storage);
    assert.deepEqual((storage.read("lk:roster:guest") as Slot).data, []);
  });

  it("keeps the old keys when the slot cannot be stored", () => {
    const storage = memorySlotStorage();
    storage.write("charactersOwned", legacy);
    storage.failWrites = true;
    migrateLegacyRoster(storage);
    assert.equal(storage.read("lk:roster:guest"), null);
    assert.notEqual(storage.read("charactersOwned"), null);
  });
});
