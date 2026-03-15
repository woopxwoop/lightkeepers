<script lang="ts">
  import {
    charactersOwned,
    teamsOwnedStygian,
    nearMissStygianTeams,
  } from "$lib/stores";
  import { computePullSuggestions } from "$lib/pullSuggestions";
  import type { PullSuggestion } from "$lib/pullSuggestions";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";

  let { data } = $props();
  let mapping: Map<string, string> = $derived(data.mapping);

  type PageState = "idle" | "loading" | "done" | "empty";
  let pageState: PageState = $state("idle");
  let suggestions: PullSuggestion[] = $state([]);

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);

  const rankAccent = ["#e8a83a", "#8a95b0", "#4a5270"];

  /**
   * Returns [sharedMembers..., missingCharacter] for bestTeam
   * and    [sharedMembers..., replacedCharacter] for currentBestTeam
   * so both arrays align positionally — swap is always in the last slot.
   */
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
    const result = computePullSuggestions(
      $nearMissStygianTeams,
      $teamsOwnedStygian,
    );
    suggestions = result;
    pageState = result.length > 0 ? "done" : "empty";
  }

  let maxScore = $derived(suggestions[0]?.score ?? 1);
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
      <div
        class="w-14 h-14 rounded-2xl flex items-center justify-center"
        style="border: 1px solid color-mix(in srgb, var(--secondary-color) 30%, transparent);
               background: color-mix(in srgb, var(--secondary-color) 7%, transparent);"
      >
        <div
          class="w-6 h-6 rounded-full"
          style="border: 1px solid color-mix(in srgb, var(--secondary-color) 45%, transparent);
                 background: color-mix(in srgb, var(--secondary-color) 18%, transparent);"
        ></div>
      </div>

      <div class="flex flex-col gap-2 max-w-sm">
        <p class="text-(--foreground-color) font-medium">
          Which characters are worth pulling?
        </p>
        <p class="text-(--intermediate-color)">
          We'll find characters you don't own that would most improve your
          Stygian teams — ranked by how much they upgrade your existing roster.
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
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {#each suggestions as suggestion, i}
        {@const barWidth = ((suggestion.score / maxScore) * 100).toFixed(1)}
        <div
          class="rounded-xl overflow-hidden flex flex-col"
          style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
        >
          <div class="h-[2px]" style="background: {rankAccent[i]};"></div>

          <div class="p-3 flex flex-col gap-3">
            <!-- Character portrait + name -->
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

            <!-- Improvement bar -->
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

            <!-- Currently running + best unlocked, aligned -->
            {#if suggestion.currentBestTeam}
              {@const aligned = alignMembers(
                suggestion.bestTeam.members ?? [],
                suggestion.currentBestTeam.members ?? [],
                suggestion.character,
              )}

              <div class="flex flex-col gap-1.5">
                <p class="text-xs text-(--faint-color)">currently running</p>
                <div class="grid grid-cols-4 gap-[2px] opacity-50">
                  {#each aligned.currentAligned as member, j}
                    {#if j === 3}
                      <!-- replaced character — highlight it -->
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="background: var(--background-color);
                               outline: 1px solid var(--faint-color);"
                      >
                        <CharacterIcon
                          name={member}
                          icon={mapping.get(member) ?? avatarImg}
                          rarity={null}
                        />
                      </div>
                    {:else}
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="background: var(--background-color);"
                      >
                        <CharacterIcon
                          name={member}
                          icon={mapping.get(member) ?? avatarImg}
                          rarity={null}
                        />
                      </div>
                    {/if}
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
                    {#if j === 3}
                      <!-- the pull slot — show portrait with accent ring -->
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="outline: 1.5px solid {rankAccent[i]};
                               outline-offset: -1.5px;"
                      >
                        <CharacterIcon
                          name={suggestion.character}
                          icon={mapping.get(suggestion.character) ?? avatarImg}
                          rarity={null}
                        />
                      </div>
                    {:else}
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="background: var(--background-color);"
                      >
                        <CharacterIcon
                          name={member}
                          icon={mapping.get(member) ?? avatarImg}
                          rarity={null}
                        />
                      </div>
                    {/if}
                  {/each}
                </div>
                <p
                  class="text-xs text-(--faint-color)"
                  style="color: {rankAccent[i]};"
                >
                  {suggestion.bestTeam.avg_usage_total?.toFixed(1)}% avg usage
                </p>
              </div>
            {:else}
              <!-- No current alternative — just show the unlocked team -->
              <div class="flex flex-col gap-1.5">
                <p class="text-xs" style="color: {rankAccent[i]};">
                  with {suggestion.character}
                </p>
                <div class="grid grid-cols-4 gap-[2px]">
                  {#each suggestion.bestTeam.members ?? [] as member}
                    {#if member === suggestion.character}
                      <div
                        class="aspect-[3/4] rounded-[5px] flex items-center justify-center"
                        style="border: 1px dashed {rankAccent[i]};
                               background: color-mix(in srgb, {rankAccent[
                          i
                        ]} 6%, transparent);"
                      >
                        <div
                          class="w-3 h-3 rounded-full"
                          style="border: 1px solid color-mix(in srgb, {rankAccent[
                            i
                          ]} 40%, transparent);
                                 background: color-mix(in srgb, {rankAccent[
                            i
                          ]} 12%, transparent);"
                        ></div>
                      </div>
                    {:else}
                      <div
                        class="aspect-[3/4] rounded-[5px] overflow-hidden relative"
                        style="background: var(--background-color);"
                      >
                        <CharacterIcon
                          name={member}
                          icon={mapping.get(member) ?? avatarImg}
                          rarity={null}
                        />
                      </div>
                    {/if}
                  {/each}
                </div>
                <p
                  class="text-xs text-(--faint-color)"
                  style="color: {rankAccent[i]};"
                >
                  {suggestion.bestTeam.avg_usage_total?.toFixed(1)}% avg usage ·
                  no current alternative
                </p>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <button
      onclick={calculate}
      class="text-xs text-(--faint-color) hover:text-(--intermediate-color) transition-colors self-center"
    >
      Recalculate
    </button>
  {/if}
</main>
