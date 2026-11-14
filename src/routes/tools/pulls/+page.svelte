<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import { charactersOwned, charactersHydrated } from "#lib/stores/roster.js";
  import {
    abyssVersionNumber,
    stygianVersionNumber,
  } from "#lib/stores/versions.js";
  import { staticBoardsPhase } from "#lib/stores/boards.js";
  import {
    teamsOwnedStatus,
    nearMissStygianTeams,
    nearMissPairTeams,
    nearMissStatus,
    ensureNearMissTeams,
    ensureTeamsOwned,
    invalidateNearMissTeams,
    invalidateTeamsOwned,
  } from "#lib/stores/teams.js";
  import {
    tierList,
    tierListLoaded,
    tierListError,
    ensureTierList,
    invalidateTierList,
  } from "#lib/stores/tierlist.js";
  import { animationsEnabled } from "#lib/stores/preferences.js";
  import { ownedNameIds } from "#lib/utils.js";
  import type {
    PullSuggestion,
    PairSuggestion,
  } from "#lib/boards/pullSuggestions.js";
  import {
    cycledTeamIndex,
    nextRevealed,
    pairKey,
    pairLedgerRow,
    pairRowId,
    resolvePullView,
    safeTeamIndex,
    singleLedgerRow,
    singleRowId,
    type LedgerRowModel,
  } from "#lib/boards/pull-view.js";
  import PageShell from "#lib/ui/components/PageShell.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import { settingsPath } from "#lib/ui/nav-links.js";
  import LedgerRow from "./LedgerRow.svelte";
  import PullsPanel from "./PullsPanel.svelte";
  import StandoutsBoard from "./StandoutsBoard.svelte";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  let revealedSingles = $state(new Set<string>());
  let revealedPairs = $state(new Set<string>());
  /** Active team per revealed row — rows page through their teams separately. */
  let singleTeamIndex = $state<Record<string, number>>({});
  let pairTeamIndex = $state<Record<string, number>>({});
  let teamCycleDirection = $state<Record<string, -1 | 0 | 1>>({});
  let hidingTeamRows = $state(new Set<string>());
  const teamHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

  onDestroy(() => {
    for (const timer of teamHideTimers.values()) clearTimeout(timer);
    teamHideTimers.clear();
  });

  const TEAM_HIDE_MS = 140;

  let ownedIds = $derived(ownedNameIds($charactersOwned));
  let ownedCount = $derived(ownedIds.size);

  /** Limited cream name_ids — pull suggestions stay inside the standouts cut. */
  let creamPullIds = $derived(
    $tierList ? new Set($tierList.fiveStar.map((e) => e.nameId)) : undefined,
  );

  let pullView = $derived(
    resolvePullView({
      hydrated: $charactersHydrated,
      ownedCount,
      teamsOwnedStatus: $teamsOwnedStatus,
      nearMissStatus: $nearMissStatus,
      tierSettled: $tierListLoaded || $tierListError != null,
      nearMissTeams: $nearMissStygianTeams,
      nearMissPairs: $nearMissPairTeams,
      creamPullIds,
    }),
  );
  let pageState = $derived(pullView.pageState);
  let suggestions = $derived(pullView.suggestions);
  let pairSuggestions = $derived(pullView.pairSuggestions);
  let singleRows = $derived(
    suggestions.map((s) => singleLedgerRow(s, mapping, singleTeamIndex)),
  );
  let pairRows = $derived(
    pairSuggestions.map((s) => pairLedgerRow(s, mapping, pairTeamIndex)),
  );

  /** Drops revealed ids that no longer exist and clamps each cycle index. */
  function syncRevealed(
    singles: PullSuggestion[],
    pairs: PairSuggestion[],
  ): void {
    const singleIds = singles.map((s) => s.character);
    revealedSingles = nextRevealed(revealedSingles, singleIds);
    for (const suggestion of singles) {
      singleTeamIndex[suggestion.character] = safeTeamIndex(
        singleTeamIndex,
        suggestion.character,
        suggestion.topTeams,
      );
    }

    const pairIds = pairs.map(pairKey);
    revealedPairs = nextRevealed(revealedPairs, pairIds);
    for (const suggestion of pairs) {
      const key = pairKey(suggestion);
      pairTeamIndex[key] = safeTeamIndex(
        pairTeamIndex,
        key,
        suggestion.topTeams,
      );
    }
  }

  // Tier list is roster-independent — warm as soon as the page mounts.
  $effect(() => {
    ensureTierList().catch(() => {});
  });

  // Lazy: owned teams + near-miss (not from global bootstrap).
  // Read `idle` only. `loading` and `error` must not re-enter this effect —
  // a failure would retry forever, and a join would stack calls.
  $effect(() => {
    void $staticBoardsPhase;
    if (!$charactersHydrated) return;
    if (abyssVersionNumber < 0 || stygianVersionNumber < 0) return;
    if (ownedCount === 0) return;
    const owned = $charactersOwned;
    if ($teamsOwnedStatus === "idle") {
      ensureTeamsOwned(owned).catch(() => {});
    }
    if ($nearMissStatus === "idle") {
      ensureNearMissTeams(owned).catch(() => {});
    }
  });

  $effect(() => {
    if (pageState !== "done" && pageState !== "empty") return;
    const singles = suggestions;
    const pairs = pairSuggestions;
    untrack(() => syncRevealed(singles, pairs));
  });

  function toggleSingle(character: string) {
    revealedSingles = toggleRevealed(
      revealedSingles,
      character,
      singleTeamIndex,
      singleRowId(character),
    );
  }

  function togglePair(key: string) {
    revealedPairs = toggleRevealed(
      revealedPairs,
      key,
      pairTeamIndex,
      pairRowId(key),
    );
  }

  function toggleRevealed(
    revealed: Set<string>,
    id: string,
    indices: Record<string, number>,
    rowId: string,
  ): Set<string> {
    const next = new Set(revealed);
    if (next.delete(id)) {
      beginTeamHide(rowId);
    } else {
      next.add(id);
      indices[id] ??= 0;
    }
    return next;
  }

  function beginTeamHide(rowId: string): void {
    const hiding = new Set(hidingTeamRows);
    hiding.add(rowId);
    hidingTeamRows = hiding;

    const prior = teamHideTimers.get(rowId);
    if (prior) clearTimeout(prior);
    const wait = get(animationsEnabled) ? TEAM_HIDE_MS : 1;
    teamHideTimers.set(
      rowId,
      setTimeout(() => {
        teamHideTimers.delete(rowId);
        const next = new Set(hidingTeamRows);
        next.delete(rowId);
        hidingTeamRows = next;
      }, wait),
    );
  }

  function cycleTeamIndex(
    indices: Record<string, number>,
    id: string,
    rowId: string,
    count: number,
    direction: -1 | 1,
  ): void {
    if (count < 2) return;
    teamCycleDirection[rowId] = direction;
    indices[id] = cycledTeamIndex(indices[id], count, direction);
  }

  async function retryPulls() {
    invalidateTeamsOwned();
    invalidateNearMissTeams();
    await Promise.all([
      ensureTeamsOwned($charactersOwned),
      ensureNearMissTeams($charactersOwned),
    ]).catch(() => {});
  }

  async function retryTierList() {
    invalidateTierList();
    try {
      await ensureTierList();
    } catch {
      /* tierListError store already set */
    }
  }
