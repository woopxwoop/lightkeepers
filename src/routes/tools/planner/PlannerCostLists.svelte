<script lang="ts">
  import { assetUrl } from "#lib/asset-urls.js";
  import {
    craftRanksCanExpand,
    formatMaterialSourceLine,
  } from "#lib/planner/upgrade-costs.js";
  import {
    characterExpBooks,
    formatCount,
    materialRows,
    weaponExpOres,
    type CostScope,
  } from "#lib/planner/planner-cost-view.js";
  import type { AggregatedUpgradeCosts } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";

  let {
    catalog,
    aggregate,
    ranksExpanded = $bindable(),
    goalCount,
    costScope,
    starredCount,
  }: {
    catalog: UpgradeCostsCatalog;
    aggregate: AggregatedUpgradeCosts;
    ranksExpanded: boolean;
    goalCount: number;
    costScope: CostScope;
    starredCount: number;
  } = $props();

  let books = $derived(characterExpBooks(aggregate.characterExp, catalog));
  let ores = $derived(weaponExpOres(aggregate.weaponExp, catalog));
  let rows = $derived(
    materialRows(aggregate.materials, catalog, ranksExpanded),
  );
  let ranksCanExpand = $derived(
    craftRanksCanExpand(aggregate.materials, catalog),
  );
</script>

{#if books.length > 0}
  <h3 class="group-title">EXP books</h3>
  <ul class="mat-list">
    {#each books as book (book.id)}
      {@const meta = catalog.materials[String(book.id)]}
      <li class="mat-row">
        <img
          class="mat-icon"
          src={assetUrl(meta?.icon ?? `UI_ItemIcon_${book.id}`) ?? ""}
          alt=""
          width="32"
          height="32"
          loading="lazy"
        />
        <span class="mat-name">{meta?.name ?? `Item ${book.id}`}</span>
        <span class="mat-count">×{formatCount(book.count)}</span>
      </li>
    {/each}
  </ul>
{/if}

{#if ores.length > 0}
  <h3 class="group-title">Enhancement ores</h3>
  <ul class="mat-list">
    {#each ores as ore (ore.id)}
      {@const meta = catalog.materials[String(ore.id)]}
      <li class="mat-row">
        <img
          class="mat-icon"
          src={assetUrl(meta?.icon ?? `UI_ItemIcon_${ore.id}`) ?? ""}
          alt=""
          width="32"
          height="32"
          loading="lazy"
        />
        <span class="mat-name">{meta?.name ?? `Item ${ore.id}`}</span>
        <span class="mat-count">×{formatCount(ore.count)}</span>
      </li>
    {/each}
  </ul>
{/if}

{#if rows.length > 0}
  <div class="group-head">
    <h3 class="group-title">Materials</h3>
    {#if ranksCanExpand}
      <button
        type="button"
        class="eyebrow ranks-toggle"
        aria-expanded={ranksExpanded}
        onclick={() => (ranksExpanded = !ranksExpanded)}
      >
        {ranksExpanded ? "Collapse" : "Expand"}
        <IconChevronDown size={14} strokeWidth={2.25} />
      </button>
    {/if}
  </div>
  <ul class="mat-list">
    {#each rows as mat (mat.id)}
      {@const source = mat.sources[0]}
      <li class="mat-row">
        <img
          class="mat-icon"
          src={assetUrl(mat.icon) ?? ""}
          alt=""
          width="32"
          height="32"
          loading="lazy"
        />
        <span class="mat-text">
          <span class="mat-name">{mat.name}</span>
          {#if source}
            <span class="meta-sub mat-source">
              {#if source.icon && assetUrl(source.icon)}
                <img
                  class="mat-source-icon"
                  src={assetUrl(source.icon) ?? ""}
                  alt=""
                  width="16"
                  height="16"
                  loading="lazy"
                  onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              {/if}
              {formatMaterialSourceLine(source)}
            </span>
          {/if}
        </span>
        <span class="mat-count">×{formatCount(mat.count)}</span>
      </li>
    {/each}
  </ul>
{:else if aggregate.mora === 0 && aggregate.characterExp === 0 && aggregate.weaponExp === 0}
  <p class="section-lede">
    {#if goalCount === 0}
      Add a goal to see costs.
    {:else if costScope === "starred" && starredCount === 0}
      Star a goal to include it here and on the farming itinerary.
    {:else}
      Nothing to farm — configs match.
    {/if}
  </p>
{/if}

<style>
  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .group-head .group-title {
    margin: 0;
  }

  .ranks-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .ranks-toggle:hover {
    color: var(--foreground-color);
  }

  .ranks-toggle :global(svg) {
    transition: transform 160ms ease;
  }

  .ranks-toggle[aria-expanded="true"] :global(svg) {
    transform: rotate(180deg);
  }

  .group-title {
    margin: 0.5rem 0 0;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .mat-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.35rem 0.85rem;
  }

  .mat-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 0.5rem;
    align-items: center;
    min-width: 0;
  }

  .mat-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .mat-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .mat-name {
    font-size: var(--text-sm);
    color: var(--foreground-color);
    min-width: 0;
  }

  .mat-source {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .mat-source-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .mat-count {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }
</style>
