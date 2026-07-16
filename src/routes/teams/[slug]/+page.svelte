<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import {
    buildGoodKeyMap,
    toGoodKey,
    weaponByKey,
    getSimConfigUrl,
  } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type {
    InvestmentFile,
    InvestmentTeam,
    CharacterBuild,
  } from "$lib/types/investment";

  let { data: layoutData } = $props();

  const API_URL = "/api/investment";

  let investment: InvestmentFile | null = $state(null);
  let team: InvestmentTeam | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  onMount(() => fetchTeam());

  async function fetchTeam() {
    loading = true;
    error = null;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InvestmentFile = await res.json();
      investment = data;
      team = data.teams.find((t) => t.team_key === layoutData.slug) ?? null;
      if (!team) throw new Error(`Team "${layoutData.slug}" not found`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load team";
    } finally {
      loading = false;
    }
  }

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));

  let ownedKeys = $derived(
    new Set(
      $charactersOwned.filter((c) => c.isOwned).map((c) => toGoodKey(c.name)),
    ),
  );

  function isOwned(key: string): boolean {
    return ownedKeys.has(key);
  }

  // ── Element accent colours ────────────────────────────────────────────────
  const ELEMENT_COLORS: Record<string, string> = {
    Pyro: "#f07b4a",
    Hydro: "#5eb8f5",
    Anemo: "#6dd5a8",
    Electro: "#c48ad5",
    Dendro: "#b1d94c",
    Cryo: "#8fd5e5",
    Geo: "#f5c242",
  };

  function elementBg(element: string | null): string {
    if (!element || !ELEMENT_COLORS[element]) return "var(--background-color)";
    return `color-mix(in srgb, ${ELEMENT_COLORS[element]} 8%, var(--background-color))`;
  }

  // ── Accordion: group sims by cost, rank by DPS within each group ─────────
  let costGroups = $derived.by(() => {
    if (!team) return [] as { cost: number; sims: InvestmentTeam["results"] }[];
    const groups = new Map<number, InvestmentTeam["results"]>();
    for (const sim of team.results) {
      const entry = groups.get(sim.cost);
      if (entry) {
        entry.push(sim);
      } else {
        groups.set(sim.cost, [sim]);
      }
    }
    // Sort each group by DPS descending, then sort groups by cost ascending
    for (const sims of groups.values()) {
      sims.sort((a, b) => b.dps - a.dps);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([cost, sims]) => ({ cost, sims }));
  });

  let openCosts = $state<Set<number>>(new Set());

  function toggleCost(cost: number) {
    const next = new Set(openCosts);
    if (next.has(cost)) {
      next.delete(cost);
    } else {
      next.add(cost);
    }
    openCosts = next;
  }
</script>

