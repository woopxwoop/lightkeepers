<script lang="ts">
  import type { RotationViewModel } from "#lib/research/research-answer-panels.js";

  let { rotation }: { rotation: RotationViewModel } = $props();
</script>

<section class="research-rotation" aria-label="Rotation">
  <ol class="research-rotation-steps">
    {#each rotation.steps as step, i (i)}
      <li>{@html step}</li>
    {/each}
  </ol>
  {#if rotation.notesHtml}
    <p class="research-rotation-notes">{@html rotation.notesHtml}</p>
  {/if}
  {#if rotation.citeHtml}
    <span class="research-rotation-cites">{@html rotation.citeHtml}</span>
  {/if}
</section>

<style>
  .research-rotation {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-rotation-steps {
    margin: 0;
    padding-left: 1.25rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--foreground-color);
  }

  .research-rotation-steps li + li {
    margin-top: 0.35rem;
  }

  .research-rotation-notes {
    margin: 0.35rem 0 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-rotation :global(.research-entity-slot) {
    display: contents;
  }

  .research-rotation :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .research-rotation :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .research-rotation :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }
</style>
