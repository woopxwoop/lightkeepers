import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  clearRosterInventory,
  getRosterWeaponsCached,
  getRosterArtifactsCached,
  loadRosterArtifacts,
  loadRosterWeapons,
  setRosterInventory,
} from "./roster-inventory.ts";

afterEach(() => {
  clearRosterInventory();
  mock.restoreAll();
});

describe("roster inventory fetch generations", () => {
  it("ignores a weapons fetch after clearRosterInventory", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mock.method(globalThis, "fetch", () => fetchPromise);

    const pending = loadRosterWeapons();
    clearRosterInventory();
    resolveFetch(
      new Response(JSON.stringify({ weapons: [{ key: "StaffOfHoma" }] }), {
        status: 200,
      }),
    );
    const rows = await pending;
    assert.deepEqual(rows, []);
    assert.equal(getRosterWeaponsCached(), null);
  });

  it("ignores a weapons fetch after setRosterInventory seed", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mock.method(globalThis, "fetch", () => fetchPromise);

    const pending = loadRosterWeapons();
    setRosterInventory({
      weapons: [
        {
          key: "Seeded",
          level: 1,
          ascension: 0,
          refinement: 1,
          location: "",
          lock: false,
        },
      ],
    });
    resolveFetch(
      new Response(
        JSON.stringify({
          weapons: [
            {
              key: "Stale",
              level: 90,
              ascension: 6,
              refinement: 1,
              location: "",
              lock: false,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await pending;
    assert.equal(getRosterWeaponsCached()?.[0]?.key, "Seeded");
  });

  it("ignores an artifacts fetch after clearRosterInventory", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mock.method(globalThis, "fetch", () => fetchPromise);

    const pending = loadRosterArtifacts();
    clearRosterInventory();
    resolveFetch(
      new Response(JSON.stringify({ artifacts: [{ setKey: "X" }] }), {
        status: 200,
      }),
    );
    const rows = await pending;
    assert.deepEqual(rows, []);
    assert.equal(getRosterArtifactsCached(), null);
  });
});
