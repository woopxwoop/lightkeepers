<script lang="ts" module>
  export type ActionMenuItem = {
    id: string;
    label: string;
    href?: string;
    onclick?: () => void;
  };
</script>

<script lang="ts">
  import { tick } from "svelte";
  import IconEllipsis from "$lib/ui/icons/IconEllipsis.svelte";

  let {
    label,
    items = [],
    class: className = "",
    align = "end",
  }: {
    /** Accessible name for the overflow trigger. */
    label: string;
    items?: ActionMenuItem[];
    class?: string;
    /** Horizontal anchor of the menu relative to the trigger. */
    align?: "start" | "end";
  } = $props();

  const GAP = 6;
  const EDGE = 8;
  const menuId = $props.id();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);
  let focusOnOpen = false;
  let focusLastOnOpen = false;

  /** Viewport-fixed placement so overflow:hidden surfaces can't clip the menu. */
  function placeMenu() {
    const trigger = triggerEl;
    const menu = menuEl;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availableWidth = Math.max(0, vw - EDGE * 2);

    menu.style.minWidth = `${Math.min(Math.max(rect.width, 10 * 16), availableWidth)}px`;
    menu.style.maxWidth = `${availableWidth}px`;
    menu.style.maxHeight = "";

    const menuRect = menu.getBoundingClientRect();
    const belowTop = rect.bottom + GAP;
    const belowSpace = Math.max(0, vh - EDGE - belowTop);
    const aboveSpace = Math.max(0, rect.top - GAP - EDGE);

    let top = belowTop;
    if (menuRect.height <= belowSpace) {
      // Keep the preferred below-trigger placement.
    } else if (menuRect.height <= aboveSpace) {
      top = rect.top - menuRect.height - GAP;
    } else if (aboveSpace > belowSpace) {
      top = EDGE;
      menu.style.maxHeight = `${aboveSpace}px`;
    } else {
      menu.style.maxHeight = `${belowSpace}px`;
    }

    const constrainedRect = menu.getBoundingClientRect();
    let left = align === "end" ? rect.right - constrainedRect.width : rect.left;
    const horizontalEdge = vw >= EDGE * 2 ? EDGE : 0;
    const maxLeft = Math.max(
      horizontalEdge,
      vw - constrainedRect.width - horizontalEdge,
    );
    left = Math.max(horizontalEdge, Math.min(left, maxLeft));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  function toggle(event: MouseEvent) {
    focusOnOpen = !open && event.detail === 0;
    open = !open;
  }

  function openFromKeyboard(event: KeyboardEvent) {
    if (!open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      focusOnOpen = true;
      focusLastOnOpen = event.key === "ArrowUp" || event.key === "End";
      open = true;
    }
  }

  function close() {
    open = false;
  }

  /** Mount under body so fixed coords stay viewport-relative. */
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
        const items =
          menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        const target = focusLastOnOpen ? items?.[items.length - 1] : items?.[0];
        focusLastOnOpen = false;
        target?.focus();
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

      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const options = [
        ...(menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
      ];
      if (options.length === 0) return;

      e.preventDefault();
      const current = options.indexOf(document.activeElement as HTMLElement);
      let next = current;
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = options.length - 1;
      else if (e.key === "ArrowDown")
        next = Math.min(current + 1, options.length - 1);
      else next = current < 0 ? options.length - 1 : Math.max(current - 1, 0);
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

<div class="action-menu {className}">
  <button
    type="button"
    class="action-trigger"
    class:open
    bind:this={triggerEl}
    aria-label={label}
    aria-expanded={open}
    aria-haspopup="menu"
    aria-controls={menuId}
    onkeydown={openFromKeyboard}
    onclick={toggle}
  >
    <IconEllipsis size={16} />
  </button>
  {#if open}
    <div
      id={menuId}
      class="action-panel"
      role="menu"
      aria-label={label}
      tabindex="-1"
      use:portal
      bind:this={menuEl}
    >
      {#each items as item (item.id)}
        {#if item.href}
          <a
            class="action-item"
            role="menuitem"
            href={item.href}
            onclick={close}
          >
            {item.label}
          </a>
        {:else}
          <button
            type="button"
            class="action-item"
            role="menuitem"
            onclick={() => {
              close();
              triggerEl?.focus();
              item.onclick?.();
            }}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .action-menu {
    position: relative;
    display: inline-flex;
  }

  .action-trigger {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    color: var(--foreground-color);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .action-trigger:hover,
  .action-trigger.open {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.4);
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
  }

  .action-panel {
    position: fixed;
    z-index: 200;
    min-width: 10rem;
    box-sizing: border-box;
    overflow-y: auto;
    padding: 0.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .action-item {
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
    text-decoration: none;
    transition: var(--control-transition);
  }

  .action-item:hover,
  .action-item:focus-visible {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }
</style>
