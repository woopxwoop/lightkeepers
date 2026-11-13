<script lang="ts">
  /**
   * Goals lists that cannot be combined (over the cap). The user picks which
   * list to keep. Dismiss uploads nothing.
   */
  import { browser } from "$app/env";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { MAX_CALCULATOR_GOALS } from "#lib/calculator-goals.js";
  import { goalsSync } from "#lib/app/goals-sync.js";
  import {
    goalsMissingFrom,
    goalsSyncConflict,
    type GoalsSyncChoice,
  } from "#lib/app/goals-sync-conflict.js";
  import Button from "#lib/ui/components/Button.svelte";
  import IconX from "#lib/ui/icons/IconX.svelte";
  import { acquireBodyScrollLock } from "#lib/ui/body-scroll-lock.js";

  const goalsView = goalsSync().view;

  let dialogEl: HTMLElement | null = $state(null);
  let busy = $state(false);

  let savedCopy = $derived($goalsSyncConflict?.savedCopy === true);
  let localOnly = $derived(
    $goalsView.remote
      ? goalsMissingFrom($goalsView.data, $goalsView.remote)
      : [],
  );
  let remoteOnly = $derived(
    $goalsView.remote
      ? goalsMissingFrom($goalsView.remote, $goalsView.data)
      : [],
  );

  function choose(choice: GoalsSyncChoice): void {
    const pending = $goalsSyncConflict;
    if (!pending || busy) return;
    busy = true;
    pending.resolve(choice);
  }

  function dismiss(): void {
    choose("dismiss");
  }

  $effect(() => {
    if (!$goalsSyncConflict) return;

    busy = false;

    const previouslyFocused =
      browser && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusableSelector =
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
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

    const releaseScrollLock = browser ? acquireBodyScrollLock() : () => {};

    void tick().then(() => {
      const first = dialogEl?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      releaseScrollLock();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  });
</script>

{#if $goalsSyncConflict}
  <div class="popup-root">
    <button
      type="button"
      class="popup-backdrop"
      tabindex="-1"
      aria-label="Dismiss goals sync"
      disabled={busy}
      onclick={dismiss}
    ></button>
    <div
      bind:this={dialogEl}
      class="popup-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goals-sync-conflict-title"
      transition:scale={{
        duration: prefersReducedMotion.current ? 0 : 220,
        start: 0.96,
      }}
    >
      <button
        type="button"
        class="popup-close"
        disabled={busy}
        onclick={dismiss}
        aria-label="Close"
      >
        <IconX size={16} />
      </button>
      <p class="popup-eyebrow">Goals sync</p>
      <h2 id="goals-sync-conflict-title" class="section-title popup-title">
        These goal lists don't fit together
      </h2>
      <p class="section-lede popup-summary">
        This device has {$goalsView.data.goals.length} goals and the {savedCopy
          ? "saved"
          : "cloud"} copy has {$goalsView.remote?.goals.length ?? 0}. Together
        that is more than {MAX_CALCULATOR_GOALS}, so they can't be combined.
        Keep one list. The other list's extra goals will not be saved.
      </p>

      <div class="sides">
        <section>
          <h3 class="side-label">Only on this device</h3>
          {#if localOnly.length === 0}
            <p class="side-empty">None</p>
          {:else}
            <ul>
              {#each localOnly as name, i (`local:${i}:${name}`)}
                <li>{name}</li>
              {/each}
            </ul>
          {/if}
        </section>
        <section>
          <h3 class="side-label">
            {savedCopy ? "Only on the saved copy" : "Only in the cloud"}
          </h3>
          {#if remoteOnly.length === 0}
            <p class="side-empty">None</p>
          {:else}
            <ul>
              {#each remoteOnly as name, i (`remote:${i}:${name}`)}
                <li>{name}</li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>

      <div class="popup-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onclick={() => choose("keep-local")}
        >
          Keep this device
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onclick={() => choose("keep-remote")}
        >
          {savedCopy ? "Keep saved" : "Keep cloud"}
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
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 55%, transparent);
    backdrop-filter: blur(2px);
    pointer-events: auto;
    animation: popup-fade-in 180ms ease-out;
  }

  .popup-backdrop:disabled {
    cursor: default;
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
    width: min(100%, 32rem);
    max-height: min(100%, 36rem);
    overflow: auto;
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

  .popup-close {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .popup-close:hover:not(:disabled) {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .popup-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    padding-right: 1.5rem;
    text-transform: none;
    letter-spacing: 0.02em;
    font-size: var(--text-base);
  }

  .popup-summary {
    margin: 0.15rem 0 0.15rem;
  }

  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .side-label {
    margin: 0 0 0.25rem;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .sides ul {
    margin: 0;
    padding-left: 1.1rem;
    max-height: 10rem;
    overflow: auto;
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .side-empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .popup-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  @media (max-width: 40rem) {
    .sides {
      grid-template-columns: 1fr;
    }
  }
</style>
