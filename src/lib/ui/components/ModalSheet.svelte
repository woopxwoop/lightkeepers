<script lang="ts">
  /**
   * Modal shell — backdrop, centered dialog panel, head row with close button.
   * Owns scroll lock, initial focus, Escape, tab trap, and focus restore.
   * Size comes from `size` ("dialog" | "sheet"); chrome is fixed and
   * per-modal chrome overrides are not supported. `nested` stacks above.
   */
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { trapTabKey } from "#lib/ui/focus-trap.js";
  import { acquireBodyScrollLock } from "#lib/ui/body-scroll-lock.js";
  import IconX from "#lib/ui/icons/IconX.svelte";

  let {
    open,
    onclose,
    label,
    labelledby,
    closeOnNavigate = false,
    size = "dialog",
    initialFocus,
    nested = false,
    suspendKeys = false,
    head,
    children,
  }: {
    open: boolean;
    onclose: () => void;
    label?: string;
    labelledby?: string;
    closeOnNavigate?: boolean;
    size?: "dialog" | "sheet";
    /** Selector inside the panel to focus on open; default: the close button. */
    initialFocus?: string;
    /** Stacked above another overlay: take keys in the capture phase and stop them there. */
    nested?: boolean;
    /** A further overlay above this one owns the keyboard. */
    suspendKeys?: boolean;
    head?: Snippet;
    children: Snippet;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);
  let closeEl: HTMLButtonElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let closedByNavigate = false;

  afterNavigate(({ shallow, type }) => {
    if (!closeOnNavigate) return;
    if (shallow && type === "goto") return;
    if (!open) return;
    closedByNavigate = true;
    onclose();
  });

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    const capture = nested;
    let active = true;
    void tick().then(() => {
      if (!active || !open) return;
      const target = initialFocus
        ? panelEl?.querySelector<HTMLElement>(initialFocus)
        : closeEl;
      target?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (suspendKeys) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (capture) e.stopImmediatePropagation();
        onclose();
        return;
      }
      if (panelEl) trapTabKey(e, panelEl);
    }
    window.addEventListener("keydown", onKey, capture);
    return () => {
      active = false;
      releaseScrollLock();
      window.removeEventListener("keydown", onKey, capture);
      const skipFocus = closedByNavigate;
      closedByNavigate = false;
      if (previous?.isConnected && !skipFocus) previous.focus();
    };
  });
</script>

{#if open}
  <div class="modal-root {size}" class:nested>
    <button
      type="button"
      class="modal-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={onclose}
      transition:fade|global={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="modal-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledby}
      tabindex="-1"
      transition:scale|global={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="modal-head">
        {@render head?.()}
        <button
          type="button"
          class="modal-close"
          bind:this={closeEl}
          onclick={onclose}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .modal-root.nested {
    z-index: 140;
  }

  .modal-backdrop {
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

  .modal-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.1rem 1.1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    /* Page base: modal content (pick tiles, itinerary cards, AccountPanel) is
       built on it and uses --background-mid for its own raised surfaces. */
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
  }

  /* Child combinator: a nested modal can render inside another modal's panel,
     and a descendant selector would let the outer root's size apply to it. */
  .modal-root.dialog > .modal-panel {
    width: min(32rem, 100%);
    height: auto;
    max-height: min(40rem, calc(100vh - 2rem));
  }

  .modal-root.sheet > .modal-panel {
    width: min(90vw, 72rem);
    height: min(88vh, 56rem);
  }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .modal-close {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .modal-close :global(svg) {
    width: 18px;
    height: 18px;
  }

  .modal-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0;
  }
</style>
