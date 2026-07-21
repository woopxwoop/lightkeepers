<script lang="ts">
  import { teamsOwned, allTeamsAbyss, charactersOwned } from "$lib/stores";
  import { solveAbyssWithFallback, solveAbyss } from "$lib/solver";
  import Team from "$lib/ui/components/Team.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";
  import SolutionDots from "$lib/ui/components/SolutionDots.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import type { AbyssTeam } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";

  const SLOTS = ["top", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];

  const MODE_OPTIONS = [
    { value: "roster" as const, label: "roster" },
    { value: "meta" as const, label: "meta" },
  ];

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let abyssEnemies = $derived(
    data.abyssEnemies as {
      top: {
        chamber: number;
        monsterLevel: number;
        enemies: { id: number; name: string; asset: string | null }[];
      }[];
      bottom: {
        chamber: number;
        monsterLevel: number;
        enemies: { id: number; name: string; asset: string | null }[];
      }[];
      buffName: string | null;
      openTime: string | null;
    },
  );

  const halfLabel: Record<Slot, string> = {
    top: "First Half",
    bottom: "Second Half",
  };

  let teamsMode = $state<"roster" | "meta">("roster");
  let selectedIndex = $state(0);

  const SOLUTIONS_COUNT = 6;

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let solutions = $derived.by(() => {
    if (teamsMode === "roster") {
      return solveAbyssWithFallback(
        $teamsOwned,
        $allTeamsAbyss,
        ownedNames,
        SOLUTIONS_COUNT,
      );
    }
    return solveAbyss($allTeamsAbyss, SOLUTIONS_COUNT).map((sol) => ({
      ...sol,
      isFallback: false as const,
      assignments: sol.assignments.map((a) => ({
        ...a,
        missingCharacters: (a.team.members ?? []).filter(
          (m) => !ownedNames.has(m),
        ),
      })),
      neededCharacters: [
        ...new Set(
          sol.assignments.flatMap((a) =>
            (a.team.members ?? []).filter((m) => !ownedNames.has(m)),
          ),
        ),
      ],
    }));
  });

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

  // Reset pager when switching roster ↔ meta (not on every solution change)
  let prevMode = $state<"roster" | "meta">("roster");
  $effect(() => {
    if (teamsMode !== prevMode) {
      prevMode = teamsMode;
      selectedIndex = 0;
    }
  });

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(
    $teamsOwned.length === 0 && $allTeamsAbyss.length === 0,
  );

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

  function assignmentKey(slot: Slot): string {
    const teamKey = solution?.assignments.find(
      (assignment) => assignment.slot === slot,
    )?.team.team_key;
    return `${slot}:${String(teamKey ?? "empty")}`;
  }
</script>

{#snippet slotPanel(slot: Slot)}
  {@const sideEnemies = abyssEnemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}

  <Surface flush class="slot-panel">
    <!-- Chamber enemies — dynamic 3-chamber strip preserved -->
    <div class="chamber-strip">
      {#if sideEnemies && sideEnemies.length > 0}
        <div class="chambers">
          {#each sideEnemies as chamber}
            <div class="chamber">
              <span class="chamber-label">{chamber.chamber}</span>
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

    {#if abyssEnemies?.buffName}
      <p class="buff-line">
        <span class="buff-name">{abyssEnemies.buffName}</span>
        <span class="buff-half">{halfLabel[slot]}</span>
      </p>
    {/if}

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
          <p>
            {teamsMode === "roster"
              ? "Set up your roster in Settings"
              : "No data available"}
          </p>
        </div>
      {/if}
    </div>
  </Surface>
{/snippet}

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Spiral Abyss</h1>
      {#if updatedLabel}
        <p class="page-meta">Updated {updatedLabel}</p>
      {/if}
    </div>

    <SegmentedControl
      options={MODE_OPTIONS}
      bind:value={teamsMode}
      aria-label="Team source"
    />
  </header>

  {#if !loading && displaySolutions.length > 1}
    <SolutionDots
      count={displaySolutions.length}
      bind:index={selectedIndex}
      aria-label-prefix="Solution"
    />
  {/if}

  {#if loading}
    <LoadingState />
  {:else}
    <div class="panels">
      {#each SLOTS as slot (slot)}
        <div data-panel-slot={slot}>
          {#key assignmentKey(slot)}
            {@render slotPanel(slot)}
          {/key}
        </div>
      {/each}
    </div>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="fallback-note">
        Unable to find floor 12 clears with your roster — try teams similar to
        those suggested, or check Pull suggestions.
      </p>
    {/if}
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
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .panels {
    display: grid;
    gap: var(--space-4);
    align-items: start;
  }

  @media (min-width: 1024px) {
    .panels {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  :global(.slot-panel) {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .chamber-strip {
    padding: var(--space-4);
    background: var(--surface-base);
  }

  .chambers {
    display: flex;
  }

  .chamber {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.75rem;
  }

  .chamber-label {
    font-size: var(--text-xs);
    font-weight: 500;
    padding-bottom: 0.25rem;
    border-bottom: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
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
    height: 4.5rem;
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

  .buff-line {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.55rem var(--space-4);
    border-top: var(--border-width) solid var(--border-subtle);
    background: var(--surface-base);
    font-size: var(--text-sm);
  }

  .buff-name {
    color: var(--foreground-color);
    font-weight: 500;
  }

  .buff-half {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .team-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: var(--space-4);
    border-top: var(--border-width) solid var(--border-subtle);
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
</style>
