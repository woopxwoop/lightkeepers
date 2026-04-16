<script lang="ts">
  import {
    charactersOwned,
    writeTeamsOwned,
    writeNearMissTeams,
  } from "$lib/stores";
  import { onMount } from "svelte";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";
  import { fly, slide } from "svelte/transition";

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let isSaving = $state(false);
  let hasUnsavedChanges = $state(false);

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let search = $state("");
  let filtersOpen = $state(false);

  let isFiltered = $derived(
    rarityFilter.size > 0 || elementFilter.size > 0 || weaponFilter.size > 0,
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
    ["5", "5★"],
    ["4", "4★"],
  ];

  function toggleFilter(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  // $inspect(tempCharactersOwned);

  let visibleCharacters = $derived(
    tempCharactersOwned.filter((c) => {
      const matchesRarity =
        rarityFilter.size === 0 ||
        (rarityFilter.has("5") && c.rarity === 5) ||
        (rarityFilter.has("4") && c.rarity === 4);
      const matchesElement =
        elementFilter.size === 0 ||
        (c.element != null && elementFilter.has(c.element));
      const matchesWeapon =
        weaponFilter.size === 0 ||
        (c.weapon_type != null && weaponFilter.has(c.weapon_type));
      const matchesSearch =
        search === "" || c.name.toLowerCase().includes(search.toLowerCase());
      return matchesRarity && matchesElement && matchesWeapon && matchesSearch;
    }),
  );

  let savedSnapshot = $state<string>("");

  function toggleOwned(id: string) {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      c.id === id ? { ...c, isOwned: !c.isOwned } : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function selectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.id === c.id)
        ? { ...c, isOwned: true }
        : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function deselectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.id === c.id)
        ? { ...c, isOwned: false }
        : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  async function saveCharacters() {
    if (isSaving) return;
    isSaving = true;
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(tempCharactersOwned),
    );
    savedSnapshot = JSON.stringify(tempCharactersOwned);
    charactersOwned.set(tempCharactersOwned);

    // Single server round-trip for both abyss + stygian owned teams
    await writeTeamsOwned(tempCharactersOwned);
    // Near-miss updates in the background
    writeNearMissTeams(tempCharactersOwned).catch(console.error);

    showSaved = true;
    hasUnsavedChanges = false;
    isSaving = false;
    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  onMount(() => {
    synced = false;
  });

  $effect(() => {
    if ($charactersOwned.length > 0 && !synced) {
      tempCharactersOwned = [...$charactersOwned];
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      synced = true;
    }
  });

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
</script>

