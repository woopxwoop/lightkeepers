<script lang="ts">
  import { resolve } from "$app/paths";
  import { hasSavedRoster } from "$lib/stores";
  import { authClient } from "$lib/auth-client";

  const session = authClient.useSession();

  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const pullsPath = resolve("/pulls");

  /** Show the nudge only when the user has never saved a roster AND isn't logged in. */
  let showNudge = $derived(!$hasSavedRoster && !$session.data);

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

  const rosterPath = resolve("/settings/roster");
</script>

<main class="w-[80%] pb-20">
  <div class="flex flex-col gap-8 mt-16">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-3">
        <h1 class="hook">Genshin Impact <br /> personalized insights.</h1>
        {#if showNudge}
          <p style="color: var(--foreground-mid);">
            Select your owned characters to get personalized team
            recommendations.
          </p>
        {/if}
      </div>
    </div>

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
  </div>

  <!-- New-user nudge — only shown until the first roster save -->
  {#if showNudge}
    <a
      href={rosterPath}
      class="roster-nudge"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent);"
    >
      <span class="text-sm font-medium" style="color: var(--foreground-color);">
        New here?
      </span>
      <span class="text-xs" style="color: var(--foreground-mid);">
        Configure your roster
      </span>
    </a>
  {/if}
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

  .roster-nudge {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    text-decoration: none;
    backdrop-filter: blur(12px);
    transition:
      border-color 0.2s,
      transform 0.2s,
      box-shadow 0.2s;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  }

  .roster-nudge:hover {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      transparent
    ) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }
</style>
