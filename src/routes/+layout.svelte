<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    charactersOwned,
    writeTopAbyssTeamsOwned,
    writeTopStygianTeamsOwned,
    writeNearMissStygianTeams,
    writeNearMissPairTeams,
  } from "$lib/stores";
  import { onMount, tick } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
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

    let finalList: CharacterOwned[];
    if (cachedCharactersOwned) {
      finalList = characters.map((c) => {
        let cachedChar = cachedCharactersOwned!.find((c2) => c2.id === c.id);
        if (cachedChar) return cachedChar;
        return {
          icon: c.icon,
          id: c.id,
          name: c.name,
          rarity: c.rarity,
          isOwned: true,
        };
      });
    } else {
      finalList = characters.map((c) => ({
        icon: c.icon,
        id: c.id,
        name: c.name,
        rarity: c.rarity,
        isOwned: true,
      }));
    }

    charactersOwned.set(finalList);
    await Promise.all([
      writeTopAbyssTeamsOwned(finalList),
      writeTopStygianTeamsOwned(finalList),
      writeNearMissStygianTeams(finalList),
      writeNearMissPairTeams(finalList),
    ]);

    updateUnderline();
  });

  const homePath = resolve("/");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");
  const settingsPath = resolve("/settings");

  // ── Sliding underline ──────────────────────────────────────────────────
  let navLinks: Record<string, HTMLElement | null> = {
    abyss: null,
    stygian: null,
    pulls: null,
    settings: null,
  };
  let linksContainer: HTMLElement | null = $state(null);
  let underlineLeft = $state(0);
  let underlineWidth = $state(0);
  let underlineReady = $state(false);

  async function updateUnderline() {
    await tick();
    if (!linksContainer) return;
    const active = Object.values(navLinks).find(
      (el) => el?.getAttribute("aria-current") === "page",
    );
    if (!active) {
      underlineReady = false;
      return;
    }
    const containerRect = linksContainer.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    underlineLeft = rect.left - containerRect.left;
    underlineWidth = rect.width;
    underlineReady = true;
  }

  $effect(() => {
    page.url.pathname;
    updateUnderline();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<div class="w-full flex flex-col items-center">
  <nav
    class="nav-bar w-full fixed top-0 z-10 flex items-center justify-between px-8 h-12"
  >
    <a
      href={homePath}
      class="nav-logo"
      aria-current={page.url.pathname === homePath ? "page" : undefined}
    >
      LIGHTKEEPERS
    </a>

    <div class="flex items-center gap-6 relative" bind:this={linksContainer}>
      <a
        href={abyssPath}
        class="nav-link"
        aria-current={page.url.pathname === abyssPath ? "page" : undefined}
        bind:this={navLinks.abyss}>Abyss</a
      >
      <a
        href={stygianPath}
        class="nav-link"
        aria-current={page.url.pathname === stygianPath ? "page" : undefined}
        bind:this={navLinks.stygian}>Stygian</a
      >
      <a
        href={pullsPath}
        class="nav-link"
        aria-current={page.url.pathname === pullsPath ? "page" : undefined}
        bind:this={navLinks.pulls}>Pulls</a
      >
      <a
        href={settingsPath}
        class="nav-link"
        aria-current={page.url.pathname === settingsPath ? "page" : undefined}
        bind:this={navLinks.settings}>Settings</a
      >

      {#if underlineReady}
        <span
          class="absolute bottom-0 h-[1.5px] pointer-events-none"
          style="
            left: {underlineLeft}px;
            width: {underlineWidth}px;
            background: var(--secondary-color);
            transition: left 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                        width 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
          "
        ></span>
      {/if}
    </div>
  </nav>

  <div class="h-12 w-full"></div>
  <div class="w-full flex flex-col items-center pt-8">
    {#key page.url.pathname}
      <div
        class="w-full flex flex-col items-center"
        in:fly={{ y: 12, duration: 280, easing: cubicOut }}
      >
        {@render children()}
      </div>
    {/key}
  </div>
</div>
