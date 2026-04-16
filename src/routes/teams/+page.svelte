<script lang="ts">
  import Team from "$lib/ui/components/Team.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import {
    teamsOwned,
    teamsOwnedStygian,
    allTeamsAbyss,
    allTeamsStygian,
    charactersOwned,
  } from "$lib/stores";
  import { abyssSlotLabel, stygianSlotLabel } from "$lib/slotLabels";
  import {
    solveAbyssWithFallback,
    solveStygianWithFallback,
    solveAbyss,
    solveStygian,
    slotAffinityRate,
  } from "$lib/solver";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  let activeMode = $state<"abyss" | "stygian">("abyss");
  let teamsMode = $state<"roster" | "meta">("roster");

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name)),
  );

  const SOLUTIONS_COUNT = 6;

  // NOTE: These solver calls can be expensive when the team lists are large.
  // Compute only what is currently visible so the UI stays responsive.
  let abyssSolutions = $derived.by(() => {
    if (activeMode !== "abyss") return [];

    if (teamsMode === "roster") {
      return solveAbyssWithFallback(
        $teamsOwned,
        $allTeamsAbyss,
        ownedNames,
        SOLUTIONS_COUNT,
      );
    }

    // Meta: best global comps annotated with your missing chars
    return solveAbyss($allTeamsAbyss, SOLUTIONS_COUNT).map((sol) => ({
      ...sol,
      isFallback: false as const,
      assignments: sol.assignments.map((a) => ({
        ...a,
        missingCharacters: (a.team.members ?? []).filter(
          (m) => !ownedNames.has(m),
        ),
      })),
      neededCharacters: [
        ...new Set(
          sol.assignments.flatMap((a) =>
            (a.team.members ?? []).filter((m) => !ownedNames.has(m)),
          ),
        ),
      ],
    }));
  });

  let stygianSolutions = $derived.by(() => {
    if (activeMode !== "stygian") return [];

    if (teamsMode === "roster") {
      return solveStygianWithFallback(
        $teamsOwnedStygian,
        $allTeamsStygian,
        ownedNames,
        SOLUTIONS_COUNT,
      );
    }

    // Meta: best global comps annotated with your missing chars
    return solveStygian($allTeamsStygian, SOLUTIONS_COUNT).map((sol) => ({
      ...sol,
      isFallback: false as const,
      assignments: sol.assignments.map((a) => ({
        ...a,
        missingCharacters: (a.team.members ?? []).filter(
          (m) => !ownedNames.has(m),
        ),
      })),
      neededCharacters: [
        ...new Set(
          sol.assignments.flatMap((a) =>
            (a.team.members ?? []).filter((m) => !ownedNames.has(m)),
          ),
        ),
      ],
    }));
  });

  let abyssActiveSlots: string[] = $state([]);
  let stygianActiveSlots: string[] = $state([]);

  $effect(() => {
    abyssActiveSlots = abyssSolutions.map(
      (s) => s.assignments[0]?.slot ?? "top",
    );
  });
  $effect(() => {
    stygianActiveSlots = stygianSolutions.map(
      (s) => s.assignments[0]?.slot ?? "top",
    );
  });

  let loading = $derived(
    activeMode === "abyss"
      ? $teamsOwned.length === 0 && $allTeamsAbyss.length === 0
      : $teamsOwnedStygian.length === 0 && $allTeamsStygian.length === 0,
  );
</script>

