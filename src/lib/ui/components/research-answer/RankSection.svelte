<script lang="ts">
  import type { RankRowView } from "#lib/research/research-answer-panels.js";
  import ResearchEntityMention from "#lib/ui/components/ResearchEntityMention.svelte";

  let {
    title,
    ariaLabel,
    rows,
  }: {
    title: string;
    ariaLabel: string;
    rows: RankRowView[];
  } = $props();

  let top = $derived(rows[0]);
  let rest = $derived(rows.slice(1));
</script>

{#snippet rankRow(row: RankRowView)}
  <li class="research-rank-row" class:is-top={row.rank === 1}>
    <span class="research-rank-num" aria-hidden="true">{row.rank}</span>
    <div class="research-rank-body">
      <div class="research-rank-head">
        {#if row.entity}
          <ResearchEntityMention entity={row.entity} />
        {:else}
          <span class="research-rank-label">{row.label}</span>
        {/if}
        {#if row.citeHtml}
          <span>{@html row.citeHtml}</span>
        {/if}
      </div>
      {#if row.noteHtml}
        <p class="research-rank-note">{@html row.noteHtml}</p>
      {/if}
    </div>
  </li>
{/snippet}

<section class="research-ranks" aria-label={ariaLabel}>
  <h3 class="research-ranks-title">{title}</h3>
  <ol class="research-rank-list">
    {@render rankRow(top)}
  </ol>
  {#if rest.length > 0}
    <details class="research-ranks-more">
      <summary>
        {rest.length} more {rest.length === 1 ? "option" : "options"}
      </summary>
      <ol class="research-rank-list research-rank-list-more" start={2}>
        {#each rest as row (row.key)}
          {@render rankRow(row)}
        {/each}
      </ol>
    </details>
  {/if}
</section>

<style>
  .research-ranks {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-ranks-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .research-rank-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .research-rank-row {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
  }

  .research-rank-row.is-top .research-rank-num {
    color: var(--foreground-color);
  }

  .research-ranks-more {
    margin: 0.15rem 0 0;
  }

  .research-ranks-more summary {
    cursor: pointer;
    list-style: none;
    font-size: var(--text-xs);
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground-color) 58%, transparent);
    padding: 0.2rem 0;
    user-select: none;
  }

  .research-ranks-more summary::-webkit-details-marker {
    display: none;
  }

  .research-ranks-more summary::before {
    content: "▸ ";
    display: inline-block;
    transition: transform 0.12s ease;
  }

  .research-ranks-more[open] summary::before {
    transform: rotate(90deg);
  }

  .research-ranks-more summary:hover {
    color: var(--foreground-color);
  }

  .research-rank-list-more {
    margin-top: 0.45rem;
  }

  .research-rank-num {
    flex-shrink: 0;
    min-width: 1.25rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: color-mix(in srgb, var(--foreground-color) 48%, transparent);
    padding-top: 0.2rem;
  }

  .research-rank-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .research-rank-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.35rem;
  }

  .research-rank-label {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .research-rank-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-ranks :global(.research-entity-slot) {
    display: contents;
  }

  .research-ranks :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .research-ranks :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .research-ranks :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }
</style>
