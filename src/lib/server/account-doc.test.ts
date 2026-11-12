/**
 * Account-document compare-and-swap writes (docs/design/account-sync.md).
 *
 * Run: pnpm exec tsx --test src/lib/server/account-doc.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountDocTable, nextRev, type AccountDocDb } from "./account-doc.ts";

type Call = {
  op: string;
  row?: Record<string, unknown>;
  eq: [string, string][];
};

/**
 * Records the builder chain and answers with `reply`. Mirrors only the
 * PostgREST methods `account-doc.ts` uses.
 */
function fakeDb(reply: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const db = {
    from() {
      const call: Call = { op: "", eq: [] };
      calls.push(call);
      const chain = {
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return chain;
        },
        select() {
          return chain;
        },
        maybeSingle() {
          return chain;
        },
        then<R>(resolve: (value: { data: unknown; error: unknown }) => R) {
          return Promise.resolve(reply).then(resolve);
        },
      };
      const start = (op: string) => (row?: Record<string, unknown>) => {
        call.op = op;
        call.row = row;
        return chain;
      };
      return {
        select: () => {
          call.op = "select";
          return chain;
        },
        upsert: start("upsert"),
        insert: start("insert"),
        update: start("update"),
      };
    },
  } as unknown as AccountDocDb;
  return { db, calls };
}

const REV = "2026-11-12T10:00:00.000+00:00";
const NEXT = "2026-11-12T10:00:01.000+00:00";

describe("nextRev", () => {
  it("uses the clock when it is after the base", () => {
    const now = Date.parse("2026-11-12T10:00:05.000Z");
    assert.equal(nextRev(REV, now), "2026-11-12T10:00:05.000Z");
    assert.equal(nextRev(undefined, now), "2026-11-12T10:00:05.000Z");
    assert.equal(nextRev(null, now), "2026-11-12T10:00:05.000Z");
  });

  it("moves past the base when the clock is equal or behind", () => {
    assert.equal(nextRev(REV, Date.parse(REV)), "2026-11-12T10:00:00.001Z");
    assert.equal(
      nextRev(REV, Date.parse(REV) - 5_000),
      "2026-11-12T10:00:00.001Z",
    );
  });
});

describe("accountDocTable.read", () => {
  it("returns the column and its revision", async () => {
    const { db } = fakeDb({
      data: { goals: [1], updated_at: REV },
      error: null,
    });
    const read = await accountDocTable(db, "user_calculator_goals").read(
      "u1",
      "goals",
    );
    assert.deepEqual(read, { data: [1], rev: REV, error: null });
  });

  it("returns nulls when the user has no row", async () => {
    const { db } = fakeDb({ data: null, error: null });
    const read = await accountDocTable(db, "user_rosters").read("u1", "roster");
    assert.deepEqual(read, { data: null, rev: null, error: null });
  });
});

describe("accountDocTable.write", () => {
  it("upserts without a condition when baseRev is absent", async () => {
    const { db, calls } = fakeDb({ data: [{ updated_at: NEXT }], error: null });
    const result = await accountDocTable(db, "user_rosters").write(
      "u1",
      { roster: [] },
      undefined,
    );
    assert.deepEqual(result, { status: "written", rev: NEXT });
    assert.equal(calls[0].op, "upsert");
    assert.equal(calls[0].row?.user_id, "u1");
  });

  it("creates only when baseRev is null", async () => {
    const { db, calls } = fakeDb({ data: [{ updated_at: NEXT }], error: null });
    const result = await accountDocTable(db, "user_rosters").write(
      "u1",
      { roster: [] },
      null,
    );
    assert.deepEqual(result, { status: "written", rev: NEXT });
    assert.equal(calls[0].op, "insert");
  });

  it("reports an existing row on create-only as a conflict", async () => {
    const { db } = fakeDb({ data: null, error: { code: "23505" } });
    const result = await accountDocTable(db, "user_rosters").write(
      "u1",
      { roster: [] },
      null,
    );
    assert.deepEqual(result, { status: "conflict" });
  });

  it("updates only the row still at baseRev", async () => {
    const { db, calls } = fakeDb({ data: [{ updated_at: NEXT }], error: null });
    const result = await accountDocTable(db, "user_calculator_goals").write(
      "u1",
      { goals: [] },
      REV,
    );
    assert.deepEqual(result, { status: "written", rev: NEXT });
    assert.equal(calls[0].op, "update");
    assert.deepEqual(calls[0].eq, [
      ["user_id", "u1"],
      ["updated_at", REV],
    ]);
    assert.equal(calls[0].row?.user_id, undefined);
  });

  it("treats zero updated rows as a conflict", async () => {
    const { db } = fakeDb({ data: [], error: null });
    const result = await accountDocTable(db, "user_calculator_goals").write(
      "u1",
      { goals: [] },
      REV,
    );
    assert.deepEqual(result, { status: "conflict" });
  });

  it("passes database errors through", async () => {
    const dbError = { code: "42703", message: "column missing" };
    const { db } = fakeDb({ data: null, error: dbError });
    const result = await accountDocTable(db, "user_rosters").write(
      "u1",
      { roster: [] },
      REV,
    );
    assert.deepEqual(result, { status: "error", error: dbError });
  });
});
