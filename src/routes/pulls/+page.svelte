<script lang="ts">
  import {
    charactersOwned,
    teamsOwnedStygian,
    allTeamsStygian,
    nearMissStygianTeams,
    nearMissPairTeams,
    nearMissStygianLoaded,
    nearMissPairLoaded,
  } from "$lib/stores";
  import {
    computePullSuggestions,
    computePairSuggestions,
  } from "$lib/pullSuggestions";
  import type { PullSuggestion, PairSuggestion } from "$lib/pullSuggestions";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import favicon from "$lib/assets/favicon.svg";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  type PageState = "idle" | "loading" | "done" | "empty";
  let pageState: PageState = $state("idle");
  let suggestions: PullSuggestion[] = $state([]);
  let pairSuggestions: PairSuggestion[] = $state([]);
  let calculationError: string | null = $state(null);

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);

  const rankAccent = ["var(--accent-1)", "var(--accent-1)", "var(--accent-1)"];

  const smallIconZoom = 1.6;

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
    ($nearMissStygianLoaded && $nearMissPairLoaded) ||
      $teamsOwnedStygian.length === 0,
  );

  async function calculate() {
    if (!nearMissReady) return;
    console.log("[CALCULATE] Starting...");

    pageState = "loading";
    calculationError = null;

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
      pageState = "empty";
      calculationError = "Could not calculate suggestions right now.";
      console.error("pull suggestion calculation failed:", error);
    }
  }

  let maxScore = $derived(suggestions[0]?.score ?? 1);
  let maxPairScore = $derived(pairSuggestions[0]?.avgUsage ?? 1);

  // Top 3 best teams the user doesn't have (pulls page section)
  let topMissingTeams = $derived.by(() => {
    const ownedNames = new Set(
      $charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id ?? ""),
    );

    const all = $allTeamsStygian;

    const candidates = all
      .filter((team) => {
        const members = team.members ?? [];
        if (members.length !== 4) return false;
        if ((team.avg_usage_rate ?? 0) <= 20) return false;
        return members.some((m) => !ownedNames.has(m));
      })
      .sort((a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0));

    const result: typeof candidates = [];
    for (const team of candidates) {
      const members = team.members ?? [];
      const dominated = all.some((other) => {
        if ((other.avg_usage_rate ?? 0) <= (team.avg_usage_rate ?? 0))
          return false;
        const otherMembers = other.members ?? [];
        if (otherMembers.length !== 4) return false;
        return members.filter((m) => otherMembers.includes(m)).length === 3;
      });
      if (!dominated) result.push(team);
      if (result.length === 3) break;
    }

    return result.map((team) => {
      const missingCharactersIndexes = (team.members ?? []).flatMap(
        (member, index) => (!ownedNames.has(member) ? index : []),
      );

      return {
        team,
        missingCharacters: missingCharactersIndexes.map(
          (index) => team.members[index],
        ),
        missingCharactersNames: missingCharactersIndexes.map(
          (index) => team.members_names[index],
        ),
      };
    });
  });

  // Debug: show state
  let debugVisible = import.meta.env.DEV;
</script>

