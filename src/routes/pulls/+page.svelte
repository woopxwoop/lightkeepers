<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import {
    charactersOwned,
    charactersHydrated,
    teamsOwnedStygian,
    teamsOwnedLoaded,
    nearMissStygianTeams,
    nearMissPairTeams,
    nearMissStygianLoaded,
    nearMissPairLoaded,
    ensureNearMissTeams,
    ensureTeamsOwned,
    invalidateNearMissTeams,
    invalidateTeamsOwned,
    tierList,
    tierListLoaded,
    tierListError,
    ensureTierList,
    invalidateTierList,
    animationsEnabled,
  } from "$lib/stores";
  import { ownedNameIds } from "$lib/utils";
  import {
    computePullSuggestions,
    computePairSuggestions,
  } from "$lib/pullSuggestions";
  import type { PullSuggestion, PairSuggestion } from "$lib/pullSuggestions";
  import type { TierListEntry } from "$lib/tierlist";
  import type { StygianTeam } from "$lib/definitions";
  import WishSlot from "$lib/ui/components/WishSlot.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconEye from "$lib/ui/icons/IconEye.svelte";
  import IconEyeOff from "$lib/ui/icons/IconEyeOff.svelte";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  // "waiting" = owned teams and/or near-miss still in flight.
  type PageState = "waiting" | "done" | "empty" | "error";
  let pageState: PageState = $state("waiting");
  let suggestions: PullSuggestion[] = $state([]);
  let pairSuggestions: PairSuggestion[] = $state([]);
  let revealedSingles = $state(new Set<string>());
  let revealedPairs = $state(new Set<string>());
  /** Active team per revealed row — rows page through their teams separately. */
  let singleTeamIndex = $state<Record<string, number>>({});
  let pairTeamIndex = $state<Record<string, number>>({});
  let teamCycleDirection = $state<Record<string, -1 | 0 | 1>>({});
  let expandedStandoutBoards = $state(new Set<string>());
  let collapsingStandoutBoards = $state(new Set<string>());
  let hidingTeamRows = $state(new Set<string>());
  const standoutCollapseTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  const teamHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

  onDestroy(() => {
    for (const timer of standoutCollapseTimers.values()) clearTimeout(timer);
    standoutCollapseTimers.clear();
    for (const timer of teamHideTimers.values()) clearTimeout(timer);
    teamHideTimers.clear();
  });

  const STANDOUT_DEAL_MS = 180;
  const STANDOUT_STAGGER_MS = 35;
  const TEAM_HIDE_MS = 140;

  let ownedIds = $derived(ownedNameIds($charactersOwned));
  let ownedCount = $derived(ownedIds.size);

  let nearMissReady = $derived($nearMissStygianLoaded && $nearMissPairLoaded);

  /** Near-miss + owned teams ready; tier cream optional (filters when present). */
  let pullsDataReady = $derived(
    nearMissReady && $teamsOwnedLoaded && ($tierListLoaded || !!$tierListError),
  );

  /** Limited cream name_ids — pull suggestions stay inside the standouts cut. */
  let creamPullIds = $derived(
    $tierList ? new Set($tierList.fiveStar.map((e) => e.nameId)) : undefined,
  );

  function rankSuggestions() {
    try {
      const singles = computePullSuggestions(
        $nearMissStygianTeams,
        3,
        creamPullIds,
      );
      const pairs = computePairSuggestions($nearMissPairTeams, 3, creamPullIds);
      suggestions = singles;
      pairSuggestions = pairs;
      // Reveal state is read here but owned by the toggles — don't make
      // ranking depend on it.
      untrack(() => syncRevealed(singles, pairs));
      pageState = singles.length > 0 || pairs.length > 0 ? "done" : "empty";
    } catch (error) {
      suggestions = [];
      pairSuggestions = [];
      pageState = "error";
      console.error("pull suggestion ranking failed:", error);
    }
  }

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

  /** Returns the same set when nothing changed, so re-ranking is a no-op. */
  function nextRevealed(
    revealed: Set<string>,
    ids: string[],
  ): Set<string> {
    const live = new Set(ids);
    const kept = [...revealed].filter((id) => live.has(id));
    return kept.length === revealed.size ? revealed : new Set(kept);
  }

  // Tier list is roster-independent — warm as soon as the page mounts.
  $effect(() => {
    ensureTierList().catch(() => {});
  });

  // Lazy: owned teams + near-miss (not from global bootstrap).
  $effect(() => {
    if (!$charactersHydrated) return;
    if (ownedCount === 0) return;
    ensureTeamsOwned($charactersOwned).catch(() => {
      pageState = "error";
    });
    if (!nearMissReady) {
      ensureNearMissTeams($charactersOwned).catch(() => {
        pageState = "error";
      });
    }
  });

  $effect(() => {
    if (!$charactersHydrated) return;

    if (ownedCount === 0) {
      suggestions = [];
      pairSuggestions = [];
      pageState = "empty";
      return;
    }

    if (!pullsDataReady) {
      // Don't clobber a fetch failure with "waiting".
      if (pageState !== "error") pageState = "waiting";
      return;
    }

    $nearMissStygianTeams;
    $nearMissPairTeams;
    $teamsOwnedStygian;
    creamPullIds;
    rankSuggestions();
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

  function toggleStandoutBoard(id: string, count = 1) {
    if (collapsingStandoutBoards.has(id)) return;

    if (expandedStandoutBoards.has(id)) {
      const collapsing = new Set(collapsingStandoutBoards);
      collapsing.add(id);
      collapsingStandoutBoards = collapsing;

      const prior = standoutCollapseTimers.get(id);
      if (prior) clearTimeout(prior);

      const wait = !get(animationsEnabled)
        ? 1
        : STANDOUT_DEAL_MS + Math.max(0, count - 1) * STANDOUT_STAGGER_MS;
      standoutCollapseTimers.set(
        id,
        setTimeout(() => {
          standoutCollapseTimers.delete(id);
          const expanded = new Set(expandedStandoutBoards);
          expanded.delete(id);
          expandedStandoutBoards = expanded;
          const nextCollapsing = new Set(collapsingStandoutBoards);
          nextCollapsing.delete(id);
          collapsingStandoutBoards = nextCollapsing;
        }, wait),
      );
      return;
    }

    const expanded = new Set(expandedStandoutBoards);
    expanded.add(id);
    expandedStandoutBoards = expanded;
  }

  function pairKey(suggestion: PairSuggestion): string {
    return `${suggestion.charA}|${suggestion.charB}`;
  }

  function singleRowId(character: string): string {
    return `pull-single-${character}`;
  }

  function pairRowId(key: string): string {
    return `pull-pair-${key}`;
  }

  /** Teammates beside the pull target(s), which already lead the row. */
  function remainingMembers(
    team: StygianTeam | undefined,
    exclude: string[],
  ): string[] {
    const skip = new Set(exclude);
    return (team?.members ?? []).filter((member) => !skip.has(member));
  }

  function safeTeamIndex(
    indices: Record<string, number>,
    id: string,
    teams: StygianTeam[],
  ): number {
    const current = indices[id] ?? 0;
    return teams.length === 0 ? 0 : Math.min(current, teams.length - 1);
  }

  function cycleTeamIndex(
    indices: Record<string, number>,
    id: string,
    rowId: string,
    count: number,
    direction: -1 | 1,
  ): void {
    if (count < 2) return;
    const current = Math.min(indices[id] ?? 0, count - 1);
    teamCycleDirection[rowId] = direction;
    indices[id] = (current + direction + count) % count;
  }

  function usagePct(entry: TierListEntry): string {
    return `${entry.score.toFixed(entry.score >= 10 ? 0 : 1)}%`;
  }

  async function retryPulls() {
    pageState = "waiting";
    invalidateTeamsOwned();
    invalidateNearMissTeams();
    try {
      await Promise.all([
        ensureTeamsOwned($charactersOwned),
        ensureNearMissTeams($charactersOwned),
      ]);
    } catch {
      pageState = "error";
    }
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

{#snippet teammateSlots(
  members: string[],
  count: number,
  revealed: boolean,
  direction: -1 | 0 | 1,
  hiding: boolean,
)}
  {#each Array(count) as _, i}
    {@const member = members[i]}
    {@const character = member ? mapping.get(member) : undefined}
    <div
      class="team-slot team-slot-mate"
      class:team-slot-revealed={revealed && Boolean(member)}
      class:team-slot-cycle-previous={revealed &&
        Boolean(member) &&
        direction === -1}
      class:team-slot-cycle-next={revealed &&
        Boolean(member) &&
        direction === 1}
      class:team-slot-hiding={hiding && Boolean(member)}
      style="--i: {i};"
    >
      {#if member}
        <WishSlot
          nameId={member}
          name={character?.name ?? member}
          rarity={character?.rarity ?? 4}
          dimmed={!ownedIds.has(member)}
        />
      {:else}
        <WishSlot empty name="Unrevealed teammate" />
      {/if}
    </div>
  {/each}
{/snippet}

{#snippet ledgerRow(
  rowId: string,
  targets: { nameId: string; name: string; rarity: number }[],
  mates: string[],
  mateCount: number,
  isOpen: boolean,
  teams: StygianTeam[],
  teamIdx: number,
  cycleTeam: StygianTeam | undefined,
  onToggle: () => void,
  indices: Record<string, number>,
  indexKey: string,
)}
  {@const isHiding = hidingTeamRows.has(rowId)}
  <li class="ledger-row" id={rowId}>
    <div class="row-team">
      {#each targets as target (target.nameId)}
        <div class="team-slot">
          <WishSlot
            nameId={target.nameId}
            name={target.name}
            rarity={target.rarity}
            highlight
          />
        </div>
      {/each}

      {#if isOpen || isHiding}
        {#key teamIdx}
          {@render teammateSlots(
            mates,
            mateCount,
            true,
            teamCycleDirection[rowId] ?? 0,
            isHiding,
          )}
        {/key}
      {:else}
        {@render teammateSlots([], mateCount, false, 0, false)}
      {/if}

      <div class="row-controls">
        {#if isOpen && teams.length > 1}
          <button
            type="button"
            class="row-control row-cycle row-cycle-up"
            aria-controls={rowId}
            aria-label="Previous unlocked team"
            onclick={() =>
              cycleTeamIndex(indices, indexKey, rowId, teams.length, -1)}
          >
            <IconChevronDown size={18} strokeWidth={2.25} />
          </button>
        {/if}

        <button
          type="button"
          class="row-control row-toggle"
          aria-expanded={isOpen}
          aria-controls={rowId}
          aria-label={isOpen ? "Hide team" : "Reveal team"}
          disabled={isHiding}
          onclick={() => {
            teamCycleDirection[rowId] = 0;
            onToggle();
          }}
        >
          <span class="row-toggle-icon" class:open={isOpen}>
            <span class="row-toggle-face row-toggle-face-closed">
              <IconEyeOff size={18} strokeWidth={2.25} />
            </span>
            <span class="row-toggle-face row-toggle-face-open">
              <IconEye size={18} strokeWidth={2.25} />
            </span>
          </span>
        </button>

        {#if isOpen && teams.length > 1}
          <button
            type="button"
            class="row-control row-cycle"
            aria-controls={rowId}
            aria-label="Next unlocked team"
            onclick={() =>
              cycleTeamIndex(indices, indexKey, rowId, teams.length, 1)}
          >
            <IconChevronDown size={18} strokeWidth={2.25} />
          </button>
        {/if}
      </div>
    </div>

    {#if isOpen}
      <div class="team-cycle-meta">
        <p class="team-cycle-label">
          {(cycleTeam?.avg_usage_rate ?? 0).toFixed(1)}% usage
          {#if teams.length > 1}
            <span class="team-cycle-count"
              >· team {teamIdx + 1} of {teams.length}</span
            >
          {/if}
        </p>
      </div>
    {/if}
  </li>
{/snippet}

{#snippet standoutsBoard(id: string, label: string, entries: TierListEntry[])}
  {@const open = expandedStandoutBoards.has(id)}
  {@const collapsing = collapsingStandoutBoards.has(id)}
  {@const shown = open || collapsing}
  {@const restCount = Math.max(0, entries.length - 1)}
  <div class="standouts">
    <p class="eyebrow standouts-status">Most used {label}</p>
    {#if entries.length === 0}
      <EmptyState message="No standouts on this board yet." />
    {:else}
      <div
        class="standouts-deck"
        class:open={shown}
        class:collapsing
        id="standouts-deck-{id}"
        style="--n: {entries.length};"
      >
        <ol class="standouts-deck-list">
          {#each entries as entry, i (entry.nameId)}
            {@const owned = ownedIds.has(entry.nameId)}
            {@const character = mapping.get(entry.nameId)}
            <li
              class="standout"
              style="--i: {i};"
              aria-hidden={!shown && i > 0 ? true : undefined}
              aria-label="{entry.name}, {usagePct(entry)} average usage"
              title="{entry.name} · {usagePct(entry)} avg usage"
            >
              <WishSlot
                nameId={entry.nameId}
                name={entry.name}
                rarity={character?.rarity ?? 5}
                dimmed={!owned}
                loading={i === 0 ? "eager" : "lazy"}
                onclick={!shown && i === 0 && restCount > 0
                  ? () => toggleStandoutBoard(id, entries.length)
                  : undefined}
                cue={!shown && i === 0 && restCount > 0 ? "Expand" : undefined}
              />
            </li>
          {/each}
          {#if restCount > 0}
            <li class="standout-toggle-cell">
              <button
                type="button"
                class="eyebrow standouts-toggle"
                aria-expanded={shown}
                aria-controls="standouts-deck-{id}"
                disabled={collapsing}
                onclick={() => toggleStandoutBoard(id, entries.length)}
              >
                <span class="standouts-toggle-label">
                  {shown ? "Collapse" : "Expand"}
                </span>
                <span class="standouts-toggle-chevron" class:open={shown}>
                  <IconChevronDown size={18} strokeWidth={2.25} />
                </span>
              </button>
            </li>
          {/if}
        </ol>
      </div>
    {/if}
  </div>
{/snippet}

<PageShell class="pulls-page gap-8">
  <header class="page-head">
    <h1 class="page-title">Pull Suggestions</h1>
    <p class="page-meta">
      Based on your {ownedCount} characters · Stygian Onslaught usage
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
    <EmptyState
      message={ownedCount === 0
        ? "Set up your roster in Settings to get pull suggestions."
        : "Your roster already covers the high-usage Stygian teams — no single pull stands out right now."}
    />
  {:else}
    <div class="suggest-columns">
      <!-- ── Best next pulls ───────────────────────────────────────── -->
      {#if suggestions.length > 0}
        <section class="panel">
          <header class="panel-head">
            <div class="panel-head-text">
              <h2 class="panel-title">Best next pulls</h2>
              <p class="panel-lede">
                Ranked by high-usage teams a character unlocks for your roster
              </p>
            </div>
          </header>

          <ol class="ledger-list">
            {#each suggestions as suggestion (suggestion.character)}
              {@const isOpen = revealedSingles.has(suggestion.character)}
              {@const char = mapping.get(suggestion.character)}
              {@const teamIdx = safeTeamIndex(
                singleTeamIndex,
                suggestion.character,
                suggestion.topTeams,
              )}
              {@const cycleTeam = suggestion.topTeams[teamIdx]}
              {@const mates = remainingMembers(cycleTeam, [
                suggestion.character,
              ])}
              {@render ledgerRow(
                singleRowId(suggestion.character),
                [
                  {
                    nameId: suggestion.character,
                    name: suggestion.characterName ?? suggestion.character,
                    rarity: char?.rarity ?? 5,
                  },
                ],
                mates,
                3,
                isOpen,
                suggestion.topTeams,
                teamIdx,
                cycleTeam,
                () => toggleSingle(suggestion.character),
                singleTeamIndex,
                suggestion.character,
              )}
            {/each}
          </ol>
        </section>
      {/if}

      <!-- ── Pair pulls ────────────────────────────────────── -->
      {#if pairSuggestions.length > 0}
        <section class="panel">
          <header class="panel-head">
            <div class="panel-head-text">
              <h2 class="panel-title">Pair Pulls</h2>
              <p class="panel-lede">Two characters that form a strong core</p>
            </div>
          </header>

          <ol class="ledger-list">
            {#each pairSuggestions as suggestion (pairKey(suggestion))}
              {@const key = pairKey(suggestion)}
              {@const isOpen = revealedPairs.has(key)}
              {@const charA = mapping.get(suggestion.charA)}
              {@const charB = mapping.get(suggestion.charB)}
              {@const teamIdx = safeTeamIndex(
                pairTeamIndex,
                key,
                suggestion.topTeams,
              )}
              {@const cycleTeam = suggestion.topTeams[teamIdx]}
              {@const mates = remainingMembers(cycleTeam, [
                suggestion.charA,
                suggestion.charB,
              ])}
              {@render ledgerRow(
                pairRowId(key),
                [
                  {
                    nameId: suggestion.charA,
                    name: suggestion.charAName ?? suggestion.charA,
                    rarity: charA?.rarity ?? 5,
                  },
                  {
                    nameId: suggestion.charB,
                    name: suggestion.charBName ?? suggestion.charB,
                    rarity: charB?.rarity ?? 5,
                  },
                ],
                mates,
                2,
                isOpen,
                suggestion.topTeams,
                teamIdx,
                cycleTeam,
                () => togglePair(key),
                pairTeamIndex,
                key,
              )}
            {/each}
          </ol>
        </section>
      {/if}
    </div>
  {/if}

  <!-- ── Cream of the crop (roster-independent) ────────────────────── -->
  <section class="panel">
    <header class="panel-head">
      <div class="panel-head-text">
        <h2 class="panel-title">Most used characters used in Stygian</h2>
      </div>
    </header>

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
        {@render standoutsBoard(
          "limited",
          "limited characters",
          $tierList?.fiveStar ?? [],
        )}
        {@render standoutsBoard(
          "nonLimited",
          "non-limited characters",
          $tierList?.fourStar ?? [],
        )}
      </div>
    {/if}
  </section>

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

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .panel-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .panel-head-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .panel-lede {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    line-height: 1.45;
    max-width: 48ch;
  }

  /* Side-by-side columns: reserve two lines so both team rows start level. */
  @media (min-width: 960px) {
    .suggest-columns .panel-lede {
      min-height: 2.9em;
    }
  }

  /* ── Standouts ──────────────────────────────────────────────────── */
  .standouts-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .standouts {
    --standout-w: clamp(4.75rem, 18vw, 5.5rem);
    --standout-gap-x: 0.55rem;
    --standout-gap-y: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .standouts-status {
    font-weight: 500;
  }

  .standouts-deck {
    --deal-stagger: 85ms;
    --deal-duration: 480ms;
    /* Keep stacked WishSlot z-index local so it can't climb over the nav. */
    isolation: isolate;
    min-width: 0;
  }

  .standouts-deck-list {
    display: grid;
    margin: 0;
    padding: 0.35rem 0.15rem 0.5rem;
    list-style: none;
    align-items: center;
  }

  /* Collapsed: stack in col 1, expand control tucked beside the lead. */
  .standouts-deck:not(.open) .standouts-deck-list {
    width: fit-content;
    grid-template-columns: var(--standout-w) auto;
    column-gap: 0.35rem;
    min-height: calc(var(--standout-w) * 16 / 5 + 12px);
  }

  .standouts-deck:not(.open) .standout {
    grid-area: 1 / 1;
    width: var(--standout-w);
    transform: translate(
      calc(min(var(--i), 4) * 3px),
      calc(min(var(--i), 4) * 3px)
    );
    z-index: calc(5 - var(--i));
    animation: none;
    transition: none;
  }

  .standouts-deck:not(.open) .standout:first-child {
    z-index: 6;
    opacity: 1;
  }

  .standouts-deck:not(.open) .standout:not(:first-child) {
    pointer-events: none;
  }

  .standouts-deck:not(.open) .standout:nth-child(n + 6) {
    opacity: 0;
  }

  .standouts-deck:not(.open) .standout-toggle-cell {
    grid-area: 1 / 2;
    align-self: center;
    justify-self: start;
  }

  /* Expanded (and mid-collapse): flow right/down. */
  .standouts-deck.open .standouts-deck-list {
    grid-template-columns: repeat(auto-fill, minmax(var(--standout-w), 1fr));
    gap: var(--standout-gap-y) var(--standout-gap-x);
  }

  .standouts-deck.open .standout {
    position: relative;
    z-index: 1;
    width: auto;
    pointer-events: auto;
    transition: none;
  }

  .standouts-deck.open .standout:first-child {
    transform: none;
    opacity: 1;
    animation: none;
  }

  .standouts-deck.open:not(.collapsing) .standout:not(:first-child) {
    /* `both` keeps opacity 0 during the stagger delay so layout teleports stay hidden. */
    animation: standout-deal var(--deal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      both;
    animation-delay: calc(var(--i) * var(--deal-stagger));
  }

  /* Collapse: keep the grid, pack last → first, then drop to the stack. */
  .standouts-deck.open.collapsing {
    --deal-stagger: 35ms;
    --deal-duration: 180ms;
  }

  .standouts-deck.open.collapsing .standout:not(:first-child) {
    pointer-events: none;
    animation: standout-pack var(--deal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      both;
    animation-delay: calc((var(--n) - 1 - var(--i)) * var(--deal-stagger));
  }

  @keyframes standout-deal {
    from {
      opacity: 0;
      transform: translate(-0.85rem, -0.55rem) scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes standout-pack {
    from {
      opacity: 1;
      transform: none;
    }
    to {
      opacity: 0;
      transform: translate(-0.85rem, -0.55rem) scale(0.94);
    }
  }

  .standout-toggle-cell {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 0;
  }

  .standouts-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.85rem;
    color: var(--accent-1);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .standouts-toggle:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .standouts-toggle:hover:not(:disabled) {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .standouts-toggle-label {
    line-height: 1;
  }

  .standouts-toggle-chevron {
    display: inline-flex;
    transform: rotate(-90deg);
    transition: transform 220ms ease;
  }

  .standouts-toggle-chevron.open {
    transform: rotate(90deg);
  }

  .standout {
    min-width: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .standouts-deck {
      --deal-stagger: 0ms;
      --deal-duration: 1ms;
    }

    .standouts-deck .standout {
      transition: none;
      animation: none !important;
    }

    .standouts-deck.open .standout:not(:first-child) {
      opacity: 1;
      transform: none;
    }

    .standouts-toggle-chevron {
      transition: none;
    }
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

  .ledger-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
  }

  /* Pull target + revealed teammates read as one four-slot team. */
  .row-team {
    display: flex;
    align-items: center;
    gap: var(--team-slot-gap);
    min-width: 0;
  }

  .row-controls {
    flex: 0 0 auto;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    margin-left: -0.15rem;
  }

  .row-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0.35rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .row-control:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .row-control:disabled {
    pointer-events: none;
  }

  .row-toggle {
    color: var(--accent-1);
  }

  .row-cycle {
    color: var(--foreground-mid);
  }

  .row-cycle-up :global(svg) {
    transform: rotate(180deg);
  }

  /* Stacked eye / eye-off; open state crossfades instead of rotating. */
  .row-toggle-icon {
    position: relative;
    display: block;
    width: 1.125rem;
    height: 1.125rem;
  }

  .row-toggle-face {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      opacity 180ms var(--control-ease),
      transform 180ms var(--control-ease);
  }

  .row-toggle-face-closed {
    opacity: 1;
    transform: scale(1);
  }

  .row-toggle-face-open {
    opacity: 0;
    transform: scale(0.86);
  }

  .row-toggle-icon.open .row-toggle-face-closed {
    opacity: 0;
    transform: scale(0.86);
  }

  .row-toggle-icon.open .row-toggle-face-open {
    opacity: 1;
    transform: scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .row-toggle-face {
      transition: none;
    }
  }

  /* ── Unlocked team cycle ────────────────────────────────────────── */
  /* Slots share the row evenly so a full team fits an equal-width column,
     and never grow past the standalone slot width. */
  .team-slot {
    flex: 1 1 0;
    min-width: 0;
    max-width: var(--standout-w);
  }

  /* Blanks already occupy the row — reveal is a soft materialize, not a slide. */
  .team-slot-revealed {
    animation: mate-reveal 240ms var(--control-ease) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  .team-slot-cycle-previous {
    animation-name: mate-cycle-previous;
    animation-delay: 0ms;
  }

  .team-slot-cycle-next {
    animation-name: mate-cycle-next;
    animation-delay: 0ms;
  }

  .team-slot-hiding {
    animation: mate-hide 140ms var(--control-ease) both;
    animation-delay: 0ms;
  }

  @keyframes mate-reveal {
    from {
      opacity: 0.35;
      filter: brightness(0.55);
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: scale(1);
    }
  }

  @keyframes mate-cycle-previous {
    from {
      opacity: 0.35;
      filter: brightness(0.65);
      transform: translateY(-0.45rem) scale(0.97);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mate-cycle-next {
    from {
      opacity: 0.35;
      filter: brightness(0.65);
      transform: translateY(0.45rem) scale(0.97);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mate-hide {
    from {
      opacity: 1;
      filter: brightness(1);
      transform: scale(1);
    }
    to {
      opacity: 0;
      filter: brightness(0.6);
      transform: scale(0.96);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .team-slot-revealed,
    .team-slot-cycle-previous,
    .team-slot-cycle-next,
    .team-slot-hiding {
      animation: none;
    }
  }

  .team-cycle-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding-left: 0.1rem;
  }

  .team-cycle-label {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .team-cycle-count {
    color: color-mix(in srgb, var(--foreground-mid) 75%, transparent);
  }

  @media (max-width: 640px) {
    .standouts {
      --standout-w: clamp(3.85rem, 22vw, 4.75rem);
      --standout-gap-x: 0.35rem;
      --standout-gap-y: 0.65rem;
    }

    /* Slots shrink to share the row, so this stays a cap rather than a size. */
    .ledger-list {
      --standout-w: 4.75rem;
      --team-slot-gap: 0.3rem;
      gap: var(--space-3);
    }

    .row-controls {
      flex-basis: 2.75rem;
      gap: 0.2rem;
    }

    .row-control {
      width: 2.75rem;
      height: 2.75rem;
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
</style>
