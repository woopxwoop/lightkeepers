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

<main class="w-[85%] pb-20">
  <div class="flex flex-col gap-10">
    <header class="hero flex flex-col gap-4">
      <p class="hero-eyebrow">Genshin Impact meta resources</p>
      <h1 class="hook">
        Find your best<br />
        <span class="hook-accent">teams and builds.</span>
      </h1>
    </header>

    <!-- Feature cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each features as feature}
        <a href={feature.href} class="feature-card group relative rounded-xl overflow-hidden">
          {#if feature.banner}
            <div
              class="feature-art absolute inset-0 bg-cover bg-center"
              style="background-image: url('{feature.banner}');"
            ></div>
          {/if}
          <div class="feature-scrim absolute inset-0"></div>

          <div class="relative z-10 flex flex-col justify-end h-full p-4 gap-1">
            <span class="feature-label">
              {feature.label}
              <span class="feature-arrow" aria-hidden="true">→</span>
            </span>
            <p class="feature-desc">{feature.description}</p>
          </div>
        </a>
      {/each}
    </div>
  </div>
</main>

<style>
  .hero-eyebrow {
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-1);
  }

  .hook {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4.5vw, 3.25rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--foreground-color);
  }

  /* app.css sets a global span font-size clamp — keep hero spans at h1 size */
  .hook span {
    font-size: inherit;
  }

  .hook-accent {
    color: var(--accent-2);
  }

  .feature-card {
    min-height: 11rem;
    background: var(--background-mid);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);
    transition:
      border-color 0.2s,
      transform 0.2s;
  }

  .feature-card:hover {
    border-color: color-mix(in srgb, var(--accent-1) 50%, transparent);
    transform: translateY(-2px);
  }

  .feature-art {
    opacity: 0.55;
    transition: opacity 0.25s ease, transform 0.4s ease;
  }

  .feature-card:hover .feature-art {
    opacity: 0.7;
    transform: scale(1.03);
  }

  .feature-scrim {
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--background-color) 92%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 45%,
      color-mix(in srgb, var(--background-color) 15%, transparent) 100%
    );
  }

  .feature-label {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground-color);
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .feature-arrow {
    font-size: 0.85rem;
    color: var(--accent-1);
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity 0.2s, transform 0.2s;
  }

  .feature-card:hover .feature-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .feature-desc {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--foreground-mid);
  }
</style>
