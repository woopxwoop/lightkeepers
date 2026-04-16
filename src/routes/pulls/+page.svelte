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
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import favicon from "$lib/assets/favicon.svg";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  type PageState = "idle" | "loading" | "done" | "empty";
  let pageState: PageState = $state("idle");
  let suggestions: PullSuggestion[] = $state([]);
  let pairSuggestions: PairSuggestion[] = $state([]);
  let calculationError: string | null = $state(null);

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);

  const rankAccent = ["#e8a83a", "#8a95b0", "#4a5270"];

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
      $charactersOwned.filter((c) => c.isOwned).map((c) => c.name),
    );
    const all = $allTeamsStygian;

    const candidates = all
      .filter((team) => {
        const members = team.members ?? [];
        if (members.length !== 4) return false;
        if ((team.avg_usage_total ?? 0) <= 20) return false;
        return members.some((m) => !ownedNames.has(m));
      })
      .sort((a, b) => (b.avg_usage_total ?? 0) - (a.avg_usage_total ?? 0));

    const result: typeof candidates = [];
    for (const team of candidates) {
      const members = team.members ?? [];
      const dominated = all.some((other) => {
        if ((other.avg_usage_total ?? 0) <= (team.avg_usage_total ?? 0))
          return false;
        const otherMembers = other.members ?? [];
        if (otherMembers.length !== 4) return false;
        return members.filter((m) => otherMembers.includes(m)).length === 3;
      });
      if (!dominated) result.push(team);
      if (result.length === 3) break;
    }

    return result.map((team) => ({
      team,
      missingCharacters: (team.members ?? []).filter((m) => !ownedNames.has(m)),
    }));
  });

  // Debug: show state
  let debugVisible = import.meta.env.DEV;
</script>

