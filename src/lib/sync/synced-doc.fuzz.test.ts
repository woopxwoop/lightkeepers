/**
 * Randomized interleavings for the synced-document engine.
 *
 * Two tabs share one storage (cross-tab events arrive late, in order) and one
 * cookie. Requests take a random number of microtasks. Another device writes
 * to the server, the network fails and recovers, and the session switches
 * accounts; each tab notices the switch at its own time.
 *
 * Every edit only adds a unique token, and the merge is three-way like the
 * real specs (a remote removal of an untouched item stays removed). Servers
 * only grow, so nothing committed for an account may disappear. After a
 * final round of saves on every tab:
 *
 * - every token committed for an account is on the server for that account;
 * - no account's slot or server copy holds another account's token;
 * - a guest token reaches at most one account.
 *
 * At random points a probe brings the network back and saves once with
 * nothing else running: that save must end clean, with its token and its
 * attachment written. (The final round would hide a save that needed a
 * second press.)
 *
 * A failure prints the seed and the action log. Replay one with
 * `FUZZ_SEED=<seed> pnpm exec tsx --test src/lib/sync/synced-doc.fuzz.test.ts`;
 * add `FUZZ_TRACE=1` to log each engine decision and the state after each step.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { get } from "svelte/store";
import { createSyncedDoc, type SyncedDoc } from "./synced-doc.ts";
import type { SlotStorage } from "./storage.ts";
import type { SyncTransport } from "./transport.ts";
import { fakeServer, makeSpec, type Doc } from "./synced-doc.fixtures.ts";

/**
 * Three-way merge, like `mergeGoals`: keep what both sides have, plus what
 * either side added since `base`. A side's removal of an untouched item wins.
 */
function threeWay(base: Doc | null, local: Doc, remote: Doc): Doc {
  const before = new Set(base?.items ?? []);
  const remoteSet = new Set(remote.items);
  const items = local.items.filter((x) => remoteSet.has(x) || !before.has(x));
  for (const x of remote.items) {
    if (!items.includes(x) && !before.has(x)) items.push(x);
  }
  return { items, pick: local.pick };
}

const RUNS = Number(process.env.FUZZ_RUNS ?? 300);
const STEPS = 80;
const ACCOUNTS = ["a", "b"] as const;
const TABS = 2;

