<script lang="ts">
  /**
   * Research answer markdown with entity chips, cite superscripts, and footnotes.
   */
  import { equipmentVersion } from "$lib/equipment-data";
  import {
    citationShortLabel,
    orderCitationsForDisplay,
    renderResearchAnswer,
  } from "$lib/research-answer";
  import type {
    ResearchCitation,
    ResearchComparison,
    ResearchEntity,
  } from "$lib/research-types";

  let {
    markdown,
    entities = [],
    citations = [],
    disagreements = [],
    comparison = null,
  }: {
    markdown: string;
    entities?: ResearchEntity[];
    citations?: ResearchCitation[];
    disagreements?: { summary: string; citation_ids?: number[] }[];
    comparison?: ResearchComparison | null;
  } = $props();

  let html = $derived.by(() => {
    void $equipmentVersion;
    return renderResearchAnswer(markdown, entities, citations);
  });

  let footnotes = $derived(orderCitationsForDisplay(citations, markdown));

  let citeNum = $derived.by(() => {
    const map = new Map<number, number>();
    let n = 0;
    for (const cite of footnotes) {
      n += 1;
      map.set(cite.id, n);
    }
    return map;
  });

  let sides = $derived(
    comparison
      ? [
          { key: "a" as const, side: comparison.option_a },
          { key: "b" as const, side: comparison.option_b },
        ]
      : [],
  );
</script>

<div class="research-answer">
  {#if disagreements.length > 0}
    <aside class="research-disagreements" aria-label="Source disagreements">
      {#each disagreements as d (d.summary)}
        <p class="research-disagreement">{d.summary}</p>
      {/each}
    </aside>
  {/if}

  <div class="research-body">
    {@html html}
  </div>

  {#if comparison}
    <section class="research-comparison" aria-label="Option comparison">
      <div class="research-comparison-grid">
        {#each sides as { key, side } (key)}
          <div class="research-comparison-side">
            <h3 class="research-comparison-label">{side.label}</h3>
            <p class="research-comparison-summary">{side.summary}</p>
            {#if side.bullets && side.bullets.length > 0}
              <ul class="research-comparison-bullets">
                {#each side.bullets as bullet (bullet)}
                  <li>{bullet}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if footnotes.length > 0}
    <ol class="research-footnotes">
      {#each footnotes as cite (cite.id)}
        {@const num = citeNum.get(cite.id) ?? 0}
        <li id="research-cite-{cite.id}" class="research-footnote">
          <span class="research-footnote-num" aria-hidden="true">{num}</span>
          <div class="research-footnote-body">
            <a
              class="research-footnote-link"
              href={cite.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {citationShortLabel(cite)}
            </a>
            <p class="research-footnote-quote">{cite.quote}</p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .research-answer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .research-disagreements {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, #e67e22 35%, var(--border-default));
    background: color-mix(in srgb, #e67e22 8%, transparent);
  }

  .research-disagreement {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

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

  .research-comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
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
  }

  .research-body :global(p) {
    margin: 0 0 0.65rem;
    line-height: 1.55;
  }

  .research-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .research-body :global(ul),
  .research-body :global(ol) {
    margin: 0 0 0.65rem;
    padding-left: 1.1rem;
    line-height: 1.5;
  }

  .research-body :global(li + li) {
    margin-top: 0.2rem;
  }

  .research-body :global(strong) {
    font-weight: 600;
  }

  .research-body :global(code) {
    font-size: 0.9em;
  }

  .research-body :global(h2),
  .research-body :global(h3) {
    margin: 0.85rem 0 0.35rem;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.35;
    color: color-mix(in srgb, var(--foreground-color) 88%, transparent);
  }

  .research-body :global(h2:first-child),
  .research-body :global(h3:first-child) {
    margin-top: 0;
  }

  .research-body :global(.research-entity) {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    max-width: 100%;
    margin: 0 0.1rem;
    padding: 0.1rem 0.4rem 0.1rem 0.15rem;
    vertical-align: baseline;
    border-radius: var(--radius-pill);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
    color: var(--foreground-color);
    text-decoration: none;
    font-size: 0.92em;
    line-height: 1.25;
    white-space: nowrap;
  }

  .research-body :global(a.research-entity:hover) {
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  }

  .research-body :global(.research-entity-icon) {
    width: 1.15rem;
    height: 1.15rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: 0.2rem;
  }

  .research-body :global(.research-entity-label) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .research-body :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.72em;
    line-height: 0;
    vertical-align: super;
  }

  .research-body :global(.research-cite a) {
    color: color-mix(in srgb, var(--foreground-color) 62%, transparent);
    text-decoration: none;
    padding: 0 0.12rem;
    border-radius: 0.15rem;
  }

  .research-body :global(.research-cite a:hover) {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .research-footnotes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    padding-top: var(--space-2);
  }

  .research-footnote {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    scroll-margin-top: 5rem;
  }

  .research-footnote:target {
    background: color-mix(in srgb, var(--accent-1) 8%, transparent);
    border-radius: var(--radius-sm);
    margin: -0.15rem;
    padding: 0.15rem;
  }

  .research-footnote-num {
    flex-shrink: 0;
    min-width: 1.1rem;
    font-size: var(--text-xs);
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
    text-align: right;
    padding-top: 0.1rem;
  }

  .research-footnote-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .research-footnote-link {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    text-decoration: none;
  }

  .research-footnote-link:hover {
    color: color-mix(in srgb, var(--foreground-color) 82%, var(--accent-1));
    text-decoration: underline;
  }

  .research-footnote-quote {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 68%, transparent);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
