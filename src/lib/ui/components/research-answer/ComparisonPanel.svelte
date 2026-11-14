<script lang="ts">
  import type { ComparisonSideView } from "#lib/research/research-answer-panels.js";

  let {
    verdictHtml,
    sides,
  }: {
    verdictHtml: string | null;
    sides: ComparisonSideView[];
  } = $props();
</script>

<section class="research-comparison" aria-label="Option comparison">
  {#if verdictHtml}
    <p class="research-comparison-verdict">{@html verdictHtml}</p>
  {/if}
  <div class="research-comparison-grid">
    {#each sides as side, i (side.key)}
      {#if i === 1}
        <div class="research-comparison-vs" aria-hidden="true">vs</div>
      {/if}
      <div class="research-comparison-side">
        <h3 class="research-comparison-label">{@html side.labelHtml}</h3>
        <p class="research-comparison-summary">
          {@html side.summaryHtml}
        </p>
        {#if side.bullets.length > 0}
          <ul class="research-comparison-bullets">
            {#each side.bullets as bullet, bi (bi)}
              <li>{@html bullet}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .research-comparison {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-comparison-verdict {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.45;
    color: var(--foreground-color);
    padding-bottom: 0.55rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .research-comparison-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--space-3);
    align-items: start;
  }

  .research-comparison-vs {
    align-self: center;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 42%, transparent);
    padding-top: 0.35rem;
  }

  .research-comparison-side {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .research-comparison-label {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 58%, transparent);
  }

  .research-comparison-summary {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .research-comparison-bullets {
    margin: 0.15rem 0 0;
    padding-left: 1rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-comparison-bullets li + li {
    margin-top: 0.2rem;
  }

  @media (max-width: 520px) {
    .research-comparison-grid {
      grid-template-columns: 1fr;
    }

    .research-comparison-vs {
      justify-self: center;
      padding: 0;
    }
  }

  .research-comparison :global(.research-entity-slot) {
    display: contents;
  }

  .research-comparison :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .research-comparison :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .research-comparison :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }
</style>
