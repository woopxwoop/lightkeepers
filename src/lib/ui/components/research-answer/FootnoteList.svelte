<script lang="ts">
  import {
    citationShortLabel,
    safeExternalHref,
  } from "#lib/research/research-answer.js";
  import type { ResearchCitation } from "#lib/research/research-types.js";

  let {
    footnotes,
    citeNum,
    citeAnchorPrefix,
  }: {
    footnotes: ResearchCitation[];
    citeNum: Map<number, number>;
    citeAnchorPrefix: string;
  } = $props();
</script>

<ol class="research-footnotes">
  {#each footnotes as cite (cite.id)}
    {@const num = citeNum.get(cite.id) ?? 0}
    {@const href = safeExternalHref(cite.url)}
    <li
      id="{citeAnchorPrefix}research-cite-{cite.id}"
      class="research-footnote"
    >
      <span class="research-footnote-num meta-sub" aria-hidden="true"
        >{num}</span
      >
      <div class="research-footnote-body">
        {#if href}
          <a
            class="research-footnote-link"
            {href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {citationShortLabel(cite)}
          </a>
        {:else}
          <span class="research-footnote-link">{citationShortLabel(cite)}</span>
        {/if}
        <p class="research-footnote-quote meta-sub">{cite.quote}</p>
      </div>
    </li>
  {/each}
</ol>

<style>
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
    background: color-mix(in srgb, var(--foreground-color) 5%, transparent);
    border-radius: var(--radius-sm);
    margin: -0.15rem;
    padding: 0.15rem;
  }

  .research-footnote-num {
    flex-shrink: 0;
    min-width: 1.1rem;
    text-align: right;
    padding-top: 0.15rem;
  }

  .research-footnote-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .research-footnote-link {
    font-size: var(--text-xs);
    font-weight: 500;
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    text-decoration: none;
  }

  .research-footnote-link:hover {
    color: var(--foreground-color);
    text-decoration: underline;
  }

  .research-footnote-quote {
    margin: 0;
    line-height: 1.45;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
