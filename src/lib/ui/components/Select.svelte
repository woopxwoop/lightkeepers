<script lang="ts" module>
  export type SelectOption<T extends string = string> = {
    value: T;
    label: string;
  };
</script>

<script lang="ts" generics="Value extends string = string">
  import { tick } from "svelte";
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

  const GAP = 6;
  const EDGE = 8;
  const listboxId = $props.id();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);

  let selected = $derived(
    options.find((o) => o.value === value) ?? options[0] ?? null,
  );
  let triggerText = $derived(trigger ?? selected?.label ?? "Select");

  /** Viewport-fixed placement so overflow:hidden boards can't clip the menu. */
  function placeMenu() {
    const trigger = triggerEl;
    const menu = menuEl;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const alignRight = rect.left + rect.width / 2 >= vw / 2;

    let top = rect.bottom + GAP;
    if (top + menuRect.height > vh - EDGE) {
      const above = rect.top - menuRect.height - GAP;
      if (above >= EDGE) top = above;
    }

    let left = alignRight ? rect.right - menuRect.width : rect.left;
    left = Math.max(EDGE, Math.min(left, vw - menuRect.width - EDGE));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.minWidth = `${Math.max(rect.width, 10 * 16)}px`;
  }

  function toggle() {
    open = !open;
  }

  function choose(next: Value) {
    value = next;
    open = false;
  }

  /** Mount the listbox under `body` so fixed coords stay viewport-relative. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  $effect(() => {
    if (!open) return;

    void tick().then(() => {
      placeMenu();
      requestAnimationFrame(placeMenu);
    });

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") open = false;
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerEl?.contains(target) || menuEl?.contains(target)) return;
      open = false;
    }
    function reposition() {
      placeMenu();
    }

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  });
</script>

<div class="select {className}">
  <button
    type="button"
    class="select-trigger"
    class:open
    bind:this={triggerEl}
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={listboxId}
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
      id={listboxId}
      class="select-menu"
      role="listbox"
      use:portal
      bind:this={menuEl}
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
    position: fixed;
    z-index: 200;
    min-width: 10rem;
    padding: 0.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
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
