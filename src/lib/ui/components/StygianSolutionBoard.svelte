<script lang="ts">
  import { untrack } from "svelte";
  import {
    teamsOwnedStygian,
    allTeamsStygian,
    stygianEnemiesBoard,
    staticBoardsLoaded,
    staticBoardsError,
    charactersOwned,
    charactersHydrated,
    teamsOwnedLoaded,
    ensureTeamsOwned,
    ensureStaticBoards,
    displayPreferences,
    setDisplayPreferences,
    stygianVersionNumber,
    abyssVersionNumber,
    hasSavedRoster,
  } from "$lib/stores";
  import { stygianSlotLabel } from "$lib/slotLabels";
  import {
    solveStygianWithFallback,
    solveStygianCheapClears,
    solveStygianHybrid,
    SOLVER_REVISION,
  } from "$lib/solver";
  import {
    SOLUTIONS_COUNT,
    boardSlotRate,
    filterDisplaySolutions,
    clampSolutionIndex,
    stepSolutionIndex,
    assignmentKeyFor,
    createMemo,
    rosterFingerprint,
    teamsFingerprint,
    characterMetaFingerprint,
    cheapClearsFingerprint,
  } from "$lib/board-solutions";
  import { ownedNameIds, getEnemyAsset } from "$lib/utils";
  import Team from "$lib/ui/components/Team.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import InfoPopover from "$lib/ui/components/InfoPopover.svelte";
  import IconPlay from "$lib/ui/icons/IconPlay.svelte";
  import { handleKeyboardClick, handlePointerAction } from "$lib/ui/pointer";
  import {
    STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST,
    STYGIAN_CHEAP_CLEARS_DIFFICULTY,
    STYGIAN_CLEAR_DIFFICULTY_OPTIONS,
    STYGIAN_SOLVER_MODE_OPTIONS,
    STYGIAN_SOLVER_MODE_OPTIONS_RELEASE,
    toStygianSolverModeRelease,
    type Character,
    type StygianTeam,
    type StygianClearVideo,
    type StygianCheapClearRow,
    type StygianClearDifficulty,
    type StygianSolverMode,
  } from "$lib/definitions";
  import {
    STYGIAN_C0R0_CLEAR_MAX_COST,
    c0r0ClearPairKeys,
    clearTimeAtCap,
    clearTimeAtCostCeiling,
    floorTeamCost,
  } from "$lib/team-cost";
  import { resolve } from "$app/paths";
  import { settingsPath } from "$lib/ui/nav-links";
  import { authClient } from "$lib/auth-client";
  import {
    ensureClearVideos,
    getClearVideosCached,
    youtubeThumbnailFallbackUrl,
    youtubeThumbnailUrl,
  } from "$lib/app/stygian-clear-videos";
  import { ensureCheapClears } from "$lib/app/stygian-cheap-clears";

  const SLOTS = ["top", "middle", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  const CLEAR_VIDEOS_PAGE = 5;
  type SolutionsResult = {
    solutions: ReturnType<typeof solveStygianWithFallback>;
    mode: StygianSolverMode | "hybrid" | "yshelper";
  };
  const memoSolutions = createMemo<SolutionsResult>();

  let {
    mapping,
    maxCost = STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST,
    /** Dev keeps Dire + all seating modes; release is Fearless-only trio. */
    variant = "release",
  }: {
    mapping: Map<string, Character>;
    /** Inclusive Fearless clear cost cap before ranking by time. */
    maxCost?: number;
    variant?: "release" | "dev";
  } = $props();

  let enemies = $derived($stygianEnemiesBoard);
  let storedSolverMode = $derived($displayPreferences.stygianSolverMode);
  let solverMode = $derived(
    variant === "release"
      ? toStygianSolverModeRelease(storedSolverMode)
      : storedSolverMode,
  );
  let clearDifficulty = $derived(
    variant === "release"
      ? STYGIAN_CHEAP_CLEARS_DIFFICULTY
      : $displayPreferences.stygianClearDifficulty,
  );
  let solverModeOptions = $derived(
    variant === "release"
      ? STYGIAN_SOLVER_MODE_OPTIONS_RELEASE
      : STYGIAN_SOLVER_MODE_OPTIONS,
  );
  let videoClearsMode = $derived(
    solverMode === "video" || solverMode === "video-c0r0",
  );
  let needsCheapClears = $derived(videoClearsMode || solverMode === "hybrid");
  /**
   * Fetch at least a full baseline span (4 limited 5★s); raise p_max_cost when
   * video mode asks for a higher cap so the frontier covers that ceiling.
   */
  let cheapClearsFetchMaxCost = $derived(
    Math.max(STYGIAN_C0R0_CLEAR_MAX_COST, Math.ceil(maxCost)),
  );

  $effect(() => {
    ensureStaticBoards().catch(() => {});
    // Versions seed from layout / static boards — don't POST /api/teams with -1.
    // Re-subscribe when boards load so we retry after setVersionNumbers.
    void $staticBoardsLoaded;
    if (abyssVersionNumber < 0 || stygianVersionNumber < 0) return;
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  async function retryStaticBoards() {
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      // staticBoardsError already set
    }
  }

  let selectedIndex = $state(0);
  let clearVideosRevision = $state(0);
  let clearVideosShown = $state<Partial<Record<Slot, number>>>({});
  /** null = not loaded yet; [] = loaded empty / error. */
  let cheapClearsRows = $state<StygianCheapClearRow[] | null>(null);

  let hasOwnedCharacters = $derived(
    $charactersOwned.some((character) => character.isOwned),
  );

  const session = authClient.useSession();
  /** Same gate as the home-page “configure roster first” card. */
  let showRosterSetup = $derived(
    !$session.isPending && !$hasSavedRoster && !$session.data,
  );

  $effect(() => {
    if (!needsCheapClears) {
      untrack(() => {
        if (cheapClearsRows !== null) cheapClearsRows = null;
      });
      return;
    }

    // Module version ints aren't reactive — re-run when boards finish applying
    // (that path also seeds stygianVersionNumber).
    void $staticBoardsLoaded;
    if (!$staticBoardsLoaded || stygianVersionNumber < 0) return;

    const board = enemies;
    if (!board || !hasOwnedCharacters) {
      untrack(() => {
        if (cheapClearsRows !== null) cheapClearsRows = null;
      });
      return;
    }
    const enemyIds = SLOTS.map((slot) => board[slot]?.id).filter(
      (id): id is number => typeof id === "number" && id > 0,
    );
    if (enemyIds.length < 3) {
      untrack(() => {
        if (cheapClearsRows === null || cheapClearsRows.length > 0) {
          cheapClearsRows = [];
        }
      });
      return;
    }

    const owned = $charactersOwned;
    const version = stygianVersionNumber;
    const costCap = cheapClearsFetchMaxCost;
    const difficulty = clearDifficulty;
    untrack(() => {
      cheapClearsRows = null;
    });
    const ac = new AbortController();
    ensureCheapClears({
      owned,
      stygianVersion: version,
      enemyIds,
      maxCost: costCap,
      difficulty,
      signal: ac.signal,
    })
      .then((rows) => {
        if (ac.signal.aborted) return;
        cheapClearsRows = rows;
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        cheapClearsRows = [];
      });

    return () => ac.abort();
  });

  let solutionsResult = $derived.by(() => {
    const needsOwnedTeams =
      solverMode === "yshelper" || solverMode === "hybrid";
    if (needsOwnedTeams && hasOwnedCharacters && !$teamsOwnedLoaded) {
      return { solutions: [], mode: solverMode };
    }

    const owned = $charactersOwned;
    const teams = $teamsOwnedStygian;
    const all = $allTeamsStygian;
    const topId = enemies?.top?.id;
    const middleId = enemies?.middle?.id;
    const bottomId = enemies?.bottom?.id;
    const slotEnemies =
      topId && middleId && bottomId
        ? { top: topId, middle: middleId, bottom: bottomId }
        : null;

    const cheapKey =
      cheapClearsRows === null
        ? "null"
        : cheapClearsFingerprint(cheapClearsRows);
    const key = [
      SOLVER_REVISION,
      solverMode,
      String(maxCost),
      rosterFingerprint(owned),
      teamsFingerprint(teams),
      teamsFingerprint(all),
      characterMetaFingerprint(mapping),
      slotEnemies
        ? `${slotEnemies.top}:${slotEnemies.middle}:${slotEnemies.bottom}`
        : "none",
      cheapKey,
    ].join("|");

    return memoSolutions(key, () => {
      if (solverMode === "hybrid") {
        if (!slotEnemies || cheapClearsRows === null) {
          return { solutions: [], mode: "hybrid" as const };
        }
        const c0r0Pairs = c0r0ClearPairKeys(cheapClearsRows, mapping);
        return {
          solutions: solveStygianHybrid(
            teams,
            all,
            ownedNameIds(owned),
            slotEnemies,
            c0r0Pairs,
            SOLUTIONS_COUNT,
          ),
          mode: "hybrid" as const,
        };
      }

      if (videoClearsMode && cheapClearsRows && slotEnemies) {
        return {
          solutions: solveStygianCheapClears(
            cheapClearsRows,
            slotEnemies,
            SOLUTIONS_COUNT,
            mapping,
            solverMode === "video-c0r0",
            maxCost,
          ),
          mode: solverMode,
        };
      }

      if (videoClearsMode) {
        return { solutions: [], mode: solverMode };
      }

      return {
        solutions: solveStygianWithFallback(
          teams,
          all,
          ownedNameIds(owned),
          SOLUTIONS_COUNT,
        ),
        mode: "yshelper" as const,
      };
    });
  });

  let solutions = $derived(solutionsResult.solutions);
  let showingVideoClears = $derived(videoClearsMode);
  let displaySolutions = $derived(filterDisplaySolutions(solutions));
  let safeIndex = $derived(
    clampSolutionIndex(selectedIndex, displaySolutions.length),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  // Reset "show more" when the seated teams or difficulty change.
  let clearVideosResetKey = $derived(
    solution
      ? `${clearDifficulty}|${solution.assignments
          .map((a) => `${a.slot}:${a.team.team_key ?? ""}`)
          .join("|")}`
      : clearDifficulty,
  );

  $effect(() => {
    void clearVideosResetKey;
    clearVideosShown = {};
  });

  $effect(() => {
    const sol = solution;
    const board = enemies;
    if (!sol || !board) return;

    const pairs = SLOTS.flatMap((slot) => {
      const assignment = sol.assignments.find((a) => a.slot === slot);
      const enemy = board[slot];
      const teamKey = assignment?.team?.team_key;
      if (!teamKey || enemy?.id == null) return [];
      return [{ team_key: teamKey, enemy_id: enemy.id }];
    });
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

  let loading = $derived(
    !$charactersHydrated ||
      (!$staticBoardsError &&
        !$staticBoardsLoaded &&
        $allTeamsStygian.length === 0),
  );
  let waitingForOwned = $derived(
    (solverMode === "yshelper" || solverMode === "hybrid") &&
      hasOwnedCharacters &&
      !$teamsOwnedLoaded,
  );
  let waitingForCheapClears = $derived(
    needsCheapClears &&
      hasOwnedCharacters &&
      cheapClearsRows === null &&
      $staticBoardsLoaded &&
      !!enemies?.top?.id &&
      !!enemies?.middle?.id &&
      !!enemies?.bottom?.id,
  );

  function slotRate(team: StygianTeam, slot: Slot): number {
    return boardSlotRate(team, slot);
  }

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
    const assignment = solution?.assignments.find((a) => a.slot === slot);
    const enemy = enemies?.[slot];
    const teamKey = assignment?.team?.team_key;
    if (!teamKey || enemy?.id == null) return [];
    const cached = getClearVideosCached(teamKey, enemy.id) ?? [];
    return cached.filter((clear) => clear.difficulty === clearDifficulty);
  }

  function timeForSlot(slot: Slot): number | null {
    const assignment = solution?.assignments.find((a) => a.slot === slot);
    const enemy = enemies?.[slot];
    const row = cheapClearsRows?.find(
      (candidate) =>
        candidate.team_key === assignment?.team.team_key &&
        candidate.enemy_id === enemy?.id,
    );
    if (!row || !assignment) return null;
    if (solverMode === "video-c0r0") {
      return clearTimeAtCostCeiling(
        row,
        floorTeamCost(assignment.team.members ?? [], mapping),
      );
    }
    return clearTimeAtCap(row, maxCost);
  }

  function videoHostLabel(url: string): string {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host.includes("youtu")) return "YouTube";
      if (host.includes("bilibili")) return "Bilibili";
      return "Video";
    } catch {
      return "Video";
    }
  }

  function clearVideoLabel(clear: StygianClearVideo): string {
    const host = videoHostLabel(clear.video_url);
    const cost = clear.cost != null ? `cost ${clear.cost}` : null;
    const time = clear.time_s != null ? `${clear.time_s}s` : null;
    const bits = [clear.difficulty, cost, time].filter(Boolean);
    return bits.length ? `${host} · ${bits.join(" · ")}` : host;
  }

  function clearsShownLimit(slot: Slot): number {
    return clearVideosShown[slot] ?? CLEAR_VIDEOS_PAGE;
  }

  function showMoreClears(slot: Slot) {
    clearVideosShown[slot] = clearsShownLimit(slot) + CLEAR_VIDEOS_PAGE;
  }
</script>

{#snippet enemyLabel(slot: Slot, linkClass: string)}
  {@const enemy = enemies?.[slot]}
  {#if enemy}
    <a class={linkClass} href={resolve(`/tools/stygian/enemies/${enemy.id}`)}
      >{enemy.enemy_name ?? stygianSlotLabel[slot]}</a
    >
  {:else}
    {stygianSlotLabel[slot]}
  {/if}
{/snippet}

{#snippet fieldColumn(slot: Slot)}
  {@const enemy = enemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}

  <section class="field-hero">
    {#if enemy?.asset}
      <img
        src={getEnemyAsset(enemy.asset)}
        alt=""
        class="hero-img"
        aria-hidden="true"
      />
    {/if}
    <div class="hero-scrim" aria-hidden="true"></div>

    <h2 class="field-heading">
      {@render enemyLabel(slot, "field-heading-link")}
    </h2>

    <div class="hero-body">
      {#if assignment}
        {@const clears = clearsForSlot(slot)}
        {@const time = timeForSlot(slot)}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="rate-row">
          <span>
            {#if showingVideoClears && time != null}
              {time}s
            {:else}
              {(assignment.team.usage_rate ?? 0).toFixed(1)}% usage
            {/if}
          </span>
          <span class="rate-slot"
            >{slotRate(assignment.team, slot).toFixed(0)}% in this field</span
          >
        </div>

        {#if clears.length > 0}
          {@const shown = Math.min(clears.length, clearsShownLimit(slot))}
          <div class="clear-videos">
            <InfoPopover
              label={clears.length === 1
                ? "1 video"
                : `${clears.length} videos`}
              align="start"
              class="clear-videos-trigger"
              panelClass="clear-videos-panel"
              anchorSelector=".field-hero"
            >
              {#snippet icon()}
                <IconPlay size={12} />
              {/snippet}
              <ul class="clear-videos-panel-list">
                {#each clears.slice(0, shown) as clear (clear.clear_key)}
                  {@const thumb = youtubeThumbnailUrl(clear.video_url)}
                  <li>
                    <a
                      class="clear-video-link"
                      href={clear.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {#if thumb}
                        <img
                          class="clear-video-thumb"
                          src={thumb}
                          alt=""
                          width="320"
                          height="180"
                          loading="lazy"
                          decoding="async"
                          onerror={(event) => {
                            const img = event.currentTarget as HTMLImageElement;
                            if (img.dataset.ytFallback === "1") return;
                            const fallback = youtubeThumbnailFallbackUrl(
                              clear.video_url,
                            );
                            if (!fallback) return;
                            img.dataset.ytFallback = "1";
                            img.src = fallback;
                          }}
                        />
                      {/if}
                      <span class="clear-video-meta"
                        >{clearVideoLabel(clear)}</span
                      >
                    </a>
                  </li>
                {/each}
              </ul>
              {#if shown < clears.length}
                <button
                  type="button"
                  class="clear-videos-more"
                  onclick={() => showMoreClears(slot)}
                >
                  Show more · {clears.length - shown} left
                </button>
              {/if}
            </InfoPopover>
          </div>
        {/if}
      {:else}
        <div class="panel-empty">
          <p>No team available for this field</p>
        </div>
      {/if}
    </div>
  </section>
{/snippet}

{#if loading}
  <LoadingState />
{:else if $staticBoardsError && $allTeamsStygian.length === 0}
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
      <a class="pulls-cta" href={settingsPath}>Configure roster</a>
    {/snippet}
  </EmptyState>
{:else}
  <Surface flush class="solution-board">
    <div class="board-head">
      <div class="board-head-left">
        {#if displaySolutions.length > 0 && !waitingForOwned && !waitingForCheapClears}
          <span class="eyebrow board-eyebrow">
            Solution {safeIndex + 1}
            <span class="board-eyebrow-total">of {displaySolutions.length}</span
            >
          </span>
        {:else}
          <span class="eyebrow board-eyebrow">Solutions</span>
        {/if}
      </div>

      <div class="board-actions">
        {#if variant === "dev" && needsCheapClears}
          <SegmentedControl
            class="clear-difficulty"
            aria-label="Clear difficulty"
            options={[...STYGIAN_CLEAR_DIFFICULTY_OPTIONS]}
            bind:value={
              () => clearDifficulty,
              (value: StygianClearDifficulty) =>
                setDisplayPreferences({ stygianClearDifficulty: value })
            }
          />
        {/if}
        <Select
          class="solver-mode-select"
          aria-label="Stygian solution source"
          options={[...solverModeOptions]}
          bind:value={
            () => solverMode,
            (value: StygianSolverMode) =>
              setDisplayPreferences({ stygianSolverMode: value })
          }
        />
        {#if displaySolutions.length > 1 && !waitingForOwned && !waitingForCheapClears}
          <div class="pager">
            <button
              type="button"
              class="pager-btn"
              aria-label="Previous solution"
              disabled={safeIndex === 0}
              onpointerdown={(event) =>
                handlePointerAction(event, () => stepSolution(-1))}
              onclick={(event) =>
                handleKeyboardClick(event, () => stepSolution(-1))}
            >
              <IconChevronDown size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              class="pager-btn pager-btn-next"
              aria-label="Next solution"
              disabled={safeIndex === displaySolutions.length - 1}
              onpointerdown={(event) =>
                handlePointerAction(event, () => stepSolution(1))}
              onclick={(event) =>
                handleKeyboardClick(event, () => stepSolution(1))}
            >
              <IconChevronDown size={16} strokeWidth={2.25} />
            </button>
          </div>
        {/if}
      </div>
    </div>

    {#if waitingForOwned}
      <div class="board-status">
        <LoadingState variant="pulse" message="Matching your roster…" />
      </div>
    {:else if waitingForCheapClears}
      <div class="board-status">
        <LoadingState variant="pulse" message="Matching fastest clears…" />
      </div>
    {:else if displaySolutions.length === 0}
      <div class="board-status">
        {#if videoClearsMode}
          <EmptyState
            message={`No ${clearDifficulty} clears within the cost cap for your roster.`}
          />
        {:else if solverMode === "hybrid"}
          <EmptyState
            message={`No viable ${clearDifficulty} hybrid board for your roster.`}
          />
        {:else}
          <EmptyState
            message="No viable field clears for your roster. Pull for characters that unlock better teams."
          >
            {#snippet action()}
              <a class="pulls-cta" href={resolve("/tools/pulls")}
                >See pull suggestions</a
              >
            {/snippet}
          </EmptyState>
        {/if}
      </div>
    {:else}
      <div class="board-body">
        {#each SLOTS as slot (slot)}
          <div class="board-cell" data-panel-slot={slot}>
            {#key assignmentKey(slot)}
              {@render fieldColumn(slot)}
            {/key}
          </div>
        {/each}
      </div>
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

  .board-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-subtle);
    background: var(--surface-inset);
  }

  .board-head-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
    min-width: 0;
  }

  .board-eyebrow {
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .board-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .board-actions,
  .pager {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .board-actions {
    gap: var(--space-2);
  }

  .board-actions :global(.clear-difficulty .segment) {
    padding: 0.3rem 0.55rem;
    font-size: var(--text-xs);
  }

  .board-status {
    padding: var(--space-6) var(--space-4);
  }

  .pager {
    gap: 0.25rem;
  }

  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    background: var(--surface-raised);
    transition: var(--control-transition);
  }

  .pager-btn :global(svg) {
    transform: rotate(90deg);
  }

  .pager-btn-next :global(svg) {
    transform: rotate(-90deg);
  }

  .pager-btn:hover:not(:disabled) {
    color: var(--accent-1);
    border-color: var(--border-strong);
  }

  .pager-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .board-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .board-cell {
    min-width: 0;
    padding: var(--space-4);
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

  .field-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: color-mix(
      in srgb,
      var(--foreground-color) 4%,
      var(--background-color)
    );
  }

  .hero-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: contain;
    transform: scale(1.35);
    transform-origin: 50% 25%;
    pointer-events: none;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--background-color) 35%, transparent) 0%,
      transparent 22%,
      transparent 40%,
      color-mix(in srgb, var(--background-color) 88%, transparent) 72%,
      var(--background-color) 100%
    );
    pointer-events: none;
  }

  .field-heading {
    position: relative;
    z-index: 1;
    padding: var(--space-3) var(--space-3) 34%;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
  }

  .field-heading-link {
    color: inherit;
    text-decoration: none;
  }

  .field-heading-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .hero-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: auto;
    padding: var(--space-5) var(--space-3) var(--space-3);
  }

  .rate-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .rate-slot {
    color: var(--accent-1);
  }

  .clear-videos {
    display: flex;
    align-items: baseline;
  }

  :global(.clear-videos-trigger) {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  :global(.info-panel.clear-videos-panel) {
    max-height: min(22rem, calc(100vh - 2rem));
    padding: 0.65rem 0.75rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--background-color) 32%,
        transparent
      )
      transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar) {
    width: 0.55rem;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb) {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--background-color) 32%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb:hover) {
    background: color-mix(in srgb, var(--background-color) 48%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .clear-videos-panel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .clear-video-link {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: inherit;
    text-decoration: none;
  }

  .clear-video-thumb {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 3px;
    background: color-mix(in srgb, var(--background-color) 25%, transparent);
  }

  .clear-video-meta {
    text-decoration: underline;
    text-underline-offset: 0.12em;
    line-height: 1.35;
  }

  .clear-video-link:hover .clear-video-meta {
    opacity: 0.85;
  }

  .clear-videos-more {
    margin: 0.45rem 0 0;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.12em;
    opacity: 0.75;
  }

  .clear-videos-more:hover {
    opacity: 1;
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 2rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .fallback-note {
    font-size: var(--text-xs);
    text-align: center;
    color: var(--foreground-mid);
    line-height: 1.45;
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
