<script lang="ts">
  import {
    charactersOwned,
    animationsEnabled,
    displayPreferences,
  } from "$lib/stores";
  import {
    buildGoodKeyMap,
    humanizeTeamName,
    translateStatKey,
    statIconUrl,
  } from "$lib/utils";
  import {
    artifactSetByKey,
    humanizeInvestmentLabel,
    weaponByKey,
    equipmentVersion,
    ensureEquipmentData,
  } from "$lib/equipment-data";
  import { onMount } from "svelte";
  import { artifactIconUrl, weaponIconUrl } from "$lib/asset-urls";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import {
    computeBuildSheetStats,
    formatSheetStat,
    type SheetStatBag,
  } from "$lib/build-stats";
  import type { CharacterBuild } from "$lib/types/investment";

  let { data } = $props();
  let team = $derived(data.team);
  let sim = $derived(data.sim);
  let configText = $derived(data.configText);
  let configUrl = $derived(data.configUrl);
  let kitsByKey = $derived(data.kitsByKey);

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));
  let characterNames = $derived(
    new Map(
      [...goodKeyMap.entries()].map(([key, c]) => [key, c.name ?? key]),
    ),
  );
  let teamTitle = $derived(
    humanizeTeamName(team.characters, characterNames),
  );
  let simLabel = $derived.by(() => {
    $equipmentVersion;
    return sim.kind === "baseline"
      ? "Baseline"
      : sim.label
        ? humanizeInvestmentLabel(sim.label, characterNames)
        : "";
  });
  let iconStyle = $derived($displayPreferences.iconStyle);

  onMount(() => {
    void ensureEquipmentData();
  });

  function characterFor(key: string) {
    return goodKeyMap.get(key) ?? null;
  }

  function sheetFor(build: CharacterBuild) {
    return computeBuildSheetStats(build);
  }

  function dmgBonusEntries(sheet: SheetStatBag) {
    return Object.entries(sheet.dmgBonus)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }

  function starCount(stars: number | undefined): number {
    return Math.max(0, Math.min(5, stars ?? 0));
  }

  /** Sheet field → GOOD icon key. */
  function iconKeyFor(stat: string): string {
    if (stat === "critRate") return "critRate_";
    if (stat === "critDMG") return "critDMG_";
    if (stat === "enerRech") return "enerRech_";
    return stat;
  }
</script>

