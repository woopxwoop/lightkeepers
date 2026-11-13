<script lang="ts">
  /**
   * Root shell: seed stores from SSR, then bootstrapClient on mount
   * (background /api/static warm). Synced documents (roster, goals) follow
   * the session from here. Page chrome is NavBar + slot.
   */
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Character } from "#lib/definitions.js";
  import {
    bootstrapClient,
    seedClientStores,
  } from "#lib/app/bootstrapClient.js";
  import { goalsSync, watchGoalsConflicts } from "#lib/app/goals-sync.js";
  import {
    feedRosterStores,
    rosterSync,
    watchRosterConflicts,
  } from "#lib/app/roster-sync.js";
  import { clearRosterInventory } from "#lib/app/roster-inventory.js";
  import {
    cancelGoalsSyncConflict,
    goalsSyncConflict,
  } from "#lib/app/goals-sync-conflict.js";
  import {
    cancelRosterSyncConflict,
    rosterSyncConflict,
  } from "#lib/app/roster-sync-conflict.js";
  import { authClient } from "#lib/auth-client.js";
  import { installChunkLoadRecovery } from "#lib/app/chunkLoadRecovery.js";
  import { installDebugHitTest } from "#lib/app/debugHitTest.js";
  import { rememberNavigation } from "#lib/nav-history.js";
  import { clearOrphanBodyScrollLock } from "#lib/ui/body-scroll-lock.js";
  import {
    displayPreferences,
    initDisplayPreferences,
    setVersionNumbers,
    backgroundVisible,
    syncBackgroundToPath,
  } from "#lib/stores.js";
  import NavBar from "#lib/ui/NavBar.svelte";
  import PatchNotesPopup from "#lib/ui/components/PatchNotesPopup.svelte";
  import PlannerItinerarySheet from "#lib/ui/components/PlannerItinerarySheet.svelte";
  import ResearchChatSheet from "#lib/ui/components/ResearchChatSheet.svelte";
  import AccountSettingsModal from "#lib/ui/components/AccountSettingsModal.svelte";
  import GoalsSyncConflictPopup from "#lib/ui/components/GoalsSyncConflictPopup.svelte";
  import RosterSyncConflictPopup from "#lib/ui/components/RosterSyncConflictPopup.svelte";
  import { resolve } from "$app/paths";
  import { DISCORD_INVITE_URL } from "#lib/site.js";
  import { getSiteBackgroundUrl } from "#lib/utils.js";
  import { browser, dev } from "$app/env";
  import "../app.css";

  const patchNotesPath = resolve("patch-notes");

  if (typeof window !== "undefined") {
    installChunkLoadRecovery();
  }

  afterNavigate(({ from, shallow, type }) => {
    if (shallow && type === "goto") return;

    rememberNavigation(from?.url);
    clearOrphanBodyScrollLock();
  });

  let { data, children } = $props();
  let characters: Character[] = $derived(data.characters);

  const session = authClient.useSession();
  const rosterView = rosterSync().view;
  /** Account the per-account caches (inventory, open popup) belong to. */
  let lastUserId: string | null | undefined = undefined;
  $effect(() => {
    if ($session.isPending) return;
    const id = $session.data?.user?.id ?? null;
    // Synced documents follow every settled session, the first one included.
    // Each account reads and writes only its own slot.
    // Close the previous account's prompt before switching, so the next
    // account's open question is not dismissed as soon as it appears.
    if (lastUserId !== undefined && lastUserId !== id) {
      clearRosterInventory();
      cancelRosterSyncConflict();
      cancelGoalsSyncConflict();
    }
    goalsSync().setAccount(id);
    rosterSync().setAccount(id);
    lastUserId = id;
  });

  // Pages read `charactersOwned`; it is fed from the roster document only.
  $effect(() => {
    feedRosterStores(characters, $rosterView);
  });

  // Route defaults while following route; after a manual toggle, persisted choice wins.
  syncBackgroundToPath(page.url.pathname);
  $effect(() => {
    syncBackgroundToPath(page.url.pathname);
  });

  // Version globals are module-level and child effects can run before this
  // layout's, so seed them before those components exist. The roster and
  // charactersHydrated wait for the session (feedRosterStores), so
  // /characters still renders LoadingState for the server HTML.
  if (browser) {
    untrack(() =>
      setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber),
    );
  }
  $effect(() => {
    seedClientStores({
      abyssVersionNumber: data.abyssVersionNumber,
      stygianVersionNumber: data.stygianVersionNumber,
    });
  });

  // Returning to the tab re-reads synced documents so an edit starts from the
  // newest copy. A read never sends; unsent edits are merged and stay unsent.
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || $session.isPending) return;
      void goalsSync().refresh();
      void rosterSync().refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    // The roster's "Use cloud / Upload this device" question → popup.
    const stopConflicts = watchRosterConflicts(() => characters);
    const stopGoalsConflicts = watchGoalsConflicts();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stopConflicts();
      stopGoalsConflicts();
    };
  });

  onMount(() => {
    const detachDebug = installDebugHitTest();
    initDisplayPreferences();
    syncBackgroundToPath(page.url.pathname);

    bootstrapClient({
      abyssVersionNumber: data.abyssVersionNumber,
      stygianVersionNumber: data.stygianVersionNumber,
    });

    return detachDebug;
  });
</script>

<svelte:head>
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
      style="background-image: url('{getSiteBackgroundUrl()}')"
    ></div>
    <div
      class="fixed inset-0 -z-10 backdrop-blur-xs bg-overlay"
      class:bg-dark={page.url.pathname === `/`}
      class:bg-darker={page.url.pathname !== `/`}
    ></div>
  {/if}
  <NavBar />
  <PlannerItinerarySheet />
  {#if dev}
    <ResearchChatSheet />
  {/if}
  <AccountSettingsModal />
  {#if $rosterSyncConflict}
    <RosterSyncConflictPopup />
  {:else if $goalsSyncConflict}
    <GoalsSyncConflictPopup />
  {/if}
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