<main class="w-[92%] md:w-[80%] pb-20 flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <div class="flex flex-col gap-1">
      <h2 class="tracking-widest uppercase text-(--intermediate-color)">
        Roster
      </h2>
      <p class="text-xs text-(--faint-color)">
        {ownedCount} of {totalCount} characters selected
      </p>
    </div>
  </div>

  {#if synced}
    <!-- Search + filter toggle row -->
    <div class="flex flex-col gap-0">
      <div
        class="flex items-center gap-2 rounded-xl px-3"
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"
      >
        <button
          onclick={() => (filtersOpen = !filtersOpen)}
          class="flex items-center gap-1.5 text-xs py-2 shrink-0 transition-opacity hover:opacity-75"
          style={isFiltered
            ? "color: var(--secondary-color);"
            : "color: var(--intermediate-color);"}
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
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filter
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="transition: transform 200ms; transform: rotate({filtersOpen
              ? 180
              : 0}deg);"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div
          style="width: 0.5px; height: 16px; background: var(--surface-border);"
        ></div>
        <input
          type="text"
          placeholder="Search characters…"
          bind:value={search}
          class="flex-1 text-xs py-2 bg-transparent outline-none"
          style="color: var(--foreground-color);"
        />
      </div>

      {#if filtersOpen}
        <div
          class="flex flex-col gap-3 px-4 py-4 rounded-b-xl"
          style="background: var(--surface-color); border: 0.5px solid var(--surface-border); border-top: none;"
          transition:slide={{ duration: 200 }}
        >
          <!-- Elements -->
          <div class="flex flex-col gap-2">
            <span class="text-xs uppercase tracking-widest text-(--faint-color)"
              >Elements</span
            >
            <div class="flex items-center gap-1 flex-wrap">
              {#each elements as el}
                <button
                  class="text-xs px-3 py-1 rounded-lg transition-colors"
                  style={elementFilter.has(el)
                    ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                    : "background: transparent; color: var(--faint-color); border: 0.5px solid var(--surface-border);"}
                  onclick={() =>
                    (elementFilter = toggleFilter(elementFilter, el))}
                >
                  {el}
                </button>
              {/each}
            </div>
          </div>

          <!-- Rarity -->
          <div class="flex flex-col gap-2">
            <span class="text-xs uppercase tracking-widest text-(--faint-color)"
              >Rarity</span
            >
            <div class="flex items-center gap-1">
              {#each rarities as [val, label]}
                <button
                  class="text-xs px-3 py-1 rounded-lg transition-colors"
                  style={rarityFilter.has(val)
                    ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                    : "background: transparent; color: var(--faint-color); border: 0.5px solid var(--surface-border);"}
                  onclick={() =>
                    (rarityFilter = toggleFilter(rarityFilter, val))}
                >
                  {label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Weapon Type -->
          <div class="flex flex-col gap-2">
            <span class="text-xs uppercase tracking-widest text-(--faint-color)"
              >Weapon Type</span
            >
            <div class="flex items-center gap-1 flex-wrap">
              {#each weaponTypes as wt}
                <button
                  class="text-xs px-3 py-1 rounded-lg transition-colors"
                  style={weaponFilter.has(wt)
                    ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);"
                    : "background: transparent; color: var(--faint-color); border: 0.5px solid var(--surface-border);"}
                  onclick={() =>
                    (weaponFilter = toggleFilter(weaponFilter, wt))}
                >
                  {wt}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Select / Deselect -->
    <div class="flex gap-2">
      <button
        onclick={selectAll}
        class="text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-opacity hover:opacity-75"
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);
               color: var(--intermediate-color);"
      >
        Select all
        {#if isFiltered || search}
          ({visibleOwnedCount}/{visibleCharacters.length})
        {/if}
      </button>
      <button
        onclick={deselectAll}
        class="text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-opacity hover:opacity-75"
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);
               color: var(--intermediate-color);"
      >
        Deselect all
      </button>
    </div>

    {#if hasUnsavedChanges || isSaving || showSaved}
      <div
        class="fixed bottom-6 left-0 right-0 mx-auto w-fit z-20 flex items-center gap-4
               px-5 py-3 rounded-2xl"
        style="background: var(--surface-color);
               border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);"
        transition:fly={{ y: 200, duration: 500 }}
      >
        <span class="text-sm text-(--intermediate-color)">
          {isSaving ? "Saving…" : showSaved ? "Saved!" : "Unsaved changes"}
        </span>
        <button
          onclick={saveCharacters}
          disabled={isSaving || showSaved || !hasUnsavedChanges}
          class="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style:opacity={isSaving || showSaved || !hasUnsavedChanges
            ? "0.7"
            : "1"}
          style="background: color-mix(in srgb, var(--secondary-color) 15%, transparent);
                 border: 0.5px solid color-mix(in srgb, var(--secondary-color) 45%, transparent);
                 color: var(--secondary-color);"
        >
          {isSaving ? "Saving…" : showSaved ? "Saved ✓" : "Save"}
        </button>
      </div>
    {/if}

    <div
      class="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3 pb-24"
    >
      {#each visibleCharacters as character (character.id)}
        <button
          onclick={() => toggleOwned(character.id)}
          class="cursor-pointer rounded-xl w-full h-fit overflow-hidden relative
                 transition-all duration-75 character-icon-button"
          style="border: 2px solid var(--foreground-color);
                 opacity: {character.isOwned ? '1' : ''};"
        >
          <CharacterIcon {character} />
        </button>
      {/each}

      {#if visibleCharacters.length === 0}
        <p class="col-span-full text-xs text-(--faint-color)">
          No characters match.
        </p>
      {/if}
    </div>

    {#if hasUnsavedChanges}
      <div class="h-16"></div>
    {/if}
  {:else}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p class="text-(--intermediate-color)">Loading…</p>
    </div>
  {/if}
</main>

<style>
  .character-icon-button :global(*) {
    transition-duration: 0.5s;
  }

  .character-icon-button:hover :global(.icon-container-compact img) {
    transform: scale(1.2);
  }

  .character-icon-button:hover :global(.icon-container-coop img) {
    transform: scale(2.5);
  }

  .character-icon-button:hover {
    opacity: 0.67;
  }

  .character-icon-button {
    transition-duration: 0.5s;
    opacity: 0.33;
  }
</style>
