<script lang="ts">
  import type { ErRowView } from "#lib/research/research-answer-panels.js";
  import ResearchEntityMention from "#lib/ui/components/ResearchEntityMention.svelte";

  let { rows }: { rows: ErRowView[] } = $props();
</script>

<section
  class="research-er research-panel"
  aria-label="Energy recharge targets"
>
  {#each rows as row (row.key)}
    <article class="research-er-card">
      <div class="research-er-who">
        {#if row.entity}
          <ResearchEntityMention entity={row.entity} />
        {:else}
          <span class="research-er-label">{row.label}</span>
        {/if}
        {#if row.citeHtml}
          <span>{@html row.citeHtml}</span>
        {/if}
      </div>
      <p class="research-er-range">{row.range}</p>
      {#if row.contextHtml}
        <p class="research-er-context research-note">{@html row.contextHtml}</p>
      {/if}
    </article>
  {/each}
</section>

<style>
  .research-er {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .research-er-label {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .research-er-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .research-er-who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.35rem;
  }

  .research-er-range {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--foreground-color);
  }
</style>
