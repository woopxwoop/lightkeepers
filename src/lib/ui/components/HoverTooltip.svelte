<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Snippet } from "svelte";
  import IconX from "../icons/IconX.svelte";

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
  const LEAVE_DELAY_MS = 120;
  const tooltipId = $props.id();

  let tipEl: HTMLDivElement | undefined = $state();
  let sheetRootEl: HTMLDivElement | undefined = $state();
  let sheetEl: HTMLDivElement | undefined = $state();
  let tipTriggerEl: HTMLElement | null = null;
  let activeTriggerEl: HTMLElement | null = null;
  let open = $state(false);
  let detailOpen = $state(false);
  let tipScrollable = $state(false);

  let triggerHovered = false;
  let tipHovered = false;
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;

  function clearLeaveTimer() {
    if (leaveTimer == null) return;
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }

  function scheduleHide() {
    clearLeaveTimer();
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      if (!triggerHovered && !tipHovered) hideTip();
    }, LEAVE_DELAY_MS);
  }

  function updateTriggerDescription(trigger: HTMLElement | null, add: boolean) {
    if (!trigger) return;

    const describedBy = new Set(
      (trigger.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(Boolean),
    );

    if (add) {
      describedBy.add(tooltipId);
    } else {
      describedBy.delete(tooltipId);
    }

    if (!describedBy.size) {
      trigger.removeAttribute("aria-describedby");
      return;
    }

    trigger.setAttribute("aria-describedby", [...describedBy].join(" "));
  }

  function getFocusableElements(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
  }

  function focusInitialDetailElement() {
    const sheet = sheetEl;
    if (!sheet) return;

    const focusableElements = getFocusableElements(sheet);
    (focusableElements[0] ?? sheet).focus();
  }

  function trapDetailFocus(event: KeyboardEvent) {
    if (!detailOpen || event.key !== "Tab") return;

    const sheet = sheetEl;
    if (!sheet) return;

    const focusableElements = getFocusableElements(sheet);
    if (!focusableElements.length) {
      event.preventDefault();
      sheet.focus();
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = activeElement
      ? focusableElements.indexOf(activeElement)
      : -1;

    event.preventDefault();
    if (event.shiftKey) {
      focusableElements[
        currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
      ].focus();
      return;
    }

    focusableElements[
      currentIndex === -1 || currentIndex === focusableElements.length - 1
        ? 0
        : currentIndex + 1
    ].focus();
  }

  /** Prefer above the trigger; flip below / clamp to viewport if needed. */
  function place(trigger: HTMLElement) {
    const tip = tipEl;
    if (!tip) return;

    tip.style.maxHeight = "";
    tip.style.overflow = "";
    tipScrollable = false;

    const t = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxH = Math.max(0, vh - EDGE * 2);

    let r = tip.getBoundingClientRect();
    if (r.height > maxH) {
      tip.style.maxHeight = `${maxH}px`;
      tip.style.overflow = "auto";
      tipScrollable = true;
      r = tip.getBoundingClientRect();
    }

    const aboveTop = t.top - r.height - GAP;
    const belowTop = t.bottom + GAP;
    const aboveFits = aboveTop >= EDGE;
    const belowFits = belowTop + r.height <= vh - EDGE;

    let top = aboveFits
      ? aboveTop
      : belowFits
        ? belowTop
        : Math.max(EDGE, Math.min(belowTop, vh - r.height - EDGE));

    let left = t.left + t.width / 2 - r.width / 2;
    left = Math.max(EDGE, Math.min(left, vw - r.width - EDGE));

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }

  function showTip(trigger: HTMLElement) {
    if (detailOpen) return;
    tipTriggerEl = trigger;
    open = true;
    updateTriggerDescription(trigger, true);
    requestAnimationFrame(() => {
      place(trigger);
    });
  }

  function hideTip() {
    clearLeaveTimer();
    triggerHovered = false;
    tipHovered = false;
    tipScrollable = false;
    open = false;
    if (!detailOpen) updateTriggerDescription(tipTriggerEl, false);
    tipTriggerEl = null;
  }

  function isInteractiveDescendant(
    target: EventTarget | null,
    trigger: HTMLElement,
  ): boolean {
    if (!(target instanceof Element)) return false;
    const interactive = target.closest(
      'a[href], button, input, select, textarea, summary, [role="button"]',
    );
    return Boolean(
      interactive && interactive !== trigger && trigger.contains(interactive),
    );
  }

  async function openDetail(event: Event) {
    const trigger = event.currentTarget as HTMLElement;
    if (isInteractiveDescendant(event.target, trigger)) return;

    // Every tip opens its sheet on tap / click so touch users get the same
    // affordance everywhere.
    event.preventDefault();
    event.stopPropagation();
    clearLeaveTimer();
    tipTriggerEl = null;
    activeTriggerEl = trigger;
    triggerHovered = false;
    tipHovered = false;
    open = false;
    tipScrollable = false;
    updateTriggerDescription(trigger, false);
    detailOpen = true;
    await tick();
    if (sheetRootEl && sheetRootEl.parentElement !== document.body) {
      document.body.appendChild(sheetRootEl);
    }
    focusInitialDetailElement();
  }

  async function closeDetail() {
    const trigger = activeTriggerEl;
    detailOpen = false;
    await tick();
    trigger?.focus();
    activeTriggerEl = null;
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

    const onTriggerEnter = () => {
      triggerHovered = true;
      clearLeaveTimer();
      showTip(trigger);
    };
    const onTriggerLeave = () => {
      triggerHovered = false;
      scheduleHide();
    };
    const onTipEnter = () => {
      tipHovered = true;
      clearLeaveTimer();
    };
    const onTipLeave = () => {
      tipHovered = false;
      scheduleHide();
    };
    const onClick = (event: Event) => {
      void openDetail(event);
    };
    const reposition = () => {
      if (open) place(trigger);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!detailOpen || !sheetEl) return;

      const target = event.target as Node | null;
      if (target && sheetEl.contains(target)) return;

      focusInitialDetailElement();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!detailOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        void closeDetail();
        return;
      }

      if (event.key === "Tab") {
        trapDetailFocus(event);
      }
    };

    trigger.addEventListener("pointerenter", onTriggerEnter);
    trigger.addEventListener("pointerleave", onTriggerLeave);
    tip.addEventListener("pointerenter", onTipEnter);
    tip.addEventListener("pointerleave", onTipLeave);
    trigger.addEventListener("focusin", onTriggerEnter);
    trigger.addEventListener("focusout", onTriggerLeave);
    trigger.addEventListener("click", onClick);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("keydown", onKey);

    return () => {
      clearLeaveTimer();
      updateTriggerDescription(tipTriggerEl, false);
      updateTriggerDescription(activeTriggerEl, false);
      tipTriggerEl = null;
      trigger.removeEventListener("pointerenter", onTriggerEnter);
      trigger.removeEventListener("pointerleave", onTriggerLeave);
      tip.removeEventListener("pointerenter", onTipEnter);
      tip.removeEventListener("pointerleave", onTipLeave);
      trigger.removeEventListener("focusin", onTriggerEnter);
      trigger.removeEventListener("focusout", onTriggerLeave);
      trigger.removeEventListener("click", onClick);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("focusin", onFocusIn, true);
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
  positioning survives transformed / overflow:hidden ancestors. Click / tap
  opens a detail sheet. When the tip scrolls, pointer-events stay on so the
  cursor can move onto it during the leave-delay window.
-->
<div
  bind:this={tipEl}
  id={tooltipId}
  class="hover-tooltip fixed z-50 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-left {className}"
  class:hover-tooltip-open={open && !detailOpen}
  class:hover-tooltip-interactive={open && !detailOpen && tipScrollable}
  style="top: 0; left: 0; background: var(--foreground-mid); color: var(--background-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
  role="tooltip"
  tabindex={tipScrollable && open && !detailOpen ? 0 : undefined}
>
  {#if !detailOpen}
    <div class="hover-tooltip-body">
      {@render children()}
    </div>
  {/if}
</div>

{#if detailOpen}
  <div class="tip-sheet-root" bind:this={sheetRootEl}>
    <button
      type="button"
      class="tip-sheet-backdrop"
      tabindex="-1"
      aria-hidden="true"
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
      <button
        type="button"
        class="tip-sheet-close"
        aria-label="Close details"
        onclick={closeDetail}
      >
        <IconX size={16} strokeWidth={2.25} />
      </button>
      <div class="tip-sheet-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .hover-tooltip {
    /* Fixed px — tip chrome stays compact; rem utilities would track root/body. */
    font-size: 11px;
    line-height: 1.35;
    white-space: normal;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
  }

  .hover-tooltip-open {
    opacity: 1;
    visibility: visible;
  }

  .hover-tooltip-interactive {
    pointer-events: auto;
  }

  .hover-tooltip-body {
    display: block;
  }

  /* Callers may still pass rem utilities; keep hover tip from scaling up. */
  .hover-tooltip :global(.text-sm),
  .hover-tooltip :global(.text-xs),
  .hover-tooltip :global(.text-\[0\.65rem\]),
  .hover-tooltip :global(.tip-detail-text) {
    font-size: 11px;
    line-height: 1.35;
  }

  .hover-tooltip :global(.text-\[0\.65rem\]),
  .hover-tooltip :global(.tip-detail-text--small) {
    font-size: 10px;
    line-height: 1.4;
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
    width: min(24rem, 100%);
    max-height: min(70dvh, 32rem);
    padding: 1rem;
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
    /* Keeps the first line clear of the floating close button. */
    padding-right: 1.5rem;
  }

  /* Readable sheet sizes in px — larger than hover tip, not rem-scaled. */
  .tip-sheet-body :global(.tip-detail-text) {
    font-size: 14px;
    line-height: 1.35;
  }

  .tip-sheet-body :global(.tip-detail-text.tip-detail-text--small) {
    font-size: 13px;
    line-height: 1.45;
  }

  .tip-sheet-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: color-mix(in srgb, var(--background-color) 65%, transparent);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .tip-sheet-close:hover {
    color: var(--background-color);
    background: color-mix(in srgb, var(--background-color) 12%, transparent);
  }

  @media (min-width: 640px) {
    .tip-sheet-root {
      place-items: center;
      padding: 1.25rem;
    }
  }
</style>