<main class="w-[92%] md:w-[80%] pb-20 flex flex-col gap-8">
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest uppercase text-(--intermediate-color)">
          Pull Suggestions
        </h2>
        <p class="text-(--intermediate-color)">
          Based on your {ownedCount} characters — Stygian Onslaught
        </p>
      </div>
      <div
        class="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 font-mono"
        style="display: {import.meta.env.DEV ? 'block' : 'none'};"
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
      style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
    >
      <img src={favicon} alt="Lightkeepers" class="w-14 h-14" />

      <div class="flex flex-col gap-2 max-w-sm">
        <p class="text-(--foreground-color) font-medium">
          Which characters are worth pulling?
        </p>
        <p class="text-(--intermediate-color)">
          We'll find single characters and synergistic pairs you don't own that
          would most improve your Stygian teams.
        </p>
      </div>
      <button
        onclick={calculate}
        disabled={!nearMissReady}
        class="px-6 py-2.5 rounded-lg font-medium transition-opacity"
        style="background: color-mix(in srgb, var(--secondary-color) 10%, transparent);
               border: 0.5px solid color-mix(in srgb, var(--secondary-color) 35%, transparent);
               color: var(--secondary-color);
               opacity: {nearMissReady ? '1' : '0.45'};
               cursor: {nearMissReady ? 'pointer' : 'default'};"
      >
        {nearMissReady ? "Calculate suggestions" : "Loading data…"}
      </button>
    </div>
  {:else if pageState === "loading"}
    <div class="flex items-center justify-center min-h-[30vh]">
      <p class="text-(--intermediate-color)">Calculating…</p>
    </div>
  {:else if pageState === "empty"}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
    >
      <p class="text-(--intermediate-color)">
        {calculationError ?? "No suggestions found."}
      </p>
    </div>
  {:else}
    <!-- ── Single pull suggestions ──────────────────────────────────── -->
    {#if suggestions.length > 0}
      <section class="flex flex-col gap-3">
        <p
          class="text-xs tracking-widest uppercase text-(--intermediate-color)"
        >
          Single Pulls
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {#each suggestions as suggestion, i}
            {@const barWidth = ((suggestion.score / maxScore) * 100).toFixed(1)}
            <div
              class="rounded-xl overflow-hidden flex flex-col"
              style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
            >
              <div class="h-[2px]" style="background: {rankAccent[i]};"></div>
              <div class="p-3 flex flex-col gap-3">
                <!-- Portrait + name -->
                <div class="flex items-center gap-3">
                  <div
                    class="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 relative"
                    style="background: var(--background-color);"
                  >
                    <CharacterIcon
                      character={mapping.get(suggestion.character)}
                    />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span
                      class="text-sm font-medium text-(--foreground-color) truncate"
                    >
                      {suggestion.character}
                    </span>
                    <span class="text-xs text-(--faint-color)">
                      unlocks {suggestion.unlocksTeams}
                      {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                    </span>
                  </div>
                </div>

                <!-- Bar -->
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 h-[4px] rounded-full overflow-hidden"
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
                    <p class="text-xs text-(--faint-color)">
                      currently running
                    </p>
                    <div class="grid grid-cols-4 gap-[2px] opacity-50">
                      {#each aligned.currentAligned as member, j}
                        <div
                          class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                          style="background: var(--background-color);
                                 {j === 3
                            ? 'outline: 1px solid var(--faint-color);'
                            : ''}"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p class="text-xs text-(--faint-color)">
                      {(
                        suggestion.currentBestTeam.avg_usage_total ??
                        suggestion.currentBestTeam.usage_total
                      )?.toFixed(1)}% avg usage
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <p class="text-xs" style="color: {rankAccent[i]};">
                      with {suggestion.character}
                    </p>
                    <div class="grid grid-cols-4 gap-[2px]">
                      {#each aligned.bestAligned as member, j}
                        <div
                          class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                          style="background: var(--background-color);
                                 {j === 3
                            ? `outline: 1.5px solid ${rankAccent[i]}; outline-offset: -1.5px;`
                            : ''}"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p class="text-xs text-(--faint-color)">
                      {suggestion.bestTeam.avg_usage_total?.toFixed(1)}% avg
                      usage
                    </p>
                  </div>
                {:else}
                  <div class="flex flex-col gap-1.5">
                    <p class="text-xs" style="color: {rankAccent[i]};">
                      with {suggestion.character}
                    </p>
                    <div class="grid grid-cols-4 gap-[2px]">
                      {#each suggestion.bestTeam.members ?? [] as member}
                        <div
                          class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                          style="background: var(--background-color);
                                 {member === suggestion.character
                            ? `outline: 1.5px solid ${rankAccent[i]}; outline-offset: -1.5px;`
                            : ''}"
                        >
                          <CharacterIcon character={mapping.get(member)} />
                        </div>
                      {/each}
                    </div>
                    <p class="text-xs text-(--faint-color)">
                      {suggestion.bestTeam.avg_usage_total?.toFixed(1)}% avg
                      usage · no current alternative
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
          class="text-xs tracking-widest uppercase text-(--intermediate-color)"
        >
          Synergy Pairs
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {#each pairSuggestions as suggestion, i}
            {@const barWidth = (
              (suggestion.avgUsage / maxPairScore) *
              100
            ).toFixed(1)}
            {@const synLabel =
              suggestion.pmi > 1.5
                ? "core pair"
                : suggestion.pmi > 0.8
                  ? "high synergy"
                  : "synergy pair"}
            <div
              class="rounded-xl overflow-hidden flex flex-col"
              style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
            >
              <div class="h-[2px]" style="background: {rankAccent[i]};"></div>
              <div class="p-3 flex flex-col gap-3">
                <!-- Two portraits + name -->
                <div class="flex items-center gap-2">
                  <div class="flex gap-1 flex-shrink-0">
                    <div
                      class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        character={mapping.get(suggestion.charA)}
                      />
                    </div>
                    <div
                      class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        character={mapping.get(suggestion.charB)}
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span
                      class="text-xs sm:text-sm font-medium text-(--foreground-color) truncate"
                    >
                      {suggestion.charA} + {suggestion.charB}
                    </span>
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-(--faint-color)">
                        {suggestion.unlocksTeams}
                        {suggestion.unlocksTeams === 1 ? "team" : "teams"}
                      </span>
                      <span class="text-xs" style="color: {rankAccent[i]};"
                        >· {synLabel}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Bar driven by avg usage -->
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 h-[4px] rounded-full overflow-hidden"
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
                    {suggestion.avgUsage.toFixed(1)}% avg
                  </span>
                </div>

                <!-- Best unlocked team — both missing slots get accent ring -->
                <div class="flex flex-col gap-1.5">
                  <p class="text-xs" style="color: {rankAccent[i]};">
                    best unlocked team
                  </p>
                  <div class="grid grid-cols-4 gap-[2px]">
                    {#each suggestion.bestTeam.members ?? [] as member}
                      {@const isMissing =
                        member === suggestion.charA ||
                        member === suggestion.charB}
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="background: var(--background-color);
                               {isMissing
                          ? `outline: 1.5px solid ${rankAccent[i]}; outline-offset: -1.5px;`
                          : ''}"
                      >
                        <CharacterIcon character={mapping.get(member)} />
                      </div>
                    {/each}
                  </div>
                  <p class="text-xs text-(--faint-color)">
                    {suggestion.bestTeam.avg_usage_total?.toFixed(1)}% avg usage
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
      <p class="text-xs tracking-widest uppercase text-(--intermediate-color)">
        Best Teams You Don't Have
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {#each topMissingTeams as { team, missingCharacters }, i}
          {@const accent = rankAccent[i]}
          <div
            class="rounded-xl overflow-hidden flex flex-col"
            style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
          >
            <div class="h-0.5" style="background: {accent};"></div>
            <div class="p-3 flex flex-col gap-3">
              <div class="grid grid-cols-4 gap-0.5">
                {#each team.members ?? [] as member}
                  {@const isMissing = missingCharacters.includes(member)}
                  <div
                    class="aspect-3/4 rounded-[5px] overflow-hidden relative"
                    style="background: var(--background-color);
                           {isMissing
                      ? `outline: 1.5px solid ${accent}; outline-offset: -1.5px; opacity: 0.7;`
                      : ''}"
                  >
                    <CharacterIcon character={mapping.get(member)} />
                  </div>
                {/each}
              </div>
              <div class="flex flex-col gap-1">
                <p class="text-xs text-(--faint-color)">
                  {(team.avg_usage_total ?? 0).toFixed(1)}% avg usage
                </p>
                <p class="text-xs" style="color: {accent};">
                  missing: {missingCharacters.join(", ")}
                </p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</main>
