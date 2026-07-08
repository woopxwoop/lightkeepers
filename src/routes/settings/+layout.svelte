<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";

  const sections = [
    { id: "roster", label: "Roster", icon: "users" },
    { id: "account", label: "Account", icon: "cloud" },
    { id: "display", label: "Display", icon: "monitor" },
  ] as const;

  const sectionPaths: Record<string, string> = {
    roster: resolve("/settings/roster"),
    account: resolve("/settings/account"),
    display: resolve("/settings/display"),
  };

  let { children } = $props();
</script>

<main class="w-[80%] pb-24 flex flex-col gap-6">
  <div class="settings-shell grid items-start gap-5 lg:grid-cols-[160px_1fr]">
    <aside class="settings-sidebar hidden lg:block lg:sticky overflow-hidden">
      <div class="flex flex-row lg:flex-col">
        {#each sections as section}
          <a
            href={sectionPaths[section.id]}
            class="settings-nav-item relative lg:min-w-0 w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            class:is-active={page.url.pathname === sectionPaths[section.id]}
          >
            <span class="settings-nav-icon" aria-hidden="true">
              {#if section.icon === "users"}
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              {:else if section.icon === "cloud"}
                <svg viewBox="0 0 24 24">
                  <path
                    d="M17.5 19H8a6 6 0 1 1 5.4-8.6A4.5 4.5 0 1 1 17.5 19Z"
                  />
                  <path d="M12 12v6" />
                  <path d="m9 15 3-3 3 3" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M8 20h8" />
                  <path d="M12 16v4" />
                </svg>
              {/if}
            </span>
            <span class="min-w-0">
              <span class="block">
                {section.label}
              </span>
            </span>
          </a>
        {/each}
      </div>
    </aside>

    <section class="min-w-0">
      {@render children()}
    </section>
  </div>
</main>

<style>
  .settings-sidebar {
    position: sticky;
    top: 80px;
    z-index: 10;
    border-radius: 8px;
    background: var(--background-mid);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--accent-1) 16%, transparent),
      inset 0 -1px 0 color-mix(in srgb, black 20%, transparent);
  }

  .settings-nav-item {
    color: var(--foreground-color);
    border-radius: 7px;
    overflow: hidden;
  }

  .settings-nav-item + .settings-nav-item {
    border-top: 0;
  }

  .settings-nav-item:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 4%, transparent);
  }

  .settings-nav-item.is-active {
    color: var(--foreground-color);
    background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--accent-1) 56%, transparent),
        color-mix(in srgb, var(--accent-1) 32%, transparent),
        color-mix(in srgb, var(--accent-1) 12%, transparent)
      ),
      color-mix(in srgb, var(--background-mid) 88%, transparent);
    box-shadow:
      inset 1px 0 0 var(--accent-1),
      inset 0 0 0 0.5px color-mix(in srgb, var(--accent-1) 20%, transparent);
  }

  .settings-nav-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: currentColor;
    flex: 0 0 auto;
  }

  .settings-nav-icon svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }
</style>
