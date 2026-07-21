<script lang="ts">
  import { charactersOwned, animationsEnabled, displayPreferences } from "$lib/stores";
  import {
    artifactSetByKey,
    buildGoodKeyMap,
    translateStatKey,
    weaponByKey,
    statIconUrl,
  } from "$lib/utils";
  import { artifactIconUrl, weaponIconUrl } from "$lib/asset-urls";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
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
  let iconStyle = $derived($displayPreferences.iconStyle);

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

<main
  class="w-[85%] pb-20 flex flex-col gap-8"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  <header class="flex flex-col gap-1.5">
    <p
      class="text-xs tracking-widest uppercase"
      style="color: var(--foreground-mid);"
    >
      Team config
    </p>
    <h1
      class="text-2xl md:text-3xl font-semibold leading-tight"
      style="color: var(--foreground-color);"
    >
      {team.team_name}
    </h1>
    {#if sim.label}
      <p class="text-sm" style="color: var(--foreground-mid);">
        {sim.label}
      </p>
    {/if}
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
      style="color: var(--foreground-mid);"
    >
      <span>{(sim.dps / 1000).toFixed(1)}K DPS</span>
      <span aria-hidden="true">·</span>
      <span>Cost {sim.cost}</span>
      <span aria-hidden="true">·</span>
      <a
        href="/teams/{team.team_key}"
        class="underline underline-offset-2"
        style="color: var(--accent-1);"
      >
        Investment curve
      </a>
    </div>
  </header>

  <section class="flex flex-col gap-4">
    <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4">
      {#each sim.characters as build (build.key)}
        {@const character = characterFor(build.key)}
        {@const weapon = weaponByKey.get(build.weapon.key)}
        {@const set = artifactSetByKey.get(build.set.key)}
        {@const set2 = build.set2 ? artifactSetByKey.get(build.set2) : null}
        {@const sheet = sheetFor(build)}
        {@const wIcon = weapon ? weaponIconUrl(weapon.awakenIcon) : null}
        {@const sIcon = set ? artifactIconUrl(set.icon) : null}
        {@const kit = kitsByKey[build.key]}
        <article
          class="build-card rounded-xl overflow-hidden"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
        >
          <div class="build-grid">
            <!-- Left: avatar + constellations -->
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
                    <h3
                      class="text-base font-semibold leading-tight"
                      style="color: var(--foreground-color); text-shadow: 0 1px 8px rgba(0,0,0,0.65);"
                    >
                      {character?.name ?? build.key}
                    </h3>
                    <p
                      class="text-[0.7rem] mt-0.5"
                      style="color: var(--foreground-mid); text-shadow: 0 1px 6px rgba(0,0,0,0.65);"
                    >
                      Lv. {build.level}
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Right: equip + stats -->
            <div class="build-panel flex flex-col gap-3 p-3.5 min-w-0">
              <!-- Weapon -->
              <div
                class="relative flex gap-2.5 items-start rounded-lg p-2"
                style="background: color-mix(in srgb, var(--accent-1) 7%, transparent);"
              >
                {#if wIcon}
                  <img
                    src={wIcon}
                    alt=""
                    class="weapon-icon shrink-0"
                    loading="lazy"
                  />
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <p
                      class="text-[0.8rem] font-medium leading-tight truncate"
                      style="color: var(--foreground-color);"
                    >
                      {weapon?.name ?? build.weapon.key}
                    </p>
                    <span class="r-badge">R{build.weapon.refinement}</span>
                  </div>
                  {#if weapon}
                    <div
                      class="flex gap-0.5 mt-0.5"
                      aria-label="{weapon.stars} star"
                    >
                      {#each Array.from({ length: starCount(weapon.stars) }, (_, i) => i) as i (i)}
                        <span class="star">★</span>
                      {/each}
                    </div>
                    <div
                      class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[0.65rem]"
                      style="color: var(--foreground-mid);"
                    >
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

              <!-- Stats -->
              {#if sheet}
                {@const coreStats = [
                  { key: "hp", label: "HP", value: sheet.hp },
                  { key: "atk", label: "ATK", value: sheet.atk },
                  { key: "def", label: "DEF", value: sheet.def },
                  { key: "eleMas", label: "Elemental Mastery", value: sheet.eleMas },
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
                <div class="flex flex-col gap-1">
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
                <p class="text-xs" style="color: var(--foreground-mid);">
                  Base stats unavailable for {build.key}
                </p>
              {/if}

              <!-- Talents -->
              <div
                class="flex gap-3 text-[0.65rem]"
                style="color: var(--foreground-mid);"
              >
                {#each [
                  ["auto", build.talents.auto, kit?.talents.auto],
                  ["skill", build.talents.skill, kit?.talents.skill],
                  ["burst", build.talents.burst, kit?.talents.burst],
                ] as [slot, level, icon] (slot)}
                  <span class="talent-chip">
                    {#if icon}
                      <img src={icon} alt="" class="talent-icon" />
                    {:else}
                      <span class="talent-fallback">
                        {slot === "auto" ? "NA" : slot === "skill" ? "E" : "Q"}
                      </span>
                    {/if}
                    <strong style="color: var(--foreground-color);">{level}</strong>
                  </span>
                {/each}
              </div>

              <!-- Set -->
              <div
                class="relative flex gap-2 items-center pt-2"
                style="border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 12%, transparent);"
              >
                {#if sIcon}
                  <img
                    src={sIcon}
                    alt=""
                    class="set-icon shrink-0"
                    loading="lazy"
                  />
                {/if}
                <p
                  class="text-[0.75rem] font-medium truncate min-w-0"
                  style="color: var(--foreground-color);"
                >
                  {set?.name ?? build.set.key}
                </p>
                <span class="set-badge shrink-0">{build.set.count}</span>
                {#if build.set2}
                  <span class="text-[0.65rem] truncate" style="color: var(--foreground-mid);">
                    + {set2?.name ?? build.set2}
                    {build.set2_count ?? 2}
                  </span>
                {/if}
                <ArtifactTooltip
                  setKey={build.set.key}
                  pieceCount={build.set.count}
                />
              </div>
            </div>
          </div>
        </article>
      {/each}
    </div>
    <p class="text-[0.65rem]" style="color: var(--foreground-mid);">
      Sheet totals exclude artifact set bonuses and weapon passives.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        gcsim config
      </h2>
      <a
        href={configUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs underline underline-offset-2"
        style="color: var(--accent-1);"
      >
        Open raw
      </a>
    </div>
    {#if configText}
      <pre
        class="config-block rounded-xl p-4 text-[0.7rem] leading-relaxed overflow-x-auto"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent); color: var(--foreground-mid);"
      >{configText}</pre>
    {:else}
      <p class="text-xs" style="color: var(--foreground-mid);">
        Config file not found on CDN for this build.
      </p>
    {/if}
  </section>
</main>

<style>
  .build-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: stretch;
    min-height: 20rem;
  }

  .build-art {
    position: relative;
    overflow: hidden;
    background: color-mix(in srgb, var(--accent-1) 8%, #0a0e14);
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

  /* Fill the full art column; keep CharacterIcon crop/zoom transforms. */
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

  /* Name sits above the fade, clear of the cons rail. */
  .build-art-meta {
    position: absolute;
    left: 2.4rem;
    right: 0.75rem;
    bottom: 0.65rem;
    z-index: 2;
  }

  .cons-rail {
    position: absolute;
    left: 0.45rem;
    top: 50%;
    transform: translateY(-50%);
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
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-1) 35%, transparent);
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

  @media (max-width: 640px) {
    .build-grid {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .build-art,
    .build-art--portrait,
    .build-art--enka {
      width: 100%;
      min-height: 16rem;
    }

    .cons-rail {
      top: 0.75rem;
      bottom: 3.25rem;
      transform: none;
      justify-content: space-between;
    }

    .cons-node {
      width: 1.5rem;
      height: 1.5rem;
    }

    .build-art-meta {
      left: 2.25rem;
      bottom: 0.55rem;
    }

    /* Wide mobile banner: pin TCG art to the face, not mid-card. */
    .build-art--tcg .build-avatar :global(img) {
      object-position: center top;
      transform: none;
    }
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
    border-radius: 0.25rem;
    color: #1a1208;
    background: color-mix(in srgb, var(--accent-1) 85%, #f0c060);
  }

  .star {
    font-size: 0.55rem;
    color: #e8b84a;
    line-height: 1;
  }

  .set-badge {
    font-size: 0.65rem;
    font-weight: 700;
    min-width: 1.15rem;
    height: 1.15rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    color: #0a120e;
    background: color-mix(in srgb, #6dd5a8 75%, var(--accent-1));
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
    /* Lunaris icons are dark glyphs — force light on dark theme */
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

  .config-block {
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 32rem;
    overflow-y: auto;
  }
</style>
