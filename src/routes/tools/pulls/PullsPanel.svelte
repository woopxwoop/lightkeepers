<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    lede,
    children,
  }: {
    title: string;
    lede?: string;
    children: Snippet;
  } = $props();
</script>

<section class="panel">
  <header class="panel-head">
    <div class="panel-head-text">
      <h2 class="panel-title">{title}</h2>
      {#if lede}
        <p class="panel-lede">{lede}</p>
      {/if}
    </div>
  </header>

  {@render children()}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .panel-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .panel-head-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .panel-lede {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    line-height: 1.45;
    max-width: 48ch;
  }
</style>
