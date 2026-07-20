<script lang="ts">
  import { resolve } from "$app/paths";
  import { hasSavedRoster } from "$lib/stores";
  import { authClient } from "$lib/auth-client";

  const session = authClient.useSession();

  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");
  const teamsPath = resolve("/teams");
  const charactersPath = resolve("/characters");

  const rosterPath = resolve("/settings/roster");

  /** Show the nudge only when the user has never saved a roster AND isn't logged in. */
  let showNudge = $derived(!$hasSavedRoster && !$session.data);

  const rosterCard = {
    href: rosterPath,
    label: "Configure your roster",
    description: "Mark the characters you own for tailored recommendations.",
    banner: "https://images.lightkeepers.moe/site/team.webp",
  };

  const features = $derived([
    ...(showNudge ? [rosterCard] : []),
    {
      href: abyssPath,
      label: "Spiral Abyss",
      description: "Find your best teams for the current abyss cycle.",
      banner: "https://images.lightkeepers.moe/site/abyss_banner.webp",
    },
    {
      href: stygianPath,
      label: "Stygian Onslaught",
      description: "Find your best teams for the current stygian cycle.",
      banner: "https://images.lightkeepers.moe/site/stygian_banner.webp",
    },
    {
      href: pullsPath,
      label: "Pull Suggestions",
      description: "See which characters would improve your teams.",
      banner: "https://images.lightkeepers.moe/site/heizou.webp",
    },
    {
      href: teamsPath,
      label: "Teams",
      description: "Compare teams across different investment levels.",
      banner: "https://images.lightkeepers.moe/site/kazuha.webp",
    },
    {
      href: charactersPath,
      label: "Characters",
      description: "Browse character stats and build recommendations",
      banner: "https://images.lightkeepers.moe/site/xiao.webp",
    },
    ...(showNudge ? [] : [rosterCard]),
  ]);
</script>

<main class="w-[80%] pb-20">
  <div class="flex flex-col gap-8 mt-16">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-3">
        <h1 class="hook">Genshin Impact <br /> personalized insights.</h1>
      </div>
    </div>

    <!-- Feature cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
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
                  style="color: var(--accent-1);"
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
