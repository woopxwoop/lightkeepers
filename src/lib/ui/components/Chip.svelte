<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    active = false,
    class: className = "",
    children,
    type = "button",
    ...rest
  }: {
    active?: boolean;
    class?: string;
    children?: Snippet;
    type?: "button" | "submit" | "reset";
  } & Omit<HTMLButtonAttributes, "children" | "class" | "type"> = $props();
</script>

<button
  class="chip {className}"
  class:chip-active={active}
  {type}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .chip {
    font-size: var(--text-xs);
    padding: 0.2rem 0.55rem;
    border-radius: var(--radius-pill);
    border: var(--border-width) solid
      color-mix(in srgb, var(--accent-1) 25%, transparent);
    color: var(--foreground-mid);
    background: transparent;
    transition: var(--control-transition);
  }

  .chip-active {
    color: var(--accent-1);
    border-color: color-mix(in srgb, var(--accent-1) 55%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }
</style>
