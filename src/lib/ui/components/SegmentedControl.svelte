<script lang="ts" generics="T extends string">
  import {
    handleKeyboardClick,
    handlePointerAction,
  } from "$lib/ui/pointer";

  type Option = { value: T; label: string };

  let {
    options,
    value = $bindable(),
    class: className = "",
    "aria-label": ariaLabel = "Options",
  }: {
    options: readonly Option[];
    value: T;
    class?: string;
    "aria-label"?: string;
  } = $props();
</script>

<div class="segmented {className}" role="radiogroup" aria-label={ariaLabel}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      class="segment"
      class:segment-active={value === option.value}
      aria-checked={value === option.value}
      onpointerdown={(event) =>
        handlePointerAction(event, () => (value = option.value))}
      onclick={(event) =>
        handleKeyboardClick(event, () => (value = option.value))}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: var(--border-width) solid var(--border-default);
  }

  .segment {
    padding: 0.35rem 0.75rem;
    font-size: var(--text-sm);
    text-transform: capitalize;
    background: var(--surface-raised);
    color: var(--foreground-mid);
    transition: var(--control-transition);
    touch-action: manipulation;
  }

  .segment-active {
    background: var(--surface-selected);
    color: var(--accent-1);
  }
</style>
