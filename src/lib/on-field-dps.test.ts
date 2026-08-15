import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderMembersMainDpsFirst } from "./on-field-dps.ts";

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
