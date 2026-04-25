<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { tick } from "svelte";

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
</script>

<nav
  class="nav-bar w-full pl-[10%] pr-[10%] fixed top-0 z-10 flex items-center justify-between h-16 border-none transition-colors duration-300 {scrolled
    ? 'opaque-bg'
    : 'bg-black/10'}"
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

<style>
  .nav-bar {
    pointer-events: none;
    transition: background-color 0.4s ease; /* Smooth transition */
  }

  .opaque-bg {
    background: color-mix(in srgb, var(--background-color) 80%, black 19%);
  }

  .nav-logo {
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--secondary-color);
    text-decoration: none;
    pointer-events: auto;
  }
  .nav-link {
    text-decoration: none;
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
    color: var(--secondary-color);
  }
  .nav-link[aria-current="page"] {
    color: var(--secondary-color);
  }
</style>
