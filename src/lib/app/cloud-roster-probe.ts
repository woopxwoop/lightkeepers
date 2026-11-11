/**
 * Account panel's cloud-roster probe.
 * `unknown` is signed out. A thrown read is `unreachable` at the call site.
 */

export type CloudRosterProbe =
  "unknown" | "checking" | "backed-up" | "empty" | "unreachable";

/** Map one `/api/roster` response. A missing `roster` key still counts as backed up. */
export function cloudRosterProbeFromBody(input: {
  ok: boolean;
  roster: unknown;
}): "backed-up" | "empty" | "unreachable" {
  if (!input.ok) return "unreachable";
  return input.roster !== null ? "backed-up" : "empty";
}
