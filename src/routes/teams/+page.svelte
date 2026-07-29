<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import { buildGoodKeyMap, toGoodKey } from "$lib/utils";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import CharacterTagSearch from "$lib/ui/components/CharacterTagSearch.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import {
    handCharactersFromGoodKeys,
    handBuilds,
    dimmedKeysFromGoodKeys,
  } from "$lib/character-teams";
  import {
    allTeamCharacterKeys,
    availableInvestmentCosts,
    displayDps,
    displaySim,
    sortTeamsForDisplay,
    teamsMatchingTags,
    type TeamDpsSort,
  } from "$lib/investment-teams";
  import { loadInvestment, getInvestmentCached } from "$lib/app/investment";
  import type { InvestmentFile } from "$lib/types/investment";

  let data: InvestmentFile | null = $state(getInvestmentCached());
  let loading = $derived(data === null);
  let error: string | null = $state(null);

  // ── Spotlight pagination ──────────────────────────────────────────────────
  const SPOTLIGHT_PAGE = 10;
  let spotlightCount = $state(SPOTLIGHT_PAGE);

  // Reset pagination when filters change
  $effect(() => {
    tags;
    selectedCost;
    sortBy;
    sortOwnedFirst;
    spotlightCount = SPOTLIGHT_PAGE;
  });

  /** Bump the spotlight pagination window to reveal the next page of teams. */
  function showMore() {
    spotlightCount += SPOTLIGHT_PAGE;
  }

  // ── Sort & filter state ──────────────────────────────────────────────────
  let sortOwnedFirst = $state(true);
  let sortBy = $state<TeamDpsSort>("dps-desc");
  /** Selected cost level — show DPS of the best sim at (or nearest to) this cost. */
  let selectedCost = $state<number | null>(null);

  // ── Tag search state ─────────────────────────────────────────────────────
  let tags: string[] = $state([]);
  let showSettings = $state(false);

  onMount(() => fetchData());

  /** Use shared session cache (loaded on this route, not global bootstrap). */
  async function fetchData() {
    if (data) {
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      data = await loadInvestment();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load investment data";
    } finally {
      loading = false;
    }
  }

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));
  let allCharacterKeys = $derived(
    data ? allTeamCharacterKeys(data.teams) : ([] as string[]),
  );
  let ownedKeys = $derived(
    new Set(
      $charactersOwned.filter((c) => c.isOwned).map((c) => toGoodKey(c.name)),
    ),
  );
  let availableCosts = $derived(
    data ? availableInvestmentCosts(data) : ([] as number[]),
  );
  let displayTeams = $derived(
    data
      ? sortTeamsForDisplay(teamsMatchingTags(data.teams, tags), {
          selectedCost,
          sortBy,
          sortOwnedFirst,
          ownedKeys,
        })
      : [],
  );

  let spotlightTeams = $derived(displayTeams.slice(0, spotlightCount));
  let hasMore = $derived(spotlightCount < displayTeams.length);
  let remaining = $derived(displayTeams.length - spotlightCount);
  let listKey = $derived(
    `${tags.join(",")}|${selectedCost ?? "any"}|${sortBy}|${sortOwnedFirst}`,
  );
</script>