<main class="w-[80%] pb-20 flex flex-col gap-8">
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-1">
        <h2
          class="tracking-widest uppercase"
          style="color: var(--foreground-color);"
        >
          Pull Suggestions
        </h2>
        <p style="color: var(--foreground-mid);">
          Based on your {ownedCount} characters & Stygian Onslaught usage
        </p>
      </div>
      <div
        class="text-xs px-2 py-1 rounded font-mono"
        class:pulls-debug-visible={import.meta.env.DEV}
        class:pulls-debug-hidden={!import.meta.env.DEV}
        style="background: color-mix(in srgb, darkred 40%, transparent); color: #fca5a5;"
      >
        <div>ready: {nearMissReady}</div>
        <div>single: {$nearMissStygianLoaded}</div>
        <div>pair: {$nearMissPairLoaded}</div>
        <div>state: {pageState}</div>
      </div>
    </div>
  </div>

  {#if pageState === "idle"}
    <div
      class="rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <img src={favicon} alt="Lightkeepers" class="w-14 h-14" />

      <div class="flex flex-col gap-2 max-w-sm">
        <p class="font-medium" style="color: var(--foreground-color);">
          Which characters are worth pulling?
        </p>
        <p style="color: var(--foreground-mid);">
          We'll find single characters and synergistic pairs you don't own that
          would most improve your Stygian teams.
        </p>
      </div>
      <button
        onclick={calculate}
        disabled={!nearMissReady}
        class="calculate-button px-6 py-2.5 rounded-lg font-medium transition-opacity"
        class:calculate-button-disabled={!nearMissReady}
        style="background: color-mix(in srgb, var(--accent-1) 10%, transparent);
               border: 0.5px solid color-mix(in srgb, var(--accent-1) 35%, transparent);
           color: var(--accent-1);"
      >
        {nearMissReady ? "Calculate suggestions" : "Loading data…"}
      </button>
    </div>
  {:else if pageState === "loading"}
    <div class="flex items-center justify-center min-h-[30vh]">
      <p style="color: var(--foreground-mid);">Calculating…</p>
    </div>
  {:else if pageState === "empty"}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">
        {calculationError ?? "No suggestions found."}
      </p>
    </div>
  {:else}
    <!-- ── Single pull suggestions ──────────────────────────────────── -->
    {#if suggestions.length > 0}
      <section class="flex flex-col gap-3">
        <p
          class="text-xs tracking-widest uppercase"
          style="color: var(--foreground-mid);"
        >
          Single Pulls
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {#each suggestions as suggestion, i}
            {@const barWidth = ((suggestion.score / maxScore) * 100).toFixed(1)}
            <div
              class="rounded-xl overflow-hidden flex flex-col"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
            >
              <div class="h-0.5" style="background: {rankAccent[i]};"></div>
              <div class="p-3 flex flex-col gap-3">
                <!-- Portrait + name -->
                <div class="flex items-center gap-3">
                  <div
                    class="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative"
                    style="background: var(--background-color);"
                  >
                    <CharacterIcon
                      character={mapping.get(suggestion.character)}
                      zoom={smallIconZoom}
                    />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span
                      class="text-sm font-medium truncate"
                      style="color: var(--foreground-color);"
                    >
                      {suggestion.characterName ?? suggestion.character}
                    </span>
                    <span class="text-xs" style="color: var(--foreground-mid);">
                      unlocks {suggestion.unlocksTeams}
                      {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                    </span>
                  </div>
                </div>

                <!-- Bar -->
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 h-1 rounded-full overflow-hidden"
                    style="background: var(--background-color);"
                  >
                    <div
                      class="h-full rounded-full"
                      style="width: {barWidth}%; background: {rankAccent[i]};"
                    ></div>
                  </div>
                  <span
                    class="text-xs font-medium whitespace-nowrap"
                    style="color: {rankAccent[i]};"
                  >
                    +{suggestion.improvement.toFixed(1)}%
                  </span>
                </div>

                <!-- Team comparison -->
                {#if suggestion.currentBestTeam}
                  {@const aligned = alignMembers(
                    suggestion.bestTeam.members ?? [],
                    suggestion.currentBestTeam.members ?? [],
                    suggestion.character,
                  )}
                  <div class="flex flex-col gap-1.5">
                    <div class="grid grid-cols-4 gap-0.5">
                      {#each aligned.bestAligned as member, j}
                        <div
                          class="team-slot rounded-[5px] overflow-hidden relative"
                          class:team-slot-best-highlight={j === 3}
                          style="background: var(--background-color); --team-slot-accent: {rankAccent[
                            i
                          ]};"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p
                      class="text-xs text-right"
                      style="color: {rankAccent[i]};"
                    >
                      {suggestion.avgUsage.toFixed(1)}% avg usage
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <p class="text-xs" style="color: var(--foreground-mid);">
                      current alternative
                    </p>
                    <div class="grid grid-cols-4 gap-0.5 opacity-50">
                      {#each aligned.currentAligned as member, j}
                        <div
                          class="team-slot rounded-[5px] overflow-hidden relative"
                          class:team-slot-current-highlight={j === 3}
                          style="background: var(--background-color);"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p
                      class="text-xs text-right"
                      style="color: var(--foreground-mid);"
                    >
                      {suggestion.currentBestTeam.avg_usage_rate.toFixed(1)}%
                      avg usage
                    </p>
                  </div>
                {:else}
                  <div class="flex flex-col gap-1.5">
                    <div class="grid grid-cols-4 gap-0.5">
                      {#each suggestion.bestTeam.members ?? [] as member}
                        <div
                          class="rounded-[5px] overflow-hidden relative"
                          style="background: var(--background-color);
                                 {member === suggestion.character
                            ? `outline: 1.5px solid ${rankAccent[i]}; outline-offset: -1px;`
                            : ''}"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p
                      class="text-xs text-right"
                      style="color: var(--foreground-mid);"
                    >
                      {suggestion.avgUsage.toFixed(1)}% avg usage · no current
                      alternative
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ── Pair pull suggestions ─────────────────────────────────────── -->
    {#if pairSuggestions.length > 0}
      <section class="flex flex-col gap-3">
        <p
          class="text-xs tracking-widest uppercase"
          style="color: var(--foreground-mid);"
        >
          Synergy Pairs
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {#each pairSuggestions as suggestion, i}
            {@const barWidth = (
              (suggestion.avgUsage / maxPairScore) *
              100
            ).toFixed(1)}
            <div
              class="rounded-xl overflow-hidden flex flex-col"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
            >
              <div class="h-0.5" style="background: {rankAccent[i]};"></div>
              <div class="p-3 flex flex-col gap-3">
                <!-- Two portraits + name -->
                <div class="flex items-center gap-2">
                  <div class="flex gap-1 shrink-0">
                    <div
                      class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        character={mapping.get(suggestion.charA)}
                        zoom={smallIconZoom}
                      />
                    </div>
                    <div
                      class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        character={mapping.get(suggestion.charB)}
                        zoom={smallIconZoom}
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span
                      class="text-xs sm:text-sm font-medium truncate"
                      style="color: var(--foreground-color);"
                    >
                      {suggestion.charAName} + {suggestion.charBName}
                    </span>
                    <div class="flex items-center gap-1 flex-wrap">
                      <span
                        class="text-xs"
                        style="color: var(--foreground-mid);"
                      >
                        unlocks
                        {suggestion.unlocksTeams}
                        {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Best unlocked team — both missing slots get accent ring -->
                <div class="flex flex-col gap-1.5">
                  <p class="text-xs" style="color: var(--foreground-mid);">
                    best unlocked team
                  </p>
                  <div class="grid grid-cols-4 gap-0.5">
                    {#each suggestion.bestTeam.members ?? [] as member}
                      {@const isMissing =
                        member === suggestion.charA ||
                        member === suggestion.charB}
                      <div
                        class="team-slot rounded-[5px] overflow-hidden relative"
                        class:team-slot-best-highlight={isMissing}
                        style="background: var(--background-color); --team-slot-accent: {rankAccent[
                          i
                        ]};"
                      >
                        <CharacterIcon character={mapping.get(member)} />
                      </div>
                    {/each}
                  </div>
                  <p
                    class="text-xs text-right"
                    style="color: var(--foreground-mid);"
                  >
                    {suggestion.avgUsage.toFixed(1)}% avg usage
                  </p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  <!-- ── Best teams you don't have ────────────────────────────────────── -->
  {#if topMissingTeams.length > 0}
    <section class="flex flex-col gap-3">
      <p
        class="text-xs tracking-widest uppercase"
        style="color: var(--foreground-mid);"
      >
        Best Teams You Don't Have
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {#each topMissingTeams as { team, missingCharacters, missingCharactersNames }, i}
          {@const accent = rankAccent[i]}
          <div
            class="rounded-xl overflow-hidden flex flex-col"
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
          >
            <div class="h-0.5" style="background: {accent};"></div>
            <div class="p-3 flex flex-col gap-3">
              <div class="grid grid-cols-4 gap-0.5">
                {#each team.members ?? [] as member}
                  {@const isMissing = missingCharacters.includes(member)}
                  <div
                    class="team-slot rounded-[5px] overflow-hidden relative"
                    class:team-slot-missing={isMissing}
                    style="background: var(--background-color); --team-slot-accent: {accent};"
                  >
                    <CharacterIcon character={mapping.get(member)} />
                  </div>
                {/each}
              </div>
              <div class="flex justify-between">
                <span class="text-xs" style="color: {accent};">
                  missing: {missingCharactersNames.join(", ")}
                </span>
                <span
                  class="text-xs text-right"
                  style="color: var(--foreground-mid);"
                >
                  {team.avg_usage_rate.toFixed(1)}% avg usage
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</main>

<style>
  .pulls-debug-hidden {
    display: none;
  }

  .pulls-debug-visible {
    display: block;
  }

  .calculate-button-disabled {
    opacity: 0.45;
    cursor: default;
  }

  .team-slot-current-highlight {
    outline: 1px solid var(--foreground-mid);
    outline-offset: -1px;
  }

  .team-slot-best-highlight {
    outline: 1.5px solid var(--team-slot-accent);
    outline-offset: -1px;
  }

  .team-slot-missing {
    outline: 1.5px solid var(--team-slot-accent);
    outline-offset: -1px;
    opacity: 0.33;
  }
</style>
