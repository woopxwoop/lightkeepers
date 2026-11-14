/**
 * Display preferences (icon style, theme, background, animations, Stygian
 * seating mode) persisted to `localStorage`. No server fetch:
 * `initDisplayPreferences()` reads storage, `setDisplayPreferences()` writes it.
 */

import { writable, derived, get, readable } from "svelte/store";
import type {
  StygianSolverMode,
  StygianClearDifficulty,
} from "#lib/definitions.js";
import {
  isStygianSolverMode,
  isStygianClearDifficulty,
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
  STYGIAN_SOLVER_MODE_DEFAULT,
} from "#lib/definitions.js";

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
const HEX_COLOR_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function normalizeHexColor(hex: string): string {
  const match = HEX_COLOR_RE.exec(hex);
  if (!match) return hex;
  const digits = match[1];
  // Expand shorthand: "abc" → "aabbcc", "abcd" → "aabbcc" (drop alpha)
  if (digits.length === 3 || digits.length === 4) {
    const rgb = digits.slice(0, 3);
    return `#${rgb
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  // Drop alpha channel from 8-digit hex, pad short 6-digit
  return `#${digits.slice(0, 6).padEnd(6, "0")}`;
}

export type DisplayPreferences = {
  animationsEnabled: boolean;
  iconStyle: IconStyle;
  /** Lighthouse background on non-home pages (and home when apply-to-home is on). */
  backgroundEnabled: boolean;
  /**
   * When false (default), home always shows the lighthouse. When true, home
   * uses `backgroundEnabled` like every other page.
   */
  backgroundApplyToHome: boolean;
  colorTheme: ColorTheme;
  /** Overrides for individual CSS custom properties. Keyed without the `--` prefix. */
  themeColors: Partial<Record<ThemeColorKey, string>> | null;
  /** Stygian board seating: usage solver vs Fearless video clears. */
  stygianSolverMode: StygianSolverMode;
  /** Dire / Fearless filter for hybrid + video-clear seating. */
  stygianClearDifficulty: StygianClearDifficulty;
};

const defaultDisplayPreferences: DisplayPreferences = {
  animationsEnabled: true,
  iconStyle: "tcg",
  backgroundEnabled: false,
  backgroundApplyToHome: false,
  colorTheme: "dark",
  themeColors: null,
  stygianSolverMode: STYGIAN_SOLVER_MODE_DEFAULT,
  stygianClearDifficulty: STYGIAN_CHEAP_CLEARS_DIFFICULTY,
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
      backgroundApplyToHome:
        typeof parsed.backgroundApplyToHome === "boolean"
          ? parsed.backgroundApplyToHome
          : defaultDisplayPreferences.backgroundApplyToHome,
      colorTheme:
        parsed.colorTheme === "dark" || parsed.colorTheme === "light"
          ? parsed.colorTheme
          : defaultDisplayPreferences.colorTheme,
      themeColors:
        typeof parsed.themeColors === "object" && parsed.themeColors !== null
          ? (Object.fromEntries(
              Object.entries(parsed.themeColors)
                .filter(
                  ([k, v]) =>
                    (THEME_COLOR_KEYS as readonly string[]).includes(k) &&
                    typeof v === "string" &&
                    HEX_COLOR_RE.test(v),
                )
                .map(([k, v]) => [k, normalizeHexColor(v as string)]),
            ) as Partial<Record<ThemeColorKey, string>>)
          : defaultDisplayPreferences.themeColors,
      stygianSolverMode: isStygianSolverMode(parsed.stygianSolverMode)
        ? parsed.stygianSolverMode
        : // Migrate former experimental boolean → video clears (scrape-labeled).
          (parsed as { stygianCheapClears?: unknown }).stygianCheapClears ===
            true
          ? "video"
          : defaultDisplayPreferences.stygianSolverMode,
      stygianClearDifficulty: isStygianClearDifficulty(
        parsed.stygianClearDifficulty,
      )
        ? parsed.stygianClearDifficulty
        : defaultDisplayPreferences.stygianClearDifficulty,
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

/** Live background visibility for the current route. */
export const backgroundVisible = writable(true);

function resolveBackgroundVisible(
  pathname: string,
  prefs: DisplayPreferences,
): boolean {
  if (pathname === "/" && !prefs.backgroundApplyToHome) return true;
  return prefs.backgroundEnabled;
}

export function syncBackgroundToPath(pathname: string): void {
  backgroundVisible.set(
    resolveBackgroundVisible(pathname, get(displayPreferences)),
  );
}

export function toggleBackgroundVisible(pathname: string): void {
  const prefs = get(displayPreferences);
  const next = !resolveBackgroundVisible(pathname, prefs);
  setDisplayPreferences({
    backgroundEnabled: next,
    ...(pathname === "/" ? { backgroundApplyToHome: true } : {}),
  });
  syncBackgroundToPath(pathname);
}

export function setBackgroundVisible(on: boolean, pathname: string): void {
  setDisplayPreferences({ backgroundEnabled: on });
  syncBackgroundToPath(pathname);
}

export function setBackgroundApplyToHome(
  apply: boolean,
  pathname: string,
): void {
  setDisplayPreferences({ backgroundApplyToHome: apply });
  syncBackgroundToPath(pathname);
}

export const isIconCompact = derived(
  displayPreferences,
  ($preferences) => $preferences.iconStyle === "enka",
);

/** OS reduced-motion preference. Stays false during SSR. */
const prefersReducedMotion = readable(false, (set) => {
  if (typeof window === "undefined" || !window.matchMedia) return;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  set(query.matches);
  const onChange = (e: MediaQueryListEvent) => set(e.matches);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
});

/**
 * Whether animations actually run. `app.css` collapses every duration under
 * reduced motion, so JS timings must honour it too or they'll wait on
 * animations that already finished.
 */
export const animationsEnabled = derived(
  [displayPreferences, prefersReducedMotion],
  ([$preferences, $reduced]) => $preferences.animationsEnabled && !$reduced,
);
