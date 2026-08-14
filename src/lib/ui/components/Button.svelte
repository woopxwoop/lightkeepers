<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Variant = "primary" | "secondary" | "ghost" | "icon";

  let {
    variant = "secondary",
    class: className = "",
    children,
    type = "button",
    ...rest
  }: {
    variant?: Variant;
    class?: string;
    children?: Snippet;
    type?: "button" | "submit" | "reset";
  } & Omit<HTMLButtonAttributes, "children" | "class" | "type"> = $props();
</script>

<button class="btn btn-{variant} {className}" {type} {...rest}>
  {@render children?.()}
</button>

<style>
  .btn {
    font-size: var(--text-sm);
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    padding: 0.35rem 0.7rem;
    transition: var(--control-transition);
  }

  .btn-primary {
    color: var(--control-knob-on);
    background: var(--accent-1);
    border-color: var(--accent-1);
    font-weight: 600;
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .btn-secondary:hover {
    background: color-mix(in srgb, var(--foreground-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--foreground-color) 32%, transparent);
  }

  .btn-ghost,
  .btn-icon {
    background: transparent;
    color: var(--foreground-mid);
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-ghost:hover,
  .btn-icon:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 32%, transparent);
    background: var(--surface-quiet);
  }

  .btn-icon {
    padding: 0.4rem;
  }
</style>
