<script lang="ts">
  import { tick } from "svelte";
  import type { Snippet } from "svelte";

  let {
    label,
    children,
    class: className = "",
    align = "center",
  }: {
    /** Inline trigger text — underlined to signal it explains itself. */
    label: string;
    children: Snippet;
    class?: string;
    /** Horizontal anchor of the panel relative to the trigger. */
    align?: "start" | "center" | "end";
  } = $props();

  const EDGE = 8;
  const GAP = 8;
  const panelId = $props.id();

  let open = $state(false);
  let rootEl: HTMLSpanElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();
  let panelEl: HTMLSpanElement | undefined = $state();

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  /** Viewport-fixed placement so overflow:hidden boards can't clip the panel. */
  function placePanel() {
    const trigger = triggerEl;
    const panel = panelEl;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    panel.style.maxWidth = `${Math.max(0, vw - EDGE * 2)}px`;
    panel.style.maxHeight = "";

    const panelRect = panel.getBoundingClientRect();
    const aboveTop = rect.top - panelRect.height - GAP;
    const belowTop = rect.bottom + GAP;
    const aboveFits = aboveTop >= EDGE;
    const belowFits = belowTop + panelRect.height <= vh - EDGE;

    let top = aboveFits
      ? aboveTop
      : belowFits
        ? belowTop
        : Math.max(EDGE, Math.min(belowTop, vh - panelRect.height - EDGE));

    if (panelRect.height > vh - EDGE * 2) {
      panel.style.maxHeight = `${vh - EDGE * 2}px`;
      top = EDGE;
    }

    const placed = panel.getBoundingClientRect();
    let left =
      align === "start"
        ? rect.left
        : align === "end"
          ? rect.right - placed.width
          : rect.left + rect.width / 2 - placed.width / 2;
    left = Math.max(EDGE, Math.min(left, vw - placed.width - EDGE));

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
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

    void tick().then(() => placePanel());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootEl?.contains(target)) return;
      if (target && panelEl?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (target && rootEl?.contains(target)) return;
      if (target && panelEl?.contains(target)) return;
      close();
    };
    const reposition = () => placePanel();

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  });
</script>

<span class="info-popover {className}" bind:this={rootEl}>
  <button
    type="button"
    class="info-trigger"
    bind:this={triggerEl}
    aria-expanded={open}
    aria-controls={panelId}
    aria-describedby={open ? panelId : undefined}
    onclick={toggle}
  >
    {label}
  </button>

  {#if open}
    <span
      id={panelId}
      class="info-panel"
      role="tooltip"
      tabindex="0"
      data-open="true"
      bind:this={panelEl}
      use:portal
    >
      {@render children()}
    </span>
  {/if}
</span>

<style>
  .info-popover {
    position: relative;
    display: inline-flex;
  }

  .info-trigger {
    font: inherit;
    color: inherit;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 0.15em;
    transition: var(--control-transition);
  }

  .info-trigger:hover,
  .info-trigger[aria-expanded="true"] {
    color: var(--foreground-color);
  }

  .info-panel {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50;
    display: block;
    width: max-content;
    max-width: min(16rem, calc(100vw - 2rem));
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius-md);
    /* Fixed px so the panel keeps its own scale inside small meta text. */
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: normal;
    text-transform: none;
    text-align: left;
    overflow: auto;
    background: var(--foreground-mid);
    color: var(--background-color);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
</style>
