import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requireCharacterNameIds,
  requireFiniteInteger,
  requireJsonObject,
  requireNumberInRange,
} from "./request-validation.ts";

const isBadRequest = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === 400;

describe("request validation", () => {
  it("accepts object JSON and rejects null or malformed JSON", async () => {
    const body = await requireJsonObject(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      }),
    );
    assert.equal(body.ok, true);

    await assert.rejects(
      requireJsonObject(
        new Request("http://localhost", { method: "POST", body: "null" }),
      ),
      isBadRequest,
    );
    await assert.rejects(
      requireJsonObject(
        new Request("http://localhost", { method: "POST", body: "{" }),
      ),
      isBadRequest,
    );
  });

  it("requires finite integers and bounded finite numbers", () => {
    assert.equal(requireFiniteInteger(3, "bad"), 3);
    assert.throws(() => requireFiniteInteger(3.5, "bad"), isBadRequest);
    assert.equal(requireNumberInRange(0.3, 0, 1, "bad"), 0.3);
    assert.throws(
      () => requireNumberInRange(Number.NaN, 0, 1, "bad"),
      isBadRequest,
    );
  });

  it("validates character name_id arrays", () => {
    assert.deepEqual(requireCharacterNameIds(["Furina"]), ["Furina"]);
    assert.throws(() => requireCharacterNameIds(null), isBadRequest);
    assert.throws(() => requireCharacterNameIds([""]), isBadRequest);
  });
});
