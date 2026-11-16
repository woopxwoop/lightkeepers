<script lang="ts">
  import {
    slotLabel,
    type DisplayGroup,
    type PreparedSummaryColumn,
    type SummaryHeaderMeta,
    type SummaryMode,
  } from "#lib/boards/summary-columns.js";
  import type { Tables } from "#lib/types/database.types.js";
  import { getEnemyAsset } from "#lib/utils.js";
  import DpsGroupCard from "#lib/ui/components/summary-tool/DpsGroupCard.svelte";

  let {
    mode,
    headerMeta,
    activeColumn,
    mapping,
    onopenalts,
  }: {
    mode: SummaryMode;
    headerMeta: SummaryHeaderMeta;
    activeColumn: PreparedSummaryColumn | null;
    mapping: Map<string, Tables<"characters">>;
    onopenalts: (group: DisplayGroup) => void;
  } = $props();
</script>

<div class="export-stage">
  <div
    id="summary-export"
    class="summary"
    class:summary-abyss={mode === "abyss"}
    class:summary-stygian={mode === "stygian"}
  >
    <header class="info-head">
      <div class="info-titles">
        <h2 class="info-title">
          {headerMeta.title}
          {#if activeColumn && mode === "abyss"}
            <span class="info-side">{activeColumn.label}</span>
          {/if}
        </h2>
        {#if headerMeta.version || headerMeta.buff || headerMeta.date}
          <p class="info-sub">
            {#if headerMeta.version}
              <span class="info-version">{headerMeta.version}</span>
            {/if}
            {#if headerMeta.version && (headerMeta.buff || headerMeta.date)}
              <span class="info-sep">·</span>
            {/if}
            {#if headerMeta.buff}
              <span>{headerMeta.buff}</span>
            {/if}
            {#if headerMeta.buff && headerMeta.date}
              <span class="info-sep">·</span>
            {/if}
            {#if headerMeta.date}
              <span>{headerMeta.date}</span>
            {/if}
          </p>
        {/if}
      </div>
      {#if activeColumn && mode === "abyss" && "chambers" in activeColumn && activeColumn.chambers.length > 0}
        <div class="info-enemies" aria-hidden="true">
          {#each activeColumn.chambers as chamber}
            <div class="chamber">
              {#each chamber.enemies.slice(0, 3) as enemy}
                {#if enemy.asset}
                  <img
                    src={getEnemyAsset(enemy.asset)}
                    alt=""
                    class="enemy-thumb"
                  />
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      {:else if activeColumn && mode === "stygian"}
        <div class="info-enemies info-enemies-boss">
          {#if "enemy" in activeColumn && activeColumn.enemy?.asset}
            <img
              src={getEnemyAsset(activeColumn.enemy.asset)}
              alt=""
              class="boss-thumb"
            />
          {/if}
        </div>
      {/if}
      <div class="brand">
        <img
          class="brand-mark"
          src="/lightkeepers-mark.png"
          alt=""
          width="36"
          height="36"
        />
        <span class="brand-name">Lightkeepers</span>
      </div>
    </header>

    {#if activeColumn}
      <section
        class="column column-solo"
        aria-label={mode === "abyss"
          ? activeColumn.label
          : slotLabel(activeColumn.slot)}
      >
        <ul class="team-list">
          {#each activeColumn.groups as group (group.mainDps)}
            <DpsGroupCard {group} {mapping} {onopenalts} />
          {:else}
            <li class="team-empty">No On-Field DPS teams clear the filters.</li>
          {/each}
        </ul>
      </section>
    {/if}

    <footer class="info-foot">lightkeepers.moe/tools/{mode}/summary</footer>
  </div>
</div>

<style>
  .export-stage {
    width: 100%;
    min-width: 0;
    padding-bottom: var(--space-4);
  }

  .summary {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 1rem 0.85rem 0.85rem;
    background: var(--background-color);
    color: var(--foreground-color);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    /* clip (not hidden): avoid creating a scrollport that traps page scroll on
       tall summaries when scrollHeight === clientHeight (esp. touch / trackpad). */
    overflow: clip;
    container-type: inline-size;
    container-name: info;
  }

  .info-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
    padding-bottom: 0.7rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .summary-stygian .info-head {
    margin-bottom: 0.45rem;
    padding-block: 0.1rem 0.25rem;
  }

  .info-enemies {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 0.45rem 0.55rem;
    flex-shrink: 0;
  }

  .info-enemies-boss {
    gap: 0;
    width: clamp(2.75rem, 8vw, 3.75rem);
    height: clamp(2.75rem, 8vw, 3.75rem);
    overflow: hidden;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .boss-thumb {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform: scale(1.4);
    transform-origin: center;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
    margin-left: auto;
  }

  .brand-mark {
    display: block;
    width: 1.85rem;
    height: 1.85rem;
    filter: invert(1);
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .info-titles {
    min-width: 0;
    flex: 0 1 auto;
  }

  @container info (max-width: 720px) {
    .info-head {
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: flex-start;
      gap: 0.45rem;
    }

    .brand {
      order: -1;
      margin-left: 0;
    }

    .info-titles,
    .info-enemies {
      width: 100%;
    }
  }

  .info-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.55rem;
  }

  .info-side {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .info-version {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground-color);
  }

  .info-sub,
  .team-empty,
  .info-foot {
    margin: 0.15rem 0 0;
    font-size: 0.72rem;
    color: var(--foreground-mid);
  }

  .info-sep {
    opacity: 0.55;
  }

  .chamber {
    display: flex;
    gap: 0.2rem;
    min-width: 0;
  }

  .enemy-thumb {
    width: 2.35rem;
    height: 2.35rem;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .column-solo {
    min-width: 0;
    overflow: clip;
    width: 100%;
  }

  .team-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem 0.7rem;
    min-width: 0;
  }

  @container info (max-width: 900px) {
    .team-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @container info (max-width: 640px) {
    .team-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .team-empty {
    min-width: 0;
    grid-column: 1 / -1;
  }

  .info-foot {
    margin-top: 0.85rem;
    padding-top: 0.55rem;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    text-align: right;
  }
</style>
