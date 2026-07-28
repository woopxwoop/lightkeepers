<script lang="ts">
  import { onDestroy } from "svelte";
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
  import {
    computePullSuggestions,
    computePairSuggestions,
  } from "$lib/pullSuggestions";
  import type { PullSuggestion, PairSuggestion } from "$lib/pullSuggestions";
  import type { TierListEntry } from "$lib/tierlist";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import WishSlot from "$lib/ui/components/WishSlot.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  // "waiting" = owned teams and/or near-miss still in flight.
  type PageState = "waiting" | "done" | "empty" | "error";
  let pageState: PageState = $state("waiting");
  let suggestions: PullSuggestion[] = $state([]);
  let pairSuggestions: PairSuggestion[] = $state([]);
  let expandedSingle = $state<string | null>(null);
  let expandedPair = $state<string | null>(null);
  let expandedStandoutBoards = $state(new Set<string>());
  let collapsingStandoutBoards = $state(new Set<string>());
  const standoutCollapseTimers = new Map<string, ReturnType<typeof setTimeout>>();

  onDestroy(() => {
    for (const timer of standoutCollapseTimers.values()) clearTimeout(timer);
    standoutCollapseTimers.clear();
  });

  const STANDOUT_DEAL_MS = 480;
  const STANDOUT_STAGGER_MS = 85;

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);
  let ownedIds = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let nearMissReady = $derived($nearMissStygianLoaded && $nearMissPairLoaded);

  /** Near-miss + owned teams ready; tier cream optional (filters when present). */
  let pullsDataReady = $derived(
    nearMissReady && $teamsOwnedLoaded && ($tierListLoaded || !!$tierListError),
  );

  /** Limited cream name_ids — pull suggestions stay inside the standouts cut. */
  let creamPullIds = $derived(
    $tierList
      ? new Set($tierList.fiveStar.map((e) => e.nameId))
      : undefined,
  );

  function rankSuggestions() {
    try {
      const singles = computePullSuggestions(
        $nearMissStygianTeams,
        3,
        creamPullIds,
      );
      const pairs = computePairSuggestions(
        $nearMissPairTeams,
        3,
        creamPullIds,
      );
      suggestions = singles;
      pairSuggestions = pairs;
      pageState = singles.length > 0 || pairs.length > 0 ? "done" : "empty";
    } catch (error) {
      suggestions = [];
      pairSuggestions = [];
      pageState = "error";
      console.error("pull suggestion ranking failed:", error);
    }
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
    expandedSingle = expandedSingle === character ? null : character;
  }

  function togglePair(key: string) {
    expandedPair = expandedPair === key ? null : key;
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

{#snippet teamGrid(members: string[], highlighted: string[], dimmed: boolean)}
  <div class="mini-grid" class:mini-grid-dimmed={dimmed}>
    {#each members as member (member)}
      <div
        class="mini-slot"
        class:mini-slot-highlight={highlighted.includes(member)}
      >
        <CharacterIcon character={mapping.get(member)} />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet standoutsBoard(id: string, label: string, entries: TierListEntry[])}
  {@const open = expandedStandoutBoards.has(id)}
  {@const collapsing = collapsingStandoutBoards.has(id)}
  {@const shown = open || collapsing}
  {@const restCount = Math.max(0, entries.length - 1)}
  <div class="standouts">
    <p class="standouts-status">Most used {label}</p>
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
                cue={!shown && i === 0 && restCount > 0
                  ? "Expand"
                  : undefined}
              />
            </li>
          {/each}
          {#if restCount > 0}
            <li class="standout-toggle-cell">
              <button
                type="button"
                class="standouts-toggle"
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
                and how many of those teams they open
              </p>
            </div>
          </header>

          <ol class="ledger-list">
            {#each suggestions as suggestion (suggestion.character)}
              {@const isOpen = expandedSingle === suggestion.character}
              {@const char = mapping.get(suggestion.character)}
              <li class="ledger-row">
                <div class="row-art">
                  <WishSlot
                    nameId={suggestion.character}
                    name={suggestion.characterName ?? suggestion.character}
                    rarity={char?.rarity ?? 5}
                  />
                </div>
                <button
                  type="button"
                  class="row-toggle"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Show less" : "Learn more"}
                  onclick={() => toggleSingle(suggestion.character)}
                >
                  <span class="row-toggle-chevron" class:open={isOpen}>
                    <IconChevronDown size={18} strokeWidth={2.25} />
                  </span>
                </button>

                <div
                  class="row-details"
                  class:row-details-open={isOpen}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                >
                  <div class="row-details-inner">
                    <div class="compare">
                      <p class="compare-label">
                        best unlocked: {(
                          suggestion.topTeams[0]?.avg_usage_rate ?? 0
                        ).toFixed(1)}%
                      </p>
                      {#each suggestion.topTeams as team, i (team.team_key)}
                        <div
                          class="compare-side"
                          class:compare-side-best={i === 0}
                        >
                          {@render teamGrid(
                            team.members ?? [],
                            i === 0 ? [suggestion.character] : [],
                            i !== 0,
                          )}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      <!-- ── Pair opportunities ────────────────────────────────────── -->
      {#if pairSuggestions.length > 0}
        <section class="panel">
          <header class="panel-head">
            <div class="panel-head-text">
              <h2 class="panel-title">Pair opportunities</h2>
              <p class="panel-lede">
                Two characters that unlock teams neither would alone
              </p>
            </div>
          </header>

          <ol class="ledger-list">
            {#each pairSuggestions as suggestion (pairKey(suggestion))}
              {@const key = pairKey(suggestion)}
              {@const isOpen = expandedPair === key}
              {@const charA = mapping.get(suggestion.charA)}
              {@const charB = mapping.get(suggestion.charB)}
              <li class="ledger-row">
                <div class="row-art row-art-pair">
                  <WishSlot
                    nameId={suggestion.charA}
                    name={suggestion.charAName ?? suggestion.charA}
                    rarity={charA?.rarity ?? 5}
                  />
                  <WishSlot
                    nameId={suggestion.charB}
                    name={suggestion.charBName ?? suggestion.charB}
                    rarity={charB?.rarity ?? 5}
                  />
                </div>
                <button
                  type="button"
                  class="row-toggle"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Show less" : "Learn more"}
                  onclick={() => togglePair(key)}
                >
                  <span class="row-toggle-chevron" class:open={isOpen}>
                    <IconChevronDown size={18} strokeWidth={2.25} />
                  </span>
                </button>

                <div
                  class="row-details"
                  class:row-details-open={isOpen}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                >
                  <div class="row-details-inner">
                    <div class="compare">
                      <p class="compare-label">
                        best unlocked: {(
                          suggestion.topTeams[0]?.avg_usage_rate ?? 0
                        ).toFixed(1)}%
                      </p>
                      {#each suggestion.topTeams as team, i (team.team_key)}
                        <div
                          class="compare-side"
                          class:compare-side-best={i === 0}
                        >
                          {@render teamGrid(
                            team.members ?? [],
                            i === 0
                              ? [suggestion.charA, suggestion.charB]
                              : [],
                            i !== 0,
                          )}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </li>
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
        <h2 class="panel-title">Characters used in Stygian</h2>
        <p class="panel-lede">
          Most used characters in Stygian over the last
          {$tierList?.windowCycles ?? 5} cycles
        </p>
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

  /* ── Panels ─────────────────────────────────────────────────────── */
  .suggest-columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-8);
    align-items: start;
  }

  @media (min-width: 960px) {
    .suggest-columns {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
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
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .standouts-deck {
    --deal-stagger: 85ms;
    --deal-duration: 480ms;
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
    z-index: calc(40 - var(--i));
    animation: none;
    transition: none;
  }

  .standouts-deck:not(.open) .standout:first-child {
    z-index: 50;
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
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
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
    align-items: center;
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
  }

  .row-art {
    flex: 0 0 var(--standout-w);
    width: var(--standout-w);
  }

  .row-art-pair {
    display: flex;
    flex: 0 0 auto;
    width: auto;
    gap: 0.45rem;
  }

  .row-art :global(.wish) {
    width: var(--standout-w);
  }

  .row-toggle {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    min-height: 2rem;
    padding: 0.35rem;
    color: var(--accent-1);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .row-toggle:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .row-toggle-chevron {
    display: inline-flex;
    transform: rotate(-90deg);
    transition: transform 220ms ease;
  }

  .row-toggle-chevron.open {
    transform: rotate(90deg);
  }

  .row-details {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: 0fr;
    min-width: 0;
    opacity: 0;
    transition:
      grid-template-columns var(--control-duration) var(--control-ease),
      opacity var(--control-duration) var(--control-ease),
      margin-left var(--control-duration) var(--control-ease);
  }

  .row-details-open {
    grid-template-columns: 1fr;
    opacity: 1;
    margin-left: var(--space-2);
  }

  .row-details-inner {
    min-width: 0;
    overflow: hidden;
    padding: 0.15rem 0.2rem 0.15rem 0.35rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .row-toggle-chevron,
    .row-details {
      transition: none;
    }
  }

  /* ── Comparison ─────────────────────────────────────────────────── */
  .compare {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    width: min(100%, 13rem);
    padding: 0;
  }

  @media (min-width: 960px) {
    .compare {
      width: min(100%, 18rem);
      gap: var(--space-4);
    }
  }

  @media (min-width: 1280px) {
    .compare {
      width: min(100%, 22rem);
    }
  }

  .compare-side {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    border-radius: var(--radius-sm);
  }

  .compare-side-best {
    outline: 1.5px solid var(--accent-1);
    outline-offset: -1.5px;
  }

  .compare-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--foreground-mid);
  }

  .mini-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.1875rem;
  }

  .mini-grid-dimmed {
    opacity: 0.5;
  }

  .mini-slot {
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--background-color);
  }

  .mini-slot-highlight {
    outline: 1.5px solid rgba(255, 255, 255, 0.55);
    outline-offset: -1.5px;
  }

  @media (max-width: 640px) {
    .standouts {
      --standout-w: clamp(3.85rem, 22vw, 4.75rem);
      --standout-gap-x: 0.35rem;
      --standout-gap-y: 0.65rem;
    }

    .ledger-list {
      --standout-w: clamp(2.75rem, 15vw, 3.35rem);
      gap: var(--space-3);
    }

    .ledger-row {
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .row-art-pair {
      gap: 0.3rem;
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
