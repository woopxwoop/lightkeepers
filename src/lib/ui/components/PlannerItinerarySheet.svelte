<script lang="ts">
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { plannerItineraryOpen } from "$lib/planner-itinerary-open";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import PlannerItinerary from "$lib/ui/components/PlannerItinerary.svelte";

  const plannerPath = resolve("/tools/planner");

  let panelEl: HTMLDivElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let closedByNavigate = false;

  function close() {
    plannerItineraryOpen.set(false);
  }

  afterNavigate(() => {
    if (!$plannerItineraryOpen) return;
    closedByNavigate = true;
    close();
  });

  $effect(() => {
    if (!$plannerItineraryOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    let active = true;
    void tick().then(() => {
      if (!active || !$plannerItineraryOpen) return;
      panelEl?.querySelector<HTMLElement>(".sheet-close")?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (panelEl) trapTabKey(e, panelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
      const skipFocus = closedByNavigate;
      closedByNavigate = false;
      if (previous?.isConnected && !skipFocus) previous.focus();
    };
  });
</script>

{#if $plannerItineraryOpen}
  <div class="sheet-root">
    <button
      type="button"
      class="sheet-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={close}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="sheet-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-label="Farming itinerary"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="sheet-head">
        <a class="back-link sheet-planner" href={plannerPath}
          >View full planner</a
        >
        <button
          type="button"
          class="sheet-close"
          onclick={close}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <div class="sheet-body">
        <PlannerItinerary chrome="plain" showEmpty showHeading={false} />
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .sheet-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .sheet-panel {
    position: relative;
    z-index: 1;
    width: min(90vw, 72rem);
    height: min(88vh, 56rem);
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 0.85rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .sheet-planner {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .sheet-close {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sheet-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 0.15rem 0.15rem 0.35rem;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .sheet-body :global(.itinerary) {
    flex: 1;
    min-height: 0;
  }

  .sheet-body::-webkit-scrollbar {
    width: 0.55rem;
  }

  .sheet-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .sheet-body::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .sheet-body::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--foreground-color) 36%, transparent);
    background-clip: padding-box;
  }
</style>
