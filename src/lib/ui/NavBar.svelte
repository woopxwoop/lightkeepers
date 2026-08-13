<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick, untrack } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";
  import IconListChecks from "$lib/ui/icons/IconListChecks.svelte";
  import { DISCORD_INVITE_URL } from "$lib/site";
  import { backgroundVisible, toggleBackgroundVisible } from "$lib/stores";
  import { plannerItineraryOpen } from "$lib/planner-itinerary-open";

  const homePath = resolve("/");
  const abyssPath = resolve("/tools/abyss");
  const stygianPath = resolve("/tools/stygian");
  const pullsPath = resolve("/tools/pulls");
  const plannerPath = resolve("/tools/planner");
  const teamsPath = resolve("/teams");
  const charactersPath = resolve("/characters");
  const settingsPath = resolve("/settings");
  const patchNotesPath = resolve("/patch-notes");

  const toolsLinks = [
    {
      label: "Abyss",
      path: abyssPath,
      match: "exact" as const,
      preload: "hover" as const,
    },
    {
      label: "Stygian",
      path: stygianPath,
      match: "prefix" as const,
      preload: "hover" as const,
    },
    { label: "Pulls", path: pullsPath, match: "exact" as const },
    {
      label: "Planner",
      path: plannerPath,
      match: "prefix" as const,
    },
  ] as const;

  const settingsLinks = [
    {
      label: "Roster",
      path: resolve("/settings"),
      tab: "roster",
      icon: "users" as const,
    },
    {
      label: "Account",
      path: `${resolve("/settings")}?tab=account`,
      tab: "account",
      icon: "cloud" as const,
    },
    {
      label: "Display",
      path: `${resolve("/settings")}?tab=display`,
      tab: "display",
      icon: "monitor" as const,
    },
  ] as const;

  const mainLinks = [
    { label: "Teams", path: teamsPath, match: "prefix" as const },
    { label: "Characters", path: charactersPath, match: "prefix" as const },
  ] as const;

  function isPathActive(path: string, match: "exact" | "prefix"): boolean {
    if (match === "exact") return page.url.pathname === path;
    const current = page.url.pathname;
    return current === path || current.startsWith(`${path}/`);
  }

  function isMainActive(link: (typeof mainLinks)[number]): boolean {
    return isPathActive(link.path, link.match);
  }

  function isToolActive(link: (typeof toolsLinks)[number]): boolean {
    return isPathActive(link.path, link.match);
  }

  const onToolsPage = $derived(isPathActive(resolve("/tools"), "prefix"));
  const onPlannerPage = $derived(isPathActive(plannerPath, "prefix"));
  const hideFarmTrigger = $derived(
    page.url.pathname === homePath || onPlannerPage,
  );

  const onSettingsPage = $derived(
    page.url.pathname.startsWith(resolve("/settings")),
  );

  let scrolled = $state(false);

  $effect(() => {
    const onScroll = () => {
      scrolled = window.scrollY > 30;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });

  // ── Hover sub-rows (Tools + Settings) ──────────────────────────────
  let toolsHovered = $state(false);
  let settingsHovered = $state(false);
  let toolsLeaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let settingsLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function onToolsEnter() {
    if (toolsLeaveTimeout) {
      clearTimeout(toolsLeaveTimeout);
      toolsLeaveTimeout = null;
    }
    if (settingsLeaveTimeout) {
      clearTimeout(settingsLeaveTimeout);
      settingsLeaveTimeout = null;
    }
    toolsHovered = true;
    settingsHovered = false;
  }

  function onToolsLeave() {
    toolsLeaveTimeout = setTimeout(() => {
      toolsHovered = false;
    }, 120);
  }

  function onSettingsEnter() {
    if (settingsLeaveTimeout) {
      clearTimeout(settingsLeaveTimeout);
      settingsLeaveTimeout = null;
    }
    if (toolsLeaveTimeout) {
      clearTimeout(toolsLeaveTimeout);
      toolsLeaveTimeout = null;
    }
    settingsHovered = true;
    toolsHovered = false;
  }

  function onSettingsLeave() {
    settingsLeaveTimeout = setTimeout(() => {
      settingsHovered = false;
    }, 120);
  }

  const navSubOpen = $derived(toolsHovered || settingsHovered);

  // ── Mobile drawer ──────────────────────────────────────────────────────
  let mobileOpen = $state(false);
  let toolsDrawerExpanded = $state(false);
  let settingsDrawerExpanded = $state(false);
  let drawerEl: HTMLElement | null = $state(null);
  let hamburgerEl: HTMLButtonElement | null = $state(null);
  let drawerWasOpen = false;
  let closedByNavigation = false;

  $effect(() => {
    // Include search so Settings ?tab= changes close the mobile drawer too.
    page.url.href;
    untrack(() => {
      if (mobileOpen) {
        closedByNavigation = true;
        mobileOpen = false;
        toolsDrawerExpanded = false;
        settingsDrawerExpanded = false;
      }
    });
  });

  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  $effect(() => {
    if (mobileOpen) {
      drawerWasOpen = true;
      closedByNavigation = false;

      tick().then(() => {
        drawerEl?.querySelector<HTMLElement>("a[href]")?.focus();
      });

      function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          mobileOpen = false;
          toolsDrawerExpanded = false;
          settingsDrawerExpanded = false;
          return;
        }
        if (e.key !== "Tab" || !drawerEl) return;

        const focusable = Array.from(
          drawerEl.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.closest("[inert]"));
        if (focusable.length < 2) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }

      window.addEventListener("keydown", onKeydown);
      return () => window.removeEventListener("keydown", onKeydown);
    } else if (drawerWasOpen && !closedByNavigation) {
      drawerWasOpen = false;
      hamburgerEl?.focus();
    } else if (closedByNavigation) {
      drawerWasOpen = false;
      closedByNavigation = false;
    }
  });
