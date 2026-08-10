<script lang="ts">
  /**
   * Root shell: seed stores from SSR, then bootstrapClient on mount
   * (roster + background /api/static warm). Page chrome is NavBar + slot.
   */
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Character } from "$lib/definitions";
  import { bootstrapClient, seedClientStores } from "$lib/app/bootstrapClient";
  import { installChunkLoadRecovery } from "$lib/app/chunkLoadRecovery";
  import { installDebugHitTest } from "$lib/app/debugHitTest";
  import { rememberNavigation } from "$lib/nav-history";
  import {
    displayPreferences,
    initDisplayPreferences,
    faviconDataUri,
    backgroundVisible,
    syncBackgroundToPath,
  } from "$lib/stores";
  import NavBar from "$lib/ui/NavBar.svelte";
  import PatchNotesPopup from "$lib/ui/components/PatchNotesPopup.svelte";
  import { resolve } from "$app/paths";
  import { DISCORD_INVITE_URL } from "$lib/site";
  import "../app.css";

  const patchNotesPath = resolve("/patch-notes");


  if (typeof window !== "undefined") {
    installChunkLoadRecovery();
  }

  afterNavigate(({ from }) => {
    rememberNavigation(from?.url);
  });

  let { data, children } = $props();
  let characters: Character[] = $derived(data.characters);

  // Route defaults while following route; after a manual toggle, persisted choice wins.
  syncBackgroundToPath(page.url.pathname);
  $effect(() => {
    syncBackgroundToPath(page.url.pathname);
  });

  $effect(() => {
    seedClientStores({
      characters,
      abyssVersionNumber: data.abyssVersionNumber,
      stygianVersionNumber: data.stygianVersionNumber,
    });
  });

  onMount(() => {
    const detachDebug = installDebugHitTest();
    initDisplayPreferences();
    syncBackgroundToPath(page.url.pathname);

    bootstrapClient({
      characters,
      abyssVersionNumber: data.abyssVersionNumber,
      stygianVersionNumber: data.stygianVersionNumber,
    }).catch(console.error);

    return detachDebug;
  });
</script>

<svelte:head>
  <link rel="icon" href={$faviconDataUri} type="image/png" />
  <title>{page.data.seo?.title ?? "Lightkeepers"}</title>
  <meta
    name="description"
    content={page.data.seo?.description ??
      "Genshin Impact team and character recommendations"}
  />
</svelte:head>

<div
  class="relative min-h-screen w-full flex flex-col items-center"
  style={$displayPreferences.themeColors
    ? Object.entries($displayPreferences.themeColors)
        .map(([key, val]) => `--${key}:${val}`)
        .join(";")
    : ""}
>
  {#if $backgroundVisible}
    <div
      class="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
      style="background-image: url('https://images.lightkeepers.moe/site/lightkeepers_dark.webp')"
    ></div>
    <div
      class="fixed inset-0 -z-10 backdrop-blur-xs bg-overlay"
      class:bg-dark={page.url.pathname === `/`}
      class:bg-darker={page.url.pathname !== `/`}
    ></div>
  {/if}
  <NavBar />
  <PatchNotesPopup note={data.latestPatchNote} />

  <div class="h-12 w-full"></div>
  <div class="w-full flex flex-col items-center pt-6 md:pt-8">
    {#key page.url.pathname}
      <div
        class="w-full flex flex-col items-center"
        in:fly={{ y: 12, duration: 280, easing: cubicOut }}
      >
        {@render children()}
      </div>
    {/key}
  </div>

  <!-- Footer -->
  <footer
    class="w-full flex items-center justify-center gap-2 py-8 mt-auto text-xs"
    style="color: var(--foreground-mid);"
  >
    <span>© Lightkeepers</span>
    <span aria-hidden="true">·</span>
    <a href={patchNotesPath} class="footer-link">Patch notes</a>
    <span aria-hidden="true">·</span>
    <a
      href="https://github.com/woopxwoop/lightkeepers"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >
      GitHub
    </a>
    <span aria-hidden="true">·</span>
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >
      Discord
    </a>
  </footer>
</div>

<style>
  .bg-overlay {
    transition: background-color 0.5s ease-out;
  }
  .bg-dark {
    background-color: color-mix(in oklab, black 75%, transparent);
  }

  .bg-darker {
    background-color: color-mix(in oklab, black 80%, transparent);
  }

  .footer-link {
    color: var(--accent-1);
    text-decoration: none;
  }
  .footer-link:hover {
    text-decoration: underline;
  }
</style>
