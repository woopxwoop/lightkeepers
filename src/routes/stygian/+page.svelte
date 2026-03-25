<script lang="ts">
  import Team from "$lib/components/Team.svelte";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import {
    teamsOwnedStygian,
    allTeamsStygian,
    charactersOwned,
  } from "$lib/stores";
  import { stygianSlotLabel } from "$lib/slotLabels";
  import { solveStygianWithFallback } from "$lib/solver";

  let { data } = $props();
  let mapping: Map<string, string> = $derived(data.mapping);

  let loading = $state(true);

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name)),
  );

  let stygianSolutions = $derived(
    solveStygianWithFallback(
      $teamsOwnedStygian,
      $allTeamsStygian,
      ownedNames,
      3,
    ),
  );

  let activeSlots: string[] = $state([]);
  $effect(() => {
    if (stygianSolutions.length > 0 && activeSlots.length === 0) {
      activeSlots = stygianSolutions.map(
        (s) => s.assignments[0]?.slot ?? "top",
      );
    }
  });

  $effect(() => {
    loading = $teamsOwnedStygian.length === 0 && $allTeamsStygian.length === 0;
  });
</script>

<main class="w-[80%] pb-20 flex flex-col gap-6">
  {#if loading}
    <p class="text-(--intermediate-color)">Loading teams…</p>
  {:else}
    {#if stygianSolutions[0]?.isFallback}
      {@const needed = stygianSolutions[0].neededCharacters}
      <div class="flex flex-col gap-2">
        <p class="text-xs text-(--intermediate-color)">
          Your roster couldn't fill all slots — showing best teams needing the
          fewest additions{needed.length === 0 ? "." : ":"}
        </p>
        {#if needed.length > 0}
          <div class="flex flex-wrap gap-3">
            {#each needed as char}
              <div class="flex items-center gap-1.5">
                <div
                  class="w-6 h-6 rounded-md overflow-hidden flex-shrink-0"
                  style="background: var(--surface-color); outline: 1px dashed color-mix(in srgb, var(--secondary-color) 55%, transparent);"
                >
                  <CharacterIcon
                    name={char}
                    icon={mapping.get(char) ?? avatarImg}
                    rarity={null}
                  />
                </div>
                <span class="text-xs text-(--secondary-color)">{char}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#each stygianSolutions as solution, i}
      <div
        class="rounded-2xl p-4 flex flex-col gap-4"
        class:opacity-60={i > 0}
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
      >
        <p
          class="text-xs font-medium text-(--intermediate-color) tracking-widest uppercase"
        >
          {i === 0 ? "Best Match" : `Option ${i + 1}`}
        </p>

        {#if solution.unfilled.length > 0}
          <p class="text-xs text-red-400">
            ⚠ Couldn't fill: {solution.unfilled
              .map((s) => stygianSlotLabel[s])
              .join(", ")}
          </p>
        {/if}

        <div class="flex gap-2 lg:grid lg:grid-cols-3">
          {#each solution.assignments as { team, slot }}
            <div class="flex items-center gap-2">
              <span
                class="slot-badge slot-badge-{slot === 'top'
                  ? 1
                  : slot === 'middle'
                    ? 2
                    : 3} hidden lg:inline-block"
              >
                {stygianSlotLabel[slot]}
              </span>
              <button
                class="slot-badge lg:hidden transition-colors"
                class:slot-badge-1={slot === "top" && activeSlots[i] === slot}
                class:slot-badge-2={slot === "middle" &&
                  activeSlots[i] === slot}
                class:slot-badge-3={slot === "bottom" &&
                  activeSlots[i] === slot}
                style={activeSlots[i] !== slot
                  ? "background: color-mix(in srgb, var(--secondary-color) 5%, transparent); color: color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                  : ""}
                onclick={() => {
                  activeSlots[i] = slot;
                }}
              >
                {stygianSlotLabel[slot]}
              </button>
              <span class="text-xs text-(--faint-color) hidden lg:inline">
                {team.usage_total?.toFixed(2)}% usage
              </span>
            </div>
          {/each}
        </div>

        <div class="grid lg:grid-cols-3 gap-4">
          {#each solution.assignments as { team, slot, missingCharacters }}
            <div class:hidden={activeSlots[i] !== slot} class="lg:block">
              <Team {team} {mapping} {missingCharacters} />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</main>
