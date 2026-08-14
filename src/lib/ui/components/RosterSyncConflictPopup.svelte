<script lang="ts">
  /**
   * Login bootstrap conflict: local roster ≠ cloud. User picks which wins.
   * Escape keeps local in memory without uploading (cloud unchanged).
   */
  import { browser } from "$app/environment";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "$lib/ui/components/Button.svelte";
  import {
    rosterSyncConflict,
    type RosterSyncChoice,
  } from "$lib/app/roster-sync-conflict";

  let dialogEl: HTMLElement | null = $state(null);
  let busy = $state(false);

  function choose(choice: RosterSyncChoice): void {
    const pending = $rosterSyncConflict;
    if (!pending || busy) return;
    busy = true;
    pending.resolve(choice);
    busy = false;
  }

  $effect(() => {
    if (!$rosterSyncConflict) return;

    const previouslyFocused =
      browser && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusableSelector =
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        choose("keep-local");
        return;
      }
      if (e.key !== "Tab" || !dialogEl) return;

      const focusable = Array.from(
        dialogEl.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogEl.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey);

    let prevOverflow = "";
    if (browser) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    void tick().then(() => {
      const first = dialogEl?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      if (browser) document.body.style.overflow = prevOverflow;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  });
</script>

{#if $rosterSyncConflict}
  <div class="popup-root">
    <div class="popup-backdrop" aria-hidden="true"></div>
    <div
      bind:this={dialogEl}
      class="popup-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-sync-conflict-title"
      transition:scale={{
        duration: prefersReducedMotion.current ? 0 : 220,
        start: 0.96,
      }}
    >
      <p class="popup-eyebrow">Roster sync</p>
      <h2 id="roster-sync-conflict-title" class="section-title popup-title">
        Local and cloud differ
      </h2>
      <p class="section-lede popup-summary">
        Your device roster doesn't match the cloud backup. Use the cloud copy
        here, or upload this device's roster to the cloud.
      </p>
      <div class="popup-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onclick={() => choose("upload-local")}
        >
          Upload local
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onclick={() => choose("use-cloud")}
        >
          Use cloud
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .popup-root {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    pointer-events: none;
  }

  .popup-backdrop {
    position: absolute;
    inset: 0;
    background: color-mix(in oklab, black 55%, transparent);
    backdrop-filter: blur(2px);
    pointer-events: auto;
    animation: popup-fade-in 180ms ease-out;
  }

  @keyframes popup-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .popup-backdrop {
      animation: none;
    }
  }

  .popup-panel {
    position: relative;
    z-index: 1;
    width: min(100%, 24rem);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 1.15rem 1.2rem 1.1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    background: var(--background-color);
    box-shadow: 0 18px 48px color-mix(in oklab, black 45%, transparent);
    pointer-events: auto;
  }

  .popup-eyebrow {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .popup-title {
    margin: 0;
    text-transform: none;
    letter-spacing: 0.02em;
    font-size: var(--text-base);
  }

  .popup-summary {
    margin: 0.15rem 0 0.35rem;
  }

  .popup-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    margin-top: 0.35rem;
  }
</style>
