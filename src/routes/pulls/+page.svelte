<script lang="ts">
  import {
    charactersOwned,
    teamsOwnedStygian,
    nearMissStygianTeams,
    nearMissPairTeams,
  } from "$lib/stores";
  import {
    computePullSuggestions,
    computePairSuggestions,
  } from "$lib/pullSuggestions";
  import type { PullSuggestion, PairSuggestion } from "$lib/pullSuggestions";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import favicon from "$lib/assets/favicon.svg";

  let { data } = $props();
  let mapping: Map<string, string> = $derived(data.mapping);

  type PageState = "idle" | "loading" | "done" | "empty";
  let pageState: PageState = $state("idle");
  let suggestions: PullSuggestion[] = $state([]);
  let pairSuggestions: PairSuggestion[] = $state([]);

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

  async function calculate() {
    pageState = "loading";
    await new Promise((r) => setTimeout(r, 50));
    const singles = computePullSuggestions(
      $nearMissStygianTeams,
      $teamsOwnedStygian,
    );
    const pairs = computePairSuggestions($nearMissPairTeams);
    suggestions = singles;
    pairSuggestions = pairs;
    pageState = singles.length > 0 || pairs.length > 0 ? "done" : "empty";
  }

  let maxScore = $derived(suggestions[0]?.score ?? 1);
  let maxPairScore = $derived(pairSuggestions[0]?.avgUsage ?? 1);
</script>

<main class="w-[80%] pb-20 flex flex-col gap-8">
  <div class="flex flex-col gap-1">
    <h2 class="tracking-widest uppercase text-(--intermediate-color)">
      Pull Suggestions
    </h2>
    <p class="text-(--intermediate-color)">
      Based on your {ownedCount} characters — Stygian Onslaught
    </p>
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
        class="px-6 py-2.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
        style="background: color-mix(in srgb, var(--secondary-color) 10%, transparent);
               border: 0.5px solid color-mix(in srgb, var(--secondary-color) 35%, transparent);
               color: var(--secondary-color);"
      >
        Calculate suggestions
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
        No suggestions found — your roster already covers the top Stygian teams.
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
                      name={suggestion.character}
                      icon={mapping.get(suggestion.character) ?? avatarImg}
                      rarity={null}
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
                          <CharacterIcon
                            name={member}
                            icon={mapping.get(member) ?? avatarImg}
                            rarity={null}
                          />
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
                          <CharacterIcon
                            name={member}
                            icon={mapping.get(member) ?? avatarImg}
                            rarity={null}
                          />
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
                          <CharacterIcon
                            name={member}
                            icon={mapping.get(member) ?? avatarImg}
                            rarity={null}
                          />
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
                <div class="flex items-center gap-3">
                  <div class="flex gap-1 flex-shrink-0">
                    <div
                      class="w-11 h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        name={suggestion.charA}
                        icon={mapping.get(suggestion.charA) ?? avatarImg}
                        rarity={null}
                      />
                    </div>
                    <div
                      class="w-11 h-11 rounded-lg overflow-hidden relative"
                      style="background: var(--background-color);"
                    >
                      <CharacterIcon
                        name={suggestion.charB}
                        icon={mapping.get(suggestion.charB) ?? avatarImg}
                        rarity={null}
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span
                      class="text-sm font-medium text-(--foreground-color) truncate"
                    >
                      {suggestion.charA} + {suggestion.charB}
                    </span>
                    <div class="flex items-center gap-1.5">
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
                        <CharacterIcon
                          name={member}
                          icon={mapping.get(member) ?? avatarImg}
                          rarity={null}
                        />
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

    <button
      onclick={calculate}
      class="text-xs text-(--faint-color) hover:text-(--intermediate-color) transition-colors self-center"
    >
      Recalculate
    </button>
  {/if}
</main>
