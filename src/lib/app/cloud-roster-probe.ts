/**
 * Account panel's cloud-roster probe.
 * `unknown` is signed out. A thrown read is `unreachable` at the call site.
 */

export type CloudRosterProbe =
  "unknown" | "checking" | "backed-up" | "empty" | "unreachable";

/**
 * Map one `/api/roster` response.
 * `null` means no cloud row. An array, including `[]`, is a stored roster.
 * A missing or non-array `roster` is not a roster we can trust.
 */
export function cloudRosterProbeFromBody(input: {
  ok: boolean;
  roster: unknown;
}): "backed-up" | "empty" | "unreachable" {
  if (!input.ok) return "unreachable";
  if (input.roster === null) return "empty";
  if (!Array.isArray(input.roster)) return "unreachable";
  return "backed-up";
}
