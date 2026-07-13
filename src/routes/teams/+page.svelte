<script lang="ts">
  import { onMount } from "svelte";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import { buildGoodKeyMap, toGoodKey, weaponByKey } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { InvestmentFile, InvestmentTeam } from "$lib/types/investment";

  const API_URL = "/api/investment";

  let data: InvestmentFile | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  // ── Sort & filter state ──────────────────────────────────────────────────
  let sortOwnedFirst = $state(true);
  let sortBy = $state<"dps-desc" | "dps-asc" | "cost-desc" | "cost-asc">("dps-desc");
  /** Selected cost level — show DPS of the best sim at (or nearest to) this cost. */
  let selectedCost = $state<number | null>(null);

  // ── Tag search state ─────────────────────────────────────────────────────
  let inputText = $state("");
  let tags: string[] = $state([]);
  let suggestionIndex = $state(0);
  let focused = $state(false);
  let inputEl: HTMLInputElement | null = $state(null);

  onMount(() => fetchData());

  async function fetchData() {
    loading = true;
    error = null;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load investment data";
    } finally {
      loading = false;
    }
  }

  // GOOD key → Character for icon display
  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));

  // All unique character keys present in the investment data
  let allCharacterKeys = $derived.by(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    for (const t of data.teams) {
      for (const k of t.characters) set.add(k);
    }
    return [...set].sort();
  });

  // Suggestions filtered by input text, excluding already-tagged keys
  let suggestions = $derived.by(() => {
    const q = inputText.trim().toLowerCase();
    if (!q) return [] as string[];
    return allCharacterKeys.filter(
      (k) => !tags.includes(k) && k.toLowerCase().includes(q),
    );
  });

  // Reset suggestion index when suggestions change
  $effect(() => {
    suggestions;
    suggestionIndex = 0;
  });

  function addTag(key: string) {
    if (!tags.includes(key)) {
      tags = [...tags, key];
    }
    inputText = "";
    suggestionIndex = 0;
    inputEl?.focus();
  }

  function removeTag(key: string) {
    tags = tags.filter((t) => t !== key);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && suggestionIndex < suggestions.length) {
        addTag(suggestions[suggestionIndex]);
      }
    } else if (e.key === "Backspace" && inputText === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestionIndex = Math.min(suggestionIndex + 1, suggestions.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestionIndex = Math.max(suggestionIndex - 1, 0);
    } else if (e.key === "Escape") {
      inputText = "";
      suggestionIndex = 0;
      inputEl?.blur();
    }
  }

  let showSuggestions = $derived(focused && suggestions.length > 0);

  // Which GOOD keys the user owns
  let ownedKeys = $derived(
    new Set(
      $charactersOwned.filter((c) => c.isOwned).map((c) => toGoodKey(c.name)),
    ),
  );

  // Filtering: intersection of all tagged characters
  let filteredTeams = $derived.by(() => {
    if (!data) return [];
    if (tags.length === 0) return data.teams;
    return data.teams.filter((t) =>
      tags.every((tag) => t.characters.includes(tag)),
    );
  });

  // All unique cost values across every team's sims (for the select dropdown)
  let availableCosts = $derived.by(() => {
    if (!data) return [] as number[];
    const set = new Set<number>();
    for (const t of data.teams) {
      for (const r of t.results) set.add(r.cost);
    }
    return [...set].sort((a, b) => a - b);
  });

  /**
   * Find the best sim for a team at (or nearest to) the given cost.
   * Returns the DPS of the sim whose cost is closest to the target,
   * preferring the lower cost on ties.
   */
  function getDpsAtCost(team: InvestmentTeam, cost: number): number {
    if (team.results.length === 0) return 0;
    let best = team.results[0];
    let bestDist = Math.abs(best.cost - cost);
    for (let i = 1; i < team.results.length; i++) {
      const dist = Math.abs(team.results[i].cost - cost);
      if (dist < bestDist || (dist === bestDist && team.results[i].cost < best.cost)) {
        best = team.results[i];
        bestDist = dist;
      }
    }
    return best.dps;
  }

  /** DPS shown on cards — respects the selected cost filter if active. */
  function displayDps(team: InvestmentTeam): number {
    if (selectedCost !== null) return getDpsAtCost(team, selectedCost);
    return team.results.length > 0 ? team.results[0].dps : 0;
  }

  /** Get the sim at exactly the given cost, if it exists. */
  function getSimAtCost(team: InvestmentTeam, cost: number) {
    return team.results.find((r) => r.cost === cost) ?? null;
  }

  /** Format a cons + refinement label, e.g. "C2R1" or "C0". */
  function formatCR(cons: number, refinement: number, weaponKey: string): string {
    const weapon = weaponByKey.get(weaponKey);
    const is4Star = weapon ? weapon.stars <= 4 : false;
    const parts: string[] = [];
    parts.push(`C${cons}`);
    if (is4Star) {
      parts.push("R0");
    } else {
      parts.push(`R${refinement}`);
    }
    return parts.join("");
  }

  // Sort comparator based on selected sort option
  function getSortComparator(
    mode: typeof sortBy,
  ): (a: InvestmentTeam, b: InvestmentTeam) => number {
    switch (mode) {
      case "dps-desc":
        return (a, b) => displayDps(b) - displayDps(a);
      case "dps-asc":
        return (a, b) => displayDps(a) - displayDps(b);
      case "cost-desc":
        return (a, b) => b.baseline_cost - a.baseline_cost;
      case "cost-asc":
        return (a, b) => a.baseline_cost - b.baseline_cost;
    }
  }

  // Final display list: tag-filtered → cost-filtered (by baseline_cost ≤ selectedCost) → sorted
  let displayTeams = $derived.by(() => {
    if (!data) return [];
    let teams = filteredTeams;

    // When a cost is selected, only show teams that have a sim at exactly that cost
    if (selectedCost !== null) {
      teams = teams.filter((t) => t.results.some((r) => r.cost === selectedCost));
    }

    const sorted = [...teams];
    const comparator = getSortComparator(sortBy);

    if (sortOwnedFirst) {
      const owned = sorted.filter((t) => ownsTeam(t));
      const notOwned = sorted.filter((t) => !ownsTeam(t));
      owned.sort(comparator);
      notOwned.sort(comparator);
      return [...owned, ...notOwned];
    }

    sorted.sort(comparator);
    return sorted;
  });

  function ownsTeam(team: InvestmentTeam): boolean {
    return team.characters.every((k) => ownedKeys.has(k));
  }
