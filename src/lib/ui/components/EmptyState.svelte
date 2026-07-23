<script lang="ts">
  import type { Snippet } from "svelte";
  import Surface from "$lib/ui/components/Surface.svelte";

  let {
    message,
    class: className = "",
    children,
    action,
  }: {
    message?: string;
    class?: string;
    children?: Snippet;
    action?: Snippet;
  } = $props();
</script>

<Surface class="empty-state text-center {className}">
  {#if children}
    {@render children()}
  {:else if message}
    <p class="msg">{message}</p>
  {/if}
  {#if action}
    <div class="action">
      {@render action()}
    </div>
  {/if}
</Surface>

<style>
  :global(.empty-state) {
    padding: var(--space-8) var(--space-4);
  }

  .msg {
    color: var(--foreground-mid);
    font-size: var(--text-md);
  }

  .action {
    margin-top: var(--space-4);
    display: flex;
    justify-content: center;
  }
</style>
