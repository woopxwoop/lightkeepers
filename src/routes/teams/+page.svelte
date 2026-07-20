<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import { buildGoodKeyMap, toGoodKey, formatInvestmentCR } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import { loadInvestment, getInvestmentCached } from "$lib/app/investment";
  import type { InvestmentFile, InvestmentTeam } from "$lib/types/investment";

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

  /** Build a subtle element-tinted background colour for a character's element. */
  function elementBg(element: string | null): string {
    if (!element || !ELEMENT_COLORS[element]) return "var(--background-color)";
    return `color-mix(in srgb, ${ELEMENT_COLORS[element]} 8%, var(--background-color))`;
  }

  let data: InvestmentFile | null = $state(getInvestmentCached());
  let loading = $derived(data === null);
  let error: string | null = $state(null);

  // ── View mode ─────────────────────────────────────────────────────────────
  type ViewMode = "spotlight" | "compact";
  let viewMode = $state<ViewMode>("spotlight");
  const SPOTLIGHT_PAGE = 10;
  let spotlightCount = $state(SPOTLIGHT_PAGE);

  // Reset pagination when filters change
  $effect(() => {
    tags;
    selectedCost;
    sortBy;
    sortOwnedFirst;
    bestPerCharacter;
    spotlightCount = SPOTLIGHT_PAGE;
  });

  /** Bump the spotlight pagination window to reveal the next page of teams. */
  function showMore() {
    spotlightCount += SPOTLIGHT_PAGE;
  }

  // ── Sort & filter state ──────────────────────────────────────────────────
  let sortOwnedFirst = $state(true);
  /**
   * Keep only teams that are someone's best — i.e. for at least one character on
   * the team, no other team (at the active cost) has higher DPS for them.
   */
  let bestPerCharacter = $state(false);
  let sortBy = $state<"dps-desc" | "dps-asc">("dps-desc");
  /** Selected cost level — show DPS of the best sim at (or nearest to) this cost. */
  let selectedCost = $state<number | null>(null);

  // ── Tag search state ─────────────────────────────────────────────────────
  let inputText = $state("");
  let tags: string[] = $state([]);
  let suggestionIndex = $state(0);
  let focused = $state(false);
  let inputEl: HTMLInputElement | null = $state(null);

  onMount(() => fetchData());

  /** Use shared session cache (prefetched from bootstrap when possible). */
  async function fetchData() {
    if (data) {
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      data = await loadInvestment();
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
      for (const k of t.characters) {
        set.add(k);
      }
    }
    return [...set];
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

  /** Add a character tag to the filter set and reset the search input. */
  function addTag(key: string) {
    if (!tags.includes(key)) {
      tags = [...tags, key];
    }
    inputText = "";
    suggestionIndex = 0;
    inputEl?.focus();
  }

  /** Remove a character tag from the active filter set. */
  function removeTag(key: string) {
    tags = tags.filter((t) => t !== key);
  }

  /** Keyboard navigation for the combobox: Enter to select, arrows to move,
   *  Backspace on empty to remove last tag, Escape to dismiss. */
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

  let showInfo = $state(false);
  let showSettings = $state(false);
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

  // All unique cost values (prefer merge-time list; fall back to scan)
  let availableCosts = $derived.by(() => {
    if (!data) return [] as number[];
    if (data.available_costs?.length) return data.available_costs;
    const set = new Set<number>();
    for (const t of data.teams) {
      for (const r of t.results) set.add(r.cost);
    }
    return [...set].sort((a, b) => a - b);
  });

  /**
   * Characters for whom this team is best at the active cost (merge-time fields).
   * Empty if the payload predates annotation.
   */
  function bestForChars(team: InvestmentTeam): string[] {
    if (selectedCost === null) return team.is_best_for ?? [];
    return team.is_best_for_at_cost?.[String(selectedCost)] ?? [];
  }

  /** Whether this team is `goodKey`'s best DPS team at the active cost. */
  function isBestTeamFor(team: InvestmentTeam, goodKey: string): boolean {
    return bestForChars(team).includes(goodKey);
  }

  // Final display list: tag → cost → best-per-character → sorted
  let displayTeams = $derived.by(() => {
    if (!data) return [];
    let teams = filteredTeams;

    // When a cost is selected, only show teams that have a sim at exactly that cost
    if (selectedCost !== null) {
      teams = teams.filter((t) =>
        t.results.some((r) => r.cost === selectedCost),
      );
    }

    if (bestPerCharacter) {
      // Keep T if it is at least one member's best team (precomputed at merge)
      teams = teams.filter((t) => bestForChars(t).length > 0);
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
      if (
        dist < bestDist ||
        (dist === bestDist && team.results[i].cost < best.cost)
      ) {
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

  /** Find the simulation result at exactly `cost`, or null if none exists. */
  function getSimAtCost(team: InvestmentTeam, cost: number) {
    return team.results.find((r) => r.cost === cost) ?? null;
  }

  /** Build a comparator for the active sort mode (DPS ascending or descending). */
  function getSortComparator(
    mode: typeof sortBy,
  ): (a: InvestmentTeam, b: InvestmentTeam) => number {
    switch (mode) {
      case "dps-desc":
        return (a, b) => displayDps(b) - displayDps(a);
      case "dps-asc":
        return (a, b) => displayDps(a) - displayDps(b);
    }
  }

  /** Whether the current user owns every character in the given team. */
  function ownsTeam(team: InvestmentTeam): boolean {
    return team.characters.every((k) => ownedKeys.has(k));
  }

  // ── Spotlight pagination ──────────────────────────────────────────────────
  let spotlightTeams = $derived(displayTeams.slice(0, spotlightCount));
  let hasMore = $derived(spotlightCount < displayTeams.length);
  let remaining = $derived(displayTeams.length - spotlightCount);

  // Animation re-trigger key — changes whenever filters, sort, cost, or view mode change
  let listKey = $derived(
    `${tags.join(",")}|${selectedCost ?? "any"}|${sortBy}|${sortOwnedFirst}|${bestPerCharacter}|${viewMode}`,
  );
</script>

<main
  class="w-[80%] pb-20 flex flex-col gap-6"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  <div class="flex items-center gap-2">
    <h2
      class="tracking-widest uppercase"
      style="color: var(--foreground-color);"
    >
      Teams
    </h2>
    <span class="info-tip relative inline-block">
      <button
        type="button"
        onclick={() => (showInfo = !showInfo)}
        class="inline-flex items-center justify-center rounded-full cursor-pointer"
        style="width: 18px; height: 18px; font-size: 11px; font-weight: 700; color: var(--background-color); background: var(--foreground-mid); border: none;"
      >
        i
      </button>
      {#if showInfo}
        <span
          class="info-tooltip absolute left-full top-0 ml-2 w-80 px-3 py-2 rounded-lg text-xs leading-relaxed z-20"
          style="background: var(--foreground-mid); color: var(--background-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
        >
          Team calculations done via
          <a
            href="https://gcsim.app/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:underline"
            style="color: var(--background-color); text-decoration: underline; text-underline-offset: 2px;"
          >
            gcsim
          </a>
          using
          <a
            href="https://compendium.keqingmains.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:underline"
            style="color: var(--background-color); text-decoration: underline; text-underline-offset: 2px;"
          >
            KQM artifact standards
          </a>. Comparisons between teams is not recommended — rotation
          difficulty and team cost vary. Comparing the same team at different
          investment levels is encouraged.
        </span>
      {/if}
    </span>
  </div>

  {#if loading}
    <div
      class="rounded-2xl p-8 text-center flex items-center justify-center gap-2"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <span
        class="w-2 h-2 rounded-full"
        style="background: var(--accent-1); animation: var(--pulse-animation, loading-pulse 1s ease-in-out infinite);"
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
        <!-- Settings gear -->
        <button
          type="button"
          onclick={() => (showSettings = !showSettings)}
          class="settings-gear shrink-0"
          class:settings-gear-active={showSettings}
          aria-label="Toggle filter settings"
          style="color: var(--foreground-mid);"
        >
          <IconCog size={16} />
        </button>

        {#each tags as tag}
          <span class="tag-chip">
            <span class="tag-chip-text">{goodKeyMap.get(tag)?.name ?? tag}</span
            >
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
          role="combobox"
          aria-label="Filter teams by character"
          aria-expanded={showSuggestions}
          aria-controls="suggestion-listbox"
          aria-activedescendant={showSuggestions &&
          suggestionIndex < suggestions.length
            ? `suggestion-${suggestions[suggestionIndex]}`
            : undefined}
        />
        <span class="text-xs ml-auto" style="color: var(--foreground-mid);">
          {displayTeams.length} of {data.teams.length}
        </span>
      </div>

      <!-- Expandable settings panel -->
      {#if showSettings}
        <div
          class="settings-panel mt-1 rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-3"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
          transition:slide={{ duration: 150 }}
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

          <!-- Best per character: union of each character's top DPS team(s) -->
          <label
            class="flex items-center gap-2 cursor-pointer select-none"
            title="Show a team if it is any character's best DPS team at the active cost"
          >
            <input
              type="checkbox"
              bind:checked={bestPerCharacter}
              class="toggle-input"
            />
            <span class="text-sm" style="color: var(--foreground-color);">
              <span aria-hidden="true" style="color: var(--accent-1);">★</span>
              Best per character
            </span>
          </label>

          <!-- Separator -->
          <span
            class="w-px h-5"
            style="background: color-mix(in srgb, var(--accent-1) 18%, transparent);"
          ></span>

          <!-- Sort select -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs" style="color: var(--foreground-mid);"
              >Sort</span
            >
            <select
              bind:value={sortBy}
              class="sort-select text-sm"
              style="background: var(--background-color); color: var(--foreground-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
            >
              <option value="dps-desc">DPS ↓</option>
              <option value="dps-asc">DPS ↑</option>
            </select>
          </div>

          <!-- Separator -->
          <span
            class="w-px h-5"
            style="background: color-mix(in srgb, var(--accent-1) 18%, transparent);"
          ></span>

          <!-- Cost filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs" style="color: var(--foreground-mid);"
              >Cost</span
            >
            <input
              type="number"
              bind:value={selectedCost}
              placeholder="{availableCosts[0] ?? 0}–{availableCosts[
                availableCosts.length - 1
              ] ?? 0}"
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

          <!-- Separator -->
          <span
            class="w-px h-5"
            style="background: color-mix(in srgb, var(--accent-1) 18%, transparent);"
          ></span>

          <!-- View mode toggle (hidden on small screens — single column anyway) -->
          <div
            class="hidden sm:flex rounded-md overflow-hidden ml-auto"
            style="border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
          >
            {#each ["spotlight", "compact"] as const as mode}
              <button
                type="button"
                onclick={() => (viewMode = mode)}
                class="mode-btn px-2.5 py-1 text-xs capitalize transition-colors"
                class:mode-btn-active={viewMode === mode}
              >
                {mode}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Suggestions dropdown -->
      {#if showSuggestions}
        <div
          id="suggestion-listbox"
          role="listbox"
          class="suggestions-dropdown absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
        >
          {#each suggestions as key, i}
            {@const char = goodKeyMap.get(key)}
            <button
              id="suggestion-{key}"
              role="option"
              aria-selected={i === suggestionIndex}
              class="suggestion-item flex items-center gap-2 w-full text-left px-3 py-2 text-sm"
              class:suggestion-active={i === suggestionIndex}
              style="color: var(--foreground-color);"
              onclick={() => addTag(key)}
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

    <!-- Team cards -->
    {#if viewMode === "spotlight"}
      {#key listKey}
        <div class="flex flex-col gap-4" class:no-anim={!$animationsEnabled}>
          {#each spotlightTeams as team, i}
            {@const owned = ownsTeam(team)}
            {@const costSim =
              selectedCost !== null ? getSimAtCost(team, selectedCost) : null}
            {@const bestSim =
              costSim ?? (team.results.length > 0 ? team.results[0] : null)}
            <div
              class="team-row card-enter rounded-xl overflow-hidden"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent); animation-delay: {i *
                50}ms;"
            >
              <!-- 4 character portrait cards -->
              <div class="grid grid-cols-4 gap-1 p-2">
                {#each team.characters as goodKey}
                  {@const char = goodKeyMap.get(goodKey)}
                  {@const isOwned = ownedKeys.has(goodKey)}
                  {@const build = bestSim?.characters.find(
                    (c) => c.key === goodKey,
                  )}
                  {@const elColor = ELEMENT_COLORS[char?.element ?? ""]}
                  {@const starred =
                    bestPerCharacter && isBestTeamFor(team, goodKey)}
                  <div
                    class="char-card rounded-md overflow-hidden relative"
                    style="--shine: {elColor ??
                      'transparent'}; background: {elementBg(
                      char?.element ?? null,
                    )};"
                  >
                    <!-- Subtle element glow at top -->
                    {#if elColor}
                      <div
                        class="absolute top-0 left-0 right-0 z-10 pointer-events-none"
                        style="height: 2px; background: {elColor}; opacity: 0.7;"
                      ></div>
                    {/if}

                    {#if starred}
                      <span
                        class="absolute top-1 right-1 z-20 text-[0.7rem] leading-none drop-shadow"
                        style="color: var(--accent-1);"
                        title="This character's best team"
                        aria-label="Best team for this character">★</span
                      >
                    {/if}

                    <!-- Portrait image -->
                    {#if char}
                      <div class="char-portrait-img">
                        <CharacterIcon character={char} />
                      </div>
                    {/if}

                    <!-- Gradient overlay at bottom -->
                    <div
                      class="char-overlay absolute bottom-0 left-0 right-0 flex flex-col justify-end px-1.5 pb-1.5 pt-5 z-10"
                    >
                      <span
                        class="text-[0.7rem] font-medium leading-tight truncate"
                        style="color: var(--foreground-color);"
                      >
                        {char?.name ?? goodKey}
                      </span>
                      {#if build}
                        <span
                          class="text-[0.65rem] font-semibold leading-tight tracking-wider"
                          style="color: var(--accent-1);"
                        >
                          {formatInvestmentCR(
                            build.cons,
                            build.weapon.refinement,
                            build.weapon.key,
                          )}
                        </span>
                      {/if}
                    </div>

                    <!-- Dim unowned characters -->
                    {#if !isOwned}
                      <div
                        class="absolute inset-0 z-5"
                        style="background: rgba(2, 6, 11, 0.55);"
                      ></div>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Info bar -->
              <div
                class="flex items-center justify-between px-4 py-3"
                style="border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 12%, transparent);"
              >
                <div class="flex items-baseline gap-2">
                  <span class="text-xs" style="color: var(--foreground-mid);">
                    {selectedCost !== null ? selectedCost : team.baseline_cost}
                    cost -
                    {(displayDps(team) / 1000).toFixed(0)}K DPS
                  </span>
                </div>

                <a
                  href="/teams/{team.team_key}"
                  class="text-xs font-medium hover:underline shrink-0"
                  style="color: var(--accent-1);"
                >
                  view details
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/key}

      <!-- Show more button -->
      {#if hasMore}
        <button
          onclick={showMore}
          class="show-more-btn rounded-xl px-5 py-3 text-sm font-medium transition-all duration-150"
          style="background: color-mix(in srgb, var(--accent-1) 8%, var(--background-mid)); color: var(--accent-1); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
        >
          Show {Math.min(SPOTLIGHT_PAGE, remaining)} more ({remaining} remaining)
        </button>
      {/if}
    {:else}
      {#key listKey}
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          class:no-anim={!$animationsEnabled}
        >
          {#each displayTeams as team, i}
            {@const owned = ownsTeam(team)}
            {@const costSim =
              selectedCost !== null
                ? getSimAtCost(team, selectedCost)
                : team.results.length > 0
                  ? team.results[0]
                  : null}
            <div
              class="team-card card-enter rounded-xl overflow-hidden flex flex-col"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent); animation-delay: {i *
                35}ms;"
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
                    {@const build = costSim?.characters.find(
                      (c) => c.key === goodKey,
                    )}
                    {@const starred =
                      bestPerCharacter && isBestTeamFor(team, goodKey)}
                    <div
                      class="team-slot rounded-[5px] overflow-hidden relative"
                      style="background: {elementBg(char?.element ?? null)};"
                    >
                      {#if starred}
                        <span
                          class="absolute top-0.5 right-0.5 z-20 text-[0.55rem] leading-none"
                          style="color: var(--accent-1);"
                          title="This character's best team"
                          aria-label="Best team for this character">★</span
                        >
                      {/if}
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
                          {formatInvestmentCR(
                            build.cons,
                            build.weapon.refinement,
                            build.weapon.key,
                          )}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>

                <!-- Cost + view details -->
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs" style="color: var(--foreground-mid);">
                    {selectedCost !== null ? selectedCost : team.baseline_cost} cost
                    - {(displayDps(team) / 1000).toFixed(0)}K DPS
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
      {/key}
    {/if}

    {#if displayTeams.length === 0}
      <div
        class="rounded-2xl p-8 text-center"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        <p style="color: var(--foreground-mid);">
          No teams found{tags.length > 0
            ? " with those characters"
            : ""}{selectedCost !== null ? " at that cost" : ""}.
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

  /* ── Settings gear ────────────────────────────────────────────────────── */

  .settings-gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      transform 0.3s ease;
  }

  .settings-gear:hover {
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
    color: var(--accent-1);
  }

  .settings-gear-active {
    color: var(--accent-1) !important;
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
    transform: rotate(60deg);
  }

  /* ── Settings panel ───────────────────────────────────────────────────── */

  .team-slot {
    width: 100%;
    min-width: 32px;
  }

  /* ── Spotlight portrait cards ─────────────────────────────────────────── */

  .team-row {
    transition: border-color 0.2s;
  }

  .team-row:hover {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 40%,
      transparent
    ) !important;
  }

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
    /* Let CharacterIcon's own styling handle the image;
       only ensure it fills the card without gaps */
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

  .show-more-btn:hover {
    background: color-mix(
      in srgb,
      var(--accent-1) 14%,
      var(--background-mid)
    ) !important;
    border-color: color-mix(
      in srgb,
      var(--accent-1) 32%,
      transparent
    ) !important;
  }

  /* ── View mode toggle ─────────────────────────────────────────────────── */

  .mode-btn {
    background: var(--background-mid);
    color: var(--foreground-mid);
    cursor: pointer;
    border: none;
  }

  .mode-btn-active {
    background: color-mix(in srgb, var(--accent-1) 12%, var(--background-mid));
    color: var(--accent-1);
  }

  /* ── Toggle switch ─────────────────────────────────────────────────────── */
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

  /* ── Staggered card entrance ────────────────────────────────────────── */

  .card-enter {
    animation: slide-up 0.35s ease-out both;
  }

  .no-anim .card-enter {
    animation: none;
  }
</style>
