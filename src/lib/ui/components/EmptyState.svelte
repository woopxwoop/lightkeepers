<script lang="ts">
  import type { Snippet } from "svelte";

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

<div class="empty-state text-center {className}">
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
</div>

<style>
  .empty-state {
    background: var(--surface-raised);
    /* Cream hairline on mid — never washed gold (--border-default). */
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-radius: var(--radius-lg);
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
