<script lang="ts">
  import { untrack } from "svelte";
  import { resolve } from "$app/paths";
  import { animationsEnabled, charactersOwned } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import {
    fetchStygianEnemyTeams,
    isAbortError,
    isTimeoutError,
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
  let selectedVersion = $state("");

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
    return [...groups.values()].sort(
      (a, b) => b.version_number - a.version_number,
    );
  });

  let versionOptions = $derived(
    teamsByVersion.map((g) => ({
      value: String(g.version_number),
      label: g.version_name,
    })),
  );

  let activeGroup = $derived(
    teamsByVersion.find((g) => String(g.version_number) === selectedVersion) ??
      teamsByVersion[0] ??
      null,
  );

  $effect(() => {
    const options = versionOptions;
    if (options.length === 0) {
      selectedVersion = "";
      return;
    }
    if (!options.some((o) => o.value === selectedVersion)) {
      selectedVersion = options[0]!.value;
    }
  });

  $effect(() => {
    const enemyId = enemy.id;
    const cached = untrack(() => teamsKey === enemyId && teamsPayload !== null);
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
        if (teamsAbort !== controller) return;
        if (controller.signal.aborted) {
          teamsLoading = false;
          return;
        }
        teamsPayload = payload;
        teamsKey = enemyId;
        teamsLoading = false;
      })
      .catch((err) => {
        if (teamsAbort !== controller) return;
        if (controller.signal.aborted || isAbortError(err)) {
          teamsLoading = false;
          return;
        }
        teamsPayload = null;
        teamsKey = null;
        teamsLoading = false;
        teamsError = isTimeoutError(err)
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

<PageShell
  class="enemy-detail gap-6 {$animationsEnabled ? '' : 'no-page-anim'}"
>
  <div class="page-bg">
    <header class="hero-float">
      <PageTrail
        class="hero-trail"
        items={[
          { label: "Stygian", href: resolve("/tools/stygian") },
          { label: "Enemies", href: resolve("/tools/stygian/enemies") },
          { label: enemy.enemy_name ?? `Enemy ${enemy.id}` },
        ]}
      />
      <div class="hero-figure">
        {#if enemy.asset}
          <img
            class="hero-art"
            src={getEnemyAsset(enemy.asset)}
            alt=""
            aria-hidden="true"
          />
        {/if}
        <h1 class="hero-title">{enemy.enemy_name ?? `Enemy ${enemy.id}`}</h1>
      </div>
      {#if activeGroup && versionOptions.length > 0}
        <div class="teams-head">
          <div class="teams-label">
            <span class="teams-label-text" id="enemy-version-label">Cycle:</span
            >
            <Select
              id="enemy-version-trigger"
              options={versionOptions}
              bind:value={selectedVersion}
              bare
              aria-labelledby="enemy-version-label enemy-version-trigger"
            />
          </div>
          <span class="version-slot"
            >{stygianSlotIndexLabel(activeGroup.slot_index)}</span
          >
        </div>
      {/if}
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
      {:else if activeGroup}
        <ol class="team-hands">
          {#each activeGroup.teams as team, i (team.team_key ?? `${activeGroup.version_number}-${i}`)}
            <li class="team-hand-row">
              <TeamCardHand
                characters={handCharactersFromMembers(team.members ?? [])}
                dimmedKeys={dimmedKeysFromMembers(team.members ?? [])}
                spread="flat"
              />
              <div class="team-hand-footer">
                <span class="team-hand-meta">
                  <span class="team-hand-rank">#{i + 1}</span>
                  <span>{(team.field_rate ?? 0).toFixed(0)}% in this field</span
                  >
                  <span class="team-hand-sep" aria-hidden="true">·</span>
                  <span>{(team.usage_rate ?? 0).toFixed(1)}% usage</span>
                </span>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    </section>
  </div>
</PageShell>

<style>
  .page-bg {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hero-float {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    text-align: center;
  }

  .hero-float :global(.hero-trail) {
    align-self: flex-start;
  }

  .hero-figure {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(100%, 22rem);
  }

  .hero-art {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: min(22rem, 48vh);
    object-fit: contain;
  }

  .hero-title {
    position: relative;
    z-index: 1;
    margin: -1.75rem 0 0;
    max-width: 100%;
    font-family: var(--font-display);
    font-size: clamp(1.85rem, 4vw, 2.6rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.1;
    color: var(--foreground-color);
    text-shadow:
      0 0 18px var(--background-color),
      0 1px 12px var(--background-color);
  }

  .teams-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.85rem;
    margin-top: 0.15rem;
  }

  .teams-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .teams-label-text {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .version-slot {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .board-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 22%, transparent);
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
