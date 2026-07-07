/**
 * stores.ts
 *
 * All Supabase calls now go through SvelteKit API routes instead of
 * hitting Supabase directly from the browser. Benefits:
 *   - Server-side in-memory LRU cache cuts duplicate Supabase round-trips
 *   - Static data (all teams) is Cloudflare-edge-cached via /api/static
 *   - Per-user data (/api/teams, /api/nearmiss) is cached by character list
 *   - Service-role key stays server-side only
 */

import { writable, derived, get, type Writable } from "svelte/store";
import type { CharacterOwned, AbyssTeam, StygianTeam } from "$lib/definitions";
import type {
  NearMissStygianTeam,
  NearMissPairTeam,
} from "$lib/pullSuggestions";
import { postJson } from "$lib/api/http";

// ── Version numbers ────────────────────────────────────────────────────────
// Populated from layout server data — no client-side fetch needed.
export let abyssVersionNumber = -1;
export let stygianVersionNumber = -1;

export function setVersionNumbers(abyss: number, stygian: number) {
  abyssVersionNumber = abyss;
  stygianVersionNumber = stygian;
}

export type IconStyle = "coop" | "enka" | "tcg";

export type ColorTheme = "dark" | "light";

/** CSS variable names that can be customized via the color picker. */
export const THEME_COLOR_KEYS = [
  "background-color",
  "foreground-color",
  "background-mid",
  "foreground-mid",
  "accent-1",
  "accent-2",
  "accent-3",
] as const;

export const DEFAULT_DARK_COLORS: Record<ThemeColorKey, string> = {
  "background-color": "#02060b",
  "foreground-color": "#f4f1e8",
  "background-mid": "#040d17",
  "foreground-mid": "#f3e6c9",
  "accent-1": "#d79a3e",
  "accent-2": "#f6d68a",
  "accent-3": "#ead7b0",
};

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/**
 * Normalize a hex color to exactly 6-digit `#rrggbb`.
 * Handles 3-, 4-, 6-, and 8-digit formats. Drops alpha channels (4th/8th pair).
 * Returns the input unchanged if it doesn't look like hex.
 */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function normalizeHexColor(hex: string): string {
  const match = HEX_COLOR_RE.exec(hex);
  if (!match) return hex;
  const digits = match[1];
  // Expand shorthand: "abc" → "aabbcc", "abcd" → "aabbcc" (drop alpha)
  if (digits.length === 3 || digits.length === 4) {
    const rgb = digits.slice(0, 3);
    return `#${rgb.split("").map((c) => c + c).join("")}`;
  }
  // Drop alpha channel from 8-digit hex, pad short 6-digit
  return `#${digits.slice(0, 6).padEnd(6, "0")}`;
}

export type DisplayPreferences = {
  animationsEnabled: boolean;
  iconStyle: IconStyle;
  backgroundEnabled: boolean;
  colorTheme: ColorTheme;
  /** Overrides for individual CSS custom properties. Keyed without the `--` prefix. */
  themeColors: Partial<Record<ThemeColorKey, string>> | null;
};

const defaultDisplayPreferences: DisplayPreferences = {
  animationsEnabled: true,
  iconStyle: "coop",
  backgroundEnabled: true,
  colorTheme: "dark",
  themeColors: null,
};

export const displayPreferences = writable<DisplayPreferences>({
  ...defaultDisplayPreferences,
});

export function initDisplayPreferences(): void {
  try {
    const saved = localStorage.getItem("displayPreferences");
    if (!saved) return;

    const parsed = JSON.parse(saved) as Partial<DisplayPreferences>;
    displayPreferences.set({
      animationsEnabled:
        typeof parsed.animationsEnabled === "boolean"
          ? parsed.animationsEnabled
          : defaultDisplayPreferences.animationsEnabled,
      iconStyle:
        parsed.iconStyle === "enka" ||
        parsed.iconStyle === "coop" ||
        parsed.iconStyle === "tcg"
          ? parsed.iconStyle
          : defaultDisplayPreferences.iconStyle,
      backgroundEnabled:
        typeof parsed.backgroundEnabled === "boolean"
          ? parsed.backgroundEnabled
          : defaultDisplayPreferences.backgroundEnabled,
      colorTheme:
        parsed.colorTheme === "dark" || parsed.colorTheme === "light"
          ? parsed.colorTheme
          : defaultDisplayPreferences.colorTheme,
      themeColors:
        typeof parsed.themeColors === "object" && parsed.themeColors !== null
          ? (Object.fromEntries(
              Object.entries(parsed.themeColors).filter(
                ([k, v]) =>
                  (THEME_COLOR_KEYS as readonly string[]).includes(k) &&
                  typeof v === "string" &&
                  HEX_COLOR_RE.test(v),
              ).map(([k, v]) => [k, normalizeHexColor(v as string)]),
            ) as Partial<Record<ThemeColorKey, string>>)
          : defaultDisplayPreferences.themeColors,
    });
  } catch {
    displayPreferences.set({ ...defaultDisplayPreferences });
  }
}

