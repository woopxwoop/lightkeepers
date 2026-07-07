<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick, untrack } from "svelte";
  import { fly, fade } from "svelte/transition";

  const homePath = resolve("/");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");
  const settingsPath = resolve("/settings");
  const settingsLinks = [
    { label: "Roster", path: resolve("/settings/roster") },
    { label: "Account", path: resolve("/settings/account") },
    { label: "Display", path: resolve("/settings/display") },
  ] as const;

  const onSettingsPage = $derived(
    page.url.pathname.startsWith(resolve("/settings")),
  );

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

  // ── Settings hover sub-row ──────────────────────────────────────────────
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
    class="flex items-center justify-between h-16 pl-[10%] pr-[10%]"
  >
    <a
      href={homePath}
      class="nav-logo shrink-0"
      aria-current={page.url.pathname === homePath ? "page" : undefined}
    >
      LIGHTKEEPERS
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
      <div class="relative">
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
        class="settings-sub-row absolute left-1/2 -translate-x-1/2 top-full flex items-center gap-4 pt-4 pb-2 transition-all duration-200 whitespace-nowrap"
        class:settings-sub-row-open={settingsHovered}
        inert={!settingsHovered}
        role="presentation"
        onmouseenter={onSettingsEnter}
        onmouseleave={onSettingsLeave}
        onfocusin={onSettingsEnter}
        onfocusout={onSettingsLeave}
      >
        {#each settingsLinks as link}
          <a
            href={link.path}
            class="nav-sub-link"
            aria-current={page.url.pathname === link.path
              ? "page"
              : undefined}>{link.label}</a
          >
        {/each}
      </div>
      </div>

      {#if underlineReady}
        <span
          class="absolute bottom-0 h-[1.5px] pointer-events-none"
          style="
            left: {underlineLeft}px;
            width: {underlineWidth}px;
            background: var(--accent-1);
            transition: left 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                        width 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
          "
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

    <!-- Collapsible Settings section -->
    <div class="drawer-settings-group">
      <button
        class="drawer-link drawer-settings-toggle"
        aria-expanded={settingsDrawerExpanded || undefined}
        aria-current={onSettingsPage ? "page" : undefined}
        onclick={() => (settingsDrawerExpanded = !settingsDrawerExpanded)}
      >
        Settings
        <svg
          class="drawer-chevron"
          class:drawer-chevron-open={settingsDrawerExpanded}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="drawer-sub-links" class:drawer-sub-links-open={settingsDrawerExpanded} inert={!settingsDrawerExpanded}>
        {#each settingsLinks as link}
          <a
            href={link.path}
            class="drawer-link drawer-sub-link"
            aria-current={page.url.pathname === link.path
              ? "page"
              : undefined}
          >
            {link.label}
          </a>
        {/each}
      </div>
    </div>

    <img
      src="/guoba_lightkeepers.png"
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
      height 0.25s ease;
    height: 4rem;
  }

  .nav-bar.nav-sub-open {
    height: 6.5rem;
  }

  .nav-initial {
    background: color-mix(in srgb, black 10%, transparent);
  }

  .opaque-bg {
    background: color-mix(in srgb, var(--background-color) 80%, black 19%);
  }

  .nav-logo {
    letter-spacing: 0.1em;
    font-size: var(--h2-size);
    font-family: "Bonobo";
    font-weight: 700;
    color: var(--accent-1);
    pointer-events: auto;
  }

  .nav-link {
    padding-bottom: 2px;
    border-bottom: 1.5px solid transparent;
    transition:
      color 0.15s,
      border-color 0.15s;
    pointer-events: auto;
  }

  .nav-bar > div {
    pointer-events: auto;
  }

  .nav-link:hover {
    color: var(--accent-1);
  }

  .nav-link[aria-current="page"] {
    color: var(--accent-1);
  }

  /* ── Settings sub-row ── */
  .settings-sub-row {
    max-height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .settings-sub-row.settings-sub-row-open {
    max-height: 2.5rem;
    opacity: 1;
    pointer-events: auto;
  }

  .nav-sub-link {
    font-size: 0.85rem;
    letter-spacing: 0.03em;
    color: var(--foreground-mid);
    transition: color 0.15s;
    pointer-events: auto;
  }

  .nav-sub-link:hover,
  .nav-sub-link[aria-current="page"] {
    color: var(--accent-1);
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
    border-left: 1px solid color-mix(in srgb, var(--accent-1) 25%, transparent);
  }

  .drawer-link {
    font-size: 1.2rem;
    letter-spacing: 0.06em;
    color: var(--foreground-mid);
    transition: color 0.15s;
  }

  .drawer-link:hover,
  .drawer-link[aria-current="page"] {
    color: var(--accent-1);
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
    font-size: 1rem;
    margin-top: 0.6rem;
  }
</style>
