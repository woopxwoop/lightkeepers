<script lang="ts">
  import { teamsOwned, teamsOwnedStygian } from "$lib/stores";
  import { solveAbyss, solveStygian } from "$lib/solver";
  import Team from "$lib/components/Team.svelte";
  import type {
    Solution,
    AbyssAssignment,
    StygianAssignment,
  } from "$lib/solver";
  import { abyssSlotLabel, stygianSlotLabel } from "$lib/slotLabels";

  let { data } = $props();
  let mapping: Map<string, string> = $derived(data.mapping);

  // ---- Derived solutions --------------------------------------------------

  let abyssSolutions = $derived(solveAbyss($teamsOwned, 3));
  let stygianSolutions = $derived(solveStygian($teamsOwnedStygian, 3));

  // ---- Slot badge colours -------------------------------------------------

  const slotColour: Record<string, string> = {
    top: "bg-amber-600",
    middle: "bg-sky-700",
    bottom: "bg-violet-700",
  };
</script>

<main class="w-[80%] flex flex-col gap-10 pb-20">
  <!-- ── Abyss ─────────────────────────────────────────────────────────── -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Abyss — Greedy Solutions</h2>

    {#if $teamsOwned.length === 0}
      <p class="opacity-60">Loading abyss teams…</p>
    {:else if abyssSolutions.length === 0}
      <p class="opacity-60">
        No valid non-overlapping solutions found for your roster.
      </p>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {#each abyssSolutions as solution, i}
          <div
            class="border border-(--foreground-color) rounded-2xl p-4 flex flex-col gap-3"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-lg">Option {i + 1}</span>
              <span class="text-sm opacity-60">
                score {solution.score.toFixed(1)}%
              </span>
            </div>

            {#each solution.assignments as { team, slot }}
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white {slotColour[
                      slot
                    ]}"
                  >
                    {abyssSlotLabel[slot]}
                  </span>
                  <span class="text-xs opacity-50">
                    ↑{team.usage_rate_top?.toFixed(1)}% · ↓{team.usage_rate_bottom?.toFixed(
                      1,
                    )}% · total {team.usage_total?.toFixed(1)}%
                  </span>
                </div>
                <Team {team} {mapping} />
              </div>
            {/each}

            {#if solution.unfilled.length > 0}
              <p class="text-xs text-red-400 mt-1">
                ⚠ Couldn't fill: {solution.unfilled.join(", ")}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- ── Stygian ───────────────────────────────────────────────────────── -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Stygian — Greedy Solutions</h2>

    {#if $teamsOwnedStygian.length === 0}
      <p class="opacity-60">Loading stygian teams…</p>
    {:else if stygianSolutions.length === 0}
      <p class="opacity-60">
        No valid non-overlapping solutions found for your roster.
      </p>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {#each stygianSolutions as solution, i}
          <div
            class="border border-(--foreground-color) rounded-2xl p-4 flex flex-col gap-3"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-lg">Option {i + 1}</span>
              <span class="text-sm opacity-60">
                score {solution.score.toFixed(1)}%
              </span>
            </div>

            {#each solution.assignments as { team, slot }}
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white {slotColour[
                      slot
                    ]}"
                  >
                    {stygianSlotLabel[slot]}
                  </span>
                  <span class="text-xs opacity-50">
                    ↑{team.usage_rate_top?.toFixed(1)}% · ◆{team.usage_rate_middle?.toFixed(
                      1,
                    )}% · ↓{team.usage_rate_bottom?.toFixed(1)}% · total {team.usage_total?.toFixed(
                      1,
                    )}%
                  </span>
                </div>
                <Team {team} {mapping} />
              </div>
            {/each}

            {#if solution.unfilled.length > 0}
              <p class="text-xs text-red-400 mt-1">
                ⚠ Couldn't fill: {solution.unfilled.join(", ")}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- ── Raw data (collapsible debug) ──────────────────────────────────── -->
  <section>
    <details>
      <summary class="cursor-pointer opacity-50 text-sm mb-2">
        Raw solver output (debug)
      </summary>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-bold mb-1 opacity-60">ABYSS</p>
          <pre
            class="text-xs overflow-auto max-h-96 bg-black/20 p-3 rounded-xl">{JSON.stringify(
              abyssSolutions,
              null,
              2,
            )}</pre>
        </div>
        <div>
          <p class="text-xs font-bold mb-1 opacity-60">STYGIAN</p>
          <pre
            class="text-xs overflow-auto max-h-96 bg-black/20 p-3 rounded-xl">{JSON.stringify(
              stygianSolutions,
              null,
              2,
            )}</pre>
        </div>
      </div>
    </details>
  </section>
</main>
