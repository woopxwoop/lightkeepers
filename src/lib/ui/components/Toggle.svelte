<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    pressed = $bindable(false),
    class: className = "",
    "aria-label": ariaLabel = "Toggle",
    onclick,
    ...rest
  }: {
    pressed?: boolean;
    class?: string;
    "aria-label"?: string;
  } & Omit<
    HTMLButtonAttributes,
    "children" | "class" | "aria-label" | "aria-pressed" | "type"
  > = $props();

  function handleClick(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
    pressed = !pressed;
    onclick?.(e);
  }
</script>

<button
  type="button"
  class="toggle {className}"
  class:is-on={pressed}
  aria-pressed={pressed}
  aria-label={ariaLabel}
  onclick={handleClick}
  {...rest}
>
  <span></span>
</button>

<style>
  .toggle {
    width: 2.75rem;
    height: 1.5rem;
    border-radius: var(--radius-pill);
    border: var(--border-width) solid var(--border-control-quiet);
    background: color-mix(in srgb, var(--foreground-mid) 12%, transparent);
    padding: 0.15rem;
    display: flex;
    align-items: center;
    transition:
      background-color 180ms var(--control-ease),
      border-color 180ms var(--control-ease),
      opacity 180ms var(--control-ease);
  }

  .toggle:hover:not(:disabled):not(.is-on) {
    border-color: color-mix(in srgb, var(--foreground-color) 40%, transparent);
    background: color-mix(in srgb, var(--foreground-mid) 18%, transparent);
  }

  .toggle:hover:not(:disabled).is-on {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }

  .toggle:active:not(:disabled):not(.is-on) {
    background: color-mix(in srgb, var(--foreground-mid) 22%, transparent);
  }

  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle span {
    width: 1.05rem;
    height: 1.05rem;
    border-radius: var(--radius-pill);
    background: var(--foreground-mid);
    transition:
      transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
      background-color 180ms var(--control-ease);
  }

  /* Solid accent track — no translucent gold wash over blue mid */
  .toggle.is-on {
    background: var(--accent-1);
    border-color: var(--accent-1);
  }

  .toggle.is-on span {
    transform: translateX(1.15rem);
    background: var(--control-knob-on);
  }
</style>
