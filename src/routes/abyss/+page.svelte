<script lang="ts">
  import { teamsOwned, allTeamsAbyss, charactersOwned } from "$lib/stores";
  import { abyssSlotLabel } from "$lib/slotLabels";
  import { solveAbyssWithFallback, solveAbyss } from "$lib/solver";
  import Team from "$lib/ui/components/Team.svelte";
  import { onMount } from "svelte";
  import type { AbyssTeam } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";

  const SLOTS = ["top", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  const modes = ["roster", "meta"] as const;

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let abyssEnemies = $derived(
    data.abyssEnemies as {
      top: {
        chamber: number;
        monsterLevel: number;
        enemies: { id: number; name: string; asset: string | null }[];
      }[];
      bottom: {
        chamber: number;
        monsterLevel: number;
        enemies: { id: number; name: string; asset: string | null }[];
      }[];
      buffName: string | null;
      openTime: string | null;
    },
  );

  const halfLabel: Record<Slot, string> = {
    top: "First Half",
    bottom: "Second Half",
  };

  let teamsMode = $state<"roster" | "meta">("roster");
  let selectedIndex = $state(0);
  let activeSlotIndex = $state(0);
  let activeSlot = $derived(SLOTS[activeSlotIndex]);
  let isDesktop = $state(false);

  const SOLUTIONS_COUNT = 6;

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let solutions = $derived.by(() => {
    if (teamsMode === "roster") {
      return solveAbyssWithFallback(
        $teamsOwned,
        $allTeamsAbyss,
        ownedNames,
        SOLUTIONS_COUNT,
      );
    }
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

  let displaySolutions = $derived.by(() => {
    const complete = solutions.filter((s) => s.unfilled.length === 0);
    return complete.length > 0 ? complete : solutions.slice(0, 3);
  });

  let safeIndex = $derived(
    Math.min(selectedIndex, Math.max(0, displaySolutions.length - 1)),
  );

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(
    $teamsOwned.length === 0 && $allTeamsAbyss.length === 0,
  );

  function setTeamsMode(mode: "roster" | "meta") {
    teamsMode = mode;
    selectedIndex = 0;
    if (import.meta.env.DEV) {
      console.debug("[LK TEAMS MODE]", { mode, route: location.pathname });
    }
  }

  function setActiveSlot(index: number) {
    const previousIndex = activeSlotIndex;
    activeSlotIndex = index;
    if (import.meta.env.DEV) {
      queueMicrotask(() => {
        console.debug("[LK ACTIVE SLOT]", {
          requestedIndex: index,
          previousIndex,
          currentIndex: activeSlotIndex,
          activeSlot,
          route: location.pathname,
        });
      });
    }
  }

  function handlePointerAction(event: PointerEvent, action: () => void) {
    if (event.button !== 0) return;
    action();
  }

  function handleKeyboardClick(event: MouseEvent, action: () => void) {
    if (event.detail === 0) action();
  }

  function slotRate(team: AbyssTeam, slot: Slot): number {
    if (slot === "top") return team.field_1_rate ?? 0;
    return team.field_2_rate ?? 0;
  }

  function assignmentKey(slot: Slot): string {
    const teamKey = solution?.assignments.find(
      (assignment) => assignment.slot === slot,
    )?.team.team_key;
    return `${slot}:${String(teamKey ?? "empty")}`;
  }

  const slotAccent: Record<Slot, string> = {
    top: "var(--accent-1)",
    bottom: "var(--accent-1)",
  };

  let activeSlotAccent = $derived(slotAccent[activeSlot]);
  let activeSlotLeft = $derived(
    `calc((100% / ${SLOTS.length}) * ${activeSlotIndex})`,
  );

  onMount(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      isDesktop = query.matches;
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });
</script>

{#snippet slotPanel(slot: Slot)}
  {@const sideEnemies = abyssEnemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}
  {@const accent = slotAccent[slot]}

  <div
    class="rounded-2xl overflow-hidden flex flex-col"
    style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
  >
    <!-- Chamber enemies -->
    <div
      class="relative w-full overflow-hidden p-4"
      style="background: color-mix(in srgb, {accent} 4%, var(--background-color));"
    >
      {#if sideEnemies && sideEnemies.length > 0}
        <div class="flex">
          {#each sideEnemies as chamber}
            <div class="flex-1 flex flex-col items-center gap-1 px-3">
              <span
                class="text-xs font-medium pb-1 border-b"
                style="color: var(--foreground-mid); border-color: color-mix(in srgb, {accent} 22%, transparent);"
              >
                {chamber.chamber}
              </span>
              <div class="flex flex-row justify-center gap-1">
                {#each chamber.enemies.slice(0, 3) as enemy}
                  {#if enemy.asset}
                    <img
                      src={getEnemyAsset(enemy.asset)}
                      alt={enemy.name}
                      title={enemy.name}
                      class="min-w-8 grow h-18 rounded-md object-cover"
                      style="border: 1px solid color-mix(in srgb, {accent} 18%, transparent);"
                    />
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center justify-center py-3">
          <span class="text-xs" style="color: var(--foreground-mid);"
            >No enemy data</span
          >
        </div>
      {/if}
    </div>

    {#if abyssEnemies?.buffName}
      <div
        class="text-lg text-center py-2"
        style="background: color-mix(in srgb, {accent} 4%, var(--background-color)); color: var(--foreground-color);"
      >
        {abyssEnemies.buffName}: {halfLabel[slot]}
      </div>
    {/if}

    <!-- Team content -->
    <div
      class="p-4 flex flex-col gap-3"
      style="background: color-mix(in srgb, {accent} 4%, var(--background-color));"
    >
      {#if assignment}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="flex items-center justify-between">
          <span class="text-xs" style="color: var(--foreground-mid);">
            {(assignment.team.usage_rate ?? 0).toFixed(1)}% usage
          </span>
          <span class="text-xs" style="color: {accent};">
            {slotRate(assignment.team, slot).toFixed(0)}% in this half
          </span>
        </div>
      {:else if solution}
        <div class="flex items-center justify-center py-8">
          <p class="text-xs" style="color: var(--foreground-mid);">
            No team available for this side
          </p>
        </div>
      {:else}
        <div class="flex items-center justify-center py-8">
          <p class="text-xs" style="color: var(--foreground-mid);">
            {teamsMode === "roster"
              ? "Set up your roster in Settings"
              : "No data available"}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<main class="w-[80%] pb-20 flex flex-col gap-6">
  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <h2
      class="tracking-widest uppercase"
      style="color: var(--foreground-color);"
    >
      Spiral Abyss
      {#if abyssEnemies?.openTime}
        <span
          class="text-xs normal-case tracking-normal ml-2"
          style="color: var(--foreground-mid);"
        >
          updated {new Date(abyssEnemies.openTime).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      {/if}
    </h2>

    <div
      class="flex rounded-lg overflow-hidden"
      style="border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      {#each modes as mode}
        <button
          type="button"
          onpointerdown={(event) =>
            handlePointerAction(event, () => setTeamsMode(mode))}
          onclick={(event) =>
            handleKeyboardClick(event, () => setTeamsMode(mode))}
          class="mode-button px-3 py-1.5 text-xs capitalize transition-colors"
          class:mode-button-active={teamsMode === mode}
        >
          {mode}
        </button>
      {/each}
    </div>
  </div>

  <!-- ── Mobile side tabs ───────────────────────────────────────────────── -->
  <div
    role="tablist"
    aria-label="Abyss side"
    class="relative z-1 lg:hidden flex rounded-xl overflow-hidden"
    style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
  >
    <span
      class="absolute inset-y-0 pointer-events-none transition-[left,background-color] duration-150"
      style="left: {activeSlotLeft}; width: calc(100% / {SLOTS.length}); background: color-mix(in srgb, {activeSlotAccent} 10%, var(--background-mid));"
    ></span>
    <span
      class="absolute bottom-0 h-[1.5px] pointer-events-none transition-[left,background-color] duration-150"
      style="left: {activeSlotLeft}; width: calc(100% / {SLOTS.length}); background: {activeSlotAccent};"
    ></span>
    {#each SLOTS as slot, slotIndex (slot)}
      <button
        type="button"
        role="tab"
        data-slot={slot}
        data-active={activeSlot === slot}
        aria-selected={activeSlot === slot}
        onpointerdown={(event) =>
          handlePointerAction(event, () => setActiveSlot(slotIndex))}
        onclick={(event) =>
          handleKeyboardClick(event, () => setActiveSlot(slotIndex))}
        class="slot-tab relative z-1 flex-1 py-2.5 text-xs font-medium transition-colors pointer-events-auto touch-manipulation"
        class:slot-tab-active={activeSlot === slot}
      >
        {abyssSlotLabel[slot]}
      </button>
    {/each}
  </div>

  <!-- ── Solution dots ─────────────────────────────────────────────────── -->
  {#if !loading && displaySolutions.length > 1}
    <div class="flex items-center justify-center gap-0.5">
      {#each displaySolutions as _, i}
        <button
          type="button"
          onpointerdown={(event) =>
            handlePointerAction(event, () => (selectedIndex = i))}
          onclick={(event) =>
            handleKeyboardClick(event, () => (selectedIndex = i))}
          aria-label="Solution {i + 1}"
          class="w-6 h-6 flex items-center justify-center"
        >
          <span
            class="solution-dot rounded-full block transition-all duration-150"
            class:solution-dot-active={safeIndex === i}
          ></span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- ── Side panels ────────────────────────────────────────────────────── -->
  {#if loading}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p style="color: var(--foreground-mid);">Loading…</p>
    </div>
  {:else}
    <div class="grid lg:grid-cols-2 gap-4 items-start">
      {#each SLOTS as slot, slotIndex (slot)}
        {#if isDesktop || slotIndex === activeSlotIndex}
          <div
            data-panel-slot={slot}
            data-active-panel={slotIndex === activeSlotIndex}
          >
            {#key assignmentKey(slot)}
              {@render slotPanel(slot)}
            {/key}
          </div>
        {/if}
      {/each}
    </div>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="text-xs text-center" style="color: var(--foreground-mid);">
        Some teams need characters not in your roster
      </p>
    {/if}
  {/if}
</main>

<style>
  .mode-button {
    background: var(--background-mid);
    color: var(--foreground-mid);
  }

  .mode-button-active {
    background: color-mix(in srgb, var(--accent-1) 12%, var(--background-mid));
    color: var(--accent-1);
  }

  .slot-tab {
    color: var(--foreground-mid);
  }

  .slot-tab-active {
    color: var(--accent-1);
  }

  .solution-dot {
    width: 5px;
    height: 5px;
    background: var(--foreground-mid);
    opacity: 0.6;
  }

  .solution-dot-active {
    width: 7px;
    height: 7px;
    background: var(--accent-1);
    opacity: 1;
  }
</style>