</script>

{#snippet ledger(
  rows: LedgerRowModel[],
  revealed: Set<string>,
  indices: Record<string, number>,
  toggle: (id: string) => void,
)}
  <ol class="ledger-list">
    {#each rows as row (row.indexKey)}
      <LedgerRow
        rowId={row.rowId}
        targets={row.targets}
        mates={row.mates}
        mateCount={row.mateCount}
        isOpen={revealed.has(row.indexKey)}
        isHiding={hidingTeamRows.has(row.rowId)}
        direction={teamCycleDirection[row.rowId] ?? 0}
        teams={row.teams}
        teamIdx={row.teamIdx}
        cycleTeam={row.cycleTeam}
        {mapping}
        {ownedIds}
        ontoggle={() => {
          teamCycleDirection[row.rowId] = 0;
          toggle(row.indexKey);
        }}
        oncycle={(direction) =>
          cycleTeamIndex(
            indices,
            row.indexKey,
            row.rowId,
            row.teams.length,
            direction,
          )}
      />
    {/each}
  </ol>
{/snippet}

<PageShell class="pulls-page gap-8">
  <header class="page-head">
    <h1 class="page-title">Pull Suggestions</h1>
    <p class="page-meta">
      Based on your {ownedCount} characters · Stygian usage for long-term roster strength
    </p>
  </header>

  {#if pageState === "waiting"}
    <LoadingState
      variant="pulse"
      message="Matching your roster against Stygian usage…"
    />
  {:else if pageState === "error"}
    <EmptyState message="Could not load pull suggestions right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryPulls}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else if pageState === "empty"}
    {#if ownedCount === 0}
      <EmptyState
        message="Set up your roster in Settings to get pull suggestions."
      >
        {#snippet action()}
          <a class="pulls-cta" href={settingsPath}>Configure roster</a>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        message="No high-usage singles or pairs to suggest for this roster."
      />
    {/if}
  {:else}
    <div class="suggest-columns">
      <!-- ── Best next pulls ───────────────────────────────────────── -->
      {#if suggestions.length > 0}
        <PullsPanel
          title="Best next pulls"
          lede="Characters that unlock high-usage teams for your roster long-term"
        >
          {@render ledger(
            singleRows,
            revealedSingles,
            singleTeamIndex,
            toggleSingle,
          )}
        </PullsPanel>
      {/if}

      <!-- ── Pair pulls ────────────────────────────────────── -->
      {#if pairSuggestions.length > 0}
        <PullsPanel
          title="Pair Pulls"
          lede="Two characters that form a strong core for your roster"
        >
          {@render ledger(pairRows, revealedPairs, pairTeamIndex, togglePair)}
        </PullsPanel>
      {/if}
    </div>
  {/if}

  <!-- ── Cream of the crop (roster-independent) ────────────────────── -->
  <PullsPanel title="Most used characters in Stygian">
    {#if !$tierListLoaded && !$tierListError}
      <LoadingState variant="pulse" message="Finding Stygian standouts…" />
    {:else if $tierListError}
      <EmptyState message="Could not load Stygian standouts right now.">
        {#snippet action()}
          <Button variant="secondary" onclick={retryTierList}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="standouts-stack">
        <StandoutsBoard
          id="limited"
          label="limited characters"
          entries={$tierList?.fiveStar ?? []}
          {mapping}
          {ownedIds}
        />
        <StandoutsBoard
          id="nonLimited"
          label="non-limited characters"
          entries={$tierList?.fourStar ?? []}
          {mapping}
          {ownedIds}
        />
      </div>
    {/if}
  </PullsPanel>

  <p class="pulls-note">
    When in doubt, pull and build around your favorite characters.
  </p>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding-bottom: var(--space-2);
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  /* ── Panels ─────────────────────────────────────────────────────── */
  .suggest-columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-8);
    align-items: start;
  }

  @media (min-width: 960px) {
    .suggest-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-6);
    }
  }

  /* Side-by-side columns: reserve two lines so both team rows start level. */
  @media (min-width: 960px) {
    .suggest-columns :global(.panel-lede) {
      min-height: 2.9em;
    }
  }

  /* ── Standouts ──────────────────────────────────────────────────── */
  .standouts-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ── Suggestion ledger ──────────────────────────────────────────── */
  .ledger-list {
    --standout-w: clamp(4.75rem, 18vw, 5.5rem);
    --team-slot-gap: 0.45rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin: 0;
    /* Room for WishSlot glow + best-team outline */
    padding: 0.45rem 0.35rem 0.45rem 0.55rem;
    list-style: none;
  }

  @media (max-width: 640px) {
    /* Slots shrink to share the row, so this stays a cap rather than a size. */
    .ledger-list {
      --standout-w: 4.75rem;
      --team-slot-gap: 0.3rem;
      gap: var(--space-3);
    }
  }

  /* ── Methodology ────────────────────────────────────────────────── */
  .pulls-note {
    margin-top: var(--space-2);
    padding-top: var(--space-4);
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.12);
    max-width: 60ch;
    font-size: var(--text-xs);
    line-height: 1.55;
    color: var(--accent-2);
  }

  .pulls-cta {
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

  .pulls-cta:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }
</style>
