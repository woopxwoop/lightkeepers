/**
 * Account panel's cloud-roster probe: is this account's roster stored on the
 * server? `unknown` is signed out, `checking` is a read in flight.
 *
 * Read-only: saves go through `rosterSync()`; this only asks the server
 * whether a row exists (the synced document does not expose that).
 */

export type CloudRosterProbe =
  "unknown" | "checking" | "backed-up" | "empty" | "unreachable";

type ProbeResult = "backed-up" | "empty" | "unreachable";

/**
 * Map one `/api/roster` response.
 * `null` means no cloud row. An array, including `[]`, is a stored roster.
 * A missing or non-array `roster` is not a roster we can trust.
 */
export function cloudRosterProbeFromBody(input: {
  ok: boolean;
  roster: unknown;
}): ProbeResult {
  if (!input.ok) return "unreachable";
  if (input.roster === null) return "empty";
  if (!Array.isArray(input.roster)) return "unreachable";
  return "backed-up";
}

/**
 * Read `/api/roster` once and classify it. Never throws: a failed status,
 * network error, or unparseable body is `unreachable` (logged).
 * Callers own staleness (drop a result that arrives after the account changed).
 */
export async function probeCloudRoster(
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> {
  try {
    const res = await fetchImpl("/api/roster");
    if (!res.ok) {
      console.error("probeCloudRoster: unexpected status", res.status);
      return "unreachable";
    }
    const body = (await res.json()) as { roster?: unknown } | null;
    return cloudRosterProbeFromBody({ ok: true, roster: body?.roster });
  } catch (err) {
    console.error("probeCloudRoster: network error", err);
    return "unreachable";
  }
}
