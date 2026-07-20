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

  /** Prefer above the trigger; flip below / clamp horizontally if needed. */
  function place() {
    const tip = tipEl;
    const trigger = tip?.parentElement;
    if (!tip || !trigger) return;

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
    const trigger = tipEl?.parentElement;
    if (!trigger) return;

    const onEnter = () => place();
    trigger.addEventListener("pointerenter", onEnter);
    trigger.addEventListener("focusin", onEnter);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    return () => {
      trigger.removeEventListener("pointerenter", onEnter);
      trigger.removeEventListener("focusin", onEnter);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  });
</script>

<!--
  Parent must have Tailwind `group`. Uses position:fixed and repositions on
  hover so the tip stays inside the viewport.
-->
<div
  bind:this={tipEl}
  class="hover-tooltip pointer-events-none fixed z-50 w-max max-w-56 rounded-lg px-2.5 py-1.5 text-left {className}"
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

  :global(.group:hover) > .hover-tooltip,
  :global(.group:focus-within) > .hover-tooltip {
    opacity: 1;
    visibility: visible;
  }
</style>