</script>

<nav
  class="nav-bar w-full fixed top-0 z-[100] flex flex-col transition-all duration-300 {scrolled
    ? 'opaque-bg'
    : 'nav-initial'}"
  class:nav-sub-open={navSubOpen}
>
  <!-- Main row -->
  <div class="nav-row flex items-center justify-between h-16">
    <div class="nav-brand shrink-0 flex items-center gap-2.5">
      <button
        type="button"
        class="nav-mark-btn"
        class:bg-on={$backgroundVisible}
        aria-pressed={$backgroundVisible}
        aria-label={$backgroundVisible
          ? "Hide lighthouse background"
          : "Show lighthouse background"}
        onclick={() => toggleBackgroundVisible(page.url.pathname)}
      >
        <img
          class="nav-mark"
          src="/lightkeepers-mark.png"
          alt=""
          width="28"
          height="28"
          decoding="async"
        />
      </button>
      <a
        href={homePath}
        class="nav-wordmark"
        aria-current={page.url.pathname === homePath ? "page" : undefined}
      >
        Lightkeepers
      </a>
    </div>

    <!-- Desktop links -->
    <div class="hidden md:flex items-center gap-6 relative">
      <div class="nav-menu-item">
        <a
          href={abyssPath}
          class="nav-link"
          onmouseenter={onToolsEnter}
          onmouseleave={onToolsLeave}
          onfocus={onToolsEnter}
          onblur={onToolsLeave}>Tools</a
        >

        <div
          class="nav-sub-row"
          class:nav-sub-row-open={toolsHovered}
          inert={!toolsHovered}
          role="presentation"
          onmouseenter={onToolsEnter}
          onmouseleave={onToolsLeave}
          onfocusin={onToolsEnter}
          onfocusout={onToolsLeave}
        >
          {#each toolsLinks as link}
            <a
              href={link.path}
              class="nav-sub-link"
              data-sveltekit-preload-data={"preload" in link
                ? link.preload
                : undefined}
              aria-current={isToolActive(link) ? "page" : undefined}
              >{link.label}</a
            >
          {/each}
        </div>
      </div>

      {#each mainLinks as link}
        <a
          href={link.path}
          class="nav-link"
          data-sveltekit-preload-data={"preload" in link
            ? link.preload
            : undefined}
          aria-current={isMainActive(link) ? "page" : undefined}>{link.label}</a
        >
      {/each}

      <div class="nav-farm-cluster">
        <div class="nav-menu-item">
          <a
            href={settingsPath}
            class="nav-link"
            aria-current={onSettingsPage ? "page" : undefined}
            onmouseenter={onSettingsEnter}
            onmouseleave={onSettingsLeave}
            onfocus={onSettingsEnter}
            onblur={onSettingsLeave}>Settings</a
          >

          <div
            class="nav-sub-row"
            class:nav-sub-row-open={settingsHovered}
            inert={!settingsHovered}
            role="presentation"
            onmouseenter={onSettingsEnter}
            onmouseleave={onSettingsLeave}
            onfocusin={onSettingsEnter}
            onfocusout={onSettingsLeave}
          >
            {#each settingsLinks as link}
              {@const activeTab = page.url.searchParams.get("tab") ?? "roster"}
              <a
                href={link.path}
                class="nav-sub-link"
                aria-current={onSettingsPage && activeTab === link.tab
                  ? "page"
                  : undefined}>{link.label}</a
              >
            {/each}
          </div>
        </div>

        {#if !hideFarmTrigger}
          <button
            type="button"
            class="nav-farm-btn"
            aria-label="Farming"
            aria-haspopup="dialog"
            aria-expanded={$plannerItineraryOpen}
            onclick={() => plannerItineraryOpen.set(true)}
          >
            <IconListChecks size={18} />
          </button>
        {/if}
      </div>
    </div>

    <div class="nav-end flex items-center gap-1">
      {#if !hideFarmTrigger}
        <div class="md:hidden">
          <button
            type="button"
            class="nav-farm-btn"
            aria-label="Farming"
            aria-haspopup="dialog"
            aria-expanded={$plannerItineraryOpen}
            onclick={() => {
              plannerItineraryOpen.set(true);
              mobileOpen = false;
            }}
          >
            <IconListChecks size={18} />
          </button>
        </div>
      {/if}

      <!-- Hamburger button (mobile only) -->
      <button
        class="hamburger md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        bind:this={hamburgerEl}
        onclick={() => {
          mobileOpen = !mobileOpen;
          if (!mobileOpen) {
            toolsDrawerExpanded = false;
            settingsDrawerExpanded = false;
          } else {
            toolsDrawerExpanded = onToolsPage;
            settingsDrawerExpanded = onSettingsPage;
          }
        }}
      >
        <span class="bar" class:open={mobileOpen}></span>
        <span class="bar" class:open={mobileOpen}></span>
        <span class="bar" class:open={mobileOpen}></span>
      </button>
    </div>
  </div>
</nav>

<!-- Backdrop -->
{#if mobileOpen}
  <div
    class="drawer-backdrop"
    role="presentation"
    transition:fade={{ duration: 200 }}
    onclick={() => {
      mobileOpen = false;
      toolsDrawerExpanded = false;
      settingsDrawerExpanded = false;
    }}
  ></div>
{/if}

<!-- Side drawer -->
{#if mobileOpen}
  <div
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-label="Navigation menu"
    bind:this={drawerEl}
    transition:fly={{
      x: prefersReducedMotion.current ? 0 : 300,
      duration: prefersReducedMotion.current ? 0 : 280,
    }}
  >
    <div class="drawer-glow" aria-hidden="true"></div>

    <nav class="drawer-nav" aria-label="Primary">
      <p class="eyebrow drawer-section-label">Navigate</p>

      <div class="drawer-group">
        <button
          type="button"
          class="drawer-item drawer-group-toggle"
          class:is-active={onToolsPage && !toolsDrawerExpanded}
          style="--i: 0"
          aria-expanded={toolsDrawerExpanded}
          onclick={() => {
            toolsDrawerExpanded = !toolsDrawerExpanded;
            if (toolsDrawerExpanded) settingsDrawerExpanded = false;
          }}
        >
          <span class="drawer-item-label">Tools</span>
          <span
            class="drawer-chevron"
            class:drawer-chevron-open={toolsDrawerExpanded}
            aria-hidden="true"
          >
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>

        <div
          class="drawer-sub"
          class:drawer-sub-open={toolsDrawerExpanded}
          inert={!toolsDrawerExpanded}
        >
          {#each toolsLinks as link, i}
            <a
              href={link.path}
              class="drawer-item drawer-item-sub"
              class:is-active={isToolActive(link)}
              style="--i: {1 + i}"
              data-sveltekit-preload-data={"preload" in link
                ? link.preload
                : undefined}
              aria-current={isToolActive(link) ? "page" : undefined}
            >
              <span class="drawer-item-label">{link.label}</span>
            </a>
          {/each}
        </div>
      </div>

      {#each mainLinks as link, i}
        <a
          href={link.path}
          class="drawer-item"
          class:is-active={isMainActive(link)}
          style="--i: {toolsLinks.length + 1 + i}"
          data-sveltekit-preload-data={"preload" in link
            ? link.preload
            : undefined}
          aria-current={isMainActive(link) ? "page" : undefined}
        >
          <span class="drawer-item-label">{link.label}</span>
        </a>
      {/each}

      <div class="drawer-group">
        <p class="eyebrow drawer-section-label">Account</p>
        <button
          type="button"
          class="drawer-item drawer-group-toggle"
          class:is-active={onSettingsPage && !settingsDrawerExpanded}
          style="--i: {toolsLinks.length + 1 + mainLinks.length}"
          aria-expanded={settingsDrawerExpanded}
          aria-current={onSettingsPage ? "page" : undefined}
          onclick={() => {
            settingsDrawerExpanded = !settingsDrawerExpanded;
            if (settingsDrawerExpanded) toolsDrawerExpanded = false;
          }}
        >
          <span class="drawer-item-icon" aria-hidden="true">
            <IconCog size={18} />
          </span>
          <span class="drawer-item-label">Settings</span>
          <span
            class="drawer-chevron"
            class:drawer-chevron-open={settingsDrawerExpanded}
            aria-hidden="true"
          >
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>

        <div
          class="drawer-sub"
          class:drawer-sub-open={settingsDrawerExpanded}
          inert={!settingsDrawerExpanded}
        >
          {#each settingsLinks as link, i}
            {@const activeTab = page.url.searchParams.get("tab") ?? "roster"}
            {@const subActive = onSettingsPage && activeTab === link.tab}
            <a
              href={link.path}
              class="drawer-item drawer-item-sub"
              class:is-active={subActive}
              style="--i: {toolsLinks.length + 2 + mainLinks.length + i}"
              aria-current={subActive ? "page" : undefined}
            >
              <span class="drawer-item-icon" aria-hidden="true">
                {#if link.icon === "users"}
                  <IconUser size={16} />
                {:else if link.icon === "cloud"}
                  <IconCloudUp size={16} />
                {:else}
                  <IconMonitor size={16} />
                {/if}
              </span>
              <span class="drawer-item-label">{link.label}</span>
            </a>
          {/each}
        </div>
      </div>
    </nav>

    <div class="drawer-foot">
      <a
        class="drawer-item"
        href={patchNotesPath}
        class:is-active={page.url.pathname === patchNotesPath ||
          page.url.pathname.startsWith(`${patchNotesPath}/`)}
      >
        <span class="drawer-item-label">Patch notes</span>
      </a>
      <a
        class="drawer-item"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="drawer-item-icon" aria-hidden="true">
          <img
            src="https://api.lightkeepers.moe/site/guoba_lightkeepers.webp"
            alt=""
            class="drawer-guoba"
          />
        </span>
        <span class="drawer-item-label">Discord</span>
      </a>
    </div>
  </div>
{/if}

<style>
  .nav-bar {
    pointer-events: none;
    transition:
      background-color 0.4s ease,
      height 0.25s ease,
      border-color 0.4s ease;
    height: 4rem;
    border-bottom: var(--border-width) solid transparent;
  }

  .nav-row {
    padding-left: var(--page-gutter);
    padding-right: var(--page-gutter);
  }

  .nav-bar.nav-sub-open {
    height: 6.5rem;
  }

  .nav-initial {
    background: color-mix(in srgb, black 10%, transparent);
  }

  .opaque-bg {
    background: color-mix(in srgb, var(--background-color) 88%, transparent);
    backdrop-filter: blur(12px);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .nav-brand {
    pointer-events: auto;
  }

  .nav-mark-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .nav-wordmark {
    font-family: var(--font-brand);
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: var(--tracking-brand);
    color: var(--foreground-color);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
  }

  .nav-wordmark:hover {
    color: var(--accent-1);
  }

  /* Designed mark is dark-on-black — invert so it reads on the nav. */
  .nav-mark {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
    filter: invert(1);
    transition: opacity 0.2s ease;
  }

  .nav-mark-btn:not(.bg-on) .nav-mark {
    opacity: 0.55;
  }

  .nav-mark-btn:hover .nav-mark {
    opacity: 0.85;
  }

  .nav-mark-btn:not(.bg-on):hover .nav-mark {
    opacity: 0.75;
  }

  .nav-link {
    position: relative;
    padding-bottom: 2px;
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1.25;
    color: var(--foreground-mid);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
    pointer-events: auto;
  }

  .nav-bar > div {
    pointer-events: auto;
  }

  /* Gold underline bar. */
  .nav-link::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.5px;
    pointer-events: none;
    background: var(--accent-1);
    opacity: 0;
    transform: scaleX(0.55);
    transform-origin: center;
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .nav-link:hover,
  .nav-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  .nav-link:hover::after,
  .nav-link[aria-current="page"]::after {
    opacity: 1;
    transform: scaleX(1);
  }

  /* ── Hover sub-row (Tools / Settings) ── */
  .nav-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    /* Match other nav-link flex items so the parent doesn't sit low */
    align-self: center;
  }

  .nav-sub-row {
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-4);
    padding-bottom: var(--space-2);
    white-space: nowrap;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    transition:
      max-height 0.2s ease,
      opacity 0.2s ease;
  }

  .nav-sub-row.nav-sub-row-open {
    max-height: 2.5rem;
    opacity: 1;
    overflow: visible;
    pointer-events: auto;
  }

  .nav-sub-link {
    font-size: var(--text-md);
    letter-spacing: 0.03em;
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--foreground-mid);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
    pointer-events: auto;
  }

  .nav-sub-link:hover,
  .nav-sub-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  /* ── Farming (nav sheet) ── */
  .nav-farm-cluster {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .nav-farm-btn {
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--foreground-mid);
    cursor: pointer;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
  }

  .nav-farm-btn:hover,
  .nav-farm-btn[aria-expanded="true"] {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  /* ── Hamburger ── */
  .hamburger {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    padding: 0.5rem;
    margin-right: -0.25rem;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--control-duration) var(--control-ease);
  }

  .hamburger:hover {
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .bar {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--foreground-color);
    border-radius: 2px;
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
    transform-origin: center;
  }

  .bar:nth-child(1).open {
    transform: translateY(7px) rotate(45deg);
  }
  .bar:nth-child(2).open {
    opacity: 0;
    transform: scaleX(0);
  }
  .bar:nth-child(3).open {
    transform: translateY(-7px) rotate(-45deg);
  }

  /* ── Drawer ── */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: color-mix(in srgb, black 55%, transparent);
    backdrop-filter: blur(2px);
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    width: min(300px, 88vw);
    height: 100%;
    padding: 4.75rem 0 1rem;
    overflow: hidden;
    background: var(--surface-raised);
    /* Cream hairline on mid surface — avoid muddy low-opacity gold */
    border-left: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 22%, transparent);
    box-shadow: -16px 0 48px color-mix(in srgb, black 50%, transparent);
  }

  .drawer-glow {
    position: absolute;
    inset: 0 auto 0 0;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      transparent 8%,
      color-mix(in srgb, var(--accent-1) 55%, transparent) 42%,
      color-mix(in srgb, var(--accent-2) 35%, transparent) 58%,
      transparent 92%
    );
    opacity: 0.85;
  }

  .drawer-nav {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0.5rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .drawer-nav::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .drawer-section-label {
    margin: 0.35rem 0.75rem 0.4rem;
    font-size: 0.68rem;
    color: color-mix(in srgb, var(--foreground-mid) 70%, transparent);
  }

  .drawer-group .drawer-section-label {
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 16%, transparent);
  }

  .drawer-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.78rem 0.9rem;
    border-radius: var(--radius-md);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--foreground-mid);
    text-decoration: none;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
    animation: drawer-item-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(40ms * var(--i, 0));
  }

  .drawer-item:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 7%, transparent);
  }

  .drawer-item.is-active {
    color: var(--accent-2);
    background: var(--surface-selected);
  }

  .drawer-item.is-active::before {
    content: "";
    position: absolute;
    left: 0.2rem;
    top: 22%;
    bottom: 22%;
    width: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent-1);
  }

  .drawer-item-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: currentColor;
    flex: 0 0 auto;
  }

  .drawer-item-label {
    flex: 1 1 auto;
    min-width: 0;
  }

  .drawer-group {
    display: flex;
    flex-direction: column;
  }

  .drawer-chevron {
    margin-left: auto;
    flex-shrink: 0;
    transition: transform 0.2s ease;
    color: currentColor;
    opacity: 0.75;
  }

  .drawer-chevron-open {
    transform: rotate(180deg);
  }

  .drawer-sub {
    display: flex;
    flex-direction: column;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }

  .drawer-sub-open {
    max-height: 16rem;
  }

  .drawer-item-sub {
    padding-left: 1.15rem;
    font-size: var(--text-md);
  }

  .drawer-foot {
    position: relative;
    z-index: 1;
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 0.85rem 0.75rem 0.85rem;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 16%, transparent);
  }

  .drawer-guoba {
    width: 22px;
    height: 22px;
    object-fit: contain;
    display: block;
  }

  @keyframes drawer-item-in {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-item {
      animation: none;
    }

    .nav-link::after {
      transition: none;
    }
  }
</style>
