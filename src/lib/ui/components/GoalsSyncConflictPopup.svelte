<script lang="ts">
  /**
   * Goals lists that cannot be combined (over the cap). The user picks which
   * list to keep. Dismiss uploads nothing.
   */
  import { MAX_CALCULATOR_GOALS } from "#lib/planner/calculator-goals.js";
  import { goalsSync } from "#lib/app/goals-sync.js";
  import {
    goalsMissingFrom,
    goalsSyncConflict,
    type GoalsSyncChoice,
  } from "#lib/app/goals-sync-conflict.js";
  import Button from "#lib/ui/components/Button.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";

  const goalsView = goalsSync().view;

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
    try {
      pending.resolve(choice);
    } catch {
      busy = false;
    }
  }

  function dismiss(): void {
    choose("dismiss");
  }

  $effect(() => {
    if ($goalsSyncConflict) busy = false;
  });
</script>

<ModalSheet
  open={!!$goalsSyncConflict}
  onclose={dismiss}
  labelledby="goals-sync-conflict-title"
  size="dialog"
  closeDisabled={busy}
>
  {#snippet head()}
    <div>
      <p class="popup-eyebrow">Goals sync</p>
      <h2 id="goals-sync-conflict-title" class="section-title popup-title">
        These goal lists don't fit together
      </h2>
    </div>
  {/snippet}
  <p class="section-lede popup-summary">
    This device has {$goalsView.data.goals.length} goals and the {savedCopy
      ? "saved"
      : "cloud"} copy has {$goalsView.remote?.goals.length ?? 0}. Together that
    is more than {MAX_CALCULATOR_GOALS}, so they can't be combined. Keep one
    list. The other list's extra goals will not be saved.
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
