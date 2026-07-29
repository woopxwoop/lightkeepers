<script lang="ts">
  import {
    teamsOwnedStygian,
    allTeamsStygian,
    stygianEnemiesBoard,
    stygianScheduleBoard,
    staticBoardsLoaded,
    staticBoardsError,
    charactersOwned,
    ensureTeamsOwned,
    ensureStaticBoards,
    stygianVersionNumber,
  } from "$lib/stores";
  import { stygianSlotLabel } from "$lib/slotLabels";
  import { solveStygianWithFallback } from "$lib/solver";
  import {
    SOLUTIONS_COUNT,
    META_LEADERBOARD_COUNT,
    boardSlotRate,
    boardSlotScore,
    filterDisplaySolutions,
    clampSolutionIndex,
    stepSolutionIndex,
    assignmentKeyFor,
    metaLeaderboardBySlot,
    rosterFingerprint,
    teamsFingerprint,
    createMemo,
  } from "$lib/board-solutions";
  import Team from "$lib/ui/components/Team.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import {
    handleKeyboardClick,
    handlePointerAction,
  } from "$lib/ui/pointer";
  import type { StygianTeam } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";

  const SLOTS = ["top", "middle", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let enemies = $derived($stygianEnemiesBoard);
  let schedule = $derived($stygianScheduleBoard);

  // Meta boards + owned subset — warmed from bootstrap when possible.
  $effect(() => {
    ensureStaticBoards().catch(() => {});
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  async function retryStaticBoards() {
    try {
      await ensureStaticBoards();
    } catch {
      // staticBoardsError already set
    }
  }

  let selectedIndex = $state(0);

  const memoSolutions = createMemo<
    ReturnType<typeof solveStygianWithFallback>
  >();

  let solutions = $derived.by(() => {
    const owned = $teamsOwnedStygian;
    const all = $allTeamsStygian;
    const chars = $charactersOwned;
    const key = [
      stygianVersionNumber,
      rosterFingerprint(chars),
      teamsFingerprint(owned),
      teamsFingerprint(all),
      SOLUTIONS_COUNT,
    ].join("\0");
    return memoSolutions(key, () =>
      solveStygianWithFallback(
        owned,
        all,
        new Set(chars.filter((c) => c.isOwned).map((c) => c.name_id)),
        SOLUTIONS_COUNT,
      ),
    );
  });

  let displaySolutions = $derived(filterDisplaySolutions(solutions));

  let safeIndex = $derived(
    clampSolutionIndex(selectedIndex, displaySolutions.length),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(
    !$staticBoardsError &&
      !$staticBoardsLoaded &&
      $allTeamsStygian.length === 0,
  );

  let updatedLabel = $derived.by(() => {
    if (!schedule?.openTime) return "";
    return new Date(schedule.openTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  let metaParts = $derived(
    [
      schedule?.challengeName,
      updatedLabel ? `Updated ${updatedLabel}` : "",
    ].filter((part): part is string => Boolean(part)),
  );

  function slotRate(team: StygianTeam, slot: Slot): number {
    return boardSlotRate(team, slot);
  }

  function fieldScore(team: StygianTeam, slot: Slot): number {
    return boardSlotScore(team, slot);
  }

  let metaByField = $derived(
    metaLeaderboardBySlot(
      $allTeamsStygian,
      SLOTS,
      META_LEADERBOARD_COUNT,
    ) as Record<Slot, StygianTeam[]>,
  );

  function assignmentKey(slot: Slot): string {
    return assignmentKeyFor(solution, slot);
  }

  function stepSolution(delta: number) {
    const next = stepSolutionIndex(safeIndex, delta, displaySolutions.length);
    if (next == null) return;
    selectedIndex = next;
  }
</script>

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
      {enemy?.enemy_name ?? stygianSlotLabel[slot]}
    </h2>

    <div class="hero-body">
      {#if assignment}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="rate-row">
          <span>{(assignment.team.usage_rate ?? 0).toFixed(1)}% usage</span>
          <span class="rate-slot"
            >{slotRate(assignment.team, slot).toFixed(0)}% in this field</span
          >
        </div>
      {:else if solution}
        <div class="panel-empty">
          <p>No team available for this field</p>
        </div>
      {:else}
        <div class="panel-empty">
          <p>Set up your roster in Settings</p>
        </div>
      {/if}
    </div>
  </section>
{/snippet}

{#snippet metaColumn(slot: Slot)}
  {@const teams = metaByField[slot]}

  <section class="meta-column">
    <h3 class="meta-field-heading">
      {enemies?.[slot]?.enemy_name ?? stygianSlotLabel[slot]}
    </h3>

    {#if teams.length === 0}
      <p class="meta-empty">No meta data yet</p>
    {:else}
      <ol class="meta-list">
        {#each teams as team, i (team.team_key ?? i)}
          <li class="meta-row">
            <div class="meta-place">
              <span class="meta-rank">{i + 1}</span>
              <span
                class="meta-score"
                title={`${(team.usage_rate ?? 0).toFixed(1)}% usage × ${slotRate(team, slot).toFixed(0)}% field rate = ${fieldScore(team, slot).toFixed(1)}%`}
                aria-label={`${fieldScore(team, slot).toFixed(1)} percent usage index: ${(team.usage_rate ?? 0).toFixed(1)} percent usage times ${slotRate(team, slot).toFixed(0)} percent field rate`}
                >{fieldScore(team, slot).toFixed(1)}%</span
              >
            </div>
            <div class="meta-team">
              <Team {team} {mapping} />
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/snippet}

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Stygian Onslaught</h1>
      {#if metaParts.length > 0}
        <p class="page-meta">
          {#each metaParts as part, index (part)}
            {#if index > 0}
              <span class="page-meta-sep" aria-hidden="true">·</span>
            {/if}
            <span>{part}</span>
          {/each}
        </p>
      {/if}
    </div>
  </header>

  {#if loading}
    <LoadingState />
  {:else if $staticBoardsError && $allTeamsStygian.length === 0}
    <EmptyState message="Could not load Stygian teams right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryStaticBoards}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <Surface flush class="solution-board">
      <div class="board-head">
        <div class="board-head-left">
          <span class="board-eyebrow">
            Solution {safeIndex + 1}
            <span class="board-eyebrow-total">of {displaySolutions.length}</span>
          </span>
        </div>

        <div class="board-actions">
          {#if displaySolutions.length > 1}
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

      <div class="board-body">
        {#each SLOTS as slot (slot)}
          <div class="board-cell" data-panel-slot={slot}>
            {#key assignmentKey(slot)}
              {@render fieldColumn(slot)}
            {/key}
          </div>
        {/each}
      </div>
    </Surface>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="fallback-note">
        Unable to find fearless mode clears with your roster — try teams similar
        to those suggested on hard or menacing.
      </p>
    {/if}

    <section class="meta-section">
      <header class="meta-head">
        <h2 class="meta-title">Meta teams</h2>
        <p class="meta-lede">
          Teams with the highest
          <span
            class="meta-term"
            title="usage rate × rate of appearing in this field"
            >usage index</span
          > in each field
        </p>
      </header>

      <div class="meta-board">
        {#each SLOTS as slot (slot)}
          {@render metaColumn(slot)}
        {/each}
      </div>
    </section>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  /* ── Solution board ─────────────────────────────────────────────── */
  /* Board hairlines are pure white — warm tones over blue mid mix to mud. */
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
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .board-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .board-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
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

  /* ── Field hero: boss art as backdrop, team composited on top ───── */
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
    /* Bottom padding is width-relative — it reserves the boss-art area
       between the heading and the composited team. */
    padding: var(--space-3) var(--space-3) 34%;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
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

  .panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
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

  /* ── Meta leaderboard ───────────────────────────────────────────── */
  .meta-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-top: var(--space-2);
  }

  .meta-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .meta-lede {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  .meta-term {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: help;
  }

  .meta-board {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }

  @media (min-width: 1024px) {
    .meta-board {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
    }

    /* Equal inline padding on every column so portrait widths (and thus
       3:4 heights) stay matched — asymmetric outer padding used to make
       the middle field's teams noticeably shorter. */
    .meta-column {
      min-width: 0;
      padding-inline: var(--space-4);
    }

    .meta-column + .meta-column {
      border-left: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 14%, transparent);
    }
  }

  .meta-field-heading {
    margin-bottom: var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .meta-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
  }

  .meta-place {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .meta-rank {
    width: 100%;
    padding-bottom: 0.2rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 24%, transparent);
    text-align: center;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--foreground-mid);
  }

  .meta-team {
    min-width: 0;
  }

  .meta-score {
    margin-top: 0.2rem;
    font-size: var(--text-xs);
    color: var(--foreground-color);
    font-weight: 500;
    cursor: help;
  }

  .meta-empty {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }
</style>
