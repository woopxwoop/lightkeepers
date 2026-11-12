/**
 * Calculator goals snapshots — capture before await, local write, cloud POST.
 * Mirrors `roster-snapshot.ts`.
 */

import { get, writable } from "svelte/store";
import {
  CALCULATOR_GOALS_VERSION,
  emptyGoalsState,
  parseGoalsState,
} from "#lib/calculator-goals.js";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
} from "#lib/types/calculator-goals.js";

export const CALCULATOR_GOALS_STORAGE_KEY = "calculatorGoals";

/** Bumps after a successful local write — same-tab sync for planner + itinerary. */
export const goalsLocalRevision = writable(0);

export type GoalsCapture = {
  state: CalculatorGoalsState;
  json: string;
  differsFrom(current: CalculatorGoalsState): boolean;
};

export function captureGoals(state: CalculatorGoalsState): GoalsCapture {
  const normalized = parseGoalsState(state);
  const json = JSON.stringify(normalized);
  return {
    state: normalized,
    json,
    differsFrom(current) {
      return JSON.stringify(parseGoalsState(current)) !== json;
    },
  };
}

export function goalsDiffersFromSnapshot(
  state: CalculatorGoalsState,
  savedJson: string,
): boolean {
  return JSON.stringify(parseGoalsState(state)) !== savedJson;
}

export function writeGoalsLocal(json: string): boolean {
  try {
    localStorage.setItem(CALCULATOR_GOALS_STORAGE_KEY, json);
  } catch {
    return false;
  }
  goalsLocalRevision.update((n) => n + 1);
  return true;
}

/**
 * Revision last produced by `persistGoalsLocal`. A same-tab edit also bumps
 * `goalsLocalRevision`, so callers can tell a cloud apply from a local save.
 */
let cloudAppliedRevision = -1;
let cloudAppliedJson = "";

/** True when `revision` is the cloud hydrate write of `json`, not a local edit. */
export function localRevisionWasCloudApply(
  revision: number,
  json: string,
): boolean {
  return revision === cloudAppliedRevision && json === cloudAppliedJson;
}

/** Normalize + write full local state (includes selectedId). */
export function persistGoalsLocal(state: CalculatorGoalsState): boolean {
  const capture = captureGoals(state);
  const ok = writeGoalsLocal(capture.json);
  if (!ok) return false;
  cloudAppliedRevision = get(goalsLocalRevision);
  cloudAppliedJson = capture.json;
  return true;
}

export function readGoalsLocal(): CalculatorGoalsState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CALCULATOR_GOALS_STORAGE_KEY);
  } catch {
    return emptyGoalsState();
  }
  if (!raw) return emptyGoalsState();
  try {
    return parseGoalsState(JSON.parse(raw) as unknown);
  } catch {
    return emptyGoalsState();
  }
}

const POST_TIMEOUT_MS = 10_000;

export type GoalsCloudRead =
  | { status: "none" }
  | { status: "goals"; goals: CalculatorGoal[] }
  | { status: "error"; message: string };

function goalsCloudError(status: number): GoalsCloudRead {
  return {
    status: "error",
    message:
      status === 408
        ? "Sync failed (408): Request timed out"
        : `Sync failed (${status}) — goals not synced`,
  };
}

/**
 * `none` is no cloud row — local stays, and a later Save may create the row.
 * `goals` is a stored list, including an empty one. `error` keeps local and
 * must not be followed by a POST.
 */
export async function fetchGoalsCloud(): Promise<GoalsCloudRead> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/calculator-goals", {
      signal: controller.signal,
    });
    if (!res.ok) return goalsCloudError(res.status);
    const body = (await res.json()) as { goals?: unknown };
    if (body.goals == null) return { status: "none" };
    return {
      status: "goals",
      goals: parseGoalsState({
        version: CALCULATOR_GOALS_VERSION,
        goals: body.goals,
        selectedId: null,
      }).goals,
    };
  } catch (err) {
    const timedOut =
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      err.name === "AbortError";
    return goalsCloudError(timedOut ? 408 : 0);
  } finally {
    clearTimeout(timer);
  }
}

const MAX_ERROR_MESSAGE_LEN = 200;
const GENERIC_SYNC_ERROR = "Could not save goals";

export async function postGoals(
  state: CalculatorGoalsState,
): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  const normalized = parseGoalsState(state);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

  try {
    const res = await fetch("/api/calculator-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: normalized.goals }),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };

    let message: string | undefined;
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { message?: unknown };
          message =
            typeof parsed.message === "string" &&
            parsed.message &&
            parsed.message.length <= MAX_ERROR_MESSAGE_LEN
              ? parsed.message
              : GENERIC_SYNC_ERROR;
        } catch {
          message = GENERIC_SYNC_ERROR;
        }
      }
    } catch {
      /* ignore */
    }

    return { ok: false, status: res.status, message };
  } catch (err) {
    const timedOut =
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      err.name === "AbortError";
    return {
      ok: false,
      status: timedOut ? 408 : 0,
      message: timedOut ? "Request timed out" : GENERIC_SYNC_ERROR,
    };
  } finally {
    clearTimeout(timer);
  }
}
