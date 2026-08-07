<script lang="ts">
  import { untrack } from "svelte";
  import { resolve } from "$app/paths";
  import {
    animationsEnabled,
    charactersOwned,
  } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import BackLink from "$lib/ui/components/BackLink.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import {
    fetchStygianEnemyTeams,
    isAbortError,
  } from "$lib/app/stygian-enemy-teams";
  import { stygianSlotIndexLabel } from "$lib/slotLabels";
  import { getEnemyAsset, ownedNameIds } from "$lib/utils";
  import type {
    Character,
    StygianEnemyTeamsPayload,
    StygianEnemyTopTeam,
  } from "$lib/definitions";

  let { data } = $props();
  let enemy = $derived(data.enemy);
  let mapping = $derived(data.mapping as Map<string, Character>);

  let teamsPayload = $state<StygianEnemyTeamsPayload | null>(null);
  let teamsLoading = $state(false);
  let teamsError = $state<string | null>(null);
  let teamsKey = $state<number | null>(null);
  let teamsAbort: AbortController | null = null;

  let ownedNameIdsSet = $derived(new Set(ownedNameIds($charactersOwned)));

  let teamsByVersion = $derived.by(() => {
    const payload = teamsPayload;
    if (!payload) return [];
    const groups = new Map<
      number,
      {
        version_number: number;
        version_name: string;
        slot_index: number;
        teams: StygianEnemyTopTeam[];
      }
    >();
    for (const team of payload.teams) {
      let group = groups.get(team.version_number);
      if (!group) {
        group = {
          version_number: team.version_number,
          version_name: team.version_name || String(team.version_number),
          slot_index: team.slot_index,
          teams: [],
        };
        groups.set(team.version_number, group);
      }
      group.teams.push(team);
    }
    return [...groups.values()]
      .map((g) => ({
        ...g,
        teams: g.teams
          .slice()
          .sort((a, b) => (b.field_rate ?? 0) - (a.field_rate ?? 0)),
      }))
      .sort((a, b) => b.version_number - a.version_number);
  });

  $effect(() => {
    const enemyId = enemy.id;
    const cached = untrack(
      () => teamsKey === enemyId && teamsPayload !== null,
    );
    if (cached) return;

    void loadTeams(enemyId);
    return () => {
      teamsAbort?.abort();
    };
  });

  function loadTeams(enemyId: number) {
    teamsAbort?.abort();
    const controller = new AbortController();
    teamsAbort = controller;

    teamsLoading = true;
    teamsError = null;
    teamsPayload = null;

    return fetchStygianEnemyTeams(enemyId, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          teamsLoading = false;
          return;
        }
        teamsPayload = payload;
        teamsKey = enemyId;
        teamsLoading = false;
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          teamsLoading = false;
          return;
        }
        teamsPayload = null;
        teamsKey = null;
        teamsLoading = false;
        teamsError = isAbortError(err)
          ? "Request timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load teams";
      });
  }

  function retryTeams() {
    void loadTeams(enemy.id);
  }

  function handCharactersFromMembers(members: string[]) {
    return members.map((id) => mapping.get(id));
  }

  function dimmedKeysFromMembers(members: string[]): Set<string> {
    return new Set(members.filter((id) => !ownedNameIdsSet.has(id)));
  }
</script>

<PageShell class="enemy-detail gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="hero">
    {#if enemy.asset}
      <img
        class="hero-img"
        src={getEnemyAsset(enemy.asset)}
        alt=""
        aria-hidden="true"
      />
    {/if}
    <div class="hero-scrim" aria-hidden="true"></div>
    <div class="hero-copy">
      <BackLink href={resolve("/enemies")} class="hero-back">Enemies</BackLink>
      <h1 class="hero-title">{enemy.enemy_name ?? `Enemy ${enemy.id}`}</h1>
      <p class="hero-lede">
        Top Stygian teams by cycle, ranked for the field this boss occupied.
      </p>
    </div>
  </header>

  <section class="board-section">
    {#if teamsLoading && !teamsPayload}
      <LoadingState variant="pulse" message="Loading historical teams…" />
    {:else if teamsError && !teamsPayload}
      <EmptyState message="Could not load historical teams right now.">
        {#snippet action()}
          <Button variant="secondary" onclick={retryTeams}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else if teamsByVersion.length === 0}
      <EmptyState message="No team history for this boss yet." />
    {:else}
      <div class="version-stack">
        {#each teamsByVersion as group (group.version_number)}
          <section class="version-block">
            <header class="version-head">
              <h2 class="version-title">{group.version_name}</h2>
              <span class="version-slot"
                >{stygianSlotIndexLabel(group.slot_index)}</span
              >
            </header>
            <ol class="team-hands">
              {#each group.teams as team, i (team.team_key ?? `${group.version_number}-${i}`)}
                <li class="team-hand-row">
                  <TeamCardHand
                    characters={handCharactersFromMembers(team.members ?? [])}
                    dimmedKeys={dimmedKeysFromMembers(team.members ?? [])}
                    spread="flat"
                  />
                  <div class="team-hand-footer">
                    <span class="team-hand-meta">
                      <span class="team-hand-rank">#{i + 1}</span>
                      <span
                        >{(team.field_rate ?? 0).toFixed(0)}% in this field</span
                      >
                      <span class="team-hand-sep" aria-hidden="true">·</span>
                      <span>{(team.usage_rate ?? 0).toFixed(1)}% usage</span>
                    </span>
                  </div>
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      </div>
    {/if}
  </section>
</PageShell>

<style>
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 16%, transparent);
    min-height: 10rem;
    padding: var(--space-5) var(--space-5) var(--space-6);
  }

  .hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    opacity: 0.35;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      color-mix(in srgb, var(--background-color) 92%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 55%,
      transparent 100%
    );
  }

  .hero-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 36rem;
  }

  .hero-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 3.5vw, 2.25rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--foreground-color);
  }

  .hero-lede {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .board-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .version-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .version-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .version-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.55rem 0.85rem;
  }

  .version-title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .version-slot {
    font-size: var(--text-xs);
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
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .team-hand-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .team-hand-meta {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.5rem;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }

  .team-hand-rank {
    color: var(--foreground-color);
    font-weight: 600;
  }

  .team-hand-sep {
    opacity: 0.5;
  }
</style>
