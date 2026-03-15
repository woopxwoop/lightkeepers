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
  let tempFiveStarsOwned: CharacterOwned[] = $derived(
    tempCharactersOwned.filter((c) => c.rarity === 5),
  );
  let synced = $state(false);
  let show4Stars = $state(true);
  let showSaved = $state(false);

  function toggleOwned(id: string) {
    tempCharactersOwned = tempCharactersOwned.map((character) => {
      if (character.id === id) {
        return { ...character, isOwned: !character.isOwned };
      } else return character;
    });
  }

  function saveCharacters() {
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(tempCharactersOwned),
    );
    charactersOwned.set(tempCharactersOwned);
    writeTopAbyssTeamsOwned($charactersOwned);
    writeTopStygianTeamsOwned($charactersOwned);
    writeNearMissStygianTeams($charactersOwned);
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
      synced = true;
    }
  });

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
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

    <!-- 4-star toggle -->
    <label class="flex items-center gap-2 cursor-pointer select-none">
      <span class="text-xs text-(--intermediate-color)">5★ only</span>
      <div
        class="relative w-9 h-5 rounded-full transition-colors"
        style="background: {show4Stars
          ? 'var(--surface-border)'
          : 'color-mix(in srgb, var(--secondary-color) 30%, transparent)'};"
      >
        <input
          type="checkbox"
          class="sr-only"
          checked={!show4Stars}
          onchange={() => {
            show4Stars = !show4Stars;
          }}
        />
        <div
          class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style="background: {show4Stars
            ? 'var(--intermediate-color)'
            : 'var(--secondary-color)'};
                 transform: translateX({show4Stars ? '2px' : '18px'});"
        ></div>
      </div>
    </label>
  </div>

  {#if synced}
    <!-- Character grid -->
    <div class="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3">
      {#each show4Stars ? tempCharactersOwned : tempFiveStarsOwned as character (character.id)}
        <button
          onclick={() => toggleOwned(character.id)}
          class="cursor-pointer rounded-xl w-full overflow-hidden relative
                 transition-all duration-75 hover:-translate-y-1"
          style="border: 2px solid {character.isOwned
            ? 'color-mix(in srgb, var(--foreground-color) 80%, transparent)'
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
    </div>

    <!-- Save button -->
    <button
      onclick={saveCharacters}
      class="w-full py-3 rounded-xl text-sm font-medium tracking-wider uppercase
             transition-opacity hover:opacity-80"
      style="background: color-mix(in srgb, var(--secondary-color) 12%, transparent);
             border: 0.5px solid color-mix(in srgb, var(--secondary-color) 35%, transparent);
             color: {showSaved
        ? 'var(--secondary-color)'
        : 'var(--secondary-color)'};"
    >
      {showSaved ? "Saved ✓" : "Save Roster"}
    </button>
  {:else}
    <div class="flex items-center justify-center min-h-[40vh]">
      <p class="text-(--intermediate-color)">Loading…</p>
    </div>
  {/if}
</main>
