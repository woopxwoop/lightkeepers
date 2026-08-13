/** Genshin Impact wiki page for a display name (spaces → underscores). */
export function wikiHref(name: string): string {
  return `https://genshin-impact.fandom.com/wiki/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
}
