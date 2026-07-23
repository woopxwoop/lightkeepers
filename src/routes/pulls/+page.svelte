<script lang="ts">
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
  } from "$lib/stores";
  import {
    computePullSuggestions,
    computePairSuggestions,
  } from "$lib/pullSuggestions";
  import type { PullSuggestion, PairSuggestion } from "$lib/pullSuggestions";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
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

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);

  // Align single-missing: swap slot always last
  function alignMembers(
    bestMembers: string[],
    currentMembers: string[],
    missingCharacter: string,
  ): { bestAligned: string[]; currentAligned: string[] } {
    const shared = bestMembers.filter((m) => m !== missingCharacter);
    const replaced = currentMembers.find((m) => !shared.includes(m)) ?? "";
    return {
      bestAligned: [...shared, missingCharacter],
      currentAligned: [...shared, replaced],
    };
  }

  let nearMissReady = $derived(
    $nearMissStygianLoaded && $nearMissPairLoaded,
  );

  let pullsDataReady = $derived(nearMissReady && $teamsOwnedLoaded);

  function rankSuggestions() {
    try {
      const singles = computePullSuggestions(
        $nearMissStygianTeams,
        $teamsOwnedStygian,
      );
      const pairs = computePairSuggestions(
        $nearMissPairTeams,
        $teamsOwnedStygian,
        singles,
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
    rankSuggestions();
  });

  function toggleSingle(character: string) {
    expandedSingle = expandedSingle === character ? null : character;
  }

  function togglePair(key: string) {
    expandedPair = expandedPair === key ? null : key;
  }

  function pairKey(suggestion: PairSuggestion): string {
    return `${suggestion.charA}|${suggestion.charB}`;
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
</script>

{#snippet teamGrid(
  members: string[],
  highlighted: string[],
  dimmed: boolean,
)}
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

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Pull Suggestions</h1>
      <p class="page-meta">
        Based on your {ownedCount} characters · Stygian Onslaught usage
      </p>
    </div>
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
    <!-- ── Best next pulls ─────────────────────────────────────────── -->
    {#if suggestions.length > 0}
      <section class="ledger-section">
        <header class="ledger-head">
          <h2 class="ledger-title">Best next pulls</h2>
          <p class="ledger-lede">
            Ranked by how much a character improves the teams your roster can
            already field
          </p>
        </header>

        <Surface flush class="ledger">
          <ol class="ledger-list">
            {#each suggestions as suggestion, i (suggestion.character)}
              {@const isOpen = expandedSingle === suggestion.character}
              <li class="ledger-row">
                <button
                  type="button"
                  class="row-head"
                  aria-expanded={isOpen}
                  onclick={() => toggleSingle(suggestion.character)}
                >
                  <span class="row-rank">{i + 1}</span>
                  <span class="row-portrait">
                    <CharacterIcon
                      character={mapping.get(suggestion.character)}
                      iconStyle="enka"
                    />
                  </span>
                  <span class="row-text">
                    <span class="row-name"
                      >{suggestion.characterName ?? suggestion.character}</span
                    >
                    <span class="row-sub">
                      unlocks {suggestion.unlocksTeams}
                      {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                    </span>
                  </span>
                  <span
                    class="row-delta"
                    title={suggestion.currentBestTeam
                      ? `${suggestion.avgUsage.toFixed(1)}% unlocked − ${suggestion.currentBestTeam.avg_usage_rate.toFixed(1)}% current best`
                      : `${suggestion.avgUsage.toFixed(1)}% unlocked · no current alternative`}
                    >+{suggestion.improvement.toFixed(1)} usage pts</span
                  >
                  <span class="row-chevron" class:row-chevron-open={isOpen}>
                    <IconChevronDown size={16} strokeWidth={2.25} />
                  </span>
                </button>

                <div
                  class="row-details"
                  class:row-details-open={isOpen}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                >
                  <div class="row-details-inner">
                    {#if suggestion.currentBestTeam}
                      {@const aligned = alignMembers(
                        suggestion.bestTeam.members ?? [],
                        suggestion.currentBestTeam.members ?? [],
                        suggestion.character,
                      )}
                      <div class="compare">
                        <div class="compare-side">
                          <p class="compare-label">current best</p>
                          {@render teamGrid(aligned.currentAligned, [], true)}
                          <p class="compare-usage">
                            {suggestion.currentBestTeam.avg_usage_rate.toFixed(
                              1,
                            )}% avg usage
                          </p>
                        </div>
                        <span class="compare-arrow" aria-hidden="true">
                          <IconChevronDown size={18} strokeWidth={2} />
                        </span>
                        <div class="compare-side">
                          <p class="compare-label">
                            with {suggestion.characterName ??
                              suggestion.character}
                          </p>
                          {@render teamGrid(
                            aligned.bestAligned,
                            [suggestion.character],
                            false,
                          )}
                          <p class="compare-usage compare-usage-accent">
                            {suggestion.avgUsage.toFixed(1)}% avg usage
                          </p>
                        </div>
                      </div>
                    {:else}
                      <div class="compare">
                        <div class="compare-side">
                          <p class="compare-label">
                            best unlocked team — no current alternative
                          </p>
                          {@render teamGrid(
                            suggestion.bestTeam.members ?? [],
                            [suggestion.character],
                            false,
                          )}
                          <p class="compare-usage compare-usage-accent">
                            {suggestion.avgUsage.toFixed(1)}% avg usage
                          </p>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        </Surface>
      </section>
    {/if}

    <!-- ── Pair opportunities ──────────────────────────────────────── -->
    {#if pairSuggestions.length > 0}
      <section class="ledger-section">
        <header class="ledger-head">
          <h2 class="ledger-title">Pair opportunities</h2>
          <p class="ledger-lede">
            Two characters that unlock teams neither would alone
          </p>
        </header>

        <Surface flush class="ledger">
          <ol class="ledger-list">
            {#each pairSuggestions as suggestion, i (pairKey(suggestion))}
              {@const key = pairKey(suggestion)}
              {@const isOpen = expandedPair === key}
              <li class="ledger-row">
                <button
                  type="button"
                  class="row-head"
                  aria-expanded={isOpen}
                  onclick={() => togglePair(key)}
                >
                  <span class="row-rank">{i + 1}</span>
                  <span class="row-portrait-pair">
                    <span class="row-portrait">
                      <CharacterIcon
                        character={mapping.get(suggestion.charA)}
                        iconStyle="enka"
                      />
                    </span>
                    <span class="row-portrait">
                      <CharacterIcon
                        character={mapping.get(suggestion.charB)}
                        iconStyle="enka"
                      />
                    </span>
                  </span>
                  <span class="row-text">
                    <span class="row-name">
                      {suggestion.charAName} + {suggestion.charBName}
                    </span>
                    <span class="row-sub">
                      unlocks {suggestion.unlocksTeams}
                      {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                    </span>
                  </span>
                  <span
                    class="row-delta"
                    title={suggestion.currentBestTeam
                      ? `${suggestion.avgUsage.toFixed(1)}% unlocked − ${suggestion.currentBestTeam.avg_usage_rate.toFixed(1)}% current alternative`
                      : `${suggestion.avgUsage.toFixed(1)}% unlocked · no current alternative`}
                    >+{suggestion.improvement.toFixed(1)} usage pts</span
                  >
                  <span class="row-chevron" class:row-chevron-open={isOpen}>
                    <IconChevronDown size={16} strokeWidth={2.25} />
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
                      {#if suggestion.currentBestTeam}
                        <div class="compare-side">
                          <p class="compare-label">current alternative</p>
                          {@render teamGrid(
                            suggestion.currentBestTeam.members ?? [],
                            [],
                            true,
                          )}
                          <p class="compare-usage">
                            {suggestion.currentBestTeam.avg_usage_rate.toFixed(
                              1,
                            )}% avg usage
                          </p>
                        </div>
                        <span class="compare-arrow" aria-hidden="true">
                          <IconChevronDown size={18} strokeWidth={2} />
                        </span>
                      {/if}
                      <div class="compare-side">
                        <p class="compare-label">best unlocked team</p>
                        {@render teamGrid(
                          suggestion.bestTeam.members ?? [],
                          [suggestion.charA, suggestion.charB],
                          false,
                        )}
                        <p class="compare-usage compare-usage-accent">
                          {suggestion.avgUsage.toFixed(1)}% avg usage
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        </Surface>
      </section>
    {/if}
  {/if}

  <!-- ── How suggestions work ──────────────────────────────────────── -->
  <details class="methodology">
    <summary>How suggestions work</summary>
    <p>
      Rankings weigh team usage rates in Stygian Onslaught fearless and dire: a
      character scores higher when the teams they unlock are meaningfully
      better than what your roster can already field with the same cores. They
      do not account for vertical investment, unreleased content, or your
      personal preferences.
      <span class="methodology-accent"
        >When in doubt, pull and build around your favorite characters.</span
      >
    </p>
  </details>
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

  /* ── Ledger sections ────────────────────────────────────────────── */
  .ledger-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .ledger-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ledger-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .ledger-lede {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  /* Board hairlines are pure white — warm tones over blue mid mix to mud. */
  :global(.ledger) {
    overflow: hidden;
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
  }

  .ledger-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ledger-row + .ledger-row {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  /* ── Row head ───────────────────────────────────────────────────── */
  .row-head {
    display: grid;
    grid-template-columns: 1.5rem auto minmax(0, 1fr) auto 1rem;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-4);
    text-align: left;
    transition: background-color var(--control-duration) var(--control-ease);
  }

  .row-head:hover {
    background: var(--surface-quiet);
  }

  .row-rank {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: var(--foreground-mid);
  }

  .row-portrait {
    display: block;
    width: 3.25rem;
    height: 3.25rem;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--background-color);
    flex-shrink: 0;
  }

  .row-portrait-pair {
    display: flex;
    gap: 0.25rem;
  }

  .row-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .row-name {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-sub {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .row-delta {
    font-size: var(--text-sm);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--accent-1);
  }

  .row-chevron {
    display: inline-flex;
    color: var(--foreground-mid);
    transition: transform var(--control-duration) var(--control-ease);
  }

  .row-chevron-open {
    transform: rotate(180deg);
  }

  .row-details {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition:
      grid-template-rows var(--control-duration) var(--control-ease),
      opacity var(--control-duration) var(--control-ease);
  }

  .row-details-open {
    grid-template-rows: 1fr;
    opacity: 1;
  }

  .row-details-inner {
    min-height: 0;
    overflow: hidden;
    border-top: var(--border-width) solid var(--border-subtle);
    background: color-mix(
      in srgb,
      var(--foreground-color) 2%,
      transparent
    );
  }

  /* ── Comparison ─────────────────────────────────────────────────── */
  .compare {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-5) var(--space-4);
  }

  .compare-side {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: min(100%, 22rem);
  }

  .compare-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--foreground-mid);
  }

  .compare-usage {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--foreground-mid);
  }

  .compare-usage-accent {
    color: var(--accent-1);
  }

  /* Chevron points down (stacked mobile flow); rotates to point right
     when sides sit next to each other on desktop. */
  .compare-arrow {
    display: inline-flex;
    align-self: center;
    color: var(--foreground-mid);
  }

  @media (min-width: 768px) {
    .compare {
      flex-direction: row;
      align-items: center;
      gap: var(--space-5);
    }

    .compare-arrow :global(svg) {
      transform: rotate(-90deg);
    }

    .compare-side:only-child {
      width: min(100%, 28rem);
    }
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
    outline: 1.5px solid var(--accent-1);
    outline-offset: -1.5px;
  }

  @media (max-width: 640px) {
    .row-head {
      grid-template-columns: 1rem auto minmax(0, 1fr) auto 1rem;
      gap: var(--space-2);
      padding: var(--space-3);
    }

    .row-portrait {
      width: 3rem;
      height: 3rem;
    }

    .row-delta {
      grid-column: auto;
      justify-self: end;
    }

    .row-chevron {
      grid-column: auto;
      grid-row: auto;
    }

    .compare {
      padding: var(--space-3);
    }
  }

  /* ── Methodology ────────────────────────────────────────────────── */
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

  .methodology-accent {
    color: var(--accent-2);
  }
</style>
