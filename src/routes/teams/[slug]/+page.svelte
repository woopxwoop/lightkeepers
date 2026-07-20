<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import {
    buildGoodKeyMap,
    toGoodKey,
    getSimConfigUrl,
    humanizeInvestmentLabel,
    weaponByKey,
  } from "$lib/utils";
  import { weaponIconUrl } from "$lib/asset-urls";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import type {
    InvestmentFile,
    InvestmentTeam,
    InvestmentSim,
    CharacterBuild,
  } from "$lib/types/investment";

  let { data: layoutData } = $props();

  const API_URL = "/api/investment";

  let investment: InvestmentFile | null = $state(null);
  let team: InvestmentTeam | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  onMount(() => fetchData());

  /** Fetch the investment data JSON; team selection happens reactively via `$effect`. */
  async function fetchData() {
    loading = true;
    error = null;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      investment = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load team";
    } finally {
      loading = false;
    }
  }

  // Reactively select team when data or slug changes (handles client-side nav)
  $effect(() => {
    if (investment) {
      team =
        investment.teams.find((t) => t.team_key === layoutData.slug) ?? null;
      if (!team) error = `Team "${layoutData.slug}" not found`;
    }
  });

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

  /** Build a subtle element-tinted background colour for a character's element,
   *  mixing the element colour at 8% into the page background. */
  function elementBg(element: string | null): string {
    if (!element || !ELEMENT_COLORS[element]) return "var(--background-color)";
    return `color-mix(in srgb, ${ELEMENT_COLORS[element]} 8%, var(--background-color))`;
  }

  // ── Accordion: vertical sims by cost; baseline/f2p shown separately ─────
  let baselineSim = $derived.by((): InvestmentSim | null => {
    if (!team) return null;
    return team.results.find((r) => r.kind === "baseline") ?? null;
  });

  /** Floor-cost alternatives (baseline + f2p), highest DPS first. */
  let baselineVariants = $derived.by(() => {
    if (!team) return [] as InvestmentTeam["results"];
    return team.results
      .filter((r) => r.kind === "baseline" || r.kind === "f2p")
      .slice()
      .sort((a, b) => b.dps - a.dps);
  });

  let costGroups = $derived.by(() => {
    if (!team) return [] as { cost: number; sims: InvestmentTeam["results"] }[];
    const groups = new Map<number, InvestmentTeam["results"]>();
    // Investment priority path: paid vertical upgrades only
    for (const sim of team.results) {
      if (sim.kind !== "vertical") continue;
      const entry = groups.get(sim.cost);
      if (entry) {
        entry.push(sim);
      } else {
        groups.set(sim.cost, [sim]);
      }
    }
    for (const sims of groups.values()) {
      sims.sort((a, b) => b.dps - a.dps);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([cost, sims]) => ({ cost, sims }));
  });

  let openCosts = $state<Set<number>>(new Set());

  /** Toggle a cost group in the accordion — open if closed, close if open. */
  function toggleCost(cost: number) {
    const next = new Set(openCosts);
    if (next.has(cost)) {
      next.delete(cost);
    } else {
      next.add(cost);
    }
    openCosts = next;
  }

  /**
   * Short human label for a sim relative to baseline.
   * Labels from merge are already diffs for f2p/vertical; baseline is named.
   */
  function simDiffLabel(sim: InvestmentTeam["results"][number]): string {
    if (sim.kind === "baseline") return "Baseline";
    return humanizeInvestmentLabel(sim.label?.trim() || "variant");
  }

  function pctVsBaseline(dps: number): string {
    if (!baselineSim || baselineSim.dps <= 0) return "";
    const pct = ((dps - baselineSim.dps) / baselineSim.dps) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
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
    <!-- Character portrait cards (canonical baseline builds) -->
    <div class="grid grid-cols-4 gap-1.5">
      {#each team.characters as goodKey}
        {@const char = goodKeyMap.get(goodKey)}
        {@const owned = isOwned(goodKey)}
        {@const elColor = ELEMENT_COLORS[char?.element ?? ""]}
        {@const baselineBuild = baselineSim?.characters.find(
          (c: CharacterBuild) => c.key === goodKey,
        )}
        <div
          class="char-card rounded-md overflow-hidden relative"
          style="--shine: {elColor ?? 'transparent'}; background: {elementBg(
            char?.element ?? null,
          )};"
          title={char?.name ?? goodKey}
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

          {#if baselineBuild}
            <div
              class="char-badge absolute bottom-0 left-0 right-0 flex justify-end px-1.5 pb-1.5 pt-4 z-10"
            >
              <span
                class="text-[0.65rem] font-semibold leading-tight tracking-wider"
                style="color: var(--accent-1);"
              >
                C{baselineBuild.cons}
              </span>
            </div>
          {/if}

          <!-- Dim unowned -->
          {#if !owned}
            <div
              class="absolute inset-0 z-5"
              style="background: rgba(2, 6, 11, 0.55);"
            ></div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Baseline weapon cards (gacha splash) -->
    <div class="grid grid-cols-4 gap-1.5">
      {#each team.characters as goodKey}
        {@const baselineBuild = baselineSim?.characters.find(
          (c: CharacterBuild) => c.key === goodKey,
        )}
        {@const weapon = baselineBuild
          ? weaponByKey.get(baselineBuild.weapon.key)
          : null}
        {@const icon = weapon ? weaponIconUrl(weapon.awakenIcon) : null}
        {@const refine = baselineBuild?.weapon.refinement ?? null}
        <div
          class="weapon-card rounded-md relative group"
          style="background: var(--background-color);"
        >
          <div class="weapon-icon-wrap rounded-md overflow-hidden">
            {#if icon}
              <img
                src={icon}
                alt={weapon?.name ?? "Weapon"}
                class="weapon-icon"
                loading="lazy"
              />
            {:else}
              <div
                class="weapon-icon flex items-center justify-center text-[0.65rem] px-1 text-center"
                style="color: var(--foreground-mid);"
              >
                —
              </div>
            {/if}
            {#if refine !== null}
              <div
                class="weapon-badge absolute bottom-0 left-0 right-0 flex justify-end px-1.5 pb-1.5 pt-4 z-10"
              >
                <span
                  class="text-[0.65rem] font-semibold leading-tight tracking-wider"
                  style="color: var(--accent-1);"
                >
                  R{refine}
                </span>
              </div>
            {/if}
          </div>
          <WeaponTooltip weapon={weapon} refinement={refine} />
        </div>
      {/each}
    </div>

    {#if baselineSim}
      <p class="text-xs" style="color: var(--foreground-mid);">
        Baseline · {team.baseline_cost} cost · {(
          baselineSim.dps / 1000
        ).toFixed(0)}K DPS
      </p>
    {/if}

    <!-- Baseline / F2P variants — compact diff rows, DPS ranked -->
    {#if baselineVariants.length > 0}
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest" style="color: var(--foreground-color);">
          Baseline variants
        </h2>
      </div>

      <div
        class="rounded-xl overflow-hidden flex flex-col"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        {#each baselineVariants as sim, vi}
          <a
            href={getSimConfigUrl(sim.state_key)}
            target="_blank"
            rel="noopener noreferrer"
            class="diff-row flex items-center gap-2 px-3 py-2 text-xs no-underline"
            class:sim-divider={vi > 0}
            style="color: inherit;"
          >
            <span
              class="min-w-0 flex-1 truncate"
              style="color: var(--foreground-color);"
              title={simDiffLabel(sim)}
            >
              {simDiffLabel(sim)}
            </span>
            <span class="shrink-0 tabular-nums" style="color: var(--accent-1);">
              {(sim.dps / 1000).toFixed(1)}K
            </span>
            {#if baselineSim && sim.kind !== "baseline"}
              <span
                class="shrink-0 tabular-nums w-12 text-right"
                style="color: var(--foreground-mid);"
              >
                {pctVsBaseline(sim.dps)}
              </span>
            {:else}
              <span class="shrink-0 w-12"></span>
            {/if}
          </a>
        {/each}
      </div>
    {/if}

    <!-- Investment Label -->
    <div class="flex flex-col gap-1">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        Best investment priority by cost
      </h2>
    </div>

    <!-- Investment sims: accordion by cost (vertical upgrades) -->
    <div class="flex flex-col gap-2">
      {#each costGroups as group, gi}
        {@const peakSim = group.sims[0]}
        {@const baselineDps = baselineSim?.dps ?? peakSim.dps}
        {@const prevBest = gi > 0 ? costGroups[gi - 1].sims[0] : null}
        {@const pctGain = prevBest
          ? ((peakSim.dps - prevBest.dps) / prevBest.dps) * 100
          : baselineSim
            ? ((peakSim.dps - baselineSim.dps) / baselineSim.dps) * 100
            : 0}
        {@const cumulative = (peakSim.dps / baselineDps) * 100}
        <div
          class="accordion rounded-xl overflow-hidden"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);{$animationsEnabled
            ? ` animation: slide-up 0.3s ease-out both; animation-delay: ${gi * 60}ms;`
            : ''}"
        >
          <!-- Accordion header: cost + peak DPS + label -->
          <button
            type="button"
            onclick={() => toggleCost(group.cost)}
            aria-expanded={openCosts.has(group.cost)}
            aria-controls="cost-panel-{group.cost}"
            class="accordion-header flex items-center justify-between w-full px-4 py-3 text-left"
          >
            <div class="flex items-baseline gap-2 min-w-0">
              <span
                class="text-sm font-medium"
                style="color: var(--foreground-color);"
              >
                {group.cost} cost
              </span>
              <span
                class="text-xs truncate hidden sm:inline"
                style="color: var(--foreground-mid);"
              >
                — {humanizeInvestmentLabel(peakSim.label)}
              </span>
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

          <!-- Accordion body: compact diffs only -->
          {#if openCosts.has(group.cost)}
            <div
              id="cost-panel-{group.cost}"
              class="flex flex-col"
              style="border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 12%, transparent);"
              transition:slide={{ duration: 200 }}
            >
              {#each group.sims as sim, si}
                <a
                  href={getSimConfigUrl(sim.state_key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="diff-row flex items-center gap-2 px-3 py-2 text-xs no-underline"
                  class:sim-divider={si > 0}
                  style="color: inherit;"
                >
                  <span
                    class="min-w-0 flex-1 truncate"
                    style="color: var(--foreground-color);"
                    title={simDiffLabel(sim)}
                  >
                    {simDiffLabel(sim)}
                  </span>
                  <span
                    class="shrink-0 tabular-nums"
                    style="color: var(--accent-1);"
                  >
                    {(sim.dps / 1000).toFixed(1)}K
                  </span>
                  <span
                    class="shrink-0 tabular-nums w-12 text-right"
                    style="color: var(--foreground-mid);"
                  >
                    {pctVsBaseline(sim.dps)}
                  </span>
                </a>
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

  .diff-row:hover {
    background: color-mix(in srgb, var(--accent-1) 6%, transparent);
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

  .char-badge,
  .weapon-badge {
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.75) 0%,
      transparent 100%
    );
  }

  .weapon-card {
    aspect-ratio: 1;
  }

  .weapon-card:hover {
    z-index: 20;
  }

  .weapon-icon-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .weapon-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
    padding: 0.35rem;
  }
</style>