export function setDisplayPreferences(next: Partial<DisplayPreferences>): void {
  displayPreferences.update((current) => {
    const updated = { ...current, ...next };
    try {
      localStorage.setItem("displayPreferences", JSON.stringify(updated));
    } catch {
      // Ignore storage failures; the in-memory preference still applies.
    }
    return updated;
  });
}

export const isIconCompact = derived(
  displayPreferences,
  ($preferences) => $preferences.iconStyle === "enka",
);

export function setIconCompact(compact: boolean) {
  setDisplayPreferences({ iconStyle: compact ? "enka" : "coop" });
}

export const animationsEnabled = derived(
  displayPreferences,
  ($preferences) => $preferences.animationsEnabled,
);

export function areAnimationsEnabled(): boolean {
  return get(displayPreferences).animationsEnabled;
}

export const faviconDataUri = derived(displayPreferences, ($prefs) => {
  const accent = normalizeHexColor(
    $prefs.themeColors?.["accent-1"] ?? DEFAULT_DARK_COLORS["accent-1"],
  );
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,4 59,41 96,50 59,59 50,96 41,59 4,50 41,41" fill="rgba(${r},${g},${b},0.15)" stroke="${accent}" stroke-width="3"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="${accent}" stroke-width="2.5"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
});

// ── Character store ────────────────────────────────────────────────────────
export const charactersOwned = writable<CharacterOwned[]>([]);
export const charactersHydrated = writable<boolean>(false);

// ── Abyss stores ──────────────────────────────────────────────────────────
export const teamsOwned = writable<AbyssTeam[]>([]);
export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.field_1_rate ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);
export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.field_2_rate ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);

// ── Stygian stores ─────────────────────────────────────────────────────────
export const teamsOwnedStygian = writable<StygianTeam[]>([]);
export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_1_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_3_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_2_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);

// ── All-teams stores (pre-populated from layout server data) ───────────────
export const allTeamsAbyss = writable<AbyssTeam[]>([]);
export const allTeamsStygian = writable<StygianTeam[]>([]);

// ── Near-miss stores ───────────────────────────────────────────────────────
export const nearMissStygianTeams = writable<NearMissStygianTeam[]>([]);
export const nearMissStygianLoaded = writable(false);
export const nearMissPairTeams = writable<NearMissPairTeam[]>([]);
export const nearMissPairLoaded = writable(false);

// ── Request ID counters ────────────────────────────────────────────────────
// Discard responses from superseded requests (fast roster changes).
let teamsRequestId = 0;
let nearMissRequestId = 0;

// ── API helpers ────────────────────────────────────────────────────────────

// ── Write functions ────────────────────────────────────────────────────────

/**
 * Fetches both abyss and stygian owned-team lists in a single server round-trip.
 * The server caches results by character list so rapid re-calls are cheap.
 */
export async function writeTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  const id = ++teamsRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);

  try {
    const { abyssTeams, stygianTeams } = await postJson<{
      abyssTeams: AbyssTeam[];
      stygianTeams: StygianTeam[];
    }>("/api/teams", {
      characters,
      abyssVersion: abyssVersionNumber,
      stygianVersion: stygianVersionNumber,
    });

    if (id !== teamsRequestId) return; // superseded
    teamsOwned.set(abyssTeams);
    teamsOwnedStygian.set(stygianTeams);
  } catch (err) {
    console.error("[stores] writeTeamsOwned failed:", err);
  }
}

/**
 * Fetches near-miss data for the Pulls page.
 * Combines single + pair into one server call.
 */
export async function writeNearMissTeams(
  owned: CharacterOwned[],
): Promise<void> {
  const id = ++nearMissRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);

  nearMissStygianLoaded.set(false);
  nearMissPairLoaded.set(false);

  try {
    const { nearMissTeams, nearMissPairs } = await postJson<{
      nearMissTeams: NearMissStygianTeam[];
      nearMissPairs: NearMissPairTeam[];
    }>("/api/nearmiss", {
      characters,
      stygianVersion: stygianVersionNumber,
      minPmi: 0.3,
    });

    if (id !== nearMissRequestId) return; // superseded
    nearMissStygianTeams.set(nearMissTeams);
    nearMissPairTeams.set(nearMissPairs);
  } catch (err) {
    console.error("[stores] writeNearMissTeams failed:", err);
    nearMissStygianTeams.set([]);
    nearMissPairTeams.set([]);
  } finally {
    if (id === nearMissRequestId) {
      nearMissStygianLoaded.set(true);
      nearMissPairLoaded.set(true);
    }
  }
}
