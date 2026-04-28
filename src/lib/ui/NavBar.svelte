<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick } from "svelte";
  import { fly, fade } from "svelte/transition";

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

  // ── Mobile drawer ──────────────────────────────────────────────────────
  let mobileOpen = $state(false);

  $effect(() => {
    page.url.pathname;
    mobileOpen = false;
  });

  $effect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  });
</script>

<nav
  class="nav-bar w-full pl-[10%] pr-[10%] fixed top-0 z-30 flex items-center justify-between h-16 border-none transition-colors duration-300 {scrolled
    ? 'opaque-bg'
    : 'nav-initial'}"
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
    onclick={() => (mobileOpen = !mobileOpen)}
  >
    <span class="bar" class:open={mobileOpen}></span>
    <span class="bar" class:open={mobileOpen}></span>
    <span class="bar" class:open={mobileOpen}></span>
  </button>
</nav>

<!-- Backdrop -->
{#if mobileOpen}
  <div
    class="fixed inset-0 z-40 bg-black/60"
    role="presentation"
    transition:fade={{ duration: 200 }}
    onclick={() => (mobileOpen = false)}
  ></div>
{/if}

<!-- Side drawer -->
{#if mobileOpen}
  <aside
    class="drawer fixed top-0 right-0 h-full z-50 flex flex-col pt-24 px-8 gap-8"
    transition:fly={{ x: 280, duration: 260 }}
    aria-label="Navigation menu"
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
      href={settingsPath}
      class="drawer-link"
      aria-current={page.url.pathname === settingsPath ? "page" : undefined}
      >Settings</a
    >
  </aside>
{/if}

<style>
  .nav-bar {
    pointer-events: none;
    transition: background-color 0.4s ease;
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
    width: min(280px, 30vw);
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
</style>
