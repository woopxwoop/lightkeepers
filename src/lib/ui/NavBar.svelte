<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick, untrack } from "svelte";
  import { fly, fade } from "svelte/transition";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";

  const homePath = resolve("/");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");
  const teamsPath = resolve("/teams");
  const charactersPath = resolve("/characters");
  const settingsPath = resolve("/settings");
  const settingsLinks = [
    { label: "Roster", path: resolve("/settings") },
    { label: "Account", path: `${resolve("/settings")}?tab=account` },
    { label: "Display", path: `${resolve("/settings")}?tab=display` },
  ] as const;

  const onSettingsPage = $derived(
    page.url.pathname.startsWith(resolve("/settings")),
  );

  // ── Sliding underline ──────────────────────────────────────────────────
  let navLinks: Record<string, HTMLElement | null> = {
    abyss: null,
    stygian: null,
    pulls: null,
    teams: null,
    characters: null,
    settings: null,
  };
  let linksContainer: HTMLElement | null = $state(null);
  let underlineLeft = $state(0);
  let underlineWidth = $state(0);
  let underlineReady = $state(false);
  let underlineFrame = 0;

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

  function scheduleUnderlineUpdate() {
    if (underlineFrame) cancelAnimationFrame(underlineFrame);
    underlineFrame = requestAnimationFrame(() => {
      underlineFrame = 0;
      updateUnderline();
    });
  }

  $effect(() => {
    if (!linksContainer) return;

    const observer = new ResizeObserver(scheduleUnderlineUpdate);
    observer.observe(linksContainer);

    const onResize = () => scheduleUnderlineUpdate();
    window.addEventListener("resize", onResize, { passive: true });
    scheduleUnderlineUpdate();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      if (underlineFrame) {
        cancelAnimationFrame(underlineFrame);
        underlineFrame = 0;
      }
    };
  });

  let scrolled = $state(false);

  $effect(() => {
    const onScroll = () => {
      scrolled = window.scrollY > 30;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });

  // ── Settings & Investment hover sub-row ──────────────────────────────
  let settingsHovered = $state(false);
  let settingsLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function onSettingsEnter() {
    if (settingsLeaveTimeout) {
      clearTimeout(settingsLeaveTimeout);
      settingsLeaveTimeout = null;
    }
    settingsHovered = true;
  }

  function onSettingsLeave() {
    settingsLeaveTimeout = setTimeout(() => {
      settingsHovered = false;
    }, 120);
  }

  // ── Mobile drawer ──────────────────────────────────────────────────────
  let mobileOpen = $state(false);
  let settingsDrawerExpanded = $state(false);
  let drawerEl: HTMLElement | null = $state(null);
  let hamburgerEl: HTMLButtonElement | null = $state(null);
  let drawerWasOpen = false;
  let closedByNavigation = false;

  $effect(() => {
    page.url.pathname;
    untrack(() => {
      if (mobileOpen) {
        closedByNavigation = true;
        mobileOpen = false;
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
  class="nav-bar w-full fixed top-0 z-30 flex flex-col transition-all duration-300 {scrolled
    ? 'opaque-bg'
    : 'nav-initial'}"
  class:nav-sub-open={settingsHovered}
>
  <!-- Main row -->
  <div
    class="nav-row flex items-center justify-between h-16"
  >
    <a
      href={homePath}
      class="nav-logo shrink-0 flex items-center gap-2.5"
      aria-current={page.url.pathname === homePath ? "page" : undefined}
    >
      <img
        class="nav-mark"
        src="/lightkeepers-mark.png"
        alt=""
        width="28"
        height="28"
        decoding="async"
      />
      <span>Lightkeepers</span>
    </a>

    <!-- Desktop links -->
    <div
      class="hidden md:flex items-center gap-6 relative"
      bind:this={linksContainer}
    >
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
        href={teamsPath}
        class="nav-link"
        aria-current={page.url.pathname.startsWith(teamsPath) ? "page" : undefined}
        bind:this={navLinks.teams}>Teams</a
      >
      <a
        href={charactersPath}
        class="nav-link"
        aria-current={page.url.pathname.startsWith(charactersPath)
          ? "page"
          : undefined}
        bind:this={navLinks.characters}>Characters</a
      >
      <div class="settings-item">
        <a
          href={settingsPath}
          class="nav-link"
          aria-current={onSettingsPage ? "page" : undefined}
          bind:this={navLinks.settings}
          onmouseenter={onSettingsEnter}
          onmouseleave={onSettingsLeave}
          onfocus={onSettingsEnter}
          onblur={onSettingsLeave}>Settings</a
        >

        <!-- Settings sub-links -->
        <div
          class="settings-sub-row"
          class:settings-sub-row-open={settingsHovered}
          inert={!settingsHovered}
          role="presentation"
          onmouseenter={onSettingsEnter}
          onmouseleave={onSettingsLeave}
          onfocusin={onSettingsEnter}
          onfocusout={onSettingsLeave}
        >
          {#each settingsLinks as link}
            {@const linkUrl = new URL(link.path, "https://lightkeepers.local")}
            {@const linkTab = linkUrl.searchParams.get("tab") ?? "roster"}
            {@const activeTab = page.url.searchParams.get("tab") ?? "roster"}
            <a
              href={link.path}
              class="nav-sub-link"
              aria-current={onSettingsPage && activeTab === linkTab
                ? "page"
                : undefined}>{link.label}</a
            >
          {/each}
        </div>
      </div>

      {#if underlineReady}
        <span
          class="nav-underline"
          style="left: {underlineLeft}px; width: {underlineWidth}px;"
        ></span>
      {/if}
    </div>

    <!-- Hamburger button (mobile only) -->
    <button
      class="hamburger md:hidden"
      aria-label={mobileOpen ? "Close menu" : "Open menu"}
      aria-expanded={mobileOpen}
      bind:this={hamburgerEl}
      onclick={() => (mobileOpen = !mobileOpen)}
    >
      <span class="bar" class:open={mobileOpen}></span>
      <span class="bar" class:open={mobileOpen}></span>
      <span class="bar" class:open={mobileOpen}></span>
    </button>
  </div>

</nav>

<!-- Backdrop -->
{#if mobileOpen}
  <div
    class="fixed inset-0 z-40 bg-black/60"
    role="presentation"
    transition:fade={{ duration: 200 }}
    onclick={() => {
      mobileOpen = false;
      settingsDrawerExpanded = false;
    }}
  ></div>
{/if}

<!-- Side drawer -->
{#if mobileOpen}
  <div
    class="drawer fixed top-0 right-0 h-full z-50 flex flex-col pt-24 px-8 gap-8"
    role="dialog"
    aria-modal="true"
    aria-label="Navigation menu"
    bind:this={drawerEl}
    transition:fly={{ x: 280, duration: 260 }}
  >
    <a
      href={abyssPath}
      class="drawer-link"
      aria-current={page.url.pathname === abyssPath ? "page" : undefined}
      >Abyss</a
    >
    <a
      href={stygianPath}
      class="drawer-link"
      aria-current={page.url.pathname === stygianPath ? "page" : undefined}
      >Stygian</a
    >
    <a
      href={pullsPath}
      class="drawer-link"
      aria-current={page.url.pathname === pullsPath ? "page" : undefined}
      >Pulls</a
    >
    <a
      href={teamsPath}
      class="drawer-link"
      aria-current={page.url.pathname.startsWith(teamsPath) ? "page" : undefined}
      >Teams</a
    >
    <a
      href={charactersPath}
      class="drawer-link"
      aria-current={page.url.pathname.startsWith(charactersPath)
        ? "page"
        : undefined}
      >Characters</a
    >

    <!-- Collapsible Settings section -->
    <div class="drawer-settings-group">
      <button
        class="drawer-link drawer-settings-toggle"
        aria-expanded={settingsDrawerExpanded}
        aria-current={onSettingsPage ? "page" : undefined}
        onclick={() => (settingsDrawerExpanded = !settingsDrawerExpanded)}
      >
        Settings
        <span
          class="drawer-chevron"
          class:drawer-chevron-open={settingsDrawerExpanded}
        >
          <IconChevronDown size={14} strokeWidth={2} />
        </span>
      </button>
      <div class="drawer-sub-links" class:drawer-sub-links-open={settingsDrawerExpanded} inert={!settingsDrawerExpanded}>
        {#each settingsLinks as link}
          {@const linkUrl = new URL(link.path, "https://lightkeepers.local")}
          {@const linkTab = linkUrl.searchParams.get("tab") ?? "roster"}
          {@const activeTab = page.url.searchParams.get("tab") ?? "roster"}
          <a
            href={link.path}
            class="drawer-link drawer-sub-link"
            aria-current={onSettingsPage && activeTab === linkTab
              ? "page"
              : undefined}
          >
            {link.label}
          </a>
        {/each}
      </div>
    </div>

    <img
      src="https://images.lightkeepers.moe/site/guoba_lightkeepers.webp"
      alt=""
      class="w-full h-auto mt-auto opacity-50"
    />
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

  .nav-logo {
    font-family: var(--font-brand);
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: var(--tracking-brand);
    color: var(--foreground-color);
    pointer-events: auto;
    transition: color var(--control-duration) var(--control-ease);
    text-decoration: none;
  }

  /* Designed mark is dark-on-black — invert so it reads on the nav. */
  .nav-mark {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
    filter: invert(1);
    transition: filter 0.2s ease;
  }

  .nav-logo:hover .nav-mark {
    filter: invert(1) brightness(1.15);
  }

  .nav-link {
    padding-bottom: 2px;
    border-bottom: 1.5px solid transparent;
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

  .nav-link:hover,
  .nav-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  .nav-underline {
    position: absolute;
    bottom: 0;
    height: 1.5px;
    pointer-events: none;
    /* Gold on page-base nav — intentional lamp accent, not a mid-surface wash */
    background: var(--accent-1);
    transition:
      left 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
      width 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  /* ── Settings sub-row ── */
  .settings-item {
    position: relative;
    display: flex;
    align-items: center;
    /* Match other nav-link flex items so Settings doesn't sit low */
    align-self: center;
  }

  .settings-sub-row {
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

  .settings-sub-row.settings-sub-row-open {
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

  /* ── Hamburger ── */
  .hamburger {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    padding: 6px;
    background: none;
    border: none;
    cursor: pointer;
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
  .drawer {
    width: min(240px, 80vw);
    background: color-mix(in srgb, var(--background-color) 97%, transparent);
    backdrop-filter: blur(16px);
    border-left: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .drawer-link {
    font-size: 1.15rem;
    letter-spacing: 0.06em;
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--foreground-mid);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
  }

  .drawer-link:hover,
  .drawer-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  /* ── Drawer settings collapsible ── */
  .drawer-settings-group {
    display: flex;
    flex-direction: column;
  }

  .drawer-settings-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    text-align: left;
  }

  .drawer-chevron {
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .drawer-chevron-open {
    transform: rotate(180deg);
  }

  .drawer-sub-links {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
    display: flex;
    flex-direction: column;
  }

  .drawer-sub-links-open {
    max-height: 10rem;
  }

  .drawer-sub-link {
    font-size: var(--text-base);
    margin-top: 0.6rem;
  }
</style>