/** Deterministic PRNG (mulberry32). */
function prng(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(items: readonly T[]): T =>
      items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

/** One localStorage seen by several tabs; each tab's events queue up. */
function sharedStorage(tabs: number) {
  const entries = new Map<string, string>();
  const listeners = Array.from(
    { length: tabs },
    () => new Set<(key: string, value: unknown) => void>(),
  );
  const pending: { tab: number; key: string; json: string | null }[] = [];
  const parse = (json: string | null): unknown =>
    json === null ? null : (JSON.parse(json) as unknown);

  const tab = (index: number): SlotStorage => ({
    read: (key) => parse(entries.get(key) ?? null),
    write(key, value) {
      const json = JSON.stringify(value);
      entries.set(key, json);
      for (let other = 0; other < tabs; other++) {
        if (other !== index) pending.push({ tab: other, key, json });
      }
      return true;
    },
    remove(key) {
      entries.delete(key);
      for (let other = 0; other < tabs; other++) {
        if (other !== index) pending.push({ tab: other, key, json: null });
      }
    },
    watch(onChange) {
      listeners[index].add(onChange);
      return () => listeners[index].delete(onChange);
    },
  });

  return {
    entries,
    tab,
    pendingCount: () => pending.length,
    /** Deliver the oldest queued event for `index` (events stay in order). */
    deliverOne(index: number): boolean {
      const at = pending.findIndex((event) => event.tab === index);
      if (at < 0) return false;
      const [event] = pending.splice(at, 1);
      for (const listener of listeners[index]) {
        listener(event.key, parse(event.json));
      }
      return true;
    },
    deliverAll() {
      while (pending.length > 0) this.deliverOne(pending[0].tab);
    },
  };
}

/**
 * Each request waits a random number of microtasks before and after.
 * `written` collects the attachments of writes the server accepted.
 */
function jittered(
  transport: SyncTransport,
  rng: ReturnType<typeof prng>,
  written: unknown[],
): SyncTransport {
  const ticks = async () => {
    for (let i = rng.int(6); i > 0; i--) await Promise.resolve();
  };
  return {
    async read() {
      await ticks();
      const res = await transport.read();
      await ticks();
      return res;
    },
    async write(wire, baseRev, account, attach) {
      await ticks();
      const res = await transport.write(wire, baseRev, account, attach);
      if (res.status === "written" && attach) written.push(attach.inv);
      await ticks();
      return res;
    },
  };
}

type Tab = {
  doc: SyncedDoc<Doc>;
  /** A page draft taken earlier: the view data it started from. */
  draft: Doc | null;
};

async function run(seed: number): Promise<void> {
  const rng = prng(seed);
  const log: string[] = [];
  const storage = sharedStorage(TABS);
  const { server, transport } = fakeServer();
  const spec = { ...makeSpec(), merge: threeWay };
  const writtenAttachments: unknown[] = [];
  const tracing = process.env.FUZZ_TRACE !== undefined;
  const tabs: Tab[] = Array.from({ length: TABS }, (_, i) => ({
    doc: createSyncedDoc(spec, {
      storage: storage.tab(i),
      transport: jittered(transport, rng, writtenAttachments),
      trace: tracing
        ? (event) =>
            log.push(
              `  · tab${i} ${event.account} ${event.step}: ${event.detail}`,
            )
        : undefined,
    }),
    draft: null,
  }));
  const view = (tab: Tab) => get(tab.doc.view);
  /** Tokens committed for each account; guest tokens separately. */
  const expected = new Map<string, Set<string>>(
    ACCOUNTS.map((account) => [account, new Set<string>()]),
  );
  const guestTokens = new Set<string>();
  const inFlight: Promise<unknown>[] = [];
  let tokenN = 0;
  const token = (owner: string) => `${owner}:${++tokenN}`;

  const fail = (message: string): never => {
    assert.fail(
      `seed ${seed}: ${message}\n  actions:\n    ${log.join("\n    ")}`,
    );
  };

  // The first session settles in both tabs.
  const first = rng.pick([null, ...ACCOUNTS]);
  server.session = first;
  for (const tab of tabs) tab.doc.setAccount(first);
  log.push(`start session=${first}`);

  const snapshot = () =>
    tabs
      .map((t, i) => {
        const v = view(t);
        return `tab${i}(${v.account}) [${v.data.items}] ${v.status}${v.dirty ? "*" : ""}`;
      })
      .join(" | ") +
    ` | slot a=${JSON.stringify(storage.entries.get("lk:t:a") ?? null)}` +
    ` | server a=[${server.rows.get("a")?.items ?? ""}]@${server.rows.get("a")?.rev ?? "-"}`;

  for (let step = 0; step < STEPS; step++) {
    if (tracing) log.push(`    → ${snapshot()}`);
    const tabIndex = rng.int(TABS);
    const tab = tabs[tabIndex];
    const roll = rng.int(100);

    if (roll < 30) {
      // Save: from the current view, or from an older draft.
      const active = view(tab).account;
      const owner = active ?? "guest";
      const t = token(owner);
      const useDraft = tab.draft !== null && rng.chance(0.5);
      const base = useDraft ? tab.draft! : view(tab).data;
      const next = { ...base, items: [...base.items, t] };
      const attach =
        active !== null && rng.chance(0.15) ? { inv: t } : undefined;
      log.push(
        `tab${tabIndex} commit ${t}${useDraft ? " (draft)" : ""}${attach ? " +attach" : ""}`,
      );
      if (active === null) guestTokens.add(t);
      else expected.get(active)!.add(t);
      inFlight.push(
        tab.doc.commit(next, {
          basedOn: useDraft ? base : undefined,
          attach,
        }),
      );
      if (useDraft) tab.draft = null;
    } else if (roll < 38) {
      tab.draft = view(tab).data;
      log.push(`tab${tabIndex} draft`);
    } else if (roll < 48) {
      log.push(`tab${tabIndex} refresh`);
      inFlight.push(tab.doc.refresh());
    } else if (roll < 58) {
      const delivered = storage.deliverOne(tabIndex);
      if (delivered) log.push(`tab${tabIndex} storage event`);
    } else if (roll < 64) {
      // Another device adds to the server copy.
      const account = rng.pick(ACCOUNTS);
      const t = token(account);
      const row = server.rows.get(account);
      server.put(account, [...(row?.items ?? []), t]);
      expected.get(account)!.add(t);
      log.push(`device put ${account} ${t}`);
    } else if (roll < 69) {
      server.failWrites = !server.failWrites;
      log.push(`failWrites=${server.failWrites}`);
    } else if (roll < 73) {
      server.failReads = !server.failReads;
      log.push(`failReads=${server.failReads}`);
    } else if (roll < 77) {
      // The cookie changes; tabs notice separately.
      server.session = rng.pick([null, ...ACCOUNTS]);
      log.push(`session=${server.session}`);
    } else if (roll < 85) {
      if (view(tab).account !== server.session || !view(tab).ready) {
        log.push(`tab${tabIndex} setAccount ${server.session}`);
        tab.doc.setAccount(server.session);
        tab.draft = null; // a page drops its draft on a switch
      }
    } else if (roll < 91) {
      for (let i = rng.int(8); i > 0; i--) await Promise.resolve();
    } else if (roll < 95) {
      // Probe: one save on a quiet, healthy network must finish.
      const account = view(tab).account;
      if (account === null) continue;
      log.push(`tab${tabIndex} probe (${account})`);
      server.failReads = false;
      server.failWrites = false;
      server.session = account;
      await Promise.all(inFlight);
      for (const t of tabs) await t.doc.idle();
      storage.deliverAll();
      const t = token(account);
      expected.get(account)!.add(t);
      const data = view(tab).data;
      const result = await tab.doc.commit(
        { ...data, items: [...data.items, t] },
        { attach: { inv: t } },
      );
      if (result.status !== "sent") {
        const detail =
          result.status === "unsent" ? (result.error ?? "unsent") : result.status;
        fail(`probe save was ${detail}`);
      }
      if (!server.rows.get(account)?.items.includes(t)) {
        fail(`probe save did not send ${t}`);
      }
      if (!writtenAttachments.includes(t)) {
        fail(`probe save did not send the attachment for ${t}`);
      }
    } else {
      log.push("settle");
      await Promise.all(inFlight);
      for (const t of tabs) await t.doc.idle();
    }
  }

  // ── Final round: network back, every tab saves what it holds ──────────
  log.push("── final");
  server.failReads = false;
  server.failWrites = false;
  await Promise.all(inFlight);
  for (const account of ACCOUNTS) {
    server.session = account;
    for (const tab of tabs) {
      tab.doc.setAccount(account);
      await tab.doc.idle();
    }
    for (let round = 0; round < 2; round++) {
      for (const tab of tabs) {
        storage.deliverAll();
        await tab.doc.refresh();
        await tab.doc.idle();
        storage.deliverAll();
        await tab.doc.commit(view(tab).data);
        await tab.doc.idle();
      }
    }
  }

  // ── Invariants ─────────────────────────────────────────────────────────
  for (const account of ACCOUNTS) {
    const row = new Set(server.rows.get(account)?.items ?? []);
    for (const t of expected.get(account)!) {
      if (!row.has(t)) fail(`${account} lost ${t}; server has [${[...row]}]`);
    }
    const others = ACCOUNTS.filter((other) => other !== account);
    const slot = storage.entries.get(`lk:t:${account}`) ?? "";
    for (const other of others) {
      for (const t of [...row].filter((x) => x.startsWith(`${other}:`))) {
        fail(`${other}'s ${t} reached ${account}'s server copy`);
      }
      if (slot.includes(`"${other}:`)) {
        fail(`${other}'s token reached ${account}'s slot: ${slot}`);
      }
    }
  }
  for (const t of guestTokens) {
    const holders = ACCOUNTS.filter((account) =>
      server.rows.get(account)?.items.includes(t),
    );
    if (holders.length > 1) fail(`guest ${t} reached ${holders.join(" and ")}`);
  }
  for (const tab of tabs) tab.doc.dispose();
}

describe("synced document under random interleavings", () => {
  const only = process.env.FUZZ_SEED;
  const seeds = only
    ? [Number(only)]
    : Array.from({ length: RUNS }, (_, i) => i + 1);
  it(`keeps every edit and every account separate (${seeds.length} runs)`, async () => {
    for (const seed of seeds) await run(seed);
  });
});
