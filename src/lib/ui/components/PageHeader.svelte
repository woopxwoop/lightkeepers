<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    eyebrow = "",
    title,
    lede = "",
    class: className = "",
    children,
  }: {
    eyebrow?: string;
    title: string;
    lede?: string;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<header class="page-header {className}">
  {#if eyebrow}
    <p class="eyebrow">{eyebrow}</p>
  {/if}
  <h1 class="title">{title}</h1>
  {#if lede}
    <p class="lede">{lede}</p>
  {/if}
  {@render children?.()}
</header>

<style>
  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .title {
    font-size: var(--h1-size);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .lede {
    max-width: 40rem;
    color: var(--foreground-mid);
    font-size: var(--text-md);
    line-height: 1.45;
  }
</style>
