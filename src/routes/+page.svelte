<script lang="ts">
  import { resolve } from "$app/paths";
  import { hasSavedRoster } from "$lib/stores";
  import { authClient } from "$lib/auth-client";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PlannerItinerary from "$lib/ui/components/PlannerItinerary.svelte";
  import IconDiscord from "$lib/ui/icons/IconDiscord.svelte";
  import { DISCORD_INVITE_URL } from "$lib/site";
  import { siteAssetUrl } from "$lib/utils";

  const session = authClient.useSession();

  const abyssPath = resolve("/tools/abyss");
  const stygianPath = resolve("/tools/stygian");
  const pullsPath = resolve("/tools/pulls");
  const teamsPath = resolve("/teams");
  const charactersPath = resolve("/characters");

  const rosterPath = resolve("/settings");

  /** Show the nudge only when the user has never saved a roster AND isn't logged in. */
  let showNudge = $derived(!$hasSavedRoster && !$session.data);

  const rosterCard = {
    href: rosterPath,
    label: "Configure your roster",
    description: "Mark the characters you own for tailored recommendations.",
    banner: siteAssetUrl("team"),
  };

  const features = $derived([
    ...(showNudge ? [rosterCard] : []),
    {
      href: abyssPath,
      label: "Spiral Abyss",
      description: "Find your best teams for the current abyss cycle.",
      banner: siteAssetUrl("abyss_banner"),
      preload: "hover" as const,
    },
    {
      href: stygianPath,
      label: "Stygian Onslaught",
      description: "Find your best teams for the current stygian cycle.",
      banner: siteAssetUrl("stygian_banner"),
      preload: "hover" as const,
    },
    {
      href: pullsPath,
      label: "Pull Suggestions",
      description: "See which characters would improve your teams.",
      banner: siteAssetUrl("heizou"),
    },
    {
      href: teamsPath,
      label: "Teams",
      description: "Compare teams across different investment levels.",
      banner: siteAssetUrl("kazuha"),
    },
    {
      href: charactersPath,
      label: "Characters",
      description: "Browse character stats and build recommendations",
      banner: siteAssetUrl("xiao"),
    },
    ...(showNudge ? [] : [rosterCard]),
  ]);
</script>

<PageShell class="home-page gap-10">
  <header class="hero">
    <p class="eyebrow hero-eyebrow">Genshin Impact meta resources</p>
    <h1 class="hook">
      Find your best<br />
      <span class="hook-accent">teams, builds, and pulls.</span>
    </h1>
    <a
      class="discord-cta"
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <IconDiscord size={18} />
      <span>Join the Discord</span>
      <span class="discord-cta-hint">feedback & updates</span>
    </a>
  </header>

  <PlannerItinerary />

  <div class="feature-grid">
    {#each features as feature}
      <a
        href={feature.href}
        class="feature-card group"
        data-sveltekit-preload-data={"preload" in feature
          ? feature.preload
          : undefined}
      >
        {#if feature.banner}
          <div
            class="feature-art"
            style="background-image: url('{feature.banner}');"
          ></div>
        {/if}
        <div class="feature-scrim"></div>

        <div class="feature-body">
          <span class="feature-label">
            {feature.label}
            <span class="feature-arrow" aria-hidden="true">→</span>
          </span>
          <p class="feature-desc">{feature.description}</p>
        </div>
      </a>
    {/each}
  </div>
</PageShell>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hero-eyebrow {
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

  .discord-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    margin-top: var(--space-1);
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--foreground-color);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
  }

  .discord-cta:hover {
    color: var(--accent-2);
  }

  .discord-cta-hint {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--foreground-mid);
  }

  .discord-cta:hover .discord-cta-hint {
    color: inherit;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  @media (min-width: 640px) {
    .feature-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .feature-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .feature-card {
    position: relative;
    display: block;
    min-height: 11rem;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    /* Raised mid — white hairlines, not muddy gold */
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    text-decoration: none;
    transition:
      border-color var(--control-duration) var(--control-ease),
      transform 0.2s ease;
  }

  .feature-card:hover {
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
  }

  .feature-art {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    opacity: 0.55;
    transition:
      opacity 0.25s ease,
      transform 0.4s ease;
  }

  .feature-card:hover .feature-art {
    opacity: 0.7;
    transform: scale(1.03);
  }

  .feature-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--background-color) 92%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 45%,
      color-mix(in srgb, var(--background-color) 15%, transparent) 100%
    );
  }

  .feature-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
    min-height: 11rem;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .feature-label {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--foreground-color);
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .feature-arrow {
    font-size: var(--text-md);
    color: var(--accent-1);
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity var(--control-duration) var(--control-ease),
      transform var(--control-duration) var(--control-ease);
  }

  .feature-card:hover .feature-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .feature-desc {
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-mid);
  }
</style>
