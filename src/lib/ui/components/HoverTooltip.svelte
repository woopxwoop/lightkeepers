<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
    /** Accessible name for the detail sheet. */
    label = "Details",
  }: {
    children: Snippet;
    class?: string;
    label?: string;
  } = $props();

  const EDGE = 8;
  const GAP = 8;

  let tipEl: HTMLDivElement | undefined = $state();
  let sheetRootEl: HTMLDivElement | undefined = $state();
  let sheetEl: HTMLDivElement | undefined = $state();
  let open = $state(false);
  let detailOpen = $state(false);
  let truncated = $state(false);

  /** Prefer above the trigger; flip below / clamp horizontally if needed. */
  function place(trigger: HTMLElement) {
    const tip = tipEl;
    if (!tip) return;

    const t = trigger.getBoundingClientRect();
    const r = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = t.top - r.height - GAP;
    if (top < EDGE) {
      top = t.bottom + GAP;
      if (top + r.height > vh - EDGE) {
        top = Math.max(EDGE, Math.min(top, vh - r.height - EDGE));
      }
    }

    let left = t.left + t.width / 2 - r.width / 2;
    left = Math.max(EDGE, Math.min(left, vw - r.width - EDGE));

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }

  function measureTruncation() {
    const tip = tipEl;
    if (!tip) return;
    truncated = tip.scrollHeight > tip.clientHeight + 2;
  }

  function showTip(trigger: HTMLElement) {
    if (detailOpen) return;
    open = true;
    requestAnimationFrame(() => {
      place(trigger);
      measureTruncation();
      // Truncation adds a footer; re-place once layout settles.
      if (truncated) requestAnimationFrame(() => place(trigger));
    });
  }

  function hideTip() {
    open = false;
  }

  async function openDetail(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    open = false;
    detailOpen = true;
    await tick();
    if (sheetRootEl && sheetRootEl.parentElement !== document.body) {
      document.body.appendChild(sheetRootEl);
    }
    sheetEl?.focus();
  }

  function closeDetail() {
    detailOpen = false;
  }

  onMount(() => {
    const tip = tipEl;
    if (!tip) return;

    // Capture before reparenting — parent is the hover trigger (must have `.group`).
    const trigger = tip.parentElement;
    if (!trigger) return;

    // Portal to body so `position: fixed` is viewport-relative. Transformed
    // ancestors (e.g. TeamCardHand fan cards) otherwise become the containing
    // block and viewport coords from getBoundingClientRect land in the wrong place.
    document.body.appendChild(tip);

    const onEnter = () => showTip(trigger);
    const onLeave = () => hideTip();
    const onClick = (event: Event) => {
      void openDetail(event);
    };
    const reposition = () => {
      if (open) place(trigger);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailOpen) {
        event.stopPropagation();
        closeDetail();
      }
    };

    trigger.addEventListener("pointerenter", onEnter);
    trigger.addEventListener("pointerleave", onLeave);
    trigger.addEventListener("focusin", onEnter);
    trigger.addEventListener("focusout", onLeave);
    trigger.addEventListener("click", onClick);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);

    return () => {
      trigger.removeEventListener("pointerenter", onEnter);
      trigger.removeEventListener("pointerleave", onLeave);
      trigger.removeEventListener("focusin", onEnter);
      trigger.removeEventListener("focusout", onLeave);
      trigger.removeEventListener("click", onClick);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
      tip.remove();
      sheetRootEl?.remove();
    };
  });

  $effect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  });
</script>

<!--
  Parent must have Tailwind `group`. Tip portals to document.body so fixed
  positioning survives transformed ancestors. Click / tap opens a detail sheet.
-->
<div
  bind:this={tipEl}
  class="hover-tooltip pointer-events-none fixed z-50 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-left {className}"
  class:hover-tooltip-open={open && !detailOpen}
  class:hover-tooltip-truncated={truncated}
  style="top: 0; left: 0; background: var(--foreground-mid); color: var(--background-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
  role="tooltip"
>
  {#if !detailOpen}
    <div class="hover-tooltip-body">
      {@render children()}
    </div>
    {#if truncated}
      <div class="hover-tooltip-fade" aria-hidden="true"></div>
      <div class="hover-tooltip-more">Tap for full text</div>
    {/if}
  {/if}
</div>

{#if detailOpen}
  <div class="tip-sheet-root" bind:this={sheetRootEl}>
    <button
      type="button"
      class="tip-sheet-backdrop"
      aria-label="Close details"
      onclick={closeDetail}
    ></button>
    <div
      bind:this={sheetEl}
      class="tip-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabindex="-1"
    >
      <div class="tip-sheet-body">
        {@render children()}
      </div>
      <button type="button" class="tip-sheet-close" onclick={closeDetail}>
        Close
      </button>
    </div>
  </div>
{/if}

<style>
  .hover-tooltip {
    white-space: normal;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    opacity: 0;
    visibility: hidden;
    max-height: min(11rem, 40dvh);
    overflow: hidden;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
  }

  .hover-tooltip-open {
    opacity: 1;
    visibility: visible;
  }

  .hover-tooltip-body {
    display: block;
  }

  .hover-tooltip-truncated {
    padding-bottom: 1.35rem;
  }

  .hover-tooltip-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2.75rem;
    pointer-events: none;
    background: linear-gradient(
      to top,
      var(--foreground-mid) 35%,
      transparent
    );
  }

  .hover-tooltip-more {
    position: absolute;
    left: 0.65rem;
    right: 0.65rem;
    bottom: 0.35rem;
    z-index: 1;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--background-color) 72%, transparent);
  }

  .tip-sheet-root {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: end center;
    padding: 0.75rem;
  }

  .tip-sheet-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    cursor: pointer;
    background: color-mix(in srgb, black 55%, transparent);
    backdrop-filter: blur(2px);
  }

  .tip-sheet {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    width: min(24rem, 100%);
    max-height: min(70dvh, 32rem);
    padding: 1rem 1rem 0.85rem;
    border-radius: var(--radius-lg);
    background: var(--foreground-mid);
    color: var(--background-color);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  }

  .tip-sheet-body {
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    flex: 1 1 auto;
  }

  /* Readable sizes in the sheet regardless of tip utility classes. */
  .tip-sheet-body :global(.text-xs),
  .tip-sheet-body :global(.text-sm) {
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .tip-sheet-body :global(.text-\[0\.65rem\]) {
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .tip-sheet-close {
    align-self: flex-end;
    flex-shrink: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--background-color);
    background: color-mix(in srgb, var(--background-color) 10%, transparent);
    border: 0.5px solid
      color-mix(in srgb, var(--background-color) 22%, transparent);
    border-radius: var(--radius-md);
    padding: 0.4rem 0.7rem;
  }

  .tip-sheet-close:hover {
    background: color-mix(in srgb, var(--background-color) 16%, transparent);
  }

  @media (min-width: 640px) {
    .tip-sheet-root {
      place-items: center;
      padding: 1.25rem;
    }
  }
</style>
