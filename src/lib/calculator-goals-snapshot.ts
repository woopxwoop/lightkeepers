/**
 * Calculator goals snapshots — capture before await, local write, cloud POST.
 * Mirrors `roster-snapshot.ts`.
 */

import {
  CALCULATOR_GOALS_VERSION,
  emptyGoalsState,
  parseGoalsState,
} from "$lib/calculator-goals";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
} from "$lib/types/calculator-goals";

export const CALCULATOR_GOALS_STORAGE_KEY = "calculatorGoals";

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
    return true;
  } catch {
    return false;
  }
}

/** Normalize + write full local state (includes selectedId). */
export function persistGoalsLocal(state: CalculatorGoalsState): boolean {
  const capture = captureGoals(state);
  return writeGoalsLocal(capture.json);
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

export async function fetchGoalsCloud(): Promise<CalculatorGoal[] | null> {
  try {
    const res = await fetch("/api/calculator-goals");
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { goals?: unknown };
    // null = no row yet → caller keeps local. [] = saved empty list → DB wins.
    if (body.goals == null) return null;
    return parseGoalsState({
      version: CALCULATOR_GOALS_VERSION,
      goals: body.goals,
      selectedId: null,
    }).goals;
  } catch {
    return null;
  }
}

const POST_TIMEOUT_MS = 10_000;
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
