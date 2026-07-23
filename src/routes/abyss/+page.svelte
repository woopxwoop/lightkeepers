<script lang="ts">
  import {
    teamsOwned,
    allTeamsAbyss,
    staticBoardsLoaded,
    charactersOwned,
    ensureTeamsOwned,
    ensureStaticBoards,
  } from "$lib/stores";
  import { solveAbyssWithFallback } from "$lib/solver";
  import Team from "$lib/ui/components/Team.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import type { AbyssEnemies, AbyssTeam } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";
  import {
    handleKeyboardClick,
    handlePointerAction,
  } from "$lib/ui/pointer";

  const SLOTS = ["top", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];

  const SOLUTIONS_COUNT = 6;
  const META_LEADERBOARD_COUNT = 5;

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let abyssEnemies = $derived(data.abyssEnemies as AbyssEnemies);

  // Meta boards + owned subset — warmed from bootstrap when possible.
  $effect(() => {
    ensureStaticBoards().catch(console.error);
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  const halfLabel: Record<Slot, string> = {
    top: "First Half",
    bottom: "Second Half",
  };

  let selectedIndex = $state(0);
  let enemiesExpanded = $state(true);

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let solutions = $derived(
    solveAbyssWithFallback(
      $teamsOwned,
      $allTeamsAbyss,
      ownedNames,
      SOLUTIONS_COUNT,
    ),
  );

  let displaySolutions = $derived.by(() => {
    const complete = solutions.filter((s) => s.unfilled.length === 0);
    return complete.length > 0 ? complete : solutions.slice(0, 3);
  });

  let safeIndex = $derived(
    Math.min(selectedIndex, Math.max(0, displaySolutions.length - 1)),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(!$staticBoardsLoaded && $allTeamsAbyss.length === 0);

  let updatedLabel = $derived.by(() => {
    if (!abyssEnemies?.openTime) return "";
    return new Date(abyssEnemies.openTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  function slotRate(team: AbyssTeam, slot: Slot): number {
    if (slot === "top") return team.field_1_rate ?? 0;
    return team.field_2_rate ?? 0;
  }

  /** Popularity × half preference — ranks teams for a specific half. */
  function halfScore(team: AbyssTeam, slot: Slot): number {
    return (team.usage_rate ?? 0) * (slotRate(team, slot) / 100);
  }

  let metaByHalf = $derived.by(() => {
    const teams = $allTeamsAbyss.filter(
      (team) => (team.members ?? []).length === 4,
    );
    return Object.fromEntries(
      SLOTS.map((slot) => [
        slot,
        [...teams]
          .sort((a, b) => halfScore(b, slot) - halfScore(a, slot))
          .slice(0, META_LEADERBOARD_COUNT),
      ]),
    ) as Record<Slot, AbyssTeam[]>;
  });

  function assignmentKey(slot: Slot): string {
    const teamKey = solution?.assignments.find(
      (assignment) => assignment.slot === slot,
    )?.team.team_key;
    return `${slot}:${String(teamKey ?? "empty")}`;
  }

  function stepSolution(delta: number) {
    const next = safeIndex + delta;
    if (next < 0 || next > displaySolutions.length - 1) return;
    selectedIndex = next;
  }
</script>

{#snippet halfColumn(slot: Slot)}
  {@const sideEnemies = abyssEnemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}

  <section class="half">
    <h2 class="half-heading">{halfLabel[slot]}</h2>

    <!-- Chamber enemies — dynamic 3-chamber strip preserved -->
    <div
      id={`abyss-enemies-${slot}`}
      class="enemy-disclosure"
      class:enemy-disclosure-collapsed={!enemiesExpanded}
      aria-hidden={!enemiesExpanded}
    >
      <div class="enemy-disclosure-inner">
        <div class="chamber-strip">
          {#if sideEnemies && sideEnemies.length > 0}
            <div class="chambers">
              {#each sideEnemies as chamber}
                <div class="chamber">
                  <div class="chamber-enemies">
                    {#each chamber.enemies.slice(0, 3) as enemy}
                      {#if enemy.asset}
                        <img
                          src={getEnemyAsset(enemy.asset)}
                          alt={enemy.name}
                          title={enemy.name}
                          class="enemy-portrait"
                        />
                      {/if}
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="chamber-empty">
              <span>No enemy data</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="team-block">
      {#if assignment}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="rate-row">
          <span>{(assignment.team.usage_rate ?? 0).toFixed(1)}% usage</span>
          <span class="rate-slot"
            >{slotRate(assignment.team, slot).toFixed(0)}% in this half</span
          >
        </div>
      {:else if solution}
        <div class="panel-empty">
          <p>No team available for this side</p>
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
  {@const teams = metaByHalf[slot]}

  <section class="meta-column">
    <h3 class="meta-half-heading">{halfLabel[slot]}</h3>

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
                title={`${(team.usage_rate ?? 0).toFixed(1)}% usage × ${slotRate(team, slot).toFixed(0)}% ${halfLabel[slot].toLowerCase()} rate = ${halfScore(team, slot).toFixed(1)}%`}
                aria-label={`${halfScore(team, slot).toFixed(1)} percent usage index: ${(team.usage_rate ?? 0).toFixed(1)} percent usage times ${slotRate(team, slot).toFixed(0)} percent ${halfLabel[slot].toLowerCase()} rate`}
                >{halfScore(team, slot).toFixed(1)}%</span
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
      <h1 class="page-title">Spiral Abyss</h1>
      {#if updatedLabel || abyssEnemies?.buffName}
        <p class="page-meta">
          {#if abyssEnemies?.buffName}
            <span title="Abyssal Moon blessing">{abyssEnemies.buffName}</span>
          {/if}
          {#if updatedLabel && abyssEnemies?.buffName}
            <span class="page-meta-sep" aria-hidden="true">·</span>
          {/if}
          {#if updatedLabel}
            <span>Updated {updatedLabel}</span>
          {/if}
        </p>
      {/if}
    </div>
  </header>

  {#if loading}
    <LoadingState />
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
            <button
              type="button"
              class="enemy-toggle"
              aria-expanded={enemiesExpanded}
              aria-controls="abyss-enemies-top abyss-enemies-bottom"
              aria-label={enemiesExpanded ? "Hide enemies" : "Show enemies"}
              onpointerdown={(event) =>
                handlePointerAction(event, () => {
                  enemiesExpanded = !enemiesExpanded;
                })}
              onclick={(event) =>
                handleKeyboardClick(event, () => {
                  enemiesExpanded = !enemiesExpanded;
                })}
            >
            <span>Enemies</span>
            <IconChevronDown size={14} strokeWidth={2.25} />
          </button>

          {#if displaySolutions.length > 1}
            <div class="pager">
              <button
                type="button"
                class="pager-btn"
                aria-label="Previous solution"
                disabled={safeIndex === 0}
                onclick={() => stepSolution(-1)}
              >
                <IconChevronDown size={16} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                class="pager-btn pager-btn-next"
                aria-label="Next solution"
                disabled={safeIndex === displaySolutions.length - 1}
                onclick={() => stepSolution(1)}
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
              {@render halfColumn(slot)}
            {/key}
          </div>
        {/each}
      </div>
    </Surface>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="fallback-note">
        Unable to find floor 12 clears with your roster — try teams similar to
        those suggested, or check Pull suggestions.
      </p>
    {/if}

    <section class="meta-section">
      <header class="meta-head">
        <h2 class="meta-title">Meta teams</h2>
        <p class="meta-lede">
          Teams with the highest
          <span
            class="meta-term"
            title="usage rate × rate of appearing in this half"
            >usage index</span
          > in each side
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

  .page-head-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .page-meta-sep {
    opacity: 0.6;
  }

  /* ── Solution board ─────────────────────────────────────────────── */
  /* Board hairlines are pure white — any warm tone (gold or cream) over the
     blue-tinted mid surface mixes to mud. */
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

  .enemy-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    background: var(--surface-raised);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 500;
    transition: var(--control-transition);
  }

  .enemy-toggle:hover {
    color: var(--foreground-color);
    border-color: var(--border-strong);
  }

  .enemy-toggle :global(svg) {
    transition: transform var(--control-duration) var(--control-ease);
  }

  .enemy-toggle[aria-expanded="true"] :global(svg) {
    transform: rotate(180deg);
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

  /* Chevron points down by default — rotate to make left / right */
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .board-cell + .board-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }
  }

  .half {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .half-heading {
    margin-bottom: var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .enemy-disclosure {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transition:
      grid-template-rows var(--control-duration) var(--control-ease),
      opacity var(--control-duration) var(--control-ease);
  }

  .enemy-disclosure-collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .enemy-disclosure-inner {
    min-height: 0;
    overflow: hidden;
  }

  .chamber-strip {
    padding-bottom: var(--space-3);
    border-bottom: var(--border-width) solid var(--border-default);
  }

  .chambers {
    display: flex;
  }

  .chamber {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.5rem;
  }

  .chamber-enemies {
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 0.25rem;
  }

  .enemy-portrait {
    min-width: 2rem;
    flex-grow: 1;
    height: 4rem;
    border-radius: var(--radius-md);
    object-fit: cover;
    border: 1px solid var(--border-subtle);
  }

  .chamber-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .team-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: var(--space-3);
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
    }

    .meta-column + .meta-column {
      padding-left: var(--space-5);
      border-left: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 14%, transparent);
    }

    .meta-column:first-child {
      padding-right: var(--space-5);
    }
  }

  .meta-half-heading {
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
