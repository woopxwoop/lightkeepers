<script lang="ts">
  /**
   * Login bootstrap conflict: local roster ≠ cloud. User picks which wins,
   * or dismisses and keeps using the device roster without syncing.
   * Optional Character|Local|Cloud diff table; upload failures reopen with an error.
   */
  import Button from "#lib/ui/components/Button.svelte";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import {
    rosterSyncConflict,
    type RosterSyncChoice,
  } from "#lib/app/roster-sync-conflict.js";

  import {
    diffRostersForSync,
    type RosterSyncDiff,
    type RosterSyncProgressBits,
  } from "#lib/roster/roster-sync-diff.js";

  let busy = $state(false);
  let showDiffs = $state(false);

  let diffs = $derived.by((): RosterSyncDiff[] => {
    const pending = $rosterSyncConflict;
    if (!pending || pending.uploadRetry) return [];
    return diffRostersForSync(pending.local, pending.cloud);
  });

  let uploadRetry = $derived($rosterSyncConflict?.uploadRetry === true);
  /** The other side is this device's saved roster, not the cloud's. */
  let savedCopy = $derived($rosterSyncConflict?.savedCopy === true);
  let otherLabel = $derived(savedCopy ? "Saved" : "Cloud");

  function choose(choice: RosterSyncChoice): void {
    const pending = $rosterSyncConflict;
    if (!pending || busy) return;
    busy = true;
    pending.resolve(choice);
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
  });
</script>

{#snippet sideCell(args: {
  owned: boolean;
  ownedChanged: boolean;
  bits: RosterSyncProgressBits | null;
  other: RosterSyncProgressBits | null;
  progressChanged: boolean;
})}
  {@const bits = args.bits}
  {@const other = args.other}
  {@const levelChanged = (bits?.level ?? null) !== (other?.level ?? null)}
  {@const ascensionChanged =
    (bits?.ascension ?? null) !== (other?.ascension ?? null)}
  {@const constellationChanged =
    (bits?.constellation ?? null) !== (other?.constellation ?? null)}
  {@const talentsChanged = (bits?.talents ?? null) !== (other?.talents ?? null)}
  {@const weaponChanged =
    (bits?.weapon?.key ?? null) !== (other?.weapon?.key ?? null) ||
    (bits?.weapon?.level ?? null) !== (other?.weapon?.level ?? null) ||
    (bits?.weapon?.ascension ?? null) !== (other?.weapon?.ascension ?? null) ||
    (bits?.weapon?.refinement ?? null) !== (other?.weapon?.refinement ?? null)}
  <div class="diff-cell-stack">
    {#if args.ownedChanged}
      <span class="own-chip own-chip-changed" class:own-chip-yes={args.owned}>
        {args.owned ? "Owned" : "Not owned"}
      </span>
    {/if}
    {#if args.progressChanged}
      {#if !bits && other}
        <span class="prog-empty bit-changed">No progress</span>
      {:else if bits}
        <div class="prog-bits">
          {#if levelChanged}
            <span class="bit-changed">Lv{bits.level}</span>
          {/if}
          {#if ascensionChanged}
            <span class="bit-changed">A{bits.ascension}</span>
          {/if}
          {#if constellationChanged}
            <span class="bit-changed">C{bits.constellation}</span>
          {/if}
          {#if talentsChanged}
            <span class="bit-changed">{bits.talents}</span>
          {/if}
          {#if weaponChanged}
            <span class="bit-changed">
              {#if bits.weapon}
                {bits.weapon.key} Lv{bits.weapon.level} A{bits.weapon.ascension}
                R{bits.weapon.refinement}
              {:else}
                —
              {/if}
            </span>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

<ModalSheet
  open={!!$rosterSyncConflict}
  onclose={dismiss}
  labelledby="roster-sync-conflict-title"
  size="dialog"
  closeDisabled={busy}
>
  {#snippet head()}
    {#if $rosterSyncConflict}
      <div>
        <p class="popup-eyebrow">Roster sync</p>
        <h2 id="roster-sync-conflict-title" class="section-title popup-title">
          {uploadRetry &&
          !$rosterSyncConflict.error &&
          $rosterSyncConflict.foreignOwner
            ? "Roster belongs to another account"
            : uploadRetry && !$rosterSyncConflict.error
              ? "Upload this roster?"
              : uploadRetry
                ? "Cloud upload failed"
                : savedCopy
                  ? "Roster changed while editing"
                  : "Local and cloud differ"}
        </h2>
      </div>
    {/if}
  {/snippet}
  {#if $rosterSyncConflict}
    <p class="section-lede popup-summary">
      {#if uploadRetry && !$rosterSyncConflict.error && $rosterSyncConflict.foreignOwner}
        This device's roster was saved for a different account. Upload it to the
        signed-in account, or dismiss and leave the cloud unchanged.
      {:else if uploadRetry && !$rosterSyncConflict.error}
        This device's roster isn't tied to the signed-in account. Upload it to
        the cloud, or dismiss and leave the cloud unchanged.
      {:else if uploadRetry}
        Couldn't save this device's roster to the cloud. Retry the upload, or
        dismiss and keep using the local roster.
      {:else if savedCopy}
        The saved roster changed after you started editing. Keep your edits and
        upload them, or use the saved roster.
      {:else}
        Your device roster doesn't match the cloud backup. Use the cloud copy
        here, or upload this device's roster to the cloud.
      {/if}
    </p>
    {#if $rosterSyncConflict.error}
      <p class="popup-error" role="alert">{$rosterSyncConflict.error}</p>
    {/if}

    {#if !uploadRetry}
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
                  <th scope="col">{otherLabel}</th>
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
                      {@render sideCell({
                        owned: row.localOwned,
                        ownedChanged: row.ownedChanged,
                        bits: row.localProgress,
                        other: row.cloudProgress,
                        progressChanged: row.progressChanged,
                      })}
                    </td>
                    <td class="diff-side-cell" data-label={otherLabel}>
                      {@render sideCell({
                        owned: row.cloudOwned,
                        ownedChanged: row.ownedChanged,
                        bits: row.cloudProgress,
                        other: row.localProgress,
                        progressChanged: row.progressChanged,
                      })}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      {/if}
    {/if}

    <div class="popup-actions">
      <Button
        variant="secondary"
        disabled={busy}
        onclick={() => choose("upload-local")}
      >
        {uploadRetry && $rosterSyncConflict.error
          ? "Retry upload"
          : savedCopy
            ? "Keep my edits"
            : "Upload local"}
      </Button>
      {#if !uploadRetry}
        <Button
          variant="primary"
          disabled={busy}
          onclick={() => choose("use-cloud")}
        >
          {savedCopy ? "Use saved" : "Use cloud"}
        </Button>
      {/if}
    </div>
  {/if}
</ModalSheet>

<style>
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

  .diff-char {
    width: 32%;
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
