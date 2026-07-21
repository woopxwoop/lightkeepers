<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: className = "",
    children,
  }: {
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<main class="page-shell {className}">
  {@render children?.()}
</main>

<style>
  .page-shell {
    width: var(--page-width);
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
  }
</style>
