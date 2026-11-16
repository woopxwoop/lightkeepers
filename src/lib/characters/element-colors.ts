/** Shared Genshin element accent colors used across character/team UIs. */

export const ELEMENT_COLORS: Record<string, string> = {
  Pyro: "#f07b4a",
  Hydro: "#5eb8f5",
  Anemo: "#6dd5a8",
  Electro: "#c48ad5",
  Dendro: "#b1d94c",
  Cryo: "#8fd5e5",
  Geo: "#f5c242",
};

export const ELEMENT_NAMES = Object.keys(ELEMENT_COLORS);

/** Hex for an element, or `fallback` when unknown / missing. */
export function elementColor(
  element: string | null | undefined,
  fallback = "transparent",
): string {
  if (!element) return fallback;
  return ELEMENT_COLORS[element] ?? fallback;
}

/** Subtle element-tinted background for portrait tiles. */
export function elementBg(element: string | null | undefined): string {
  const color = element ? ELEMENT_COLORS[element] : undefined;
  if (!color) return "var(--background-color)";
  return `color-mix(in srgb, ${color} 8%, var(--background-color))`;
}
