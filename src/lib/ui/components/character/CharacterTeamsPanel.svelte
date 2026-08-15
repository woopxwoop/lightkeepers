<script lang="ts">
  import { resolve } from "$app/paths";
  import {
    allTeamsAbyss,
    allTeamsStygian,
    staticBoardsLoaded,
    staticBoardsError,
    ensureStaticBoards,
  } from "$lib/stores";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import CostPopover from "$lib/ui/components/CostPopover.svelte";
  import {
    CHARACTER_SIM_COST,
    TOP_TEAMS_LIMIT,
    topSimTeamsForCharacter,
    topTeamsForCharacter,
    handCharactersFromGoodKeys,
    handBuilds,
    dimmedKeysFromGoodKeys,
  } from "$lib/character-teams";
  import { loadInvestment, getInvestmentCached } from "$lib/app/investment";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import type { InvestmentFile } from "$lib/types/investment";

  type TeamsMode = "stygian" | "abyss" | "simulated";

  let {
    nameId,
    characterName,
    mapping,
    goodKey,
    goodKeyMap,
    ownedKeys,
    ownedNameIdsSet,
  }: {
    nameId: string;
    characterName: string;
    mapping: Map<string, Character>;
    goodKey: string;
    goodKeyMap: Map<string, CharacterOwned>;
    ownedKeys: Set<string>;
    ownedNameIdsSet: Set<string>;
  } = $props();

  const TEAMS_MODE_OPTIONS = [
    { value: "stygian" as const, label: "Stygian" },
    { value: "abyss" as const, label: "Abyss" },
    { value: "simulated" as const, label: "Simulated" },
  ];

  let teamsMode = $state<TeamsMode>("stygian");
  let investment = $state<InvestmentFile | null>(getInvestmentCached());
  let investmentError = $state<string | null>(null);
  let investmentLoading = $state(false);
  let investmentInFlight: Promise<void> | null = null;

  $effect(() => {
    if (teamsMode === "simulated") {
      void ensureInvestment();
    } else {
      ensureStaticBoards().catch(() => {});
    }
  });

  async function ensureInvestment() {
    if (investment) return;
    if (investmentInFlight) return investmentInFlight;

    investmentLoading = true;
    investmentError = null;
    const pending = (async () => {
      try {
        investment = await loadInvestment();
      } catch (e) {
        investmentError =
          e instanceof Error ? e.message : "Failed to load simulated teams";
      } finally {
        investmentLoading = false;
      }
    })();
    investmentInFlight = pending;
    try {
      await pending;
    } finally {
      if (investmentInFlight === pending) investmentInFlight = null;
    }
  }

  let popularTeams = $derived(
    teamsMode === "simulated"
      ? []
      : topTeamsForCharacter(
          teamsMode === "stygian" ? $allTeamsStygian : $allTeamsAbyss,
          nameId,
          TOP_TEAMS_LIMIT,
        ),
  );

  let simulatedTeams = $derived(
    investment
      ? topSimTeamsForCharacter(
          investment.teams,
          goodKey,
          CHARACTER_SIM_COST,
          TOP_TEAMS_LIMIT,
        )
      : [],
  );

  let teamsLoading = $derived(
    teamsMode === "simulated"
      ? investmentLoading && !investment
      : !$staticBoardsError &&
          !$staticBoardsLoaded &&
          popularTeams.length === 0,
  );

  async function retryTeams() {
    if (teamsMode === "simulated") {
      investment = null;
      await ensureInvestment();
      return;
    }
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      /* staticBoardsError store already set */
    }
  }

  function formatDps(dps: number): string {
    return `${(dps / 1000).toFixed(0)}K`;
  }

  function handCharactersFromMembers(members: string[]) {
    return members.map((id) => mapping.get(id));
  }

  function dimmedKeysFromMembers(members: string[]): Set<string> {
    return new Set(members.filter((id) => !ownedNameIdsSet.has(id)));
  }
</script>

<div
  role="tabpanel"
  id="tabpanel-teams"
  aria-labelledby="tab-teams"
  tabindex="0"