<main class="w-[80%] pb-20 flex flex-col gap-6">
  <!-- Tab toggles -->
  <div class="flex items-center justify-between flex-wrap gap-2">
    <div
      class="flex gap-1 p-1 rounded-xl"
      style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
    >
      <button
        class="px-4 py-1.5 rounded-lg text-xs font-medium tracking-widest uppercase transition-colors"
        style={activeMode === "abyss"
          ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color);"
          : "color: var(--faint-color);"}
        onclick={() => (activeMode = "abyss")}
      >
        Abyss
      </button>
      <button
        class="px-4 py-1.5 rounded-lg text-xs font-medium tracking-widest uppercase transition-colors"
        style={activeMode === "stygian"
          ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color);"
          : "color: var(--faint-color);"}
        onclick={() => (activeMode = "stygian")}
      >
        Stygian
      </button>
    </div>
    <div
      class="flex text-xs rounded-lg overflow-hidden"
      style="border: 0.5px solid var(--surface-border);"
    >
      <button
        class="px-3 py-1.5 transition-colors"
        style="background: {teamsMode === 'roster'
          ? 'var(--surface-color)'
          : 'transparent'};
               color: {teamsMode === 'roster'
          ? 'var(--foreground-color)'
          : 'var(--faint-color)'};"
        onclick={() => (teamsMode = "roster")}
      >
        Roster
      </button>
      <button
        class="px-3 py-1.5 transition-colors"
        style="background: {teamsMode === 'meta'
          ? 'var(--surface-color)'
          : 'transparent'};
               color: {teamsMode === 'meta'
          ? 'var(--foreground-color)'
          : 'var(--faint-color)'};"
        onclick={() => (teamsMode = "meta")}
      >
        Meta
      </button>
    </div>
  </div>

  {#if loading}
    <p class="text-(--intermediate-color)">Loading teams…</p>
  {:else if activeMode === "abyss"}
    <!-- Abyss recommendations -->
    {#if abyssSolutions[0]?.isFallback}
      {@const needed = abyssSolutions[0].neededCharacters}
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
                  class="w-6 h-6 rounded-md overflow-hidden shrink-0"
                  style="background: var(--surface-color); outline: 1px dashed color-mix(in srgb, var(--secondary-color) 55%, transparent);"
                >
                  <CharacterIcon character={mapping.get(char)} />
                </div>
                <span class="text-xs text-(--secondary-color)">{char}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

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

        <div class="flex gap-2 md:grid md:grid-cols-2">
          {#each solution.assignments as { team, slot }}
            <div class="flex items-center gap-2">
              <span
                class="slot-badge slot-badge-{slot === 'top'
                  ? 1
                  : 3} hidden md:inline-block"
              >
                {abyssSlotLabel[slot]}
              </span>
              <button
                class="slot-badge md:hidden transition-colors"
                class:slot-badge-1={slot === "top" &&
                  abyssActiveSlots[i] === slot}
                class:slot-badge-3={slot === "bottom" &&
                  abyssActiveSlots[i] === slot}
                style={abyssActiveSlots[i] !== slot
                  ? "background: color-mix(in srgb, var(--secondary-color) 5%, transparent); color: color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                  : ""}
                onclick={() => {
                  abyssActiveSlots[i] = slot;
                }}
              >
                {abyssSlotLabel[slot]}
              </button>
              <span class="text-xs text-(--faint-color) hidden md:inline">
                {(
                  (team.usage_total ?? 0) * slotAffinityRate(team, slot)
                ).toFixed(2)}% usage
              </span>
            </div>
          {/each}
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          {#each solution.assignments as { team, slot, missingCharacters }}
            <div class:hidden={abyssActiveSlots[i] !== slot} class="md:block">
              <Team {team} {mapping} {missingCharacters} />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {:else}
    <!-- Stygian recommendations -->
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
                  class="w-6 h-6 rounded-md overflow-hidden shrink-0"
                  style="background: var(--surface-color); outline: 1px dashed color-mix(in srgb, var(--secondary-color) 55%, transparent);"
                >
                  <CharacterIcon character={mapping.get(char)} />
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
                class:slot-badge-1={slot === "top" &&
                  stygianActiveSlots[i] === slot}
                class:slot-badge-2={slot === "middle" &&
                  stygianActiveSlots[i] === slot}
                class:slot-badge-3={slot === "bottom" &&
                  stygianActiveSlots[i] === slot}
                style={stygianActiveSlots[i] !== slot
                  ? "background: color-mix(in srgb, var(--secondary-color) 5%, transparent); color: color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                  : ""}
                onclick={() => {
                  stygianActiveSlots[i] = slot;
                }}
              >
                {stygianSlotLabel[slot]}
              </button>
              <span class="text-xs text-(--faint-color) hidden lg:inline">
                {(
                  (team.usage_total ?? 0) * slotAffinityRate(team, slot)
                ).toFixed(2)}% usage
              </span>
            </div>
          {/each}
        </div>

        <div class="grid lg:grid-cols-3 gap-4">
          {#each solution.assignments as { team, slot, missingCharacters }}
            <div class:hidden={stygianActiveSlots[i] !== slot} class="lg:block">
              <Team {team} {mapping} {missingCharacters} />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</main>
