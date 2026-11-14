<script lang="ts">
  /** Enka StatsTable: computed combat sheet rows, with the set bonus beneath (or alone). */
  import { statIconUrl, toGoodKey } from "#lib/utils.js";
  import { useEquipmentData } from "#lib/equipment/equipment-data.svelte.js";
  import {
    computeRosterSheetStats,
    formatSheetStat,
  } from "#lib/equipment/build-stats.js";
  import { sheetStatRows } from "#lib/equipment/build-stat-display.js";
  import {
    INVENTORY_ARTIFACT_SLOTS,
    type RosterBuildView,
  } from "#lib/roster/roster-build-card.js";
  import type { RosterProgress } from "#lib/definitions.js";
  import SetBonus from "#lib/ui/components/roster-build-card/SetBonus.svelte";

  let {
    view,
    progress,
    showStats,
    showSets,
  }: {
    view: RosterBuildView;
    progress: RosterProgress;
    showStats: boolean;
    showSets: boolean;
  } = $props();

  const equipment = useEquipmentData({ baseStats: true });

  let sheet = $derived.by(() => {
    void equipment.version;
    const characterKey =
      view.locationKey || toGoodKey(view.character.name) || "";
    return computeRosterSheetStats({
      characterKey,
      level: progress.level,
      ascension: progress.ascension,
      weaponKey: view.weapon?.key ?? null,
      weaponLevel: view.weapon?.level,
      weaponAscension: view.weapon?.ascension,
      pieces: INVENTORY_ARTIFACT_SLOTS.map((slot) => view.piecesBySlot[slot]),
    });
  });

  let statRows = $derived(sheetStatRows(sheet));
</script>

{#if showStats}
  <div class="StatsTable">
    {#each statRows as row (row.key)}
      <div class="row">
        {#if statIconUrl(row.icon)}
          <img src={statIconUrl(row.icon)} alt="" class="stat-icon" />
        {/if}
        <p>{row.label}</p>
        <div class="mid">
          <span class="sep"></span>
          <span class="val"
            >{row.value == null
              ? "—"
              : formatSheetStat(row.key, row.value)}</span
          >
        </div>
      </div>
    {/each}

    {#if showSets}
      <SetBonus setCounts={view.setCounts} />
    {/if}
  </div>
{:else if showSets}
  <div class="StatsTable">
    <SetBonus setCounts={view.setCounts} />
  </div>
{/if}

<style>
  /* ── Stats table ──────────────────────────────────────────────────── */

  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .StatsTable img {
    pointer-events: none;
    display: block;
  }

  .StatsTable {
    color: #fff;
    display: flex;
    flex-direction: column;
    padding: 1.5em 3% 0 0;
    justify-content: space-between;
    flex-grow: 1;
    font-size: 0.9em;
    min-height: 0;
  }

  .StatsTable .row {
    display: flex;
    align-items: center;
    white-space: nowrap;
    position: relative;
    padding: 0.15em 0;
  }

  .StatsTable .row p {
    margin: 0;
  }

  .StatsTable .row :global(.stat-icon) {
    height: 1em;
    width: 1em;
    margin-right: 0.8em;
  }

  .StatsTable .mid {
    display: flex;
    flex-grow: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35em;
  }

  /* Card-wide `.sep` spacer rule; the row rule below overrides its flex. */
  .sep {
    flex: 1 1 0;
    min-height: 0;
  }

  .StatsTable .mid .sep {
    flex: 1;
    height: 0;
    border-bottom: none;
    margin: 0 0.5em;
  }

  .StatsTable .val {
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }
</style>
