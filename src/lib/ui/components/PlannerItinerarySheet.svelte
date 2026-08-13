<script lang="ts">
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { plannerItineraryOpen } from "$lib/planner-itinerary-open";
  import { trapTabKey } from "$lib/ui/focus-trap";
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
      aria-label="Farming"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="sheet-head">
        <h2 class="section-title">Farming</h2>
        <a class="back-link sheet-edit" href={plannerPath}>Edit in planner</a>
        <button
          type="button"
          class="sheet-close"
          onclick={close}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <PlannerItinerary chrome="plain" showEmpty showHeading={false} />
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
    width: min(32rem, 100%);
    max-height: min(36rem, calc(100vh - 2rem));
    overflow-y: auto;
    padding: 1.15rem 1.2rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sheet-head .section-title {
    flex: 1;
    min-width: 0;
  }

  .sheet-edit {
    margin: 0;
    flex-shrink: 0;
  }

  .sheet-close {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
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
</style>
