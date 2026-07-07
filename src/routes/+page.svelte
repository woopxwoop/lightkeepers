<script lang="ts">
  import { resolve } from "$app/paths";
  import { charactersOwned } from "$lib/stores";

  const settingsPath = resolve("/settings");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);
  let hasRoster = $derived(ownedCount > 0);

  // Dev toggle
  let devOverride: boolean | null = $state(null);
  let showRosterView = $derived(devOverride ?? hasRoster);

  const features = [
    {
      href: abyssPath,
      label: "Spiral Abyss",
      description: "Find your best teams for the current abyss cycle.",
      banner: "/abyss_banner.png",
    },
    {
      href: stygianPath,
      label: "Stygian Onslaught",
      description: "Find your best teams for the current stygian cycle.",
      banner: "/stygian_banner.png",
    },
    {
      href: pullsPath,
      label: "Pull Suggestions",
      description: "See which characters would improve your teams the most.",
      banner: "/heizou.jpg",
    },
  ];
</script>

<main class="w-[80%] pb-20">
  <div class="flex flex-col gap-8 mt-16">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-3">
        <h1 class="hook">Genshin Impact <br /> meta recommendations.</h1>
        {#if !showRosterView}
          <p style="color: var(--foreground-mid);">
            Select your owned characters to get personalized team
            recommendations.
          </p>
        {/if}
      </div>

      {#if import.meta.env.DEV}
        <button
          onclick={() =>
            (devOverride = devOverride === null ? !hasRoster : !devOverride)}
          class="text-xs px-2 py-1 rounded font-mono shrink-0 mt-1"
          style="background: color-mix(in srgb, var(--accent-1) 15%, transparent); color: var(--accent-1); border: 0.5px solid color-mix(in srgb, var(--accent-1) 25%, transparent);"
        >
          {devOverride === null
            ? "dev: auto"
            : devOverride
              ? "dev: roster"
              : "dev: empty"}
        </button>
      {/if}
    </div>

    {#if showRosterView}
      <!-- Feature cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
        {#each features as feature}
          <a
            href={feature.href}
            class="feature-card rounded-xl overflow-hidden flex flex-col group relative"
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
          >
            <!-- Banner background -->
            {#if feature.banner}
              <div
                class="absolute inset-0 bg-cover bg-center opacity-20"
                style="background-image: url('{feature.banner}');"
              ></div>
            {/if}

            <div class="p-4 flex flex-col gap-3 relative z-10">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-1">
                  <span
                    class="text-sm font-medium"
                    style="color: var(--foreground-color);"
                  >
                    {feature.label}
                  </span>
                  <p
                    class="text-xs leading-relaxed"
                    style="color: var(--foreground-mid);"
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <!-- Quick-start steps -->
      <div class="flex flex-col gap-5 mt-2">
        {#each [{ step: "1", title: "Set up your roster", description: "Mark the characters you own so recommendations are tailored to you." }, { step: "2", title: "Browse team recommendations", description: "Get optimal team assignments for Spiral Abyss and Stygian Onslaught." }, { step: "3", title: "Discover who to pull", description: "See which characters would unlock your best missing teams." }] as item}
          <div class="flex items-start gap-4">
            <div
              class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
              style="background: var(--accent-1); color: var(--background-color);"
            >
              {item.step}
            </div>
            <div class="flex flex-col gap-0.5 pt-0.5">
              <span
                class="text-sm font-medium"
                style="color: var(--foreground-color);"
              >
                {item.title}
              </span>
              <p class="text-xs" style="color: var(--foreground-mid);">
                {item.description}
              </p>
            </div>
          </div>
        {/each}

        <a
          href={settingsPath}
          class="self-start mt-1 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style="background: var(--accent-1); color: var(--background-color);"
        >
          Go to settings →
        </a>
      </div>
    {/if}
  </div>
</main>

<style>
  .hook {
    font-family: "Lora";
  }

  .feature-card {
    transition:
      border-color 0.2s,
      transform 0.2s;
  }

  .feature-card:hover {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 45%,
      transparent
    ) !important;
    transform: translateY(-1px);
  }
</style>
