<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    variant = "default",
    flush = false,
    class: className = "",
    children,
    ...rest
  }: {
    variant?: "default" | "interactive" | "inset" | "empty";
    /** Drop default padding (e.g. media headers that manage their own). */
    flush?: boolean;
    class?: string;
    children?: Snippet;
  } & Omit<HTMLAttributes<HTMLDivElement>, "children" | "class"> = $props();
</script>

<div
  class="surface surface-{variant} {className}"
  class:surface-flush={flush}
  {...rest}
>
  {@render children?.()}
</div>

<style>
  .surface {
    background: var(--surface-raised);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .surface-flush {
    padding: 0;
  }

  .surface-interactive {
    transition: border-color var(--control-duration) var(--control-ease);
  }

  .surface-interactive:hover {
    border-color: var(--border-strong);
  }

  .surface-inset {
    background: var(--surface-inset);
  }

  .surface-empty {
    border-style: dashed;
    opacity: 0.85;
  }
</style>
