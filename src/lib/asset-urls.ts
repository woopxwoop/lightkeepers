/**
 * Construct CDN asset URLs from Enka icon names.
 *
 * Images are synced to R2 and served from https://images.lightkeepers.moe.
 * Keys follow the same flat {prefix}/{iconName}.webp structure as the sync
 * script (scripts/sync-equipment-images-r2.ts):
 *
 *   UI_RelicIcon_*        → artifacts/{name}.webp
 *   UI_EquipIcon_*        → weapons/{name}.webp
 *   UI_Gacha_EquipIcon_*  → weapons/{name}.webp
 */

const CDN_BASE = "https://images.lightkeepers.moe";

// ── Classification ───────────────────────────────

function isRelic(name: string): boolean {
  return name.startsWith("UI_RelicIcon");
}

// ── Public API ───────────────────────────────────

/** Artifact piece icon or artifact set icon. */
export function artifactIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return `${CDN_BASE}/artifacts/${encodeURIComponent(iconName)}.webp`;
}

/** Weapon icon (standard or awakened). */
export function weaponIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return `${CDN_BASE}/weapons/${encodeURIComponent(iconName)}.webp`;
}

/** Weapon splash / gacha banner art. */
export function weaponSplashUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return `${CDN_BASE}/weapons/${encodeURIComponent(iconName)}.webp`;
}

/**
 * Auto-detect the correct URL for any icon name by prefix.
 * Falls back to null for unknown prefixes.
 */
export function assetUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  if (isRelic(iconName)) return artifactIconUrl(iconName);
  // All other known prefixes (UI_EquipIcon, UI_Gacha_EquipIcon) → weapons/
  if (
    iconName.startsWith("UI_EquipIcon") ||
    iconName.startsWith("UI_Gacha_EquipIcon")
  )
    return weaponIconUrl(iconName);
  return null;
}