<main
  class="w-[80%] pb-20 flex flex-col gap-6"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  {#if loading}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">Loading…</p>
    </div>
  {:else if error}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">{error}</p>
    </div>
  {:else if team}
    <!-- Team name + baseline -->
    <div class="flex flex-col gap-1">
      <h2
        class="tracking-widest uppercase"
        style="color: var(--foreground-color);"
      >
        {team.team_name}
      </h2>
    </div>
    <!-- Character portrait cards -->
    <div class="grid grid-cols-4 gap-1.5">
      {#each team.characters as goodKey}
        {@const char = goodKeyMap.get(goodKey)}
        {@const owned = isOwned(goodKey)}
        {@const elColor = ELEMENT_COLORS[char?.element ?? ""]}
        <div
          class="char-card rounded-md overflow-hidden relative"
          style="--shine: {elColor ?? 'transparent'}; background: {elementBg(
            char?.element ?? null,
          )};"
        >
          <!-- Element glow at top -->
          {#if elColor}
            <div
              class="absolute top-0 left-0 right-0 z-10 pointer-events-none"
              style="height: 2px; background: {elColor}; opacity: 0.7;"
            ></div>
          {/if}

          <!-- Portrait -->
          {#if char}
            <div class="char-portrait-img">
              <CharacterIcon character={char} />
            </div>
          {:else}
            <div
              class="char-portrait-img flex items-center justify-center text-xs"
              style="color: var(--foreground-mid);"
            >
              {goodKey.slice(0, 4)}
            </div>
          {/if}

          <!-- Gradient overlay -->
          <div
            class="char-overlay absolute bottom-0 left-0 right-0 flex flex-col justify-end px-1.5 pb-1.5 pt-5 z-10"
          >
            <span
              class="text-[0.7rem] font-medium leading-tight truncate"
              style="color: var(--foreground-color);"
            >
              {char?.name ?? goodKey}
            </span>
          </div>

          <!-- Dim unowned -->
          {#if !owned}
            <div
              class="absolute inset-0 z-[5]"
              style="background: rgba(2, 6, 11, 0.55);"
            ></div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Investment Label -->
    <div class="flex flex-col gap-1">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        best investment priority by cost
      </h2>
    </div>

    <!-- Investment sims: accordion by cost -->
    <div class="flex flex-col gap-2">
      {#each costGroups as group, gi}
        {@const peakSim = group.sims[0]}
        {@const baselineDps = costGroups[0].sims[0].dps}
        {@const prevBest = gi > 0 ? costGroups[gi - 1].sims[0] : null}
        {@const pctGain = prevBest
          ? ((peakSim.dps - prevBest.dps) / prevBest.dps) * 100
          : 0}
        {@const cumulative = (peakSim.dps / baselineDps) * 100}
        <div
          class="accordion rounded-xl overflow-hidden"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent); animation: slide-up 0.3s ease-out both; animation-delay: {gi *
            60}ms;"
        >
          <!-- Accordion header: cost + peak DPS + label -->
          <button
            type="button"
            onclick={() => toggleCost(group.cost)}
            class="accordion-header flex items-center justify-between w-full px-4 py-3 text-left"
          >
            <div class="flex items-baseline gap-2 min-w-0">
              <span
                class="text-sm font-medium"
                style="color: var(--foreground-color);"
              >
                {group.cost} cost
              </span>
              <a
                href={getSimConfigUrl(peakSim.state_key)}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs truncate hidden sm:inline hover:underline"
                style="color: var(--foreground-mid);"
              >
                — {peakSim.label}
              </a>
            </div>
            <div class="accordion-stats">
              <span style="color: var(--foreground-mid);">
                {(peakSim.dps / 1000).toFixed(0)}K
              </span>
              <span style="color: var(--foreground-mid);">
                {cumulative.toFixed(1)}%
              </span>
              <span style="color: var(--accent-1);">
                {pctGain > 0 ? `+${pctGain.toFixed(1)}%` : ""}
              </span>
              <span
                class="accordion-arrow transition-transform duration-200"
                class:rotated={openCosts.has(group.cost)}
                style="color: var(--foreground-mid);"
              >
                ▼
              </span>
            </div>
          </button>

          <!-- Accordion body -->
          {#if openCosts.has(group.cost)}
            <div
              class="flex flex-col"
              style="border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 12%, transparent);"
              transition:slide={{ duration: 200 }}
            >
              {#each group.sims as sim}
                <div
                  class="px-4 py-3"
                  class:sim-divider={sim !== group.sims[0]}
                >
                  <!-- Sim label + DPS -->
                  <div class="flex items-center justify-between mb-2">
                    <a
                      href={getSimConfigUrl(sim.state_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs hover:underline"
                      style="color: var(--foreground-mid);"
                    >
                      {sim.label || `config.txt`}
                    </a>
                    <span
                      class="text-xs font-medium"
                      style="color: var(--accent-1);"
                    >
                      {sim.dps.toFixed(0)} DPS
                    </span>
                  </div>

                  <!-- Build rows: char — C — weapon per character -->
                  <div class="flex flex-col gap-1.5">
                    {#each team.characters as goodKey}
                      {@const char = goodKeyMap.get(goodKey)}
                      {@const build = sim.characters.find(
                        (c: CharacterBuild) => c.key === goodKey,
                      )}
                      {@const weapon = build
                        ? weaponByKey.get(build.weapon.key)
                        : null}
                      <div class="flex items-center gap-2 text-xs">
                        <span
                          class="font-medium min-w-0 truncate"
                          style="width: 5rem; color: var(--foreground-color);"
                        >
                          {char?.name ?? goodKey}
                        </span>
                        {#if build}
                          <span style="color: var(--accent-1);">
                            C{build.cons}
                          </span>
                          <span
                            class="truncate"
                            style="color: var(--foreground-mid);"
                            title={weapon?.name ?? build.weapon.key}
                          >
                            {weapon?.name ?? build.weapon.key}
                            {#if build.weapon.refinement > 1}
                              R{build.weapon.refinement}{/if}
                          </span>
                        {:else}
                          <span style="color: var(--foreground-mid);">—</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  /* ── Accordion ─────────────────────────────────────────────────────────── */

  .accordion-header {
    cursor: pointer;
    border: none;
    background: none;
    font-family: inherit;
  }

  .accordion-header:hover {
    background: color-mix(in srgb, var(--accent-1) 4%, transparent);
  }

  .accordion-stats {
    display: grid;
    grid-template-columns: 2.5rem 3.5rem 3.5rem 0.75rem;
    gap: 0.5rem;
    align-items: baseline;
    justify-items: end;
  }

  .accordion-arrow {
    display: inline-block;
    font-size: 0.6rem;
  }

  .accordion-arrow.rotated {
    transform: rotate(180deg);
  }

  .sim-divider {
    border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 8%, transparent);
  }

  /* Portrait cards (shared with list page spotlight) */
  .char-card {
    aspect-ratio: 3 / 4;
    transition:
      box-shadow 0.35s ease,
      transform 0.2s ease;
  }

  .char-card::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      ellipse 100% 70% at 50% 60%,
      var(--shine) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none;
    z-index: 10;
  }

  .char-card:hover {
    box-shadow: 0 0 32px 6px color-mix(in srgb, var(--shine) 30%, transparent);
    z-index: 5;
  }

  .char-card:hover::after {
    opacity: 0.35;
  }

  .char-portrait-img {
    width: 100%;
    height: 100%;
  }

  .char-portrait-img :global(img) {
    display: block;
  }

  .char-overlay {
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.92) 0%,
      rgba(2, 6, 11, 0.6) 50%,
      transparent 100%
    );
  }
</style>
