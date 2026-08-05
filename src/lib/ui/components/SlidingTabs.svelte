<script lang="ts" generics="T extends string">
  import { onMount } from "svelte";
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
    maxVisible,
    mobileMaxVisible,
    "aria-label": ariaLabel = "Tabs",
  }: {
    options: readonly Option[];
    value: T;
    /** Indicator / wash color (slot accent, element color, etc.). */
    accent?: string;
    class?: string;
    /** Collapse excess options into a "More" select. */
    maxVisible?: number;
    /** Mobile override for the total number of direct tabs + "More". */
    mobileMaxVisible?: number;
    "aria-label"?: string;
  } = $props();

  let isMobile = $state(false);

  onMount(() => {
    if (mobileMaxVisible === undefined) return;
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => (isMobile = media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  });

  let effectiveMaxVisible = $derived(
    isMobile && mobileMaxVisible !== undefined
      ? mobileMaxVisible
      : maxVisible,
  );
  let shouldCollapse = $derived(
    effectiveMaxVisible !== undefined &&
      effectiveMaxVisible >= 2 &&
      options.length > effectiveMaxVisible,
  );
  let directCount = $derived(
    shouldCollapse && effectiveMaxVisible !== undefined
      ? effectiveMaxVisible - 1
      : options.length,
  );
  let directOptions = $derived(
    shouldCollapse ? options.slice(0, directCount) : options,
  );
  let overflowOptions = $derived(
    shouldCollapse ? options.slice(directCount) : [],
  );
  let overflowActive = $derived(
    overflowOptions.some((option) => option.value === value),
  );
  let activeIndex = $derived(
    overflowActive
      ? directOptions.length
      : Math.max(
          0,
          directOptions.findIndex((o) => o.value === value),
        ),
  );
  let count = $derived(
    Math.max(directOptions.length + (shouldCollapse ? 1 : 0), 1),
  );
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
    const controls = (event.currentTarget as HTMLElement)
      .parentElement
      ?.querySelectorAll<HTMLElement>('button[role="tab"], select');
    const nextOption = options[next];
    const focusIndex =
      nextOption &&
      overflowOptions.some((option) => option.value === nextOption.value)
        ? directOptions.length
        : next;
    controls?.[focusIndex]?.focus();
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
  {#each directOptions as option, index (option.value)}
    <button
      type="button"
      role="tab"
      id="tab-{option.value}"
      aria-controls="tabpanel-{option.value}"
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
  {#if shouldCollapse}
    <label
      class="more-tab tab relative z-1 flex-1 pointer-events-auto"
      class:tab-active={overflowActive}
    >
      <span class="sr-only">More tabs</span>
      <select
        id={overflowActive ? `tab-${value}` : "tab-more"}
        aria-label="More tabs"
        aria-controls={overflowActive ? `tabpanel-${value}` : undefined}
        value={overflowActive ? value : ""}
        onchange={(event) => {
          const next = event.currentTarget.value as T;
          if (next) value = next;
        }}
      >
        <option value="" disabled>More</option>
        {#each overflowOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <span class="more-chevron" aria-hidden="true">⌄</span>
    </label>
  {/if}
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

  .more-tab {
    min-width: 0;
  }

  .more-tab select {
    width: 100%;
    height: 100%;
    padding: 0.625rem 1.25rem 0.625rem 0.5rem;
    border: 0;
    outline: 0;
    appearance: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: pointer;
  }

  .more-chevron {
    position: absolute;
    top: 50%;
    right: 0.55rem;
    translate: 0 -55%;
    color: currentColor;
    pointer-events: none;
  }
</style>
