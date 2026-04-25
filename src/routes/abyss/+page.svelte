<script lang="ts">
  import { teamsOwned, allTeamsAbyss, charactersOwned } from "$lib/stores";
  import { abyssSlotLabel } from "$lib/slotLabels";
  import { solveAbyssWithFallback, solveAbyss } from "$lib/solver";
  import Team from "$lib/ui/components/Team.svelte";
  import { onMount } from "svelte";
  import type { AbyssTeam } from "$lib/definitions";

  const SLOTS = ["top", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  const modes = ["roster", "meta"] as const;

  let { data } = $props();
  let mapping = $derived(data.mapping);

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
    if (slot === "top") return team.usage_rate_top ?? 0;
    return team.usage_rate_bottom ?? 0;
  }

  function assignmentKey(slot: Slot): string {
    const teamKey = solution?.assignments.find(
      (assignment) => assignment.slot === slot,
    )?.team.team_key;
    return `${slot}:${String(teamKey ?? "empty")}`;
  }

  const slotAccent: Record<Slot, string> = {
    top: "var(--slot-1-color)",
    bottom: "var(--slot-2-color)",
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
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}
  {@const accent = slotAccent[slot]}

  <div
    class="rounded-2xl overflow-hidden flex flex-col"
    style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
  >
    <!-- Team content -->
    <div class="p-4 flex flex-col gap-3">
      <!-- Slot badge -->
      <span
        class="text-xs font-medium px-2.5 py-1 rounded uppercase tracking-wider self-start"
        style="background: color-mix(in srgb, {accent} 14%, var(--background-color));
               color: {accent};
               border: 0.5px solid color-mix(in srgb, {accent} 30%, transparent);"
      >
        {abyssSlotLabel[slot]}
      </span>
      {#if assignment}
        {#if assignment.missingCharacters.length > 0}
          <div
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style="background: color-mix(in srgb, var(--secondary-color) 8%, transparent);
                   border: 0.5px solid color-mix(in srgb, var(--secondary-color) 20%, transparent);
                   color: var(--secondary-color);"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Need: {assignment.missingCharacters.join(", ")}</span>
          </div>
        {/if}

        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="flex items-center justify-between">
          <span class="text-xs text-(--faint-color)">
            {(assignment.team.usage_total ?? 0).toFixed(1)}% usage
          </span>
          <span class="text-xs" style="color: {accent};">
            {slotRate(assignment.team, slot).toFixed(0)}% on this side
          </span>
        </div>
      {:else if solution}
        <div class="flex items-center justify-center py-8">
          <p class="text-xs text-(--faint-color)">
            No team available for this side
          </p>
        </div>
      {:else}
        <div class="flex items-center justify-center py-8">
          <p class="text-xs text-(--faint-color)">
            {teamsMode === "roster"
              ? "Set up your roster in Settings"
              : "No data available"}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<main class="w-[92%] md:w-[80%] pb-20 flex flex-col gap-6">
  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <h2 class="tracking-widest uppercase text-(--intermediate-color)">
      Spiral Abyss
    </h2>

    <div
      class="flex rounded-lg overflow-hidden"
      style="border: 0.5px solid var(--surface-border);"
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
            ? "background: color-mix(in srgb, var(--secondary-color) 12%, var(--surface-color)); color: var(--secondary-color);"
            : "background: var(--surface-color); color: var(--intermediate-color);"}
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
    class="relative z-[1] lg:hidden flex rounded-xl overflow-hidden"
    style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
  >
    <span
      class="absolute inset-y-0 pointer-events-none transition-[left,background-color] duration-150"
      style="left: {activeSlotLeft}; width: calc(100% / {SLOTS.length}); background: color-mix(in srgb, {activeSlotAccent} 10%, var(--surface-color));"
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
        class="relative z-[1] flex-1 py-2.5 text-xs font-medium transition-colors pointer-events-auto touch-manipulation"
        style:--active-slot-accent={accent}
        class:text-(--intermediate-color)={activeSlot !== slot}
        class:text-(--active-slot-accent)={activeSlot === slot}
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
            class="rounded-full block transition-all duration-150"
            style={safeIndex === i
              ? "width: 7px; height: 7px; background: var(--secondary-color);"
              : "width: 5px; height: 5px; background: var(--faint-color); opacity: 0.6;"}
          ></span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- ── Side panels ────────────────────────────────────────────────────── -->
  {#if loading}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p class="text-(--intermediate-color)">Loading…</p>
    </div>
  {:else}
    <div class="grid lg:grid-cols-2 gap-4 items-start">
      {#each SLOTS as slot, slotIndex (slot)}
        {#if isDesktop || slotIndex === activeSlotIndex}
          <div data-panel-slot={slot} data-active-panel={slotIndex === activeSlotIndex}>
            {#key assignmentKey(slot)}
              {@render slotPanel(slot)}
            {/key}
          </div>
        {/if}
      {/each}
    </div>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="text-xs text-(--faint-color) text-center">
        Some teams need characters not in your roster
      </p>
    {/if}
  {/if}
</main>