>
  <section class="board-section">
    <div class="teams-head">
      <div class="teams-label">
        <span class="teams-label-text" id="teams-source-label">Teams:</span>
        <Select
          id="teams-source-trigger"
          options={TEAMS_MODE_OPTIONS}
          bind:value={teamsMode}
          bare
          aria-labelledby="teams-source-label teams-source-trigger"
        />
      </div>
      {#if teamsMode === "simulated"}
        <span class="teams-cost"
          >{CHARACTER_SIM_COST} <CostPopover /></span
        >
      {/if}
    </div>

    {#if teamsMode === "simulated"}
      {#if teamsLoading}
        <LoadingState
          variant="pulse"
          message="Loading simulated teams…"
        />
      {:else if investmentError && simulatedTeams.length === 0}
        <EmptyState message="Could not load simulated teams right now.">
          {#snippet action()}
            <Button variant="secondary" onclick={retryTeams}>Try again</Button>
          {/snippet}
        </EmptyState>
      {:else if simulatedTeams.length === 0}
        <EmptyState
          message="No {CHARACTER_SIM_COST}-cost sims featuring {characterName} yet."
        />
      {:else}
        <ol class="team-hands">
          {#each simulatedTeams as row, i (row.team.team_key)}
            <li class="team-hand-row">
              <TeamCardHand
                characters={handCharactersFromGoodKeys(
                  row.team.characters,
                  goodKeyMap,
                )}
                builds={handBuilds(row.team, row.sim)}
                dimmedKeys={dimmedKeysFromGoodKeys(
                  row.team.characters,
                  ownedKeys,
                  goodKeyMap,
                )}
                spread="flat"
              />
              <div class="team-hand-footer">
                <span class="team-hand-meta">
                  <span class="team-hand-rank">#{i + 1}</span>
                  <span
                    >{CHARACTER_SIM_COST} cost · {formatDps(row.dps)} DPS</span
                  >
                </span>
                <a
                  href={resolve(`/teams/${row.team.team_key}`)}
                  class="team-hand-link"
                >
                  View team details →
                </a>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    {:else if teamsLoading}
      <LoadingState variant="pulse" message="Loading meta teams…" />
    {:else if $staticBoardsError && popularTeams.length === 0}
      <EmptyState message="Could not load teams right now.">
        {#snippet action()}
          <Button variant="secondary" onclick={retryTeams}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else if popularTeams.length === 0}
      <EmptyState
        message="No {teamsMode === 'stygian'
          ? 'Stygian'
          : 'Abyss'} teams featuring {characterName} yet."
      />
    {:else}
      <ol class="team-hands">
        {#each popularTeams as team, i (team.team_key ?? i)}
          <li class="team-hand-row">
            <TeamCardHand
              characters={handCharactersFromMembers(team.members)}
              dimmedKeys={dimmedKeysFromMembers(team.members)}
              spread="flat"
            />
            <div class="team-hand-footer">
              <span class="team-hand-meta">
                <span class="team-hand-rank">#{i + 1}</span>
                <span>{(team.usage_rate ?? 0).toFixed(1)}% usage</span>
              </span>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>

<style>
  .board-section {
    padding: var(--space-4);
  }

  .teams-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .teams-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .teams-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .teams-cost {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-hands {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  @media (min-width: 1024px) {
    .team-hands {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--space-6);
      row-gap: var(--space-5);
    }
  }

  .team-hand-row {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    min-width: 0;
  }

  .team-hand-row:hover,
  .team-hand-row:focus-within {
    z-index: 5;
  }

  .team-hand-row :global(.hand) {
    --card-width: min(7.25rem, 25%);
    width: 100%;
  }

  .team-hand-row :global(.hand-flat) {
    justify-content: flex-start;
    align-items: flex-end;
    padding: 0.35rem 0 0;
    overflow: hidden;
  }

  @media (min-width: 1024px) {
    .team-hand-row :global(.hand) {
      --card-width: min(6.5rem, 25%);
    }
  }

  .team-hand-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: var(--space-2) var(--space-3);
    min-height: 1.25rem;
    padding: 0;
  }

  .team-hand-meta {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-hand-rank {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }

  .team-hand-link {
    flex-shrink: 0;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
    cursor: pointer;
  }

  .team-hand-link:hover {
    text-decoration: underline;
  }
</style>
