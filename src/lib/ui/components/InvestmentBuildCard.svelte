<script lang="ts">
  /**
   * One-character investment build card (weapon, sheet stats, talents, sets).
   * Shared by team-config pages and character build examples.
   */
  import { displayPreferences } from "$lib/stores";
  import { translateStatKey, statIconUrl } from "$lib/utils";
  import {
    artifactSetByKey,
    weaponByKey,
    equipmentVersion,
  } from "$lib/equipment-data";
  import { artifactIconUrl, weaponIconUrl } from "$lib/asset-urls";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import StatRow from "$lib/ui/components/StatRow.svelte";
  import {
    computeBuildSheetStats,
    formatSheetStat,
    type SheetStatBag,
  } from "$lib/build-stats";
  import { normalizeSetPieceCount } from "$lib/character-builds";
  import type { CharacterBuild } from "$lib/types/investment";
  import type { Character } from "$lib/definitions";
  import type { InvestmentBuildKitIcons } from "$lib/investment-build-card";

  let {
    build,
    character = null,
    kit = null,
    /**
     * When set, only these GOOD sheet keys are listed (flat/percent pairs
     * collapse: `atk_` → ATK row). Omit for the full team-config sheet.
     */
    relevantKeys = null,
    class: className = "",
  }: {
    build: CharacterBuild;
    character?: Character | null;
    kit?: InvestmentBuildKitIcons | null;
    relevantKeys?: Iterable<string> | null;
    class?: string;
  } = $props();

  let iconStyle = $derived($displayPreferences.iconStyle);

  let weapon = $derived.by(() => {
    $equipmentVersion;
    return weaponByKey.get(build.weapon.key) ?? null;
  });
  let set = $derived.by(() => {
    $equipmentVersion;
    return artifactSetByKey.get(build.set.key) ?? null;
  });
  let set2 = $derived.by(() => {
    $equipmentVersion;
    return build.set2 ? (artifactSetByKey.get(build.set2) ?? null) : null;
  });
  let setCount = $derived(normalizeSetPieceCount(build.set.count) ?? 4);
  let set2Count = $derived(
    build.set2 ? normalizeSetPieceCount(build.set2_count ?? 2) : null,
  );
  let sheet = $derived(computeBuildSheetStats(build));
  let wIcon = $derived(weapon ? weaponIconUrl(weapon.awakenIcon) : null);
  let sIcon = $derived(set ? artifactIconUrl(set.icon) : null);
  let s2Icon = $derived(set2 ? artifactIconUrl(set2.icon) : null);
  let relevantKeySet = $derived.by(() => {
    if (relevantKeys == null) return null;
    return relevantKeys instanceof Set ? relevantKeys : new Set(relevantKeys);
  });

  function dmgBonusEntries(bag: SheetStatBag) {
    return Object.entries(bag.dmgBonus)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }

  function starCount(stars: number | undefined): number {
    return Math.max(0, Math.min(5, stars ?? 0));
  }

  function iconKeyFor(stat: string): string {
    if (stat === "critRate") return "critRate_";
    if (stat === "critDMG") return "critDMG_";
    if (stat === "enerRech") return "enerRech_";
    if (stat === "heal") return "heal_";
    return stat;
  }

  /** Sheet row key matches a GOOD key from ``relevantKeys``. */
  function sheetRowIsRelevant(rowKey: string, rel: Set<string>): boolean {
    if (rel.has(rowKey)) return true;
    if (rowKey === "hp") return rel.has("hp") || rel.has("hp_");
    if (rowKey === "atk") return rel.has("atk") || rel.has("atk_");
    if (rowKey === "def") return rel.has("def") || rel.has("def_");
    if (rowKey === "critRate") return rel.has("critRate_");
    if (rowKey === "critDMG") return rel.has("critDMG_");
    if (rowKey === "enerRech") return rel.has("enerRech_");
    if (rowKey === "heal") return rel.has("heal_");
    if (rowKey === "eleMas") return rel.has("eleMas");
    return false;
  }

  let coreStats = $derived.by(() => {
    if (!sheet) return [];
    const rows = [
      { key: "hp", label: "HP", value: sheet.hp },
      { key: "atk", label: "ATK", value: sheet.atk },
      { key: "def", label: "DEF", value: sheet.def },
      { key: "eleMas", label: "Elemental Mastery", value: sheet.eleMas },
      { key: "critRate", label: "CRIT Rate", value: sheet.critRate },
      { key: "critDMG", label: "CRIT DMG", value: sheet.critDMG },
      { key: "enerRech", label: "Energy Recharge", value: sheet.enerRech },
      { key: "heal", label: translateStatKey("heal_"), value: sheet.heal },
      ...dmgBonusEntries(sheet).map(([key, value]) => ({
        key,
        label: translateStatKey(key),
        value,
      })),
    ];
    const rel = relevantKeySet;
    if (!rel) {
      // Team-config default: full sheet without heal (usually 0 / unused).
      return rows.filter((row) => row.key !== "heal");
    }
    return rows.filter((row) => sheetRowIsRelevant(row.key, rel));
  });

  type TalentRow = {
    slot: "auto" | "skill" | "burst";
    fallback: string;
    level: number;
    icon: string | null | undefined;
  };

  let talentRows = $derived<TalentRow[]>([
    {
      slot: "auto",
      fallback: "NA",
      level: build.talents.auto,
      icon: kit?.talents.auto,
    },
    {
      slot: "skill",
      fallback: "E",
      level: build.talents.skill,
      icon: kit?.talents.skill,
    },
    {
      slot: "burst",
      fallback: "Q",
      level: build.talents.burst,
      icon: kit?.talents.burst,
    },
  ]);
