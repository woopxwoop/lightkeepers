<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { untrack } from "svelte";
  import { loadAuditGrades } from "$lib/app/audit-grades";
  import { getRosterWeaponsCached } from "$lib/app/roster-inventory";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import { buildNextRows, type AuditRow } from "$lib/audit-grades";
  import {
    appendAuditSuggestions,
    auditRowPlannerState,
    type AuditPlannerState,
  } from "$lib/audit-planner-goals";
  import { authClient } from "$lib/auth-client";
  import {
    hydrateGoalsState,
    readGoalsIfChanged,
    saveGoalsState,
  } from "$lib/calculator-goals-lifecycle";
  import { goalsLocalRevision } from "$lib/calculator-goals-snapshot";
  import {
    charactersHydrated,
    charactersOwned,
    ensureTierList,
    tierList,
    tierListError,
    tierListLoaded,
  } from "$lib/stores";
  import { stygianUsageByNameId } from "$lib/tierlist";
  import type { CalculatorGoalsState } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import { settingsPath } from "$lib/ui/nav-links";
  import AuditQueueRow from "$lib/ui/components/AuditQueueRow.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import InfoPopover from "$lib/ui/components/InfoPopover.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";

  const session = authClient.useSession();

  let grades = $state<AuditRow[] | null>(null);
  let loading = $state(true);
  let loadError = $state(false);
  let gradeRetry = $state(0);

  let plannerCatalog = $state<UpgradeCostsCatalog | null>(null);
  let plannerGoals = $state<CalculatorGoalsState | null>(null);
  let plannerSnapshot = $state("");
  let plannerBusy = $state(false);
  let plannerError = $state<string | null>(null);

  let owned = $derived($charactersOwned.filter((c) => c.isOwned));
  /** Stable effect key — ignore roster array identity churn from store rewrites. */
  let ownedFingerprint = $derived(
    owned
      .map((c) => c.name_id)
      .sort()
      .join("\0"),
  );

  let usageByNameId = $derived(stygianUsageByNameId($tierList));
  let buildNext = $derived(grades ? buildNextRows(grades, usageByNameId) : []);

  type PageView = "loading" | "no_roster" | "error" | "ready";

  /** Wait for usage too so the ranking doesn't reshuffle; a usage failure just loses the ordering. */
  let view = $derived.by((): PageView => {
    if (!$charactersHydrated) return "loading";
    if (owned.length === 0) return "no_roster";
    if (loadError) return "error";
    if (loading || !grades) return "loading";
    if (!$tierListLoaded && !$tierListError) return "loading";
    return "ready";
  });

  function plannerStateFor(row: AuditRow): AuditPlannerState {
    return auditRowPlannerState(plannerGoals, plannerCatalog, row);
  }

  let addableRows = $derived(
    buildNext.filter((row) => plannerStateFor(row) === "add"),
  );
  function characterHref(nameId: string): string {
    return resolve(`/characters/${nameId}`);
  }

  function retryGrades() {
    gradeRetry += 1;
  }

  /** Planner goals + catalog; refreshes from storage when already loaded. */
  async function readyPlanner(): Promise<{
    catalog: UpgradeCostsCatalog;
    state: CalculatorGoalsState;
    snapshot: string;
  } | null> {
    try {
      if (!plannerCatalog || !plannerGoals) {
        const [catalog, { data: sess }] = await Promise.all([
          loadUpgradeCosts(),
          authClient.getSession(),
        ]);
        const pending = await hydrateGoalsState(Boolean(sess));
        plannerCatalog = catalog;
        plannerGoals = pending.state;
        plannerSnapshot = pending.json;
      } else {
        const pending = readGoalsIfChanged(plannerSnapshot);
        if (pending) {
          plannerGoals = pending.state;
          plannerSnapshot = pending.json;
        }
      }
      return {
        catalog: plannerCatalog,
        state: plannerGoals,
        snapshot: plannerSnapshot,
      };
    } catch {
      return null;
    }
  }

  async function addToPlanner(rows: AuditRow[]) {
    if (plannerBusy || rows.length === 0) return;
    plannerBusy = true;
    plannerError = null;
    try {
      const ready = await readyPlanner();
      if (!ready) {
        plannerError = "Couldn’t load the Planner right now";
        return;
      }
      const result = appendAuditSuggestions(ready.state, ready.catalog, rows, {
        owned: untrack(() => $charactersOwned),
        weapons: getRosterWeaponsCached(),
      });
      if (result.added === 0) return;
      const save = await saveGoalsState({
        state: result.state,
        pendingRemoveIds: new Set(),
        savedSnapshot: ready.snapshot,
        cloud: Boolean($session.data),
      });
      if (!save.ok) {
        plannerError = save.message;
        return;
      }
      plannerGoals = save.capture.state;
      plannerSnapshot = save.capture.json;
    } finally {
      plannerBusy = false;
    }
  }

  $effect(() => {
    if (browser) ensureTierList().catch(() => {});
  });

  /** Warm planner state so rows show Add / In Planner before any click. */
  $effect(() => {
    if (browser) untrack(() => void readyPlanner());
  });

  /** Same-tab sync when Planner (or another surface) persists goals. */
  $effect(() => {
    void $goalsLocalRevision;
    untrack(() => {
      if (!plannerSnapshot) return;
      const pending = readGoalsIfChanged(plannerSnapshot);
      if (!pending) return;
      plannerGoals = pending.state;
      plannerSnapshot = pending.json;
    });
  });

  $effect(() => {
    if (!browser || !$charactersHydrated) return;
    void ownedFingerprint;
    void gradeRetry;
    const roster = untrack(() => owned);
    let cancelled = false;
    loading = true;
    loadError = false;
    loadAuditGrades(roster)
      .then((result) => {
        if (!cancelled) grades = result;
      })
      .catch(() => {
        if (!cancelled) loadError = true;
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<PageShell class="gap-8">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Build Audit</h1>
      <p class="page-meta">
        {#if owned.length > 0}
          Based on your {owned.length} characters · level and talent targets from
          Builds
        {:else}
          See which characters need levels or talents next
        {/if}
      </p>
    </div>
  </header>

  {#if view === "loading"}
    <LoadingState
      variant="pulse"
      message="Checking your characters against Builds targets…"
    />
  {:else if view === "no_roster"}
    <EmptyState message="Set up your roster in Settings to audit your builds.">
      {#snippet action()}
        <a class="audit-cta" href={settingsPath}>Configure roster</a>
      {/snippet}
    </EmptyState>
  {:else if view === "error"}
    <EmptyState message="Couldn’t load your builds right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryGrades}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <section class="audit-section">
      <div class="section-head">
        <h2 class="section-title">
          <InfoPopover label="Build next" align="start">
            Ranked by how often each character is used in Stygian.
          </InfoPopover>
        </h2>
        {#if buildNext.length > 0}
          <div class="section-actions">
            {#if plannerError}
              <p class="planner-error" role="alert">{plannerError}</p>
            {/if}
            <Button
              variant="primary"
              disabled={plannerBusy || addableRows.length === 0}
              onclick={() => addToPlanner(addableRows)}
            >
              {addableRows.length > 0 ? "Add all to Planner" : "All in Planner"}
            </Button>
          </div>
        {/if}
      </div>
      {#if buildNext.length === 0}
        <p class="section-lede">
          Nothing to build here — everyone meets their Builds targets.
        </p>
      {:else}
        <ol class="queue-list">
          {#each buildNext as row, i (row.nameId)}
            <AuditQueueRow
              {row}
              rank={i + 1}
              href={characterHref(row.nameId)}
              plannerState={plannerStateFor(row)}
              busy={plannerBusy}
              onAdd={() => addToPlanner([row])}
            />
          {/each}
        </ol>
      {/if}
    </section>

    <p class="audit-note">
      Targets are the level and talents top teams run on each character’s Builds
      page. Weapon level only counts when it measurably changes damage.
    </p>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .audit-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--accent-1);
    background: var(--accent-1);
    color: var(--control-knob-on);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
  }

  .audit-cta:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }

  .audit-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
  }

  .section-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2) var(--space-3);
  }

  .planner-error {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .queue-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .audit-note {
    margin-top: var(--space-2);
    padding-top: var(--space-4);
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.12);
    max-width: 60ch;
    font-size: var(--text-xs);
    line-height: 1.55;
    color: var(--foreground-mid);
  }
</style>