</script>

<main
  class="w-[80%] pb-20 flex flex-col gap-6"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  <div class="flex flex-col gap-1">
    <h2
      class="tracking-widest uppercase"
      style="color: var(--foreground-color);"
    >
      Teams
    </h2>
    <p style="color: var(--foreground-mid);">
      Look up team investment levels — constellations, weapons, and artifacts
      from gcsim simulations.
    </p>
  </div>

  {#if loading}
    <div
      class="rounded-2xl p-8 text-center flex items-center justify-center gap-2"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <span
        class="w-2 h-2 rounded-full"
        style="background: var(--accent-1); animation: loading-pulse 1s ease-in-out infinite;"
      ></span>
      <p style="color: var(--foreground-mid); font-size: 0.85rem;">
        Loading investment data…
      </p>
    </div>
  {:else if error}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">
        Could not load investment data: {error}
      </p>
      <button
        onclick={fetchData}
        class="mt-4 px-5 py-2 rounded-xl font-medium transition-all duration-150 text-sm"
        style="background: var(--accent-1); color: var(--background-color); border: none;"
      >
        Retry
      </button>
    </div>
  {:else if data}
    <!-- Tag search bar -->
    <div class="tag-search-wrapper relative">
      <div
        class="tag-search flex items-center gap-1.5 px-3 py-2 rounded-xl flex-wrap"
        class:tag-search-focus={focused}
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        {#each tags as tag}
          <span class="tag-chip">
            <span class="tag-chip-text">{goodKeyMap.get(tag)?.name ?? tag}</span>
            <button
              class="tag-chip-x"
              onclick={() => removeTag(tag)}
              aria-label="Remove {tag}"
            >
              ×
            </button>
          </span>
        {/each}
        <input
          type="text"
          bind:value={inputText}
          bind:this={inputEl}
          onkeydown={onKeydown}
          onfocus={() => (focused = true)}
          onblur={() => setTimeout(() => (focused = false), 150)}
          placeholder={tags.length === 0 ? "Filter by character…" : ""}
          class="tag-search-input"
        />
        <span class="text-xs ml-auto" style="color: var(--foreground-mid);">
          {displayTeams.length} of {data.teams.length}
        </span>
      </div>

      <!-- Suggestions dropdown -->
      {#if showSuggestions}
        <div
          class="suggestions-dropdown absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
        >
          {#each suggestions as key, i}
            {@const char = goodKeyMap.get(key)}
            <button
              class="suggestion-item flex items-center gap-2 w-full text-left px-3 py-2 text-sm"
              class:suggestion-active={i === suggestionIndex}
              style="color: var(--foreground-color);"
              onmousedown={(e) => {
                e.preventDefault();
                addTag(key);
              }}
            >
              <span
                class="w-5 h-5 rounded-[3px] overflow-hidden shrink-0"
                style="background: var(--background-color);"
              >
                {#if char}
                  <CharacterIcon character={char} />
                {/if}
              </span>
              <span>{char?.name ?? key}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sort & filter toolbar -->
    <div
      class="filter-toolbar flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <!-- Owned first toggle -->
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          bind:checked={sortOwnedFirst}
          class="toggle-input"
        />
        <span class="text-sm" style="color: var(--foreground-color);">
          Owned first
        </span>
      </label>

      <!-- Separator -->
      <span
        class="w-px h-5"
        style="background: color-mix(in srgb, var(--accent-1) 18%, transparent);"
      ></span>

      <!-- Sort select -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs" style="color: var(--foreground-mid);">Sort</span>
        <select
          bind:value={sortBy}
          class="sort-select text-sm"
          style="background: var(--background-color); color: var(--foreground-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
        >
          <option value="dps-desc">DPS ↓</option>
          <option value="dps-asc">DPS ↑</option>
          <option value="cost-desc">Cost ↓</option>
          <option value="cost-asc">Cost ↑</option>
        </select>
      </div>

      <!-- Separator -->
      <span
        class="w-px h-5"
        style="background: color-mix(in srgb, var(--accent-1) 18%, transparent);"
      ></span>

      <!-- Cost filter -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs" style="color: var(--foreground-mid);">Cost</span>
        <input
          type="number"
          bind:value={selectedCost}
          placeholder="{availableCosts[0] ?? 0}–{availableCosts[availableCosts.length - 1] ?? 0}"
          class="cost-input text-sm"
          style="background: var(--background-color); color: var(--foreground-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
        />
        {#if selectedCost !== null}
          <button
            onclick={() => (selectedCost = null)}
            class="text-xs"
            style="background: none; border: none; cursor: pointer; color: var(--foreground-mid);"
            aria-label="Clear cost filter"
          >
            ×
          </button>
        {/if}
      </div>
    </div>

    <!-- Team cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each displayTeams as team}
        {@const owned = ownsTeam(team)}
        {@const costSim = selectedCost !== null ? getSimAtCost(team, selectedCost) : null}
        <div
          class="team-card rounded-xl overflow-hidden flex flex-col"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
        >
          <!-- Header accent -->
          <div
            class="h-0.5"
            style="background: {owned
              ? 'var(--accent-1)'
              : 'color-mix(in srgb, var(--foreground-mid) 30%, transparent)'};"
          ></div>

          <div class="p-3 flex flex-col gap-2">
            <!-- Team name + DPS -->
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-sm font-medium truncate"
                style="color: var(--foreground-color);"
              >
                {team.team_name}
              </span>
              <span
                class="text-xs whitespace-nowrap shrink-0"
                style="color: var(--foreground-mid);"
              >
                {(displayDps(team) / 1000).toFixed(0)}K DPS
              </span>
            </div>

            <!-- Character icons -->
            <div class="flex gap-0.5">
              {#each team.characters as goodKey}
                {@const char = goodKeyMap.get(goodKey)}
                {@const isOwned = ownedKeys.has(goodKey)}
                {@const build = costSim?.characters.find((c) => c.key === goodKey)}
                <div
                  class="team-slot rounded-[5px] overflow-hidden relative"
                  style="background: var(--background-color);"
                >
                  <div style={!isOwned ? "opacity: 0.3;" : ""}>
                    {#if char}
                      <CharacterIcon character={char} />
                    {:else}
                      <div
                        class="w-full h-full flex items-center justify-center text-[0.55rem]"
                        style="color: var(--foreground-mid);"
                      >
                        {goodKey.slice(0, 4)}
                      </div>
                    {/if}
                  </div>
                  {#if build}
                    <span
                      class="absolute bottom-0 left-0 right-0 text-center font-medium py-px"
                      style="background: color-mix(in srgb, var(--background-color) 75%, transparent);
                             color: var(--accent-1);
                             font-size: 11px;
                             font-weight: 600;
                             letter-spacing: 0.06em;"
                    >
                      {formatCR(build.cons, build.weapon.refinement, build.weapon.key)}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Cost + view details -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs" style="color: var(--foreground-mid);">
                {selectedCost !== null ? selectedCost : team.baseline_cost} cost
              </span>
              <a
                href="/teams/{team.team_key}"
                class="text-xs font-medium hover:underline shrink-0"
                style="color: var(--accent-1);"
              >
                view details
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if displayTeams.length === 0}
      <div
        class="rounded-2xl p-8 text-center"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        <p style="color: var(--foreground-mid);">
          No teams found{tags.length > 0
            ? " with those characters"
            : ""}{selectedCost !== null
            ? " at that cost"
            : ""}.
        </p>
      </div>
    {/if}
  {/if}
</main>

<style>
  .tag-search {
    transition: border-color 0.15s;
  }

  .tag-search-focus {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      transparent
    ) !important;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.15rem 0.4rem 0.15rem 0.55rem;
    border-radius: 6px;
    font-size: 0.82rem;
    background: color-mix(in srgb, var(--accent-1) 15%, transparent);
    color: var(--accent-1);
  }

  .tag-chip-x {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 0.15rem;
    font-size: 1rem;
    line-height: 1;
    color: var(--accent-1);
    opacity: 0.7;
    border-radius: 3px;
  }

  .tag-chip-x:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--accent-1) 20%, transparent);
  }

  .tag-search-input {
    flex: 1;
    min-width: 80px;
    background: none;
    border: none;
    outline: none;
    color: var(--foreground-color);
    font-size: 0.875rem;
    padding: 0.15rem 0;
  }

  .tag-search-input::placeholder {
    color: var(--foreground-mid);
  }

  .suggestions-dropdown {
    max-height: 240px;
    overflow-y: auto;
  }

  .suggestion-item {
    cursor: pointer;
    transition: background 0.1s;
  }

  .suggestion-item:hover,
  .suggestion-active {
    background: color-mix(in srgb, var(--accent-1) 8%, transparent);
  }

  .team-slot {
    width: 100%;
    min-width: 32px;
  }

  /* ── Sort & filter toolbar ────────────────────────────────────────────── */

  .filter-toolbar {
    transition: border-color 0.2s;
  }

  /* Toggle switch */
  .toggle-input {
    appearance: none;
    -webkit-appearance: none;
    width: 34px;
    height: 20px;
    background: var(--background-color);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s;
    margin: 0;
    flex-shrink: 0;
  }

  .toggle-input::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: color-mix(in srgb, var(--accent-1) 60%, white);
    border-radius: 50%;
    transition:
      transform 0.2s,
      background 0.2s;
  }

  .toggle-input:checked {
    background: var(--accent-1);
    border-color: var(--accent-1);
  }

  .toggle-input:checked::after {
    transform: translateX(14px);
    background: #fff;
  }

  /* Sort select */
  .sort-select {
    padding: 0.25rem 1.75rem 0.25rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    outline: none;
    font-size: 0.82rem;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23d79a3e'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.4rem center;
  }

  .sort-select:focus {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      transparent
    ) !important;
  }

  /* Cost filter input */
  .cost-input {
    width: 56px;
    padding: 0.25rem 0.35rem;
    border-radius: 6px;
    outline: none;
    text-align: center;
    font-size: 0.82rem;
    -moz-appearance: textfield;
  }

  .cost-input::-webkit-outer-spin-button,
  .cost-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .cost-input:focus {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      transparent
    ) !important;
  }

  .cost-input::placeholder {
    color: var(--foreground-mid);
    opacity: 0.5;
  }

  @keyframes loading-pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
</style>
