import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { hasTcgCard, loadTcgCardIds } from "./tcg-cards.ts";

describe("loadTcgCardIds", () => {
  it("retries a provisional index and then reuses a published one", async () => {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls += 1;
      const body =
        calls === 1
          ? { name_ids: ["PlayerBoy"], provisional: true }
          : { name_ids: ["Hutao", "PlayerBoy"] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await loadTcgCardIds();
      assert.equal(calls, 1);
      assert.equal(hasTcgCard("PlayerBoy"), true);
      assert.equal(hasTcgCard("Hutao"), null);

      await loadTcgCardIds();
      assert.equal(calls, 2);
      assert.equal(hasTcgCard("Hutao"), true);
      assert.equal(hasTcgCard("Amber"), false);

      await loadTcgCardIds();
      assert.equal(calls, 2);
    } finally {
      mock.restoreAll();
    }
  });
});
