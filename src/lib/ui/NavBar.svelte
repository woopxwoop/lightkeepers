<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick } from "svelte";

  const homePath = resolve("/");
  const teamsPath = "/teams";
  const pullsPath = resolve("/pulls");
  const settingsPath = resolve("/settings");

  // ── Sliding underline ──────────────────────────────────────────────────
  let navLinks: Record<string, HTMLElement | null> = {
    teams: null,
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

<nav
  class="nav-bar w-full fixed top-0 z-10 flex items-center justify-between px-4 md:px-8 h-16"
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
      href={teamsPath}
      class="nav-link"
      aria-current={(page.url.pathname as string) === teamsPath ? "page" : undefined}
      bind:this={navLinks.teams}
      >Teams</a
    >
    <a
      href={pullsPath}
      class="nav-link"
      aria-current={page.url.pathname === pullsPath ? "page" : undefined}
      bind:this={navLinks.pulls}
      >Pulls</a
    >
    <a
      href={settingsPath}
      class="nav-link"
      aria-current={page.url.pathname === settingsPath ? "page" : undefined}
      bind:this={navLinks.settings}
      >Settings</a
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

