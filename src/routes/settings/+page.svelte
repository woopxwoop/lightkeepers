<script lang="ts">
  import {
    charactersOwned,
    writeTopAbyssTeamsOwned,
    writeTopStygianTeamsOwned,
    writeNearMissStygianTeams,
  } from "$lib/stores";
  import { onMount } from "svelte";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let hasUnsavedChanges = $state(false);

  // Rarity filter: "all" | "5" | "4"
  let rarityFilter = $state<"all" | "5" | "4">("all");
  let search = $state("");

  let visibleCharacters = $derived(
    tempCharactersOwned.filter((c) => {
      const matchesRarity =
        rarityFilter === "all" ||
        (rarityFilter === "5" && c.rarity === 5) ||
        (rarityFilter === "4" && c.rarity === 4);
      const matchesSearch =
        search === "" || c.name.toLowerCase().includes(search.toLowerCase());
      return matchesRarity && matchesSearch;
    }),
  );

  // Saved snapshot to detect unsaved changes
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

  function saveCharacters() {
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(tempCharactersOwned),
    );
    savedSnapshot = JSON.stringify(tempCharactersOwned);
    charactersOwned.set(tempCharactersOwned);
    writeTopAbyssTeamsOwned(tempCharactersOwned);
    writeTopStygianTeamsOwned(tempCharactersOwned);
    writeNearMissStygianTeams(tempCharactersOwned);
    hasUnsavedChanges = false;
    showSaved = true;
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

<main class="w-[80%] pb-20 flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex flex-col gap-1">
      <h2 class="tracking-widest uppercase text-(--intermediate-color)">
        Roster
      </h2>
      <p class="text-xs text-(--faint-color)">
        {ownedCount} of {totalCount} characters selected
      </p>
    </div>

    <!-- Rarity filter buttons -->
    <div class="flex items-center gap-1">
      {#each [["all", "All"], ["5", "5★"], ["4", "4★"]] as [val, label]}
        <button
          class="text-xs px-3 py-1 rounded-lg transition-colors"
          style={rarityFilter === val
            ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);"
            : "background: transparent; color: var(--faint-color); border: 0.5px solid var(--surface-border);"}
          onclick={() => {
            rarityFilter = val as "all" | "5" | "4";
          }}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  {#if synced}
    <!-- Search + bulk actions row -->
    <div class="flex items-center gap-3">
      <input
        type="text"
        placeholder="Search characters…"
        bind:value={search}
        class="flex-1 text-xs rounded-lg px-3 py-2"
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);
               color: var(--foreground-color); outline: none;"
      />
      <button
        onclick={selectAll}
        class="text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-opacity hover:opacity-75"
        style="background: var(--surface-color); border: 0.5px solid var(--surface-border);
               color: var(--intermediate-color);"
      >
        Select all
        {#if rarityFilter !== "all" || search}
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

    <!-- Floating save bar — only appears when there are unsaved changes -->
    {#if hasUnsavedChanges}
      <div
        class="fixed bottom-6 left-0 right-0 mx-auto w-fit z-20 flex items-center gap-4
               px-5 py-3 rounded-2xl"
        style="background: var(--surface-color);
               border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);
               animation: slide-up 0.2s ease-out;"
      >
        <span class="text-sm text-(--intermediate-color)">Unsaved changes</span>
        <button
          onclick={saveCharacters}
          class="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style="background: color-mix(in srgb, var(--secondary-color) 15%, transparent);
                 border: 0.5px solid color-mix(in srgb, var(--secondary-color) 45%, transparent);
                 color: var(--secondary-color);"
        >
          {showSaved ? "Saved ✓" : "Save"}
        </button>
      </div>
    {/if}

    <!-- Character grid -->
    <div
      class="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3 pb-24"
    >
      {#each visibleCharacters as character (character.id)}
        <button
          onclick={() => toggleOwned(character.id)}
          class="cursor-pointer rounded-xl w-full overflow-hidden relative
                 transition-all duration-75 hover:-translate-y-1"
          style="border: 0.5px solid {character.isOwned
            ? 'color-mix(in srgb, var(--secondary-color) 40%, transparent)'
            : 'var(--surface-border)'};
                 opacity: {character.isOwned ? '1' : '0.35'};"
        >
          <CharacterIcon
            icon={character.icon}
            name={character.name}
            rarity={character.rarity}
          />
        </button>
      {/each}

      {#if visibleCharacters.length === 0}
        <p class="col-span-full text-xs text-(--faint-color)">
          No characters match.
        </p>
      {/if}
    </div>

    <!-- Spacer so last row of portraits doesn't hide behind floating bar -->
    {#if hasUnsavedChanges}
      <div class="h-16"></div>
    {/if}
  {:else}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p class="text-(--intermediate-color)">Loading…</p>
    </div>
  {/if}
</main>
