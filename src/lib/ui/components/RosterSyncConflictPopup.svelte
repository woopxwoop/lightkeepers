<script lang="ts">
  /**
   * Login bootstrap conflict: local roster ≠ cloud. User picks which wins,
   * or dismisses and keeps using the device roster without syncing.
   * Optional Character|Local|Cloud diff table; upload failures reopen with an error.
   */
  import { browser } from "$app/environment";
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "$lib/ui/components/Button.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import {
    rosterSyncConflict,
    type RosterSyncChoice,
  } from "$lib/app/roster-sync-conflict";
  import {
    diffRostersForSync,
    type RosterSyncDiff,
    type RosterSyncProgressBits,
  } from "$lib/roster-snapshot";

  let dialogEl: HTMLElement | null = $state(null);
  let busy = $state(false);
  let showDiffs = $state(false);

  let diffs = $derived.by((): RosterSyncDiff[] => {
    const pending = $rosterSyncConflict;
    if (!pending) return [];
    return diffRostersForSync(pending.local, pending.cloud);
  });

  function choose(choice: RosterSyncChoice): void {
    const pending = $rosterSyncConflict;
    if (!pending || busy) return;
    busy = true;
    pending.resolve(choice);
    busy = false;
  }

  function dismiss(): void {
    choose("dismiss");
  }

  $effect(() => {
    if (!$rosterSyncConflict) {
      showDiffs = false;
      return;
    }

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

{#snippet sideCell(
  owned: boolean,
  ownedChanged: boolean,
  bits: RosterSyncProgressBits | null,
  other: RosterSyncProgressBits | null,
  progressChanged: boolean,
)}
  {@const levelChanged = (bits?.level ?? null) !== (other?.level ?? null)}
  {@const constellationChanged =
    (bits?.constellation ?? null) !== (other?.constellation ?? null)}
  {@const talentsChanged = (bits?.talents ?? null) !== (other?.talents ?? null)}
  {@const weaponChanged = (bits?.weapon ?? null) !== (other?.weapon ?? null)}
  <div class="diff-cell-stack">
    {#if ownedChanged}
      <span
        class="own-chip own-chip-changed"
        class:own-chip-yes={owned}
      >
        {owned ? "Owned" : "Not owned"}
      </span>
    {/if}
    {#if progressChanged}
      {#if !bits && other}
        <span class="prog-empty bit-changed">No progress</span>
      {:else if bits}
        <div class="prog-bits">
          {#if levelChanged}
            <span class="bit-changed">Lv{bits.level}</span>
          {/if}
          {#if constellationChanged}
            <span class="bit-changed">C{bits.constellation}</span>
          {/if}
          {#if talentsChanged}
            <span class="bit-changed">{bits.talents}</span>
          {/if}
          {#if weaponChanged}
            <span class="bit-changed">{bits.weapon ?? "—"}</span>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

{#if $rosterSyncConflict}
  <div class="popup-root">
    <button
      type="button"
      class="popup-backdrop"
      tabindex="-1"
      aria-label="Dismiss roster sync"
      disabled={busy}
      onclick={dismiss}
    ></button>
    <div
      bind:this={dialogEl}
      class="popup-panel"
      class:popup-panel-wide={showDiffs}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-sync-conflict-title"
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
      <p class="popup-eyebrow">Roster sync</p>
      <h2 id="roster-sync-conflict-title" class="section-title popup-title">
        Local and cloud differ
      </h2>
      <p class="section-lede popup-summary">
        Your device roster doesn't match the cloud backup. Use the cloud copy
        here, or upload this device's roster to the cloud.
      </p>
      {#if $rosterSyncConflict.error}
        <p class="popup-error" role="alert">{$rosterSyncConflict.error}</p>
      {/if}

      <div class="diff-toggle-row">
        <Button
          variant="secondary"
          class="diff-toggle"
          disabled={busy || diffs.length === 0}
          onclick={() => (showDiffs = !showDiffs)}
          aria-expanded={showDiffs}
        >
          {showDiffs ? "Hide diffs" : "Show diffs"}
          {#if diffs.length > 0}
            ({diffs.length})
          {/if}
        </Button>
      </div>

      {#if showDiffs}
        <div class="diff-panel">
          {#if diffs.length === 0}
            <p class="diff-empty">No field-level differences found.</p>
          {:else}
            <table class="diff-table">
              <thead>
                <tr>
                  <th scope="col">Character</th>
                  <th scope="col">Local</th>
                  <th scope="col">Cloud</th>
                </tr>
              </thead>
              <tbody>
                {#each diffs as row (row.name_id)}
                  <tr>
                    <th scope="row" class="diff-char">
                      <div class="diff-char-inner">
                        <span class="diff-portrait">
                          <CharacterIcon
                            character={row.portrait}
                            loading="lazy"
                          />
                        </span>
                        <span class="diff-name">{row.name}</span>
                      </div>
                    </th>
                    <td class="diff-side-cell" data-label="Local">
                      {@render sideCell(
                        row.localOwned,
                        row.ownedChanged,
                        row.localProgress,
                        row.cloudProgress,
                        row.progressChanged,
                      )}
                    </td>
                    <td class="diff-side-cell" data-label="Cloud">
                      {@render sideCell(
                        row.cloudOwned,
                        row.ownedChanged,
                        row.cloudProgress,
                        row.localProgress,
                        row.progressChanged,
                      )}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      {/if}

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
    width: min(100%, 26rem);
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

  .popup-panel-wide {
    width: min(100%, 40rem);
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
    margin: 0.15rem 0 0.15rem;
  }

  .popup-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .diff-toggle-row {
    display: flex;
    justify-content: flex-start;
  }

  .diff-toggle-row :global(.diff-toggle) {
    border-color: var(--accent-1);
    color: var(--foreground-color);
  }

  .diff-toggle-row :global(.diff-toggle:disabled) {
    border-color: var(--border-control-quiet);
    color: var(--foreground-mid);
  }

  .diff-panel {
    max-height: min(50vh, 24rem);
    overflow: auto;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    background: var(--surface-quiet);
  }

  .diff-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .diff-table th,
  .diff-table td {
    padding: 0.55rem 0.6rem;
    vertical-align: top;
    text-align: left;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .diff-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
    background: var(--background-color);
    border-bottom-color: color-mix(
      in srgb,
      var(--foreground-color) 18%,
      transparent
    );
  }

  .diff-table tbody tr:last-child th,
  .diff-table tbody tr:last-child td {
    border-bottom: none;
  }

  .diff-table col:nth-child(1),
  .diff-char {
    width: 32%;
  }

  .diff-char {
    font-weight: 600;
    color: var(--foreground-color);
    background: transparent;
  }

  .diff-char-inner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .diff-portrait {
    flex: none;
    width: 2.25rem;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  .diff-portrait :global(.icon-root) {
    width: 100%;
  }

  .diff-portrait :global(img) {
    width: 100%;
    height: auto;
    display: block;
  }

  .diff-name {
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-side-cell {
    width: 34%;
  }

  .diff-cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }

  .own-chip {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    padding: 0.15rem 0.45rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 600;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    color: var(--foreground-mid);
    background: transparent;
  }

  .own-chip-yes {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .own-chip-changed {
    border-color: var(--accent-1);
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
  }

  .prog-bits {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .prog-bits > span,
  .prog-empty {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    padding: 0.12rem 0.35rem;
    border-radius: var(--radius-sm);
    color: var(--foreground-mid);
    border: var(--border-width) solid transparent;
    background: color-mix(in srgb, var(--foreground-color) 5%, transparent);
  }

  .prog-bits > span.bit-changed,
  .prog-empty.bit-changed {
    color: var(--foreground-color);
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
  }

  .diff-empty {
    margin: 0;
    padding: 0.75rem 0.7rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .popup-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    margin-top: 0.35rem;
  }

  @media (max-width: 520px) {
    .diff-table,
    .diff-table thead,
    .diff-table tbody,
    .diff-table tr,
    .diff-table th,
    .diff-table td {
      display: block;
      width: 100%;
    }

    .diff-table thead {
      display: none;
    }

    .diff-table tbody tr {
      padding: 0.65rem 0.6rem;
      border-bottom: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 12%, transparent);
    }

    .diff-table tbody tr:last-child {
      border-bottom: none;
    }

    .diff-char,
    .diff-side-cell {
      padding: 0.25rem 0;
      border-bottom: none;
    }

    .diff-side-cell::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--foreground-mid);
    }
  }
</style>
