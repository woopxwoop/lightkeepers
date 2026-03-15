<script lang="ts">
  import Team from "$lib/components/Team.svelte";
  import { teamsOwned } from "$lib/stores";
  import { solveAbyss } from "$lib/solver";
  import { abyssSlotLabel } from "$lib/slotLabels";

  let { data } = $props();
  let mapping: Map<string, string> = $derived(data.mapping);

  let loading = $state(true);

  let abyssSolutions = $derived(solveAbyss($teamsOwned, 3));

  let activeSlots: string[] = $state([]);
  $effect(() => {
    if (abyssSolutions.length > 0 && activeSlots.length === 0) {
      activeSlots = abyssSolutions.map((s) => s.assignments[0]?.slot ?? "top");
    }
  });

  $effect(() => {
    loading = $teamsOwned.length === 0;
  });
</script>

<main class="w-[80%] pb-20 flex flex-col gap-6">
  {#if loading}
    <p class="text-(--intermediate-color)">Loading teams…</p>
  {:else}
    {#each abyssSolutions as solution, i}
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
              .map((s) => abyssSlotLabel[s])
              .join(", ")}
          </p>
        {/if}

        <!-- Tag/tab row — matches team grid so tags align with their teams -->
        <div class="flex gap-2 md:grid md:grid-cols-2">
          {#each solution.assignments as { team, slot }}
            <div class="flex items-center gap-2">
              <!-- Large screens: plain colored tag, no interaction -->
              <span
                class="slot-badge slot-badge-{slot === 'top'
                  ? 1
                  : 3} hidden md:inline-block"
              >
                {abyssSlotLabel[slot]}
              </span>
              <!-- Small screens: acts as tab -->
              <button
                class="slot-badge md:hidden transition-colors"
                class:slot-badge-1={slot === "top" && activeSlots[i] === slot}
                class:slot-badge-3={slot === "bottom" &&
                  activeSlots[i] === slot}
                style={activeSlots[i] !== slot
                  ? "background: color-mix(in srgb, var(--secondary-color) 5%, transparent); color: color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                  : ""}
                onclick={() => {
                  activeSlots[i] = slot;
                }}
              >
                {abyssSlotLabel[slot]}
              </button>
              <span class="text-xs text-(--faint-color) hidden md:inline">
                {team.usage_total?.toFixed(1)}% usage
              </span>
            </div>
          {/each}
        </div>

        <!-- Team row — all visible on large, only active on small -->
        <div class="grid md:grid-cols-2 gap-4">
          {#each solution.assignments as { team, slot }}
            <div class:hidden={activeSlots[i] !== slot} class="md:block">
              <Team {team} {mapping} />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</main>
