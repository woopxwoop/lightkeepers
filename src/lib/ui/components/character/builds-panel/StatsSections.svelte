<script lang="ts">
  import HoverTooltip from "#lib/ui/components/HoverTooltip.svelte";
  import {
    artifactSlotIconUrl,
    statIconUrl,
    translateStatKey,
  } from "#lib/utils.js";
  import {
    MAIN_STAT_SLOTS,
    recommendedSubstatsFromBuilds,
  } from "#lib/characters/character-builds.js";
  import { substatUsageLabel } from "#lib/characters/character-builds-panel.js";
  import type { CharacterIndex } from "#lib/types/investment.js";

  let {
    builds,
    elColor,
  }: {
    builds: CharacterIndex;
    elColor: string;
  } = $props();

  let recommendedSubstats = $derived(recommendedSubstatsFromBuilds(builds));
</script>

<section class="board-section">
  <h2 class="section-title">Main stats</h2>
  <div class="main-stats">
    {#each MAIN_STAT_SLOTS as slot}
      <div class="main-stat-col">
        <h3 class="slot-label">
          <img
            src={artifactSlotIconUrl(slot.key)}
            alt=""
            class="stat-icon main-stat-icon shrink-0"
            loading="lazy"
          />
          {slot.label}
        </h3>
        {#if (builds.main_stats?.[slot.key] ?? []).length === 0}
          <p class="muted-note">—</p>
        {:else}
          <ul class="stat-list">
            {#each builds.main_stats?.[slot.key] ?? [] as stat}
              {@const icon = statIconUrl(stat.key)}
              <li class="main-stat-item">
                <span class="flex items-center gap-1.5 min-w-0">
                  {#if icon}
                    <img
                      src={icon}
                      alt=""
                      class="stat-icon main-stat-icon shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  <span class="stat-name">{translateStatKey(stat.key)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</section>

<section class="board-section">
  <h2 class="section-title">Recommended substats</h2>
  {#if recommendedSubstats.length === 0}
    <p class="muted-note">No substat data yet.</p>
  {:else}
    <div class="substat-row">
      {#each recommendedSubstats as roll}
        {@const icon = statIconUrl(roll.key)}
        <button
          type="button"
          class="stat-chip group relative flex items-center justify-center"
          class:is-main={roll.matchesMain}
          style={roll.matchesMain ? `border-color: ${elColor}` : undefined}
          aria-label={translateStatKey(roll.key)}
        >
          {#if icon}
            <img src={icon} alt="" class="stat-icon" loading="lazy" />
          {:else}
            <span class="stat-chip-fallback">
              {translateStatKey(roll.key)}
            </span>
          {/if}
          <HoverTooltip class="max-w-56" label={translateStatKey(roll.key)}>
            <div class="tip-detail-text font-medium">
              {translateStatKey(roll.key)}
            </div>
            {#if roll.matchesMain}
              <div
                class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
              >
                Also a main on {roll.mainSlots.join(" / ")}
              </div>
            {/if}
            {#if roll.mean > 0}
              <div
                class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
              >
                {substatUsageLabel(roll)}
              </div>
            {/if}
          </HoverTooltip>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .slot-label {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .muted-note {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .stat-name {
    color: var(--foreground-color);
    font-size: var(--text-xs);
  }

  .main-stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .main-stats {
    display: grid;
    gap: var(--space-3);
  }

  @media (min-width: 640px) {
    .main-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
    }

    .main-stat-col + .main-stat-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.14);
      padding-left: var(--space-3);
      margin-left: var(--space-3);
    }
  }

  .substat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat-chip {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0.55rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    cursor: pointer;
  }

  .stat-chip-fallback {
    font-size: 0.65rem;
    padding: 0.15rem;
    text-align: center;
    line-height: 1.15;
    color: var(--foreground-mid);
  }

  .stat-icon {
    width: 100%;
    height: 100%;
  }

  .main-stat-icon {
    width: 0.95rem;
    height: 0.95rem;
  }
</style>
