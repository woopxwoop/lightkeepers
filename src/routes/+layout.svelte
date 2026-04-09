<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    charactersOwned,
    allTeamsAbyss,
    allTeamsStygian,
    setVersionNumbers,
    writeTeamsOwned,
    writeNearMissTeams,
  } from "$lib/stores";
  import { onMount, tick } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import "../app.css";

  type DebugWindow = Window & {
    __lkDebugHitTest?: {
      enable: () => void;
      disable: () => void;
      status: () => boolean;
    };
  };

  let { data, children } = $props();
  let characters: Character[] = $derived(data.characters);

  $inspect($charactersOwned);

  onMount(() => {
    // ── Wire up version numbers from server data ────────────────────────
    setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);

    // ── Pre-populate all-teams stores from SSR data (no extra fetch) ───
    allTeamsAbyss.set(data.allTeamsAbyss);
    allTeamsStygian.set(data.allTeamsStygian);

    // ── Debug hit-test helper ──────────────────────────────────────────
    const debugWindow = window as DebugWindow;
    const attachHitTestLogging = () => {
      const clickHandler = (event: MouseEvent) => {
        const target = event.target as Element | null;
        const elementAtPoint = document.elementFromPoint(
          event.clientX,
          event.clientY,
        );
        console.log("[LK HITTEST]", {
          x: event.clientX,
          y: event.clientY,
          target,
          elementAtPoint,
          targetPath: target?.closest("[class]")?.className ?? null,
          atPointPath: elementAtPoint?.closest("[class]")?.className ?? null,
        });
      };

      document.addEventListener("click", clickHandler, true);
      console.info("[LK HITTEST] enabled");
      return () => {
        document.removeEventListener("click", clickHandler, true);
        console.info("[LK HITTEST] disabled");
      };
    };

    let detachHitTestLogging: (() => void) | null = null;
    const isEnabled = () => localStorage.getItem("lk_debug_hit_test") === "1";
    const syncDebug = () => {
      if (isEnabled() && !detachHitTestLogging) {
        detachHitTestLogging = attachHitTestLogging();
      }
      if (!isEnabled() && detachHitTestLogging) {
        detachHitTestLogging();
        detachHitTestLogging = null;
      }
    };

    debugWindow.__lkDebugHitTest = {
      enable: () => {
        localStorage.setItem("lk_debug_hit_test", "1");
        syncDebug();
      },
      disable: () => {
        localStorage.setItem("lk_debug_hit_test", "0");
        syncDebug();
      },
      status: () => isEnabled(),
    };

    syncDebug();

    // ── Bootstrap roster + owned teams ────────────────────────────────
    const bootstrap = async () => {
      const cachedJSON = localStorage.getItem("charactersOwned");
      const cachedOwned: CharacterOwned[] | undefined = cachedJSON
        ? JSON.parse(cachedJSON)
        : undefined;

      let finalList: CharacterOwned[];
      if (cachedOwned) {
        finalList = characters.map((c) => {
          const cached = cachedOwned.find((c2) => c2.id === c.id);
          if (cached && cached.enka_icon) return cached;
          if (cached) {
            let char = cached;
            char.enka_icon = c.enka_icon;
            return char;
          }
          return {
            ...c,
            isOwned: true,
          };
        });
      } else {
        finalList = characters.map((c) => ({
          ...c,
          isOwned: true,
        }));
      }

      charactersOwned.set(finalList);

      // Single round-trip for both abyss + stygian owned teams
      await writeTeamsOwned(finalList);

      // Near-miss data loads separately (only needed on Pulls page,
      // but we prefetch here so it's ready when the user navigates there)
      writeNearMissTeams(finalList).catch(console.error);

      updateUnderline();
    };

    void bootstrap();

    return () => {
      if (detachHitTestLogging) {
        detachHitTestLogging();
        detachHitTestLogging = null;
      }
    };
  });

  const homePath = resolve("/");
  const recommendationsPath = "/recommendations";
  const pullsPath = resolve("/pulls");
  const settingsPath = resolve("/settings");

  // ── Sliding underline ──────────────────────────────────────────────────
  let navLinks: Record<string, HTMLElement | null> = {
    recommendations: null,
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
  <title>Lightkeepers</title>
  <meta
    name="description"
    content="Genshin Impact team and character recommendations"
  />
</svelte:head>

<div class="w-full flex flex-col items-center">
  <nav
    class="nav-bar w-full fixed top-0 z-10 flex items-center justify-between px-4 md:px-8 h-12"
  >
    <a
      href={homePath}
      class="nav-logo shrink-0"
      aria-current={page.url.pathname === homePath ? "page" : undefined}
    >
      LIGHTKEEPERS
    </a>

    <div
      class="flex items-center gap-3 md:gap-6 relative"
      bind:this={linksContainer}
    >
      <a
        href={recommendationsPath}
        class="nav-link"
        aria-current={(page.url.pathname as string) === recommendationsPath
          ? "page"
          : undefined}
        bind:this={navLinks.recommendations}>Recommendations</a
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
