<script lang="ts">
  import { untrack } from "svelte";
  import {
    teamsOwnedStygian,
    teamsOwnedStatus,
    ensureTeamsOwned,
  } from "#lib/stores/teams.js";
  import {
    allTeamsStygian,
    stygianEnemiesBoard,
    staticBoardsPhase,
    staticBoardsView,
    ensureStaticBoards,
    rosterBoardVersions,
  } from "#lib/stores/boards.js";
  import {
    charactersOwned,
    charactersHydrated,
    hasSavedRoster,
  } from "#lib/stores/roster.js";
  import {
    displayPreferences,
    setDisplayPreferences,
  } from "#lib/stores/preferences.js";
  import {
    stygianVersionNumber,
    abyssVersionNumber,
  } from "#lib/stores/versions.js";
  import {
    filterDisplaySolutions,
    boardOutcome,
    clampSolutionIndex,
    stepSolutionIndex,
    assignmentKeyFor,
    createMemo,
  } from "#lib/boards/board-solutions.js";
  import {
    STYGIAN_BOARD_SLOTS,
    cheapClearsRequestKey,
    clearVideoPairs,
    clearVideosResetKey,
    slotClearTime,
    slotClearVideos,
    solveStygianBoard,
    stygianBoardStatus,
    stygianBossIds,
    stygianSlotEnemies,
    stygianSolutionsKey,
    type StygianBoardSlot as Slot,
    type StygianSolutionsResult,
  } from "#lib/boards/stygian-board.js";
  import Surface from "#lib/ui/components/Surface.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import BoardHead from "#lib/ui/components/stygian-solution-board/BoardHead.svelte";
  import BoardStatus from "#lib/ui/components/stygian-solution-board/BoardStatus.svelte";
  import FieldColumn from "#lib/ui/components/stygian-solution-board/FieldColumn.svelte";
  import PullsCta from "#lib/ui/components/stygian-solution-board/PullsCta.svelte";
  import {
    STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST,
    STYGIAN_CHEAP_CLEARS_DIFFICULTY,
    STYGIAN_SOLVER_MODE_HELP,
    toStygianSolverModeRelease,
    type Character,
    type StygianClearVideo,
    type StygianCheapClearRow,
  } from "#lib/definitions.js";
  import { STYGIAN_C0R0_CLEAR_MAX_COST } from "#lib/boards/team-cost.js";
  import { settingsPath } from "#lib/ui/nav-links.js";
  import { authClient } from "#lib/auth-client.js";
  import { needsRosterSetup } from "#lib/roster/roster-setup.js";
  import {
    ensureClearVideos,
    getClearVideosCached,
  } from "#lib/app/stygian-clear-videos.js";
  import {
    cheapClearsStatus,
    ensureCheapClears,
  } from "#lib/app/stygian-cheap-clears.js";

  const CLEAR_VIDEOS_PAGE = 5;
  /** Inclusive Fearless clear cost cap before ranking by time. */
  const maxCost = STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST;
  const clearDifficulty = STYGIAN_CHEAP_CLEARS_DIFFICULTY;
  /**
   * Fetch at least a full baseline span (4 limited 5★s); raise p_max_cost when
   * the ranking cap is higher so the frontier covers that ceiling.
   */
  const cheapClearsFetchMaxCost = Math.max(
    STYGIAN_C0R0_CLEAR_MAX_COST,
    Math.ceil(maxCost),
  );
  const memoSolutions = createMemo<StygianSolutionsResult>();

  let { mapping }: { mapping: Map<string, Character> } = $props();

  let enemies = $derived($stygianEnemiesBoard);
  let storedSolverMode = $derived($displayPreferences.stygianSolverMode);
  let solverMode = $derived(toStygianSolverModeRelease(storedSolverMode));
  let videoClearsMode = $derived(solverMode === "video-c0r0");
  let needsCheapClears = $derived(videoClearsMode || solverMode === "hybrid");
  let modeHint = $derived(STYGIAN_SOLVER_MODE_HELP[solverMode]);
  let boards = $derived(staticBoardsView($staticBoardsPhase));

  $effect(() => {
    ensureStaticBoards().catch(() => {});
    // Versions seed from layout / static boards — don't POST /api/teams with -1.
    // Re-subscribe when boards settle so we retry after setVersionNumbers.
    // Wait for roster seed too: an empty character list is the all-teams sentinel.
    void $staticBoardsPhase;
    if (!$charactersHydrated) return;
    if (abyssVersionNumber < 0 || stygianVersionNumber < 0) return;
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  async function retryTeamsOwned() {
    try {
      await ensureTeamsOwned($charactersOwned);
    } catch {
      // teamsOwnedStatus already set
    }
  }

  async function retryStaticBoards() {
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      // staticBoardsPhase already set
    }
  }

  let selectedIndex = $state(0);
  let clearVideosRevision = $state(0);
  let clearVideosShown = $state<Partial<Record<Slot, number>>>({});
  type CheapClearsFetch =
    | { phase: "idle" }
    | { phase: "loading"; key: string }
    | { phase: "settled"; key: string; rows: StygianCheapClearRow[] }
    | { phase: "failed"; key: string };
  let cheapClearsFetch = $state<CheapClearsFetch>({ phase: "idle" });
  let cheapClearsAttempt = $state(0);
  let cheapClearsRequest = 0;

  let hasOwnedCharacters = $derived(
    $charactersOwned.some((character) => character.isOwned),
  );

  const session = authClient.useSession();
  /** Same gate as the home-page “configure roster first” card. */
  let showRosterSetup = $derived(
    needsRosterSetup({
      sessionPending: $session.isPending,
      hasSavedRoster: $hasSavedRoster,
      sessionData: $session.data,
    }),
  );

  let cheapBoardVersion = $derived.by(() => {
    // Phase updates when the retained board is replaced, after its version.
    void $staticBoardsPhase;
    return rosterBoardVersions().stygian;
  });

  let cheapRequestKey = $derived.by(() => {
    void $staticBoardsPhase;
    return cheapClearsRequestKey({
      boardVersion: cheapBoardVersion,
      difficulty: clearDifficulty,
      fetchMaxCost: cheapClearsFetchMaxCost,
      board: enemies,
      owned: $charactersOwned,
      attempt: cheapClearsAttempt,
    });
  });

  let cheapStatus = $derived(
    cheapClearsStatus({
      active:
        needsCheapClears &&
        hasOwnedCharacters &&
        boards.kind === "board" &&
        stygianVersionNumber >= 0,
      bossCount: stygianBossIds(enemies).length,
      fetch: cheapClearsFetch.phase,
      fetchKey: cheapClearsFetch.phase === "idle" ? null : cheapClearsFetch.key,
      requestKey: cheapRequestKey,
      rowCount:
        cheapClearsFetch.phase === "settled" ? cheapClearsFetch.rows.length : 0,
    }),
  );

  let settledRows = $derived(
    cheapClearsFetch.phase === "settled" ? cheapClearsFetch.rows : null,
  );

  function retryCheapClears() {
    cheapClearsAttempt += 1;
  }

  $effect(() => {
    const active =
      needsCheapClears &&
      hasOwnedCharacters &&
      boards.kind === "board" &&
      stygianVersionNumber >= 0;
    const owned = $charactersOwned;
    const ids = stygianBossIds(enemies);
    const key = cheapRequestKey;
    // Version ints update when boards apply — phase is the reactive hook.
    void $staticBoardsPhase;
    if (!active || ids.length < 3) return;

    const current = untrack(() => cheapClearsFetch);
    if (current.phase !== "idle" && current.key === key) return;

    const id = ++cheapClearsRequest;
    cheapClearsFetch = { phase: "loading", key };
    ensureCheapClears({
      owned,
      stygianVersion: cheapBoardVersion,
      enemyIds: ids,
      maxCost: cheapClearsFetchMaxCost,
      difficulty: clearDifficulty,
    })
      .then((rows) => {
        if (cheapClearsRequest !== id) return;
        cheapClearsFetch = { phase: "settled", key, rows };
      })
      .catch(() => {
        if (cheapClearsRequest !== id) return;
        cheapClearsFetch = { phase: "failed", key };
      });
  });

  let solutionsResult = $derived.by((): StygianSolutionsResult => {
    const needsOwnedTeams =
      solverMode === "yshelper" || solverMode === "hybrid";
    if (
      needsOwnedTeams &&
      hasOwnedCharacters &&
      $teamsOwnedStatus !== "ready"
    ) {
      return { solutions: [], mode: solverMode };
    }

    const input = {
      solverMode,
      maxCost,
      owned: $charactersOwned,
      ownedTeams: $teamsOwnedStygian,
      allTeams: $allTeamsStygian,
      mapping,
      slotEnemies: stygianSlotEnemies(enemies),
      cheapStatus,
      settledRows,
    };
    return memoSolutions(stygianSolutionsKey(input), () =>
      solveStygianBoard(input),
    );
  });

  let solutions = $derived(solutionsResult.solutions);
  let displaySolutions = $derived(filterDisplaySolutions(solutions));
  let outcome = $derived(boardOutcome(solutions));
  let safeIndex = $derived(
    clampSolutionIndex(selectedIndex, displaySolutions.length),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  // Reset "show more" when the seated teams or difficulty change.
  let clearVideosReset = $derived(
    clearVideosResetKey(solution, clearDifficulty),
  );

  $effect(() => {
    void clearVideosReset;
    clearVideosShown = {};
  });

  $effect(() => {
    const sol = solution;
    const board = enemies;
    if (!sol || !board) return;

    const pairs = clearVideoPairs(sol, board);
    if (pairs.length === 0) return;

    const ac = new AbortController();
    ensureClearVideos(pairs, ac.signal)
      .then(() => {
        clearVideosRevision += 1;
      })
      .catch(() => {
        /* leave cache empty; UI stays quiet */
      });

    return () => ac.abort();
  });

  let loading = $derived(!$charactersHydrated || boards.kind === "loading");
  let ownedRosterPending = $derived(
    hasOwnedCharacters &&
      ($teamsOwnedStatus === "idle" || $teamsOwnedStatus === "loading"),
  );
  let waitingForOwned = $derived(
    (solverMode === "yshelper" || solverMode === "hybrid") &&
      ownedRosterPending,
  );
  let ownedTeamsFailed = $derived(
    (solverMode === "yshelper" || solverMode === "hybrid") &&
      hasOwnedCharacters &&
      $teamsOwnedStatus === "error",
  );
  let cheapClearBlocking = $derived(
    needsCheapClears && (cheapStatus === "loading" || cheapStatus === "error"),
  );
  let boardStatus = $derived(
    stygianBoardStatus({
      ownedTeamsFailed,
      waitingForOwned,
      needsCheapClears,
      cheapStatus,
      outcome,
    }),
  );

  function assignmentKey(slot: Slot): string {
    return assignmentKeyFor(solution, slot);
  }

  function stepSolution(delta: number) {
    const next = stepSolutionIndex(safeIndex, delta, displaySolutions.length);
    if (next == null) return;
    selectedIndex = next;
  }

  function clearsForSlot(slot: Slot): StygianClearVideo[] {
    void clearVideosRevision;
    return slotClearVideos(
      solution,
      enemies,
      slot,
      clearDifficulty,
      getClearVideosCached,
    );
  }

  function timeForSlot(slot: Slot): number | null {
    return slotClearTime({
      solution,
      board: enemies,
      slot,
      rows: settledRows,
      solverMode,
      maxCost,
      mapping,
    });
  }

  function clearsShownLimit(slot: Slot): number {
    return clearVideosShown[slot] ?? CLEAR_VIDEOS_PAGE;
  }

  function showMoreClears(slot: Slot) {
    clearVideosShown[slot] = clearsShownLimit(slot) + CLEAR_VIDEOS_PAGE;
  }
</script>

{#if boards.kind === "board" && boards.notice && !loading}
  {#if boards.notice === "stale"}
    <p class="page-meta">Showing the previous cycle.</p>
  {/if}
  <Button variant="secondary" onclick={retryStaticBoards}>Try again</Button>
{/if}

{#if loading}
  <LoadingState />
{:else if boards.kind === "empty-error"}
  <EmptyState message="Could not load Stygian teams right now.">
    {#snippet action()}
      <Button variant="secondary" onclick={retryStaticBoards}>Try again</Button>
    {/snippet}
  </EmptyState>
{:else if showRosterSetup}
  <EmptyState
    message="Set up your roster to find Stygian clears that match what you own."
  >
    {#snippet action()}
      <PullsCta href={settingsPath}>Configure roster</PullsCta>
    {/snippet}
  </EmptyState>
{:else}
  <Surface flush class="solution-board">
    <BoardHead
      count={displaySolutions.length}
      ready={!waitingForOwned && !cheapClearBlocking && !ownedTeamsFailed}
      {safeIndex}
      {modeHint}
      {solverMode}
      onsolvermode={(value) =>
        setDisplayPreferences({ stygianSolverMode: value })}
      onstep={stepSolution}
    />

    {#if boardStatus !== "board"}
      <BoardStatus
        status={boardStatus}
        {solverMode}
        onretryteams={retryTeamsOwned}
        onretryclears={retryCheapClears}
      />
    {:else}
      {#key safeIndex}
        <div class="board-body motion-board-swap">
          {#each STYGIAN_BOARD_SLOTS as slot (slot)}
            <div class="board-cell" data-panel-slot={slot}>
              {#key assignmentKey(slot)}
                <FieldColumn
                  {slot}
                  enemy={enemies?.[slot]}
                  assignment={solution?.assignments.find(
                    (a) => a.slot === slot,
                  )}
                  {mapping}
                  clears={clearsForSlot(slot)}
                  time={timeForSlot(slot)}
                  showTime={videoClearsMode}
                  clearsLimit={clearsShownLimit(slot)}
                  onshowmore={() => showMoreClears(slot)}
                />
              {/key}
            </div>
          {/each}
        </div>
      {/key}
    {/if}
  </Surface>

  {#if solution?.isFallback && solution.neededCharacters.length > 0}
    <p class="fallback-note">
      {#if videoClearsMode}
        Unable to find {clearDifficulty} clears with your roster — try teams similar
        to those suggested on hard or menacing.
      {:else}
        Unable to field a full board with your roster — missing characters are
        marked on each team.
      {/if}
    </p>
  {/if}
{/if}

<style>
  :global(.solution-board) {
    overflow: hidden;
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  .board-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .board-cell {
    min-width: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .board-cell + .board-cell {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  @media (min-width: 1024px) {
    .board-body {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .board-cell + .board-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }
  }

  .fallback-note {
    font-size: var(--text-xs);
    text-align: center;
    color: var(--foreground-mid);
    line-height: 1.45;
  }
</style>
