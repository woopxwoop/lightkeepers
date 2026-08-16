import assert from "node:assert/strict";
import { describe, it } from "node:test";
import characterBases from "./data/character-bases.json" with { type: "json" };
import {
  ON_FIELD_DPS_NAME_IDS,
  onFieldMembers,
  orderMembersMainDpsFirst,
} from "./on-field-dps.ts";

describe("orderMembersMainDpsFirst", () => {
  const onField = new Set(["carry", "carry2"]);

  it("leaves order unchanged when no on-field DPS is present", () => {
    assert.deepEqual(orderMembersMainDpsFirst(["a", "b", "c", "d"], onField), [
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("moves a single on-field DPS to the front", () => {
    assert.deepEqual(
      orderMembersMainDpsFirst(["a", "carry", "b", "c"], onField),
      ["carry", "a", "b", "c"],
    );
  });

  it("keeps relative order among multiple on-field DPS then the rest", () => {
    assert.deepEqual(
      orderMembersMainDpsFirst(["a", "carry2", "b", "carry"], onField),
      ["carry2", "carry", "a", "b"],
    );
  });
});

describe("ON_FIELD_DPS_NAME_IDS", () => {
  it("every allowlisted name_id exists in character-bases", () => {
    const catalogIds = new Set(
      Object.values(characterBases).map(
        (row) => (row as { name_id: string }).name_id,
      ),
    );
    const missing = [...ON_FIELD_DPS_NAME_IDS]
      .filter((id) => !catalogIds.has(id))
      .sort();
    assert.deepEqual(
      missing,
      [],
      `allowlist ids missing from character-bases: ${missing.join(", ")}`,
    );
  });
});

describe("onFieldMembers", () => {
  it("preserves order, dedupes, and respects an injectable set", () => {
    const onField = new Set(["carry", "carry2"]);
    assert.deepEqual(
      onFieldMembers(["a", "carry", "b", "carry", "carry2"], onField),
      ["carry", "carry2"],
    );
  });
});
