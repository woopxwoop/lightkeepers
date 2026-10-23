import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { CharacterOwned } from "../definitions.ts";
import { loadAuditGrades } from "./audit-grades.ts";
import {
  clearRosterInventory,
  setRosterInventory,
} from "./roster-inventory.ts";

describe("loadAuditGrades", () => {
  it("keeps grading when a gear request fails and uses that slice's cache", async () => {
    clearRosterInventory();
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/roster/weapons")) {
        setRosterInventory({
          weapons: [
            {
              key: "StaffOfHoma",
              level: 80,
              ascension: 6,
              refinement: 1,
              location: "HuTao",
              lock: false,
            },
          ],
        });
        return new Response("nope", { status: 500 });
      }
      if (url.includes("/api/roster/artifacts")) {
        return new Response(JSON.stringify({ artifacts: [] }), { status: 200 });
      }
      if (url.includes("/api/character-index")) {
        return new Response(JSON.stringify({ characters: {} }), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const rows = await loadAuditGrades([
        {
          name_id: "Hutao",
          name: "Hu Tao",
          isOwned: true,
          progress: null,
        } as CharacterOwned,
      ]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.weaponKey, "StaffOfHoma");
      assert.equal(rows[0]?.progress.weapon?.level, 80);
    } finally {
      mock.restoreAll();
      clearRosterInventory();
    }
  });
});
