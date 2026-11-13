/**
 * Account documents: one row per user (`user_rosters`, `user_calculator_goals`)
 * whose `updated_at` is the document revision (`rev`).
 *
 * Writes are compare-and-swap on that revision (design:
 * docs/design/account-sync.md, "Server contract"):
 *
 *   baseRev absent  → unconditional upsert (clients that predate `rev`)
 *   baseRev null    → create only; an existing row is a conflict
 *   baseRev string  → update only while `updated_at` still equals it
 *
 * The client sends back the `rev` it last saw, exactly as returned here.
 * The server never guesses which side should win.
 *
 * No `$env` imports: routes pass `serverDb`, tests pass a fake.
 */

/** Tables that hold one account document per user. */
export type AccountDocTable = "user_rosters" | "user_calculator_goals";

/** `undefined` = legacy write, `null` = create only, string = expected rev. */
export type BaseRev = string | null | undefined;

export type AccountDocRead = {
  /** The document column, or null when the user has no row. */
  data: unknown;
  rev: string | null;
  error: unknown;
};

export type AccountDocWrite =
  | { status: "written"; rev: string }
  | { status: "conflict" }
  | { status: "error"; error: unknown };

/** PostgreSQL unique violation: create-only insert found an existing row. */
const UNIQUE_VIOLATION = "23505";

type Result<T> = PromiseLike<{ data: T; error: unknown }>;

type RevRow = { updated_at: string };

/** The PostgREST builder methods this module uses. */
export type AccountDocDb = {
  from(table: AccountDocTable): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): Result<Record<string, unknown> | null>;
      };
    };
    upsert(
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ): { select(columns: string): Result<RevRow[] | null> };
    insert(row: Record<string, unknown>): {
      select(columns: string): Result<RevRow[] | null>;
    };
    update(row: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          column: string,
          value: string,
        ): {
          select(columns: string): Result<RevRow[] | null>;
        };
      };
    };
  };
};

/**
 * Next revision. Strictly after `baseRev`, so a write in the same millisecond
 * as the last one (or on a server whose clock is behind) still changes `rev`
 * and later compare-and-swap writes cannot pass against a stale base.
 */
export function nextRev(baseRev: BaseRev, now: number = Date.now()): string {
  const base = typeof baseRev === "string" ? Date.parse(baseRev) : NaN;
  const at = Number.isFinite(base) && now <= base ? base + 1 : now;
  return new Date(at).toISOString();
}

function firstRev(rows: RevRow[] | null): string | null {
  const rev = rows?.[0]?.updated_at;
  return typeof rev === "string" ? rev : null;
}

function errorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

/**
 * Read and conditional write for one account-document table. `now` is the
 * clock revisions are made from (tests fix it).
 */
export function accountDocTable(
  db: AccountDocDb,
  table: AccountDocTable,
  now: () => number = Date.now,
) {
  return {
    /** The user's document column and its revision. */
    async read(userId: string, column: string): Promise<AccountDocRead> {
      const { data, error } = await db
        .from(table)
        .select(`${column}, updated_at`)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return { data: null, rev: null, error };
      const rev = data?.updated_at;
      return {
        data: data?.[column] ?? null,
        rev: typeof rev === "string" ? rev : null,
        error: null,
      };
    },

    /**
     * Write `columns` for `userId` under the `baseRev` rule above.
     * `columns` must not include `user_id` or `updated_at`.
     */
    async write(
      userId: string,
      columns: Record<string, unknown>,
      baseRev: BaseRev,
    ): Promise<AccountDocWrite> {
      if (baseRev === undefined) {
        // Revise past the stored row, so this write's rev never equals the
        // one it replaces (a write in the same millisecond, a clock behind).
        const stored = await db
          .from(table)
          .select("updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (stored.error) return { status: "error", error: stored.error };
        const storedRev = stored.data?.updated_at;
        const updated_at = nextRev(
          typeof storedRev === "string" ? storedRev : undefined,
          now(),
        );
        const row = { ...columns, user_id: userId, updated_at };
        const { data, error } = await db
          .from(table)
          .upsert(row, { onConflict: "user_id" })
          .select("updated_at");
        if (error) return { status: "error", error };
        return { status: "written", rev: firstRev(data) ?? updated_at };
      }

      const updated_at = nextRev(baseRev, now());
      const row = { ...columns, user_id: userId, updated_at };

      if (baseRev === null) {
        const { data, error } = await db
          .from(table)
          .insert(row)
          .select("updated_at");
        if (errorCode(error) === UNIQUE_VIOLATION)
          return { status: "conflict" };
        if (error) return { status: "error", error };
        return { status: "written", rev: firstRev(data) ?? updated_at };
      }

      // A single UPDATE … WHERE is atomic: a concurrent writer that moved
      // `updated_at` first leaves zero matching rows here.
      const { data, error } = await db
        .from(table)
        .update({ ...columns, updated_at })
        .eq("user_id", userId)
        .eq("updated_at", baseRev)
        .select("updated_at");
      if (error) return { status: "error", error };
      const rev = firstRev(data);
      return rev === null ? { status: "conflict" } : { status: "written", rev };
    },
  };
}
