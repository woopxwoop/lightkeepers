<script lang="ts">
  import { onMount } from "svelte";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import { buildGoodKeyMap, toGoodKey, weaponByKey, artifactSetByKey } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { InvestmentFile, InvestmentTeam } from "$lib/types/investment";

  const API_URL = "/api/investment";

  let data: InvestmentFile | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let expandedTeam: string | null = $state(null);

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

  let showSuggestions = $derived(
    focused && suggestions.length > 0,
  );

  // Which GOOD keys the user owns
  let ownedKeys = $derived(
    new Set(
      $charactersOwned
        .filter((c) => c.isOwned)
        .map((c) => toGoodKey(c.name)),
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

  function ownsTeam(team: InvestmentTeam): boolean {
    return team.characters.every((k) => ownedKeys.has(k));
  }

  function missingCount(team: InvestmentTeam): number {
    return team.characters.filter((k) => !ownedKeys.has(k)).length;
  }

  function toggleExpand(key: string) {
    expandedTeam = expandedTeam === key ? null : key;
  }
</script>

<main class="w-[80%] pb-20 flex flex-col gap-6"
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
            <span class="tag-chip-text">{tag}</span>
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
          {filteredTeams.length} of {data.teams.length}
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
              <span>{key}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Team cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each filteredTeams as team}
        {@const owned = ownsTeam(team)}
        {@const missing = missingCount(team)}
        {@const expanded = expandedTeam === team.team_key}
        <button
          onclick={() => toggleExpand(team.team_key)}
          class="team-card rounded-xl overflow-hidden flex flex-col text-left transition-all"
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
            <!-- Character icons -->
            <div class="flex gap-0.5">
              {#each team.characters as goodKey}
                {@const char = goodKeyMap.get(goodKey)}
                {@const isOwned = ownedKeys.has(goodKey)}
                <div
                  class="team-slot rounded-[5px] overflow-hidden relative"
                  class:team-slot-missing={!isOwned}
                  style="background: var(--background-color);"
                >
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
              {/each}
            </div>

            <!-- Team name + cost -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium truncate" style="color: var(--foreground-color);">
                {team.team_name}
              </span>
              <span class="text-xs whitespace-nowrap" style="color: var(--foreground-mid);">
                {team.baseline_cost} cost
              </span>
            </div>

            <!-- Ownership + investment summary -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs" style="color: {owned ? 'var(--accent-1)' : 'var(--foreground-mid)'};">
                {#if owned}
                  Owned
                {:else}
                  Missing {missing}
                {/if}
              </span>
              {#if team.results.length > 0}
                <span class="text-xs" style="color: var(--foreground-mid);">
                  {team.results[0].dps.toFixed(0)} DPS
                </span>
              {/if}
            </div>

            <!-- Expanded: investment sims -->
            {#if expanded}
              <div
                class="flex flex-col gap-2 pt-2"
                style="border-top: 0.5px solid color-mix(in srgb, var(--foreground-mid) 12%, transparent);"
              >
                {#each team.results as sim}
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-xs">
                      <span style="color: var(--foreground-color);">
                        {sim.label || `Cost ${sim.cost}`}
                      </span>
                      <span style="color: var(--foreground-mid);">
                        {sim.cost} cost · {sim.dps.toFixed(0)} DPS
                      </span>
                    </div>
                    <div class="flex flex-col gap-1">
                      {#each sim.characters as build}
                        {@const char = goodKeyMap.get(build.key)}
                        {@const weapon = weaponByKey.get(build.weapon.key)}
                        {@const set = artifactSetByKey.get(build.set.key)}
                        <div class="flex items-center gap-1.5 text-[0.7rem]" style="color: var(--foreground-mid);">
                          <span style="color: var(--foreground-color);">
                            {char?.name_id ?? build.key}
                          </span>
                          <span>C{build.cons}</span>
                          <span class="flex items-center gap-0.5">
                            {#if weapon}
                              <img
                                src="https://enka.network/ui/{weapon.icon}.png"
                                alt=""
                                class="build-icon"
                              />
                            {/if}
                            {weapon?.name ?? build.weapon.key}
                            {#if build.weapon.refinement > 1}R{build.weapon.refinement}{/if}
                          </span>
                          <span class="flex items-center gap-0.5">
                            {#if set}
                              <img
                                src="https://enka.network/ui/{set.icon}.png"
                                alt=""
                                class="build-icon"
                              />
                            {/if}
                            {set?.name ?? build.set.key}
                            {build.set.count}pc
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    {#if filteredTeams.length === 0}
      <div
        class="rounded-2xl p-8 text-center"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        <p style="color: var(--foreground-mid);">
          No teams found{tags.length > 0 ? " with those characters" : ""}.
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

  .team-card {
    transition: border-color 0.2s, transform 0.2s;
    cursor: pointer;
  }

  .team-card:hover {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 40%,
      transparent
    ) !important;
  }

  .team-slot {
    width: 100%;
    aspect-ratio: 1;
    min-width: 32px;
  }

  .team-slot-missing {
    opacity: 0.35;
  }

  .build-icon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    object-fit: contain;
    background: var(--background-color);
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
