<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    charactersOwned,
    writeTopAbyssTeamsOwned,
    writeTopStygianTeamsOwned,
    writeNearMissStygianTeams,
  } from "$lib/stores";
  import { onMount } from "svelte";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import "../app.css";

  let { data, children } = $props();

  let characters: Character[] = $derived(data.characters);

  $inspect($charactersOwned);

  onMount(async () => {
    let cachedCharactersOwnedJSON = localStorage.getItem("charactersOwned");
    let cachedCharactersOwned: CharacterOwned[] | undefined =
      cachedCharactersOwnedJSON
        ? JSON.parse(cachedCharactersOwnedJSON)
        : undefined;

    if (cachedCharactersOwned) {
      let finalList: CharacterOwned[] = characters.map((c) => {
        let cachedChar = cachedCharactersOwned.find((c2) => c2.id === c.id);
        if (cachedChar) return cachedChar;
        return {
          icon: c.icon,
          id: c.id,
          name: c.name,
          rarity: c.rarity,
          isOwned: true,
        };
      });
      charactersOwned.set(finalList);
    } else {
      charactersOwned.set(
        characters.map((c) => ({
          icon: c.icon,
          id: c.id,
          name: c.name,
          rarity: c.rarity,
          isOwned: true,
        })),
      );
    }
    await Promise.all([
      writeTopAbyssTeamsOwned($charactersOwned),
      writeTopStygianTeamsOwned($charactersOwned),
      writeNearMissStygianTeams($charactersOwned),
    ]);
  });

  const homePath = resolve("/");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");
  const settingsPath = resolve("/settings");
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="w-full flex flex-col items-center">
  <nav
    class="nav-bar w-full fixed top-0 z-10 flex items-center justify-between px-8 h-12"
  >
    <!-- Logo = home link -->
    <a
      href={homePath}
      class="nav-logo"
      aria-current={page.url.pathname === homePath ? "page" : undefined}
    >
      LIGHTKEEPERS
    </a>

    <!-- Page links -->
    <div class="flex items-center gap-6">
      <a
        href={abyssPath}
        class="nav-link"
        aria-current={page.url.pathname === abyssPath ? "page" : undefined}
        >Abyss</a
      >
      <a
        href={stygianPath}
        class="nav-link"
        aria-current={page.url.pathname === stygianPath ? "page" : undefined}
        >Stygian</a
      >
      <a
        href={pullsPath}
        class="nav-link"
        aria-current={page.url.pathname === pullsPath ? "page" : undefined}
        >Pulls</a
      >
      <a
        href={settingsPath}
        class="nav-link"
        aria-current={page.url.pathname === settingsPath ? "page" : undefined}
        >Settings</a
      >
    </div>
  </nav>

  <!-- Offset for fixed nav + breathing room -->
  <div class="h-12 w-full"></div>
  <div class="w-full flex flex-col items-center pt-8">
    {@render children()}
  </div>
</div>
