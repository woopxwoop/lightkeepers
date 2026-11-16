/**
 * Server side of a synced document: the account-document contract
 * (`#lib/server/account-doc.js`, docs/design/account-sync.md).
 *
 * GET  → { <field>: wire | null, rev, account }
 * POST { <field>: wire, baseRev, account } → 200 { rev } | 409 { <field>, rev }
 *
 * `account` is the session's user id. GET echoes it so a response for a
 * different session can be dropped. POST sends the expected one so the
 * server refuses a write for an account that is no longer signed in.
 */

export type TransportRead =
  | {
      status: "ok";
      wire: unknown;
      rev: string | null;
      /** Account the server answered for. Null from servers that predate it. */
      account: string | null;
    }
  | { status: "error"; message: string };

export type TransportWrite =
  | {
      status: "written";
      rev: string;
      /** The document was stored and the attachment on this write was not. */
      attachmentOmitted?: boolean;
    }
  | { status: "conflict"; wire: unknown; rev: string | null }
  | { status: "error"; message: string };

export type TransportRemove =
  | { status: "removed" }
  | { status: "error"; message: string };

/**
 * Facts a route adds to a successful write. The engine only knows that an
 * attachment was dropped; the document's transport reads its own body.
 */
export type WriteReport = {
  attachmentOmitted?: boolean;
};

export interface SyncTransport {
  read(): Promise<TransportRead>;
  /**
   * `baseRev` null = create only. `account` must still be signed in.
   * `attach` adds fields to this request body only.
   */
  write(
    wire: unknown,
    baseRev: string | null,
    account: string,
    attach?: Record<string, unknown>,
  ): Promise<TransportWrite>;
  /** Delete the signed-in account's server row. `account` must still be that session. */
  remove(account: string): Promise<TransportRemove>;
}

const TIMEOUT_MS = 15_000;
const MAX_MESSAGE_LENGTH = 200;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function revOf(body: Record<string, unknown>): string | null {
  return typeof body.rev === "string" ? body.rev : null;
}

async function bodyOf(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return asRecord(await res.json());
  } catch {
    return null;
  }
}

function failure(status: number, body: Record<string, unknown> | null): string {
  const message =
    typeof body?.message === "string" &&
    body.message.length <= MAX_MESSAGE_LENGTH
      ? body.message
      : "";
  return message
    ? `Sync failed (${status}): ${message}`
    : `Sync failed (${status})`;
}

/** `fetch` transport for `endpoint`, whose body field is `field`. */
export function fetchTransport(
  endpoint: string,
  field: string,
  reportOf?: (body: Record<string, unknown>) => WriteReport,
): SyncTransport {
  return {
    async read() {
      try {
        const res = await fetch(endpoint, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = await bodyOf(res);
        if (!res.ok || !body || !(field in body)) {
          return { status: "error", message: failure(res.status, body) };
        }
        return {
          status: "ok",
          wire: body[field] ?? null,
          rev: revOf(body),
          account: typeof body.account === "string" ? body.account : null,
        };
      } catch {
        return { status: "error", message: "Sync failed (0) — offline?" };
      }
    },

    async write(wire, baseRev, account, attach) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...attach, [field]: wire, baseRev, account }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = await bodyOf(res);
        if (res.status === 409 && body) {
          return {
            status: "conflict",
            wire: body[field] ?? null,
            rev: revOf(body),
          };
        }
        if (res.ok && body && typeof body.rev === "string") {
          const report = reportOf?.(body);
          return {
            status: "written",
            rev: body.rev,
            ...(report?.attachmentOmitted ? { attachmentOmitted: true } : {}),
          };
        }
        return { status: "error", message: failure(res.status, body) };
      } catch {
        return { status: "error", message: "Sync failed (0) — offline?" };
      }
    },

    async remove(account) {
      try {
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return { status: "removed" };
        const body = await bodyOf(res);
        return { status: "error", message: failure(res.status, body) };
      } catch {
        return { status: "error", message: "Sync failed (0) — offline?" };
      }
    },
  };
}
