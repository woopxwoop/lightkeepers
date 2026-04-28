<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Character } from "$lib/definitions";
  import { bootstrapClient } from "$lib/app/bootstrapClient";
  import { installDebugHitTest } from "$lib/app/debugHitTest";
  import { initDisplayPreferences } from "$lib/stores";
  import NavBar from "$lib/ui/NavBar.svelte";
  import "../app.css";

  let { data, children } = $props();
  let characters: Character[] = $derived(data.characters);

  onMount(() => {
    const detachDebug = installDebugHitTest();
    initDisplayPreferences();

    bootstrapClient({
      characters,
      abyssVersionNumber: data.abyssVersionNumber,
      stygianVersionNumber: data.stygianVersionNumber,
      allTeamsAbyss: data.allTeamsAbyss,
      allTeamsStygian: data.allTeamsStygian,
    }).catch(console.error);

    return detachDebug;
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} type="image/svg+xml" />
  <title>{page.data.seo?.title ?? "Lightkeepers"}</title>
  <meta
    name="description"
    content={page.data.seo?.description ??
      "Genshin Impact team and character recommendations"}
  />
</svelte:head>

<div class="relative min-h-screen w-full flex flex-col items-center">
  <div
    class="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
    style="background-image: url('/lightkeepers_dark.png')"
  ></div>
  <div
    class="fixed inset-0 -z-10 backdrop-blur-xs bg-overlay"
    class:bg-dark={page.url.pathname === `/`}
    class:bg-darker={page.url.pathname !== `/`}
  ></div>
  <NavBar />

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
</style>
