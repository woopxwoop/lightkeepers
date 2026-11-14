<script lang="ts">
  import type { RotationViewModel } from "#lib/research/research-answer-panels.js";

  let { rotation }: { rotation: RotationViewModel } = $props();
</script>

<section class="research-rotation research-panel" aria-label="Rotation">
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
</style>
