<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";

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

<main class="w-[85%] pb-24 flex flex-col gap-6">
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
                <IconUser size={18} />
              {:else if section.icon === "cloud"}
                <IconCloudUp size={18} />
              {:else}
                <IconMonitor size={18} />
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
</style>