<PageShell class="gap-8 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <a href="/teams/{team.team_key}" class="back-link">← {teamTitle}</a>
    <h1 class="page-title">{simLabel || teamTitle}</h1>
    <p class="page-meta">
      <span>{(sim.dps / 1000).toFixed(1)}K DPS</span>
      <span aria-hidden="true">·</span>
      <span>Cost {sim.cost}</span>
    </p>
  </header>

  <section class="section">
    <div class="builds-grid">
      {#each sim.characters as build (build.key)}
        {@const character = characterFor(build.key)}
        {@const weapon = weaponByKey.get(build.weapon.key)}
        {@const set = artifactSetByKey.get(build.set.key)}
        {@const set2 = build.set2 ? artifactSetByKey.get(build.set2) : null}
        {@const sheet = sheetFor(build)}
        {@const wIcon = weapon ? weaponIconUrl(weapon.awakenIcon) : null}
        {@const sIcon = set ? artifactIconUrl(set.icon) : null}
        {@const s2Icon = set2 ? artifactIconUrl(set2.icon) : null}
        {@const kit = kitsByKey[build.key]}
        <Surface flush class="build-card">
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
                    <ul
                      class="cons-rail"
                      aria-label="Constellations C{build.cons}"
                    >
                      {#each kit.constellations as c (c.index)}
                        {@const unlocked = c.index <= build.cons}
                        <li
                          class="cons-node"
                          class:cons-locked={!unlocked}
                          title="C{c.index}: {c.name}"
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

                  <div class="build-art-meta">
                    <h3 class="char-name">{character?.name ?? build.key}</h3>
                    <p class="char-level">Lv. {build.level}</p>
                  </div>
                </div>
              {/if}
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
                      <div class="star-row" aria-label="{weapon.stars} star">
                        {#each Array.from({ length: starCount(weapon.stars) }, (_, i) => i) as i (i)}
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
                {@const coreStats = [
                  { key: "hp", label: "HP", value: sheet.hp },
                  { key: "atk", label: "ATK", value: sheet.atk },
                  { key: "def", label: "DEF", value: sheet.def },
                  {
                    key: "eleMas",
                    label: "Elemental Mastery",
                    value: sheet.eleMas,
                  },
                  { key: "critRate", label: "CRIT Rate", value: sheet.critRate },
                  { key: "critDMG", label: "CRIT DMG", value: sheet.critDMG },
                  {
                    key: "enerRech",
                    label: "Energy Recharge",
                    value: sheet.enerRech,
                  },
                  ...dmgBonusEntries(sheet).map(([key, value]) => ({
                    key,
                    label: translateStatKey(key),
                    value,
                  })),
                ]}
                <div class="stat-list">
                  {#each coreStats as row (row.key)}
                    {@const icon = statIconUrl(iconKeyFor(row.key))}
                    <div class="stat-row">
                      <span class="stat-label">
                        {#if icon}
                          <img src={icon} alt="" class="stat-icon" />
                        {/if}
                        {row.label}
                      </span>
                      <span class="stat-total"
                        >{formatSheetStat(row.key, row.value)}</span
                      >
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="muted">Base stats unavailable for {build.key}</p>
              {/if}

              <div class="talent-row">
                {#each [
                  ["auto", build.talents.auto, kit?.talents.auto],
                  ["skill", build.talents.skill, kit?.talents.skill],
                  ["burst", build.talents.burst, kit?.talents.burst],
                ] as [slot, level, icon] (slot)}
                  <span class="talent-chip">
                    {#if typeof icon === "string" && icon}
                      <img src={icon} alt="" class="talent-icon" />
                    {:else}
                      <span class="talent-fallback">
                        {slot === "auto" ? "NA" : slot === "skill" ? "E" : "Q"}
                      </span>
                    {/if}
                    <strong class="talent-level">{level}</strong>
                  </span>
                {/each}
              </div>

              <div class="set-list">
                <div class="set-row group">
                  {#if sIcon}
                    <img
                      src={sIcon}
                      alt=""
                      class="set-icon shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  <p class="set-name">{set?.name ?? build.set.key}</p>
                  <span class="set-badge shrink-0">{build.set.count}</span>
                  <ArtifactTooltip
                    setKey={build.set.key}
                    pieceCount={build.set.count}
                  />
                </div>
                {#if build.set2}
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
                    <span class="set-badge shrink-0"
                      >{build.set2_count ?? 2}</span
                    >
                    <ArtifactTooltip
                      setKey={build.set2}
                      pieceCount={build.set2_count ?? 2}
                    />
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </Surface>
      {/each}
    </div>
    <p class="footnote">
      Sheet totals exclude artifact set bonuses and weapon passives.
    </p>
  </section>

  <section class="section">
    <div class="section-head">
      <h2 class="section-title">gcsim config</h2>
      <a
        href={configUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="meta-link"
      >
        Open raw →
      </a>
    </div>
    {#if configText}
      <Surface flush class="config-surface">
        <pre class="config-block">{configText}</pre>
      </Surface>
    {:else}
      <p class="muted">Config file not found on CDN for this build.</p>
    {/if}
  </section>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .back-link {
    width: fit-content;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .back-link:hover {
    color: var(--accent-1);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .page-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .meta-link {
    color: var(--accent-1);
  }

  .meta-link:hover {
    text-decoration: underline;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .builds-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  @media (min-width: 1536px) {
    .builds-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  :global(.build-card),
  :global(.config-surface) {
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
    /* Match name/level block bottom; sit slightly above raw inset so circles
       don't hang under the text baseline. */
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
    padding: 0.5rem;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
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
    flex-wrap: wrap;
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

  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .stat-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--foreground-mid);
    min-width: 0;
  }

  .stat-icon {
    width: 0.95rem;
    height: 0.95rem;
    object-fit: contain;
    flex-shrink: 0;
    filter: brightness(0) invert(1);
    opacity: 0.7;
  }

  :global([data-theme="light"]) .stat-icon {
    filter: brightness(0);
    opacity: 0.65;
  }

  .stat-total {
    font-weight: 600;
    color: var(--foreground-color);
    font-variant-numeric: tabular-nums;
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

  .footnote,
  .muted {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .config-block {
    margin: 0;
    padding: 1rem;
    font-size: 0.7rem;
    line-height: 1.55;
    color: var(--foreground-mid);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 32rem;
    overflow: auto;
  }

  :global(.page-shell.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
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
