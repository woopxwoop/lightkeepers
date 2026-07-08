<script lang="ts">
  import {
    charactersOwned,
    charactersHydrated,
    writeNearMissTeams,
    writeTeamsOwned,
  } from "$lib/stores";
  import { authClient } from "$lib/auth-client";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";
  import { slide } from "svelte/transition";
  import {
    WEAPON_TYPE_MAP,
    isNewCharacter,
  } from "$lib/utils";

  const session = authClient.useSession();

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let isSaving = $state(false);
  let hasUnsavedChanges = $state(false);

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let ownershipFilter = $state<"all" | "owned" | "unowned">("all");
  let search = $state("");
  let sortBy = $state<"default" | "game_id" | "release_date">("release_date");
  let sortAsc = $state(false);
  let sortOpen = $state(false);
  let sortTriggerEl: HTMLButtonElement | null = $state(null);

  $effect(() => {
    if (!sortOpen) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") sortOpen = false;
    }
    function onClick(e: MouseEvent) {
      if (sortTriggerEl && !sortTriggerEl.contains(e.target as Node)) {
        const dropdown = document.querySelector(".sort-dropdown");
        if (dropdown && !dropdown.contains(e.target as Node)) sortOpen = false;
      }
    }
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("click", onClick);
    };
  });
  let filtersOpen = $state(false);

  let isFiltered = $derived(
    rarityFilter.size > 0 ||
      elementFilter.size > 0 ||
      weaponFilter.size > 0 ||
      ownershipFilter !== "all",
  );

  const elements = [
    "Dendro",
    "Cryo",
    "Hydro",
    "Anemo",
    "Pyro",
    "Geo",
    "Electro",
  ];
  const weaponTypes = ["Sword", "Catalyst", "Bow", "Claymore", "Polearm"];
  const rarities = [
    ["5", "5 star"],
    ["4", "4 star"],
  ];

  function toggleFilter(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  let visibleCharacters = $derived(
    tempCharactersOwned
      .filter((c) => {
        const matchesRarity =
          rarityFilter.size === 0 ||
          (rarityFilter.has("5") && c.rarity === 5) ||
          (rarityFilter.has("4") && c.rarity === 4);
        const matchesElement =
          elementFilter.size === 0 ||
          (c.element != null && elementFilter.has(c.element));
        const matchesWeapon =
          weaponFilter.size === 0 ||
          (c.weapon_type != null &&
            weaponFilter.has(
              WEAPON_TYPE_MAP[c.weapon_type as keyof typeof WEAPON_TYPE_MAP] ??
                c.weapon_type,
            ));
        const matchesOwnership =
          ownershipFilter === "all" ||
          (ownershipFilter === "owned" && c.isOwned) ||
          (ownershipFilter === "unowned" && !c.isOwned);
        const matchesSearch =
          search === "" ||
          (c.name ?? "").toLowerCase().includes(search.toLowerCase());
        return (
          matchesRarity &&
          matchesElement &&
          matchesWeapon &&
          matchesOwnership &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const cmp = (() => {
          if (sortBy === "game_id") return a.game_id - b.game_id;
          if (sortBy === "release_date") {
            if (a.released_at === null && b.released_at === null) return a.game_id - b.game_id;
            if (a.released_at === null) return -1;
            if (b.released_at === null) return 1;
            const diff = new Date(a.released_at.replace(" ", "T")).getTime() - new Date(b.released_at.replace(" ", "T")).getTime();
            if (diff !== 0) return diff;
            return a.game_id - b.game_id;
          }
          // default: alphabetical by name, tiebreak by game_id
          const nameCmp = (a.name ?? "").localeCompare(b.name ?? "");
          if (nameCmp !== 0) return nameCmp;
          return a.game_id - b.game_id;
        })();
        return sortAsc ? cmp : -cmp;
      }),
  );

  let savedSnapshot = $state("");

  function updateUnsavedState() {
    const changed = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
    hasUnsavedChanges = changed;
    if (changed) showSaved = false;
  }

  function toggleOwned(name_id: string) {
    const char = tempCharactersOwned.find((c) => c.name_id === name_id);
    if (char) char.isOwned = !char.isOwned;
    updateUnsavedState();
  }

  function selectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    for (const c of tempCharactersOwned) {
      if (visibleIds.has(c.name_id)) c.isOwned = true;
    }
    updateUnsavedState();
  }

  function deselectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    for (const c of tempCharactersOwned) {
      if (visibleIds.has(c.name_id)) c.isOwned = false;
    }
    updateUnsavedState();
  }

  let rosterError = $state("");

  async function saveCharacters() {
    if (isSaving) return;
    isSaving = true;
    rosterError = "";

    try {
      // Persist locally first (synchronous)
      localStorage.setItem(
        "charactersOwned",
        JSON.stringify(tempCharactersOwned),
      );
      // Clone so the store holds independent objects — otherwise
      // mutations to tempCharactersOwned silently update the store
      // and the "changed" count always reads 0.
      charactersOwned.set(structuredClone(tempCharactersOwned));

      // Local persistence — all awaited so errors are caught
      await writeTeamsOwned(tempCharactersOwned);
      await writeNearMissTeams(tempCharactersOwned);

      // Cloud sync (only when logged in)
      if ($session.data) {
        const res = await fetch("/api/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roster: tempCharactersOwned }),
        });
        if (!res.ok) {
          rosterError = `Sync failed (${res.status}) — roster not saved to cloud`;
          return;
        }
      }

      // All persistence succeeded — mark as saved
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      showSaved = true;
      hasUnsavedChanges = false;
    } catch (e) {
      console.error("Roster save error:", e);
      rosterError = "Something went wrong — your changes may not be saved";
    } finally {
      isSaving = false;
    }

    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  $effect(() => {
    if ($charactersHydrated && !synced) {
      // Deep-clone so tempCharactersOwned objects are independent of the store.
      tempCharactersOwned = structuredClone($charactersOwned);
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      synced = true;
    } else if ($charactersHydrated && synced && !hasUnsavedChanges) {
      // Only reassign when the store actually differs — avoids
      // thrashing CharacterIcon after save (which already set the store
      // from tempCharactersOwned).
      const storeJson = JSON.stringify($charactersOwned);
      if (storeJson !== savedSnapshot) {
        tempCharactersOwned = structuredClone($charactersOwned);
        savedSnapshot = storeJson;
      }
    }
  });

  /** Characters that were owned before any unsaved edits. */
  let savedOwnedSet = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
