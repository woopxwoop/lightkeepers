<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
  }: {
    children: Snippet;
    class?: string;
  } = $props();

  const EDGE = 8;
  const GAP = 8;

  let tipEl: HTMLDivElement | undefined = $state();
  let open = $state(false);

  /** Prefer above the trigger; flip below / clamp horizontally if needed. */
  function place(trigger: HTMLElement) {
    const tip = tipEl;
    if (!tip) return;

    // Measure while visible so width/height are accurate, then keep open state.
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

    const show = () => {
      open = true;
      // Next frame: tip is visible so layout size is correct before place().
      requestAnimationFrame(() => place(trigger));
    };
    const hide = () => {
      open = false;
    };
    const reposition = () => {
      if (open) place(trigger);
    };

    trigger.addEventListener("pointerenter", show);
    trigger.addEventListener("pointerleave", hide);
    trigger.addEventListener("focusin", show);
    trigger.addEventListener("focusout", hide);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      trigger.removeEventListener("pointerenter", show);
      trigger.removeEventListener("pointerleave", hide);
      trigger.removeEventListener("focusin", show);
      trigger.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      tip.remove();
    };
  });
</script>

<!--
  Parent must have Tailwind `group`. Tip portals to document.body so fixed
  positioning survives transformed ancestors.
-->
<div
  bind:this={tipEl}
  class="hover-tooltip pointer-events-none fixed z-50 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-left {className}"
  class:hover-tooltip-open={open}
  style="top: 0; left: 0; background: var(--foreground-mid); color: var(--background-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
  role="tooltip"
>
  {@render children()}
</div>

<style>
  .hover-tooltip {
    white-space: normal;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
  }

  .hover-tooltip-open {
    opacity: 1;
    visibility: visible;
  }
</style>