</script>

<Surface flush class="build-card {className}">
  <div class="build-grid">
    <div
      class="build-art"
      class:build-art--enka={iconStyle === "enka"}
      class:build-art--coop={iconStyle === "coop"}
      class:build-art--tcg={iconStyle === "tcg"}
      class:build-art--portrait={iconStyle !== "enka"}
    >
      {#if character}
        <div class="build-avatar">
          <CharacterIcon {character} />
          <div class="build-art-fade"></div>

          {#if kit?.constellations?.length}
            <ul class="cons-rail" aria-label="Constellations C{build.cons}">
              {#each kit.constellations as c (c.index)}
                {@const unlocked = c.index <= build.cons}
                <li
                  class="cons-node"
                  class:cons-locked={!unlocked}
                  title="C{c.index}: {c.name}"
                  aria-label="C{c.index}: {c.name}, {unlocked
                    ? 'unlocked'
                    : 'locked'}"
                >
                  {#if c.icon}
                    <img src={c.icon} alt="" loading="lazy" />
                  {/if}
                  {#if !unlocked}
                    <span class="cons-lock" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        width="10"
                        height="10"
                        fill="currentColor"
                      >
                        <path
                          d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V6zm7 12H7v-8h10v8z"
                        />
                      </svg>
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}

      <div class="build-art-meta">
        <h3 class="char-name">{character?.name ?? build.key}</h3>
        <p class="char-level">Lv. {build.level}</p>
      </div>
    </div>

    <div class="build-panel">
      <div class="equip-block">
        <div class="equip-trigger group">
          {#if wIcon}
            <img
              src={wIcon}
              alt=""
              class="weapon-icon shrink-0"
              loading="lazy"
            />
          {/if}
          <div class="min-w-0 flex-1">
            <div class="equip-title-row">
              <p class="equip-name">
                {weapon?.name ?? build.weapon.key}
              </p>
              <span class="r-badge">R{build.weapon.refinement}</span>
            </div>
            {#if weapon}
              {@const stars = starCount(weapon.stars)}
              <div
                class="star-row"
                aria-label="{stars} {stars === 1 ? 'star' : 'stars'}"
              >
                {#each Array.from({ length: stars }, (_, i) => i) as i (i)}
                  <span class="star">★</span>
                {/each}
              </div>
              <div class="equip-stats">
                <span>ATK {Math.round(weapon.baseAtk)}</span>
                {#if weapon.subStat}
                  <span>
                    {weapon.subStat.label}
                    {weapon.subStat.isPercent
                      ? `${(weapon.subStat.value * 100).toFixed(1)}%`
                      : Math.round(weapon.subStat.value)}
                  </span>
                {/if}
              </div>
            {/if}
          </div>
          <WeaponTooltip
            weaponKey={build.weapon.key}
            refinement={build.weapon.refinement}
          />
        </div>
      </div>

      {#if sheet}
        <div class="stat-list">
          {#each coreStats as row (row.key)}
            <StatRow
              label={row.label}
              value={formatSheetStat(row.key, row.value)}
              icon={statIconUrl(iconKeyFor(row.key))}
            />
          {/each}
        </div>
      {:else}
        <p class="muted">Base stats unavailable for {build.key}</p>
      {/if}

      <div class="talent-row">
        {#each talentRows as row (row.slot)}
          <span class="talent-chip">
            {#if row.icon}
              <img src={row.icon} alt="" class="talent-icon" />
            {:else}
              <span class="talent-fallback">{row.fallback}</span>
            {/if}
            <strong class="talent-level">{row.level}</strong>
          </span>
        {/each}
      </div>

      <div class="set-list">
        <div class="set-row group">
          {#if sIcon}
            <img src={sIcon} alt="" class="set-icon shrink-0" loading="lazy" />
          {/if}
          <p class="set-name">{set?.name ?? build.set.key}</p>
          <span class="set-badge shrink-0">{setCount}</span>
          <ArtifactTooltip setKey={build.set.key} pieceCount={setCount} />
        </div>
        {#if build.set2 && set2Count != null}
          <div class="set-row group">
            {#if s2Icon}
              <img
                src={s2Icon}
                alt=""
                class="set-icon shrink-0"
                loading="lazy"
              />
            {/if}
            <p class="set-name">{set2?.name ?? build.set2}</p>
            <span class="set-badge shrink-0">{set2Count}</span>
            <ArtifactTooltip setKey={build.set2} pieceCount={set2Count} />
          </div>
        {/if}
      </div>
    </div>
  </div>
</Surface>

<style>
  :global(.build-card) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
    overflow: hidden;
  }

  .build-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: stretch;
    min-height: 20rem;
  }

  .build-art {
    position: relative;
    overflow: hidden;
    background: color-mix(in srgb, var(--foreground-color) 6%, #0a0e14);
    align-self: stretch;
  }

  .build-art--portrait {
    width: 12rem;
  }

  .build-art--enka {
    width: 11rem;
  }

  .build-avatar {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .build-avatar :global(.relative) {
    width: 100%;
    height: 100%;
    aspect-ratio: unset !important;
  }

  .build-avatar :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .build-art--tcg .build-avatar :global(img) {
    object-position: top center;
  }

  .build-art-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      var(--background-mid) 0%,
      transparent 45%
    );
    pointer-events: none;
  }

  .build-art-meta {
    position: absolute;
    left: 3rem;
    right: 0.75rem;
    bottom: 0.65rem;
    z-index: 2;
  }

  .char-name {
    font-size: var(--text-md);
    font-weight: 600;
    line-height: 1.2;
    color: var(--foreground-color);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
  }

  .char-level {
    margin-top: 0.15rem;
    font-size: 0.7rem;
    line-height: 1.2;
    color: var(--foreground-mid);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
  }

  .cons-rail {
    position: absolute;
    left: 0.45rem;
    bottom: 0.85rem;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cons-node {
    position: relative;
    width: 1.65rem;
    height: 1.65rem;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, #0a0e14 70%, transparent);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28);
  }

  .cons-node img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cons-node.cons-locked img {
    filter: grayscale(1) brightness(0.35);
  }

  .cons-lock {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(0, 0, 0, 0.35);
  }

  .build-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.85rem;
    min-width: 0;
  }

  .equip-block {
    position: relative;
    padding-bottom: 0.5rem;
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .equip-trigger {
    position: relative;
    display: flex;
    width: fit-content;
    max-width: 100%;
    gap: 0.65rem;
    align-items: flex-start;
  }

  .equip-title-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .equip-name {
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.2;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .equip-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.75rem;
    margin-top: 0.25rem;
    font-size: 0.65rem;
    color: var(--foreground-mid);
  }

  .star-row {
    display: flex;
    gap: 0.1rem;
    margin-top: 0.15rem;
  }

  .weapon-icon {
    width: 3rem;
    height: 3rem;
    object-fit: contain;
  }

  .set-icon {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
  }

  .r-badge {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
    color: var(--accent-3);
    border: var(--border-width) solid rgba(255, 255, 255, 0.28);
    background: transparent;
  }

  .star {
    font-size: 0.55rem;
    color: var(--accent-3);
    line-height: 1;
  }

  .set-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.5rem;
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .set-row {
    position: relative;
    display: flex;
    width: fit-content;
    max-width: 100%;
    gap: 0.5rem;
    align-items: center;
  }

  .set-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .set-badge {
    font-size: 0.65rem;
    font-weight: 700;
    min-width: 1.15rem;
    height: 1.15rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--foreground-color);
    border: var(--border-width) solid rgba(255, 255, 255, 0.28);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .stat-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .talent-row {
    display: flex;
    gap: 0.75rem;
    font-size: 0.65rem;
    color: var(--foreground-mid);
  }

  .talent-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .talent-icon {
    width: 1.15rem;
    height: 1.15rem;
    object-fit: contain;
    border-radius: 999px;
  }

  .talent-fallback {
    font-weight: 600;
  }

  .talent-level {
    color: var(--foreground-color);
  }

  .muted {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  @media (max-width: 640px) {
    .build-grid {
      min-height: 16rem;
    }

    .build-art--portrait {
      width: 8rem;
    }

    .build-art--enka {
      width: 7.5rem;
    }

    .build-art-meta {
      left: 2.35rem;
      right: 0.5rem;
      bottom: 0.55rem;
    }

    .char-name {
      font-size: var(--text-sm);
    }

    .cons-rail {
      left: 0.35rem;
      bottom: 0.7rem;
      gap: 0.28rem;
    }

    .cons-node {
      width: 1.35rem;
      height: 1.35rem;
    }
  }
</style>