</script>

{#if synced}
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-0">
      <div
        class="flex items-center gap-2 rounded-lg px-3 search-bar"
        style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
      >
        <button
          type="button"
          onclick={() => (filtersOpen = !filtersOpen)}
          aria-expanded={filtersOpen}
          class="settings-filter-button flex items-center gap-1.5 text-xs py-2 shrink-0 transition-opacity hover:opacity-75"
          class:settings-filter-button-active={isFiltered}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon
              points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
            />
          </svg>
          Filter
        </button>
        <div
          style="width: 0.5px; height: 16px; background: color-mix(in srgb, var(--accent-1) 22%, transparent);"
        ></div>
        <input
          type="text"
          placeholder="Search characters..."
          aria-label="Search characters"
          bind:value={search}
          class="flex-1 text-xs py-2 bg-transparent outline-none"
          style="color: var(--foreground-color);"
        />
      </div>

      {#if filtersOpen}
        <div
          class="flex flex-col gap-3 px-4 py-4 rounded-b-lg"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent); border-top: none;"
          transition:slide={{ duration: 200 }}
        >
          <div class="filter-group">
            <span>Elements</span>
            <div>
              {#each elements as el}
                <button
                  type="button"
                  class="filter-chip"
                  class:is-selected={elementFilter.has(el)}
                  aria-pressed={elementFilter.has(el)}
                  onclick={() =>
                    (elementFilter = toggleFilter(elementFilter, el))}
                >
                  {el}
                </button>
              {/each}
            </div>
          </div>

          <div class="filter-group">
            <span>Rarity</span>
            <div>
              {#each rarities as [val, label]}
                <button
                  type="button"
                  class="filter-chip"
                  class:is-selected={rarityFilter.has(val)}
                  aria-pressed={rarityFilter.has(val)}
                  onclick={() =>
                    (rarityFilter = toggleFilter(rarityFilter, val))}
                >
                  {label}
                </button>
              {/each}
            </div>
          </div>

          <div class="filter-group">
            <span>Weapon Type</span>
            <div>
              {#each weaponTypes as wt}
                <button
                  type="button"
                  class="filter-chip"
                  class:is-selected={weaponFilter.has(wt)}
                  aria-pressed={weaponFilter.has(wt)}
                  onclick={() =>
                    (weaponFilter = toggleFilter(weaponFilter, wt))}
                >
                  {wt}
                </button>
              {/each}
            </div>
          </div>

          <div class="filter-group">
            <span>Ownership</span>
            <div>
              <button
                type="button"
                class="filter-chip"
                class:is-selected={ownershipFilter === "owned"}
                aria-pressed={ownershipFilter === "owned"}
                onclick={() =>
                  (ownershipFilter =
                    ownershipFilter === "owned" ? "all" : "owned")}
              >
                Owned
              </button>
              <button
                type="button"
                class="filter-chip"
                class:is-selected={ownershipFilter === "unowned"}
                aria-pressed={ownershipFilter === "unowned"}
                onclick={() =>
                  (ownershipFilter =
                    ownershipFilter === "unowned" ? "all" : "unowned")}
              >
                Unowned
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="flex gap-2 flex-wrap">
      <button type="button" onclick={selectAll} class="secondary-action">
        Select all
        {#if isFiltered || search}
          ({visibleOwnedCount}/{visibleCharacters.length})
        {/if}
      </button>
      <button type="button" onclick={deselectAll} class="secondary-action">
        Deselect all
      </button>

      <div class="flex items-center gap-1 relative">
        <span class="text-xs" style="color: var(--foreground-mid);">Sort:</span>
        <button
          type="button"
          onclick={() => (sortOpen = !sortOpen)}
          class="sort-trigger"
          bind:this={sortTriggerEl}
        >
          {sortBy === "default" ? "Alphabetical" : sortBy === "game_id" ? "Game ID" : "Release Date"}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class:sort-chevron-open={sortOpen}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {#if sortOpen}
          <div
            class="sort-dropdown"
            role="listbox"
            aria-label="Sort by"
          >
            <button
              type="button"
              role="option"
              aria-selected={sortBy === "default"}
              class="sort-option"
              class:sort-option-selected={sortBy === "default"}
              onclick={() => { sortBy = "default"; sortOpen = false; }}
            >Alphabetical</button>
            <button
              type="button"
              role="option"
              aria-selected={sortBy === "game_id"}
              class="sort-option"
              class:sort-option-selected={sortBy === "game_id"}
              onclick={() => { sortBy = "game_id"; sortOpen = false; }}
            >Game ID</button>
            <button
              type="button"
              role="option"
              aria-selected={sortBy === "release_date"}
              class="sort-option"
              class:sort-option-selected={sortBy === "release_date"}
              onclick={() => { sortBy = "release_date"; sortOpen = false; }}
            >Release Date</button>
          </div>
        {/if}
        <button
          type="button"
          onclick={() => (sortAsc = !sortAsc)}
          class="sort-direction-btn"
          aria-label={sortAsc ? "Ascending" : "Descending"}
          title={sortAsc ? "Ascending" : "Descending"}
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
          >
            {#if sortAsc}
              <polyline points="18 15 12 9 6 15" />
            {:else}
              <polyline points="6 9 12 15 18 9" />
            {/if}
          </svg>
        </button>
      </div>
      <div class="ml-auto">
        <span class="text-sm" style="color: var(--foreground-mid);">
          {ownedCount} / {totalCount}
        </span>
      </div>
    </div>

    {#if hasUnsavedChanges || isSaving || showSaved || rosterError}
      <div
        class="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-8 px-6 py-3"
        style="background: color-mix(in srgb, var(--background-mid) 94%, transparent); border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent); backdrop-filter: blur(12px);"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style="background: {isSaving
              ? 'var(--accent-2)'
              : showSaved
                ? 'color-mix(in srgb, var(--accent-1) 40%, transparent)'
                : 'var(--accent-1)'};"
          ></span>
          <span class="text-sm" style="color: var(--foreground-color);">
            {isSaving ? "Saving..." : showSaved ? "Saved" : "Unsaved changes"}
          </span>
          {#if hasUnsavedChanges}
            <span class="text-xs" style="color: var(--foreground-mid);">
              ({tempCharactersOwned.reduce(
                (count, c) =>
                  count +
                  (c.isOwned !==
                  $charactersOwned.find((o) => o.name_id === c.name_id)
                    ?.isOwned
                    ? 1
                    : 0),
                0,
              )} changed)
            </span>
          {/if}
        </div>
        {#if hasUnsavedChanges && !isSaving && !showSaved}
          <div class="flex gap-2">
            <button
              type="button"
              onclick={() => {
                tempCharactersOwned = structuredClone($charactersOwned);
                savedSnapshot = JSON.stringify($charactersOwned);
                hasUnsavedChanges = false;
              }}
              class="cancel-action"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={saveCharacters}
              class="primary-action"
            >
              Save
            </button>
          </div>
        {/if}
        {#if rosterError}
          <span class="text-xs" style="color: var(--accent-1);">
            {rosterError}
          </span>
        {/if}
      </div>
    {/if}

    <div
      class="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3 pb-24"
    >
      {#each visibleCharacters as character (character.name_id)}
        <button
          type="button"
          onclick={() => toggleOwned(character.name_id)}
          aria-pressed={character.isOwned}
          aria-label="{character.name ?? 'Unknown'}, {character.isOwned
            ? 'owned'
            : 'not owned'}"
          class="cursor-pointer rounded-lg w-full h-fit overflow-hidden relative transition-all duration-75 character-icon-button"
          class:character-icon-button-owned={character.isOwned}
          style="border: 2px solid {isNewCharacter(character.released_at) &&
          !savedOwnedSet.has(character.name_id)
            ? 'var(--accent-1)'
            : 'var(--foreground-color)'};"
        >
          {#if isNewCharacter(character.released_at) && !savedOwnedSet.has(character.name_id)}
            <span
              class="absolute top-1 right-1 z-10 text-[9px] font-bold px-1 py-0.5 rounded"
              style="background: var(--accent-1); color: var(--background-color);"
            >
              NEW
            </span>
          {/if}
          <CharacterIcon {character} />
        </button>
      {/each}

      {#if visibleCharacters.length === 0}
        <p class="col-span-full text-xs" style="color: var(--foreground-mid);">
          No characters match.
        </p>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center min-h-[40vh]">
    <p style="color: var(--foreground-mid);">Loading...</p>
  </div>
{/if}

<style>
  .filter-group > span {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent-1);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .filter-chip,
  .secondary-action {
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s,
      opacity 0.15s;
  }

  .filter-chip.is-selected {
    color: var(--accent-1);
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
    background: color-mix(in srgb, var(--accent-1) 15%, transparent);
  }

  .settings-filter-button {
    color: var(--foreground-mid);
  }

  .settings-filter-button-active {
    color: var(--accent-1);
  }

  .secondary-action {
    background: var(--background-mid);
    color: var(--foreground-mid);
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
  }

  .primary-action {
    border-radius: 10px;
    padding: 0.5rem 1.25rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--background-color);
    background: var(--accent-1);
    border: none;
    transition: opacity 0.15s;
  }

  .primary-action:hover {
    opacity: 0.85;
  }

  .cancel-action {
    border-radius: 10px;
    padding: 0.5rem 1.25rem;
    font-size: 0.8rem;
    color: var(--foreground-mid);
    background: transparent;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .cancel-action:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
  }

  .character-icon-button :global(*) {
    transition-duration: 0.5s;
  }

  .character-icon-button:hover :global(.icon-container-compact img) {
    transform: scale(1.2);
  }

  .character-icon-button:hover :global(.icon-container-coop img) {
    transform: scale(2.5);
  }

  .character-icon-button:hover :global(.icon-container-tcg img) {
    transform: scale(1.5);
  }

  .character-icon-button:hover {
    opacity: 0.67;
  }

  .character-icon-button {
    transition-duration: 0.5s;
    opacity: 0.33;
  }

  .character-icon-button-owned {
    opacity: 1;
  }

  .search-bar:focus-within {
    box-shadow: 0 0 0 1.5px var(--accent-1);
  }

  .sort-trigger {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }

  .sort-trigger:hover {
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
    color: var(--foreground-color);
  }

  .sort-chevron-open {
    transform: rotate(180deg);
  }

  .sort-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 130px;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: color-mix(in srgb, var(--background-mid) 96%, transparent);
    backdrop-filter: blur(12px);
    padding: 0.25rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .sort-option {
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background 0.1s, color 0.1s;
  }

  .sort-option:hover {
    background: color-mix(in srgb, var(--accent-1) 14%, transparent);
    color: var(--foreground-color);
  }

  .sort-option-selected {
    color: var(--accent-1);
  }

  .sort-direction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-mid);
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s, color 0.15s;
  }

  .sort-direction-btn:hover {
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
    color: var(--foreground-color);
  }
</style>
