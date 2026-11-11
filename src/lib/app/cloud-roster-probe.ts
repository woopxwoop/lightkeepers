/**
 * Account panel's cloud-roster probe.
 * `unknown` is signed out. A thrown read is `unreachable` at the call site.
 */

import { writable } from "svelte/store";

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

/** Bumped after a roster sync writes the cloud row, so a probe re-reads. */
export const cloudRosterProbeRevision = writable(0);

export function noteCloudRosterSynced(): void {
  cloudRosterProbeRevision.update((n) => n + 1);
}
