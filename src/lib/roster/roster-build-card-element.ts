/**
 * Enka element class names (card-host / Consts / Talents) and the fallback
 * `--accentColor` shown until the overlay samples its texture.
 */

const ELEMENT_CLASS: Record<string, string> = {
  Pyro: "Fire",
  Hydro: "Water",
  Anemo: "Wind",
  Electro: "Electric",
  Dendro: "Grass",
  Geo: "Rock",
  Cryo: "Ice",
};

const ELEMENT_ACCENT: Record<string, string> = {
  Fire: "linear-gradient(0deg, #68281b 0%, #4f180d 100%)",
  Ice: "linear-gradient(0deg, #154f68 0%, #08394f 100%)",
  Water: "linear-gradient(0deg, #2a4a6e 0%, #1a3048 100%)",
  Wind: "linear-gradient(0deg, #1e5c5c 0%, #0f3d3d 100%)",
  Electric: "linear-gradient(0deg, #4a2a5c 0%, #2e1840 100%)",
  Grass: "linear-gradient(0deg, #1a4a20 0%, #0d2e12 100%)",
  Rock: "linear-gradient(0deg, #6a5828 0%, #3f3414 100%)",
};

/** Enka class for a game element; unknown / missing → `Fire`. */
export function enkaElementClass(element: string | null | undefined): string {
  return ELEMENT_CLASS[element ?? ""] ?? "Fire";
}

/** Fallback accent gradient for an Enka element class; unknown → Fire's. */
export function enkaElementAccent(elementClass: string): string {
  return ELEMENT_ACCENT[elementClass] ?? ELEMENT_ACCENT.Fire;
}
