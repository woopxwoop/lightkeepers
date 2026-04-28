<script lang="ts">
  import {
    teamsOwnedStygian,
    allTeamsStygian,
    charactersOwned,
  } from "$lib/stores";
  import { stygianSlotLabel } from "$lib/slotLabels";
  import { solveStygianWithFallback, solveStygian } from "$lib/solver";
  import Team from "$lib/ui/components/Team.svelte";
  import { onMount } from "svelte";
  import type { StygianTeam } from "$lib/definitions";

  const SLOTS = ["top", "middle", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  const modes = ["roster", "meta"] as const;

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let enemies = $derived(
    data.stygianEnemies as {
      top: {
        id: number;
        lunaris_asset: string | null;
        name: string | null;
      } | null;
      middle: {
        id: number;
        lunaris_asset: string | null;
        name: string | null;
      } | null;
      bottom: {
        id: number;
        lunaris_asset: string | null;
        name: string | null;
      } | null;
    },
  );

  let teamsMode = $state<"roster" | "meta">("roster");
  let selectedIndex = $state(0);
  let activeSlotIndex = $state(0);
  let activeSlot = $derived(SLOTS[activeSlotIndex]);
  let isDesktop = $state(false);

  const SOLUTIONS_COUNT = 6;

  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name)),
  );

  let solutions = $derived.by(() => {
    if (teamsMode === "roster") {
      return solveStygianWithFallback(
        $teamsOwnedStygian,
        $allTeamsStygian,
        ownedNames,
        SOLUTIONS_COUNT,
      );
    }
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

  // Only show options that can fill every slot. If none can (very sparse roster),
  // fall back to the top 3 so there's always something to display.
  let displaySolutions = $derived.by(() => {
    const complete = solutions.filter((s) => s.unfilled.length === 0);
    return complete.length > 0 ? complete : solutions.slice(0, 3);
  });

  // Keep index in bounds if displaySolutions shrinks after a mode switch.
  let safeIndex = $derived(
    Math.min(selectedIndex, Math.max(0, displaySolutions.length - 1)),
  );

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(
    $teamsOwnedStygian.length === 0 && $allTeamsStygian.length === 0,
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

  function stygianAssetToURL(asset: string) {
    return `https://api.lunaris.moe/data/assets/leyline/${asset}.png`;
  }

  function slotRate(team: StygianTeam, slot: Slot): number {
    if (slot === "top") return team.usage_rate_top ?? 0;
    if (slot === "middle") return team.usage_rate_middle ?? 0;
    return team.usage_rate_bottom ?? 0;
  }

  function assignmentKey(slot: Slot): string {
    const teamKey = solution?.assignments.find(
      (assignment) => assignment.slot === slot,
    )?.team.team_key;
    return `${slot}:${String(teamKey ?? "empty")}`;
  }

  const slotAccent: Record<Slot, string> = {
    top: "var(--accent-1)",
    middle: "var(--accent-1)",
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
  {@const enemy = enemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}
  {@const accent = slotAccent[slot]}

  <div
    class="rounded-2xl overflow-hidden flex flex-col"
    style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
  >
    <!-- Enemy image -->
    <div
      class="relative w-full overflow-hidden"
      style="aspect-ratio: 3/2; background: color-mix(in srgb, {accent} 4%, var(--background-color));"
    >
      {#if enemy?.lunaris_asset}
        <img
          src={stygianAssetToURL(enemy.lunaris_asset)}
          alt={stygianSlotLabel[slot]}
          class="w-full h-full object-contain"
          style="transform: scale(1.5) translateY(8%);"
        />
        <div
          class="absolute inset-0"
          style="background: linear-gradient(to bottom, transparent 45%, var(--background-mid) 100%);"
        ></div>
      {:else}
        <div class="w-full h-full flex items-center justify-center">
          <span class="text-xs" style="color: var(--foreground-mid);"
            >No enemy image</span
          >
        </div>
      {/if}
    </div>

    <!-- Team content -->
    <div class="p-4 flex flex-col gap-3">
      <p
        class="text-xs uppercase tracking-widest"
        style="color: var(--foreground-mid);"
      >
        {enemy?.name ?? stygianSlotLabel[slot]}
      </p>

      {#if assignment}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="flex items-center justify-between">
          <span class="text-xs" style="color: var(--foreground-mid);">
            {(
              assignment.team.avg_usage_total ??
              assignment.team.usage_total ??
              0
            ).toFixed(1)}% avg usage
          </span>
          <span class="text-xs" style="color: {accent};">
            {slotRate(assignment.team, slot).toFixed(0)}% in this field
          </span>
        </div>
      {:else if solution}
        <div class="flex items-center justify-center py-8">
          <p class="text-xs" style="color: var(--foreground-mid);">
            No team available for this field
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
      Stygian Onslaught
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
          class="px-3 py-1.5 text-xs capitalize transition-colors"
          style={teamsMode === mode
            ? "background: color-mix(in srgb, var(--accent-1) 12%, var(--background-mid)); color: var(--accent-1);"
            : "background: var(--background-mid); color: var(--foreground-mid);"}
        >
          {mode}
        </button>
      {/each}
    </div>
  </div>

  <!-- ── Mobile field tabs ──────────────────────────────────────────────── -->
  <div
    role="tablist"
    aria-label="Stygian field"
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
      {@const accent = slotAccent[slot]}
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
        class="relative z-1 flex-1 py-2.5 text-xs font-medium transition-colors pointer-events-auto touch-manipulation"
        style="color: {activeSlot === slot ? accent : 'var(--foreground-mid)'};"
      >
        {stygianSlotLabel[slot]}
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
            class="rounded-full block transition-all duration-150"
            style={safeIndex === i
              ? "width: 7px; height: 7px; background: var(--accent-1);"
              : "width: 5px; height: 5px; background: var(--foreground-mid); opacity: 0.6;"}
          ></span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- ── Boss panels ────────────────────────────────────────────────────── -->
  {#if loading}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p style="color: var(--foreground-mid);">Loading…</p>
    </div>
  {:else}
    <div class="grid lg:grid-cols-3 gap-4 items-start">
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
