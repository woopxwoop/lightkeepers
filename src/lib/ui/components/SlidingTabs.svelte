<script lang="ts" generics="T extends string">
  import {
    handleKeyboardClick,
    handlePointerAction,
  } from "$lib/ui/pointer";

  type Option = { value: T; label: string };

  let {
    options,
    value = $bindable(),
    accent = "var(--accent-1)",
    class: className = "",
    "aria-label": ariaLabel = "Tabs",
  }: {
    options: readonly Option[];
    value: T;
    /** Indicator / wash color (slot accent, element color, etc.). */
    accent?: string;
    class?: string;
    "aria-label"?: string;
  } = $props();

  let activeIndex = $derived(
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  let count = $derived(Math.max(options.length, 1));
  let left = $derived(`calc((100% / ${count}) * ${activeIndex})`);
  let width = $derived(`calc(100% / ${count})`);

  function selectIndex(index: number) {
    const next = options[index];
    if (next) value = next.value;
  }

  function onTabKeydown(event: KeyboardEvent, index: number) {
    let next = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % options.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + options.length) % options.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectIndex(next);
    const buttons = (event.currentTarget as HTMLElement)
      .parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }
</script>

<div
  role="tablist"
  aria-label={ariaLabel}
  class="sliding-tabs relative flex overflow-hidden {className}"
  style="--tab-accent: {accent};"
>
  <span
    class="indicator-fill absolute inset-y-0 pointer-events-none"
    style="left: {left}; width: {width}; background: color-mix(in srgb, var(--tab-accent) 10%, var(--background-mid));"
  ></span>
  <span
    class="indicator-bar absolute bottom-0 h-[1.5px] pointer-events-none"
    style="left: {left}; width: {width}; background: var(--tab-accent);"
  ></span>
  {#each options as option, index (option.value)}
    <button
      type="button"
      role="tab"
      id="tab-{option.value}"
      aria-selected={value === option.value}
      tabindex={value === option.value ? 0 : -1}
      onpointerdown={(event) =>
        handlePointerAction(event, () => (value = option.value))}
      onclick={(event) =>
        handleKeyboardClick(event, () => (value = option.value))}
      onkeydown={(event) => onTabKeydown(event, index)}
      class="tab relative z-1 flex-1 py-2.5 text-xs font-medium pointer-events-auto touch-manipulation"
      class:tab-active={value === option.value}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .sliding-tabs {
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    border: var(--border-width) solid var(--border-default);
  }

  .indicator-fill,
  .indicator-bar {
    transition:
      left 150ms ease,
      background-color 150ms ease;
  }

  .tab {
    color: var(--foreground-mid);
    transition: color var(--control-duration) var(--control-ease);
  }

  .tab-active {
    color: var(--tab-accent, var(--foreground-color));
  }
</style>
