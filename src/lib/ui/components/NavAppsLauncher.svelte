<script lang="ts" module>
  import type { Component } from "svelte";

  export type NavAppItem = {
    id: string;
    label: string;
    icon: Component<{ size?: number }>;
    onclick: () => void;
  };
</script>

<script lang="ts">
  import { tick } from "svelte";
  import IconAppsGrid from "$lib/ui/icons/IconAppsGrid.svelte";

  let {
    items = [],
    class: className = "",
  }: {
    items?: NavAppItem[];
    class?: string;
  } = $props();

  const GAP = 8;
  const EDGE = 8;
  const menuId = $props.id();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);
  let focusOnOpen = false;

  function placeMenu() {
    const trigger = triggerEl;
    const menu = menuEl;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    menu.style.maxHeight = "";
    const menuRect = menu.getBoundingClientRect();
    const belowTop = rect.bottom + GAP;
    const belowSpace = Math.max(0, vh - EDGE - belowTop);
    const aboveSpace = Math.max(0, rect.top - GAP - EDGE);

    let top = belowTop;
    if (menuRect.height <= belowSpace) {
      // Prefer below the trigger.
    } else if (menuRect.height <= aboveSpace) {
      top = rect.top - menuRect.height - GAP;
    } else if (aboveSpace > belowSpace) {
      top = EDGE;
      menu.style.maxHeight = `${aboveSpace}px`;
    } else {
      menu.style.maxHeight = `${belowSpace}px`;
    }

    const constrainedRect = menu.getBoundingClientRect();
    let left = rect.right - constrainedRect.width;
    const maxLeft = Math.max(EDGE, vw - constrainedRect.width - EDGE);
    left = Math.max(EDGE, Math.min(left, maxLeft));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  function toggle(event: MouseEvent) {
    focusOnOpen = !open && event.detail === 0;
    open = !open;
  }

  function close() {
    open = false;
  }

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
      if (focusOnOpen) {
        focusOnOpen = false;
        menuEl
          ?.querySelector<HTMLElement>('[role="menuitem"]')
          ?.focus();
      }
      requestAnimationFrame(placeMenu);
    });

    function ownsFocus() {
      const active = document.activeElement;
      if (!active || active === document.body) return true;
      return !!(triggerEl?.contains(active) || menuEl?.contains(active));
    }

    function onKeydown(e: KeyboardEvent) {
      if (!ownsFocus()) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        void tick().then(() => triggerEl?.focus());
        return;
      }

      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
        return;

      const options = [
        ...(menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
      ];
      if (options.length === 0) return;

      e.preventDefault();
      const cols = 3;
      const current = options.indexOf(document.activeElement as HTMLElement);
      let next = current < 0 ? 0 : current;
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = options.length - 1;
      else if (e.key === "ArrowRight")
        next = Math.min(current + 1, options.length - 1);
      else if (e.key === "ArrowLeft") next = Math.max(current - 1, 0);
      else if (e.key === "ArrowDown")
        next = Math.min(current + cols, options.length - 1);
      else next = Math.max(current - cols, 0);
      options[next]?.focus();
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerEl?.contains(target) || menuEl?.contains(target)) return;
      close();
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

<div class="nav-apps {className}">
  <button
    type="button"
    class="nav-apps-trigger"
    class:open
    bind:this={triggerEl}
    aria-label="Apps"
    aria-expanded={open}
    aria-haspopup="menu"
    aria-controls={menuId}
    onclick={toggle}
  >
    <IconAppsGrid size={18} />
  </button>
  {#if open}
    <div
      id={menuId}
      class="nav-apps-panel"
      role="menu"
      aria-label="Apps"
      tabindex="-1"
      use:portal
      bind:this={menuEl}
    >
      <div class="nav-apps-grid">
        {#each items as item (item.id)}
          <button
            type="button"
            class="nav-apps-tile"
            role="menuitem"
            onclick={() => {
              close();
              item.onclick();
            }}
          >
            <span class="nav-apps-icon">
              <item.icon size={28} />
            </span>
            <span class="nav-apps-label">{item.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .nav-apps {
    position: relative;
    display: inline-flex;
    pointer-events: auto;
  }

  .nav-apps-trigger {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--foreground-mid);
    cursor: pointer;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
  }

  .nav-apps-trigger:hover,
  .nav-apps-trigger.open {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .nav-apps-panel {
    position: fixed;
    z-index: 200;
    box-sizing: border-box;
    overflow-y: auto;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .nav-apps-grid {
    display: grid;
    grid-template-columns: repeat(3, 4.75rem);
    gap: 0.35rem;
  }

  .nav-apps-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.65rem 0.35rem 0.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    text-align: center;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
  }

  .nav-apps-tile:hover,
  .nav-apps-tile:focus-visible {
    color: var(--foreground-color);
    background: var(--surface-quiet);
    outline: none;
  }

  .nav-apps-icon {
    display: grid;
    place-items: center;
    color: var(--foreground-color);
  }

  .nav-apps-label {
    font-size: var(--text-xs);
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
