<script lang="ts" module>
  export type SelectOption<T extends string = string> = {
    value: T;
    label: string;
  };
</script>

<script lang="ts" generics="Value extends string = string">
  import { slide } from "svelte/transition";
  import type { HTMLAttributes } from "svelte/elements";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";

  let {
    value = $bindable("" as Value),
    options = [],
    /** Fixed trigger text (e.g. "Sort"). Defaults to the selected option label. */
    trigger,
    class: className = "",
    ...rest
  }: {
    value?: Value;
    options?: SelectOption<Value>[];
    trigger?: string;
    class?: string;
  } & Omit<
    HTMLAttributes<HTMLButtonElement>,
    "class" | "children" | "type" | "onclick"
  > = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement | null = $state(null);
  /** Menu anchors to the side of the viewport the trigger sits on. */
  let menuAlign = $state<"left" | "right">("left");

  let selected = $derived(
    options.find((o) => o.value === value) ?? options[0] ?? null,
  );
  let triggerText = $derived(trigger ?? selected?.label ?? "Select");

  function resolveAlign() {
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const mid = window.innerWidth / 2;
    menuAlign = rect.left + rect.width / 2 >= mid ? "right" : "left";
  }

  function toggle() {
    if (!open) resolveAlign();
    open = !open;
  }

  $effect(() => {
    if (!open) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") open = false;
    }
    function onClick(e: MouseEvent) {
      if (rootEl && !rootEl.contains(e.target as Node)) open = false;
    }
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("click", onClick);
    };
  });

  function choose(next: Value) {
    value = next;
    open = false;
  }
</script>

<div class="select {className}" bind:this={rootEl}>
  <button
    type="button"
    class="select-trigger"
    class:open
    aria-expanded={open}
    aria-haspopup="listbox"
    onclick={toggle}
    {...rest}
  >
    {triggerText}
    <span class="chevron" class:open>
      <IconChevronDown size={10} strokeWidth={2.5} />
    </span>
  </button>
  {#if open}
    <div
      class="select-menu"
      class:align-right={menuAlign === "right"}
      role="listbox"
      transition:slide={{ duration: 150 }}
    >
      {#each options as opt (opt.value)}
        <button
          type="button"
          role="option"
          aria-selected={value === opt.value}
          class="select-option"
          class:selected={value === opt.value}
          onclick={() => choose(opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select {
    position: relative;
    display: inline-flex;
  }

  .select-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .select-trigger:hover,
  .select-trigger.open {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.32);
    background: var(--surface-quiet);
  }

  .chevron {
    display: inline-flex;
    transition: transform 150ms ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .select-menu {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 40;
    min-width: max(100%, 10rem);
    padding: 0.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .select-menu.align-right {
    left: auto;
    right: 0;
  }

  .select-option {
    display: block;
    width: 100%;
    padding: 0.45rem 0.65rem;
    text-align: left;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .select-option:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .select-option.selected {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }
</style>
