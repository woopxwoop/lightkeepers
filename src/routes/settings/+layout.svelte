<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";

  const sections = [
    {
      id: "roster",
      label: "Roster",
      icon: "users",
    },
    {
      id: "account",
      label: "Account",
      icon: "cloud",
    },
    {
      id: "display",
      label: "Display",
      icon: "monitor",
    },
  ] as const;

  type SectionId = (typeof sections)[number]["id"];

  let { children } = $props();

  let activeId = $derived.by((): SectionId => {
    const raw = page.url.searchParams.get("tab");
    if (raw && sections.some((s) => s.id === raw)) return raw as SectionId;
    return "roster";
  });

  let activeSection = $derived(
    sections.find((s) => s.id === activeId) ?? sections[0],
  );

  function hrefFor(id: SectionId): string {
    const base = resolve("/settings");
    return id === "roster" ? base : `${base}?tab=${id}`;
  }
</script>

<PageShell class="settings-layout gap-6">
  <header class="page-head">
    <h1 class="page-title">Settings</h1>
  </header>

  <div class="settings-shell">
    <aside class="settings-sidebar">
      <nav class="settings-nav" aria-label="Settings sections">
        {#each sections as section}
          <a
            href={hrefFor(section.id)}
            class="settings-nav-item"
            class:is-active={activeId === section.id}
          >
            <span class="settings-nav-icon" aria-hidden="true">
              {#if section.icon === "users"}
                <IconUser size={18} />
              {:else if section.icon === "cloud"}
                <IconCloudUp size={18} />
              {:else}
                <IconMonitor size={18} />
              {/if}
            </span>
            <span class="min-w-0">
              <span class="block">{section.label}</span>
            </span>
          </a>
        {/each}
      </nav>
    </aside>

    <section class="settings-body min-w-0">
      {@render children()}
    </section>
  </div>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .settings-shell {
    display: grid;
    align-items: stretch;
    overflow: hidden;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-lg);
  }

  .settings-sidebar {
    display: none;
  }

  @media (min-width: 1024px) {
    .settings-shell {
      grid-template-columns: 160px minmax(0, 1fr);
    }

    .settings-sidebar {
      display: block;
      border-right: var(--border-width) solid rgba(255, 255, 255, 0.14);
    }
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
  }

  .settings-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    color: var(--foreground-mid);
    text-decoration: none;
    text-align: left;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease),
      box-shadow var(--control-duration) var(--control-ease);
  }

  .settings-nav-item + .settings-nav-item {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .settings-nav-item:hover {
    color: var(--foreground-color);
    background: rgba(255, 255, 255, 0.06);
  }

  .settings-nav-item.is-active {
    color: var(--foreground-color);
    background: var(--surface-selected);
    box-shadow: inset 2px 0 0 var(--accent-1);
  }

  .settings-nav-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: currentColor;
    flex: 0 0 auto;
  }

  .settings-body {
    min-width: 0;
  }
</style>