<PageShell class="gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Team Simulations</h1>
      <p class="page-meta">
        {#if data}
          Database of the {data.teams.length} teams used for character build and
          investment recommendations
        {:else}
          Database of teams used for character build and investment
          recommendations
        {/if}
      </p>
    </div>
  </header>

  {#if loading}
    <LoadingState variant="pulse" message="Loading investment data…" />
  {:else if error}
    <EmptyState message="Could not load investment data: {error}">
      {#snippet action()}
        <Button variant="secondary" onclick={fetchData}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else if data}
    <div class="filter-block">
      <CharacterTagSearch
        bind:tags
        options={allCharacterKeys}
        getLabel={(key) => goodKeyMap.get(key)?.name ?? key}
        getCharacter={(key) => goodKeyMap.get(key)}
        countLabel="{displayTeams.length} of {data.teams.length}"
        aria-label="Filter teams by character"
      >
        {#snippet leading()}
          <button
            type="button"
            onclick={() => (showSettings = !showSettings)}
            class="settings-gear shrink-0"
            class:settings-gear-active={showSettings}
            aria-label="Toggle filter settings"
          >
            <IconCog size={16} />
          </button>
        {/snippet}
      </CharacterTagSearch>

      {#if showSettings}
        <div class="settings-panel" transition:slide={{ duration: 150 }}>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={sortOwnedFirst}
              class="toggle-input"
            />
            <span class="settings-label">Owned first</span>
          </label>

          <span class="settings-sep" aria-hidden="true"></span>

          <div class="flex items-center gap-1.5">
            <span class="settings-caption">Sort</span>
            <Select
              bind:value={sortBy}
              aria-label="Sort teams"
              options={[
                { value: "dps-desc", label: "DPS ↓" },
                { value: "dps-asc", label: "DPS ↑" },
              ]}
            />
          </div>

          <span class="settings-sep" aria-hidden="true"></span>

          <div class="flex items-center gap-1.5">
            <span class="settings-caption">Cost</span>
            <input
              type="number"
              bind:value={selectedCost}
              placeholder="{availableCosts[0] ?? 0}–{availableCosts[
                availableCosts.length - 1
              ] ?? 0}"
              class="cost-input"
            />
            {#if selectedCost !== null}
              <button
                type="button"
                onclick={() => (selectedCost = null)}
                class="cost-clear"
                aria-label="Clear cost filter"
              >
                ×
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Spotlight team cards -->
    {#if displayTeams.length === 0}
      <EmptyState
        message="No teams found{tags.length > 0
          ? ' with those characters'
          : ''}{selectedCost !== null ? ' at that cost' : ''}."
      />
    {:else}
      {#key listKey}
        <div class="team-list" class:no-anim={!$animationsEnabled}>
          {#each spotlightTeams as team, i (team.team_key)}
            {@const sim = displaySim(team, selectedCost)}
            <article
              class="team-row card-enter"
              style="animation-delay: {i * 50}ms;"
            >
              <TeamCardHand
                characters={handCharactersFromGoodKeys(
                  team.characters,
                  goodKeyMap,
                )}
                builds={handBuilds(team, sim)}
                dimmedKeys={dimmedKeysFromGoodKeys(
                  team.characters,
                  ownedKeys,
                  goodKeyMap,
                )}
              />

              <div class="team-footer">
                <span class="team-meta">
                  {selectedCost !== null ? selectedCost : team.baseline_cost}
                  cost · {(displayDps(team, selectedCost) / 1000).toFixed(0)}K DPS
                </span>
                <a href="/teams/{team.team_key}" class="team-link">
                  View details →
                </a>
              </div>
            </article>
          {/each}
        </div>
      {/key}

      {#if hasMore}
        <Button variant="secondary" class="self-center" onclick={showMore}>
          Show {Math.min(SPOTLIGHT_PAGE, remaining)} more ({remaining} remaining)
        </Button>
      {/if}
    {/if}
  {/if}

  <details class="methodology">
    <summary>How team numbers work</summary>
    <p>
      Team damage is simulated with
      <a href="https://gcsim.app/" target="_blank" rel="noopener noreferrer"
        >gcsim</a
      >
      using
      <a
        href="https://compendium.keqingmains.com/"
        target="_blank"
        rel="noopener noreferrer">KQM artifact standards</a
      >. Comparing different teams is not recommended — rotation difficulty and
      team cost vary. Comparing the same team at different investment levels is
      encouraged.
    </p>
  </details>
</PageShell>

<style>
  .filter-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .settings-gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    transition:
      background var(--control-duration) var(--control-ease),
      color var(--control-duration) var(--control-ease),
      transform 0.3s ease;
  }

  .settings-gear:hover {
    background: var(--surface-quiet);
    color: var(--accent-1);
  }

  .settings-gear-active {
    color: var(--accent-1);
    background: var(--surface-quiet);
    transform: rotate(60deg);
  }

  .settings-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .settings-label {
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .settings-caption {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .settings-sep {
    width: 1px;
    height: 1.25rem;
    background: rgba(255, 255, 255, 0.14);
  }

  .cost-input {
    width: 56px;
    padding: 0.25rem 0.35rem;
    border-radius: var(--radius-sm);
    outline: none;
    text-align: center;
    font-size: var(--text-xs);
    appearance: textfield;
    -moz-appearance: textfield;
    background: var(--background-color);
    color: var(--foreground-color);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .cost-input::-webkit-outer-spin-button,
  .cost-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .cost-input:focus {
    border-color: rgba(255, 255, 255, 0.32);
  }

  .cost-input::placeholder {
    color: var(--foreground-mid);
    opacity: 0.5;
  }

  .cost-clear {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .cost-clear:hover {
    color: var(--foreground-color);
  }

  .toggle-input {
    appearance: none;
    -webkit-appearance: none;
    width: 34px;
    height: 20px;
    background: var(--background-color);
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s;
    margin: 0;
    flex-shrink: 0;
  }

  .toggle-input::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: color-mix(in srgb, var(--accent-1) 6%, #16130e);
    border-radius: 50%;
    transition:
      transform 0.2s,
      background 0.2s;
  }

  .toggle-input:checked {
    background: var(--accent-1);
    border-color: var(--accent-1);
  }

  .toggle-input:checked::after {
    transform: translateX(14px);
    background: #fff;
  }

  .team-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
  }

  .team-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Spotlight hands sit on the page base — no raised card chrome.
     Keep card/radius paired so the fan stays inside the page width;
     oversized desktop values clip the leftmost weapon on phones. */
  .team-row :global(.hand) {
    --card-width: clamp(8.1rem, 18vw, 13.8rem);
    --radius: clamp(19.2rem, 46vw, 31.2rem);
  }

  @media (max-width: 640px) {
    .team-row :global(.hand) {
      --card-width: clamp(5.1rem, 26vw, 7.8rem);
      --radius: clamp(13.2rem, 70vw, 19.2rem);
    }
  }

  .team-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    max-width: 28rem;
    margin: 0 auto;
    padding: 0 var(--space-2);
  }

  .team-meta {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-link {
    flex-shrink: 0;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
    cursor: pointer;
  }

  .team-link:hover {
    text-decoration: underline;
  }

  .methodology {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .methodology summary {
    width: fit-content;
    cursor: pointer;
    font-family: var(--font-display);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .methodology summary:hover {
    color: var(--foreground-color);
  }

  .methodology p {
    max-width: 60ch;
    margin-top: var(--space-2);
    line-height: 1.55;
  }

  .methodology a {
    color: var(--accent-2);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .card-enter {
    animation: slide-up 0.35s ease-out both;
  }

  .no-anim .card-enter {
    animation: none;
  }

  :global(.page-shell.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(0.75rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-enter {
      animation: none;
    }
  }
</style>
