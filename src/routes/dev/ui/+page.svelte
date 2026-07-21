<script lang="ts">
  import { charactersOwned, displayPreferences } from "$lib/stores";
  import {
    THEME_COLOR_KEYS,
    DEFAULT_DARK_COLORS,
    type ThemeColorKey,
  } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import Team from "$lib/ui/components/Team.svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import IconInfo from "$lib/ui/icons/IconInfo.svelte";
  import IconFilter from "$lib/ui/icons/IconFilter.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import type { AbyssTeam } from "$lib/definitions";

  const COLOR_LABELS: Record<ThemeColorKey, string> = {
    "background-color": "Background",
    "foreground-color": "Foreground",
    "background-mid": "Background mid",
    "foreground-mid": "Foreground mid",
    "accent-1": "Accent 1",
    "accent-2": "Accent 2",
    "accent-3": "Accent 3",
  };

  const ELEMENT_COLORS: Record<string, string> = {
    Pyro: "#f07b4a",
    Hydro: "#5eb8f5",
    Anemo: "#6dd5a8",
    Electro: "#c48ad5",
    Dendro: "#b1d94c",
    Cryo: "#8fd5e5",
    Geo: "#f5c242",
  };

  let sampleChars = $derived($charactersOwned.slice(0, 8));
  let sampleMap = $derived(
    new Map(sampleChars.map((c) => [c.name_id ?? c.name, c])),
  );

  let demoTeam = $derived.by((): AbyssTeam | null => {
    if (sampleChars.length < 4) return null;
    const members = sampleChars.slice(0, 4).map((c) => c.name_id ?? c.name);
    return {
      members,
      usage_rate: 12.5,
    } as AbyssTeam;
  });

  let segment = $state<"roster" | "meta">("roster");
  let chipOn = $state(true);
  let toggleOn = $state(true);
  let iconStyleNote = $derived($displayPreferences.iconStyle);

  /** Type pairings — production lock-in is plex-titles. */
  type TypePairing = {
    id: string;
    label: string;
    note: string;
    brand: string;
    display: string;
    body: string;
    tracking?: string;
  };

  const TYPE_PAIRINGS: TypePairing[] = [
    {
      id: "plex-titles",
      label: "Plex titles + Manrope",
      note: "Production lock-in — IBM Plex Sans for brand / nav / titles; Manrope body",
      brand: "var(--font-brand)",
      display: "var(--font-display)",
      body: "var(--font-body)",
      tracking: "0.12em",
    },
    {
      id: "plex",
      label: "IBM Plex Sans (all)",
      note: "Plex everywhere — most technical / navigation-board feel",
      brand: '"IBM Plex Sans", sans-serif',
      display: '"IBM Plex Sans", sans-serif',
      body: '"IBM Plex Sans", sans-serif',
      tracking: "0.1em",
    },
    {
      id: "manrope-only",
      label: "Manrope only",
      note: "One family for brand, titles, and body — quiet and modern",
      brand: '"Manrope", sans-serif',
      display: '"Manrope", sans-serif',
      body: '"Manrope", sans-serif',
      tracking: "0.14em",
    },
    {
      id: "space-grotesk",
      label: "Space Grotesk",
      note: "Geometric brand/display; Manrope body — instrument, not manuscript",
      brand: '"Space Grotesk", sans-serif',
      display: '"Space Grotesk", sans-serif',
      body: '"Manrope", sans-serif',
      tracking: "0.08em",
    },
    {
      id: "outfit",
      label: "Outfit",
      note: "Soft geometric sans throughout — clean coastal chart energy",
      brand: '"Outfit", sans-serif',
      display: '"Outfit", sans-serif',
      body: '"Outfit", sans-serif',
      tracking: "0.12em",
    },
    {
      id: "legacy",
      label: "Legacy Bonobo + Lora",
      note: "Previous brand/display faces (local files) — ornamental / classical",
      brand: '"Bonobo", serif',
      display: '"Lora", serif',
      body: '"Manrope", sans-serif',
      tracking: "0.1em",
    },
  ];

  let typePairingId = $state("plex-titles");
  let typePairing = $derived(
    TYPE_PAIRINGS.find((p) => p.id === typePairingId) ?? TYPE_PAIRINGS[0],
  );
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="w-[85%] pb-24 flex flex-col gap-10">
  <header class="flex flex-col gap-2">
    <p class="eyebrow">Dev</p>
    <h1 class="page-title">UI gallery</h1>
    <p class="lede">
      Living surface for tokens and components while we unify the system. Icon
      style follows Display settings ({iconStyleNote}).
    </p>
  </header>

  <!-- ── Tokens ─────────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="tokens">
    <div class="section-head">
      <h2>Tokens</h2>
      <p>Current CSS variables (overrides from Display apply live).</p>
    </div>
    <div class="token-grid">
      {#each THEME_COLOR_KEYS as key}
        {@const resolved =
          $displayPreferences.themeColors?.[key] ?? DEFAULT_DARK_COLORS[key]}
        <div class="token-card surface">
          <div class="swatch" style="background: var(--{key});"></div>
          <div class="min-w-0">
            <p class="token-name">--{key}</p>
            <p class="token-meta">{COLOR_LABELS[key]} · {resolved}</p>
          </div>
        </div>
      {/each}
    </div>

    <div class="type-lab surface">
      <div class="type-lab-head">
        <p class="surface-label">Typography lab</p>
        <p class="token-meta">
          Flip pairings on real UI copy. Production uses Plex titles + Manrope.
        </p>
      </div>
      <div class="type-pairing-row" role="radiogroup" aria-label="Type pairing">
        {#each TYPE_PAIRINGS as pairing}
          <button
            type="button"
            role="radio"
            aria-checked={typePairingId === pairing.id}
            class="type-pairing-btn"
            class:is-active={typePairingId === pairing.id}
            onclick={() => (typePairingId = pairing.id)}
          >
            {pairing.label}
          </button>
        {/each}
      </div>
      <p class="token-meta type-pairing-note">{typePairing.note}</p>

      <div
        class="type-samples"
        style="
          --lab-brand: {typePairing.brand};
          --lab-display: {typePairing.display};
          --lab-body: {typePairing.body};
          --lab-tracking: {typePairing.tracking ?? '0.1em'};
        "
      >
        <p class="sample-brand">LIGHTKEEPERS</p>
        <p class="sample-display">Genshin Impact personalized insights.</p>
        <p class="sample-title">Spiral Abyss</p>
        <p class="sample-body">
          Find your best teams for the current cycle. Kamisato Ayaka · Raiden
          Shogun · Xingqiu · Bennett
        </p>
        <p class="sample-meta">Updated Mar 12, 2026 · 48 teams shown</p>
        <p class="sample-data">12.4K DPS · Cost 3 · C2 R1</p>
      </div>
    </div>
  </section>

  <!-- ── Surfaces ───────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="surfaces">
    <div class="section-head">
      <h2>Surfaces <span class="tag">pattern</span></h2>
      <p>Repeated card recipes to extract into Surface / Card.</p>
    </div>
    <div class="surface-row">
      <div class="surface">
        <p class="surface-label">Default</p>
        <p class="token-meta">background-mid + 18–22% accent border</p>
      </div>
      <div class="surface surface-interactive">
        <p class="surface-label">Interactive</p>
        <p class="token-meta">Hover strengthens accent border</p>
      </div>
      <div class="surface surface-inset">
        <p class="surface-label">Inset</p>
        <p class="token-meta">Accent wash for nested blocks</p>
      </div>
      <div class="surface surface-empty">
        <p class="surface-label">Empty / loading</p>
        <p class="token-meta">Quiet mid text, no chrome noise</p>
      </div>
    </div>
  </section>

  <!-- ── Controls ───────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="controls">
    <div class="section-head">
      <h2>Controls <span class="tag">pattern</span></h2>
      <p>Local demos of patterns to become SegmentedControl, Chip, Toggle, Button.</p>
    </div>

    <div class="control-stack">
      <div class="control-block surface">
        <p class="surface-label">Segmented</p>
        <div class="segmented">
          {#each ["roster", "meta"] as mode}
            <button
              type="button"
              class="segment"
              class:segment-active={segment === mode}
              onclick={() => (segment = mode as "roster" | "meta")}
            >
              {mode}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-block surface">
        <p class="surface-label">Chips</p>
        <div class="chip-row">
          <button
            type="button"
            class="chip"
            class:chip-active={chipOn}
            onclick={() => (chipOn = !chipOn)}>Owned</button
          >
          {#each Object.entries(ELEMENT_COLORS) as [el, color]}
            <button
              type="button"
              class="chip"
              style="border-color: {color}; color: {color};">{el}</button
            >
          {/each}
        </div>
      </div>

      <div class="control-block surface">
        <p class="surface-label">Toggle + actions</p>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="toggle"
            class:is-on={toggleOn}
            aria-pressed={toggleOn}
            aria-label="Demo toggle"
            onclick={() => (toggleOn = !toggleOn)}
          >
            <span></span>
          </button>
          <button type="button" class="btn-secondary">Secondary</button>
          <button type="button" class="btn-ghost">
            <IconFilter size={14} />
            Filters
          </button>
          <button type="button" class="btn-icon" aria-label="Settings">
            <IconCog size={16} />
          </button>
        </div>
      </div>

      <div class="control-block surface">
        <p class="surface-label">Badges</p>
        <div class="chip-row">
          <span class="badge badge-gold">R5</span>
          <span class="badge badge-mint">4pc</span>
          <span class="badge badge-muted">NEW</span>
          <span class="badge badge-warn">missing</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Existing components ────────────────────────────────────────────── -->
  <section class="gallery-section" id="components">
    <div class="section-head">
      <h2>Existing components</h2>
      <p>Shared modules under <code>$lib/ui</code>.</p>
    </div>

    <div class="control-stack">
      <div class="control-block surface">
        <p class="surface-label">CharacterIcon</p>
        {#if sampleChars.length}
          <div class="icon-row">
            {#each sampleChars.slice(0, 6) as character (character.name_id)}
              <div class="icon-cell">
                <CharacterIcon {character} />
              </div>
            {/each}
          </div>
        {:else}
          <p class="token-meta">Roster not loaded yet — refresh after hydrate.</p>
        {/if}
      </div>

      <div class="control-block surface">
        <p class="surface-label">Team</p>
        {#if demoTeam}
          <Team
            team={demoTeam}
            mapping={sampleMap}
            missingCharacters={[demoTeam.members[3]]}
          />
        {:else}
          <p class="token-meta">Need at least 4 characters in store.</p>
        {/if}
      </div>

      <div class="control-block surface">
        <p class="surface-label">GameText</p>
        <GameText
          text={"Deals <color=#FFD780FF>Pyro DMG</color> equal to 200% of ATK. {LINK#demo}See talent{/LINK}."}
          resolveLink={() => "#components"}
        />
      </div>

      <div class="control-block surface">
        <p class="surface-label">Tooltips</p>
        <div class="chip-row">
          <div class="group relative inline-flex">
            <button type="button" class="btn-secondary">Weapon</button>
            <WeaponTooltip weaponKey="EngulfingLightning" refinement={1} />
          </div>
          <div class="group relative inline-flex">
            <button type="button" class="btn-secondary">Artifact</button>
            <ArtifactTooltip setKey="EmblemOfSeveredFate" pieceCount={4} />
          </div>
          <div class="group relative inline-flex">
            <button type="button" class="btn-ghost">
              <IconInfo size={14} />
              Hover tip
            </button>
            <HoverTooltip>
              <p class="text-xs" style="color: var(--foreground-color);">
                Generic hover / focus tip shell.
              </p>
            </HoverTooltip>
          </div>
        </div>
      </div>

      <div class="control-block surface">
        <p class="surface-label">Icons</p>
        <div class="icon-strip">
          <IconInfo size={18} />
          <IconFilter size={18} />
          <IconCog size={18} />
          <IconChevronDown size={18} />
          <IconUser size={18} />
          <IconMonitor size={18} />
          <IconCloudUp size={18} />
        </div>
      </div>
    </div>
  </section>

  <!-- ── Planned ────────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="planned">
    <div class="section-head">
      <h2>Planned primitives</h2>
      <p>Stubs land here as we extract them from routes.</p>
    </div>
    <div class="planned-grid">
      {#each [
        "PageShell / PageHeader",
        "Surface / Card",
        "Button",
        "SegmentedControl / Tabs",
        "FilterBar / SearchInput / Chip",
        "Toggle",
        "CharacterCard",
        "StatRow / StatusBadge",
        "Tooltip (focus + touch)",
      ] as name}
        <div class="planned-card surface surface-empty">
          <p class="surface-label">{name}</p>
          <p class="token-meta">Not extracted yet</p>
        </div>
      {/each}
    </div>
  </section>
</main>

<style>
  .eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .page-title {
    font-size: var(--h1-size);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .lede {
    max-width: 40rem;
    color: var(--foreground-mid);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .gallery-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: 0.8rem;
    color: var(--foreground-mid);
  }

  .tag {
    margin-left: 0.4rem;
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    color: var(--accent-1);
    text-transform: uppercase;
  }

  .surface {
    background: var(--background-mid);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 20%, transparent);
    border-radius: 0.75rem;
    padding: 1rem;
  }

  .surface-interactive {
    transition: border-color 0.15s ease;
  }

  .surface-interactive:hover {
    border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
  }

  .surface-inset {
    background: color-mix(in srgb, var(--accent-1) 7%, var(--background-mid));
  }

  .surface-empty {
    border-style: dashed;
    opacity: 0.85;
  }

  .surface-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--foreground-color);
    margin-bottom: 0.35rem;
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.75rem;
  }

  .token-card {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
  }

  .swatch {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.4rem;
    border: 0.5px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    flex-shrink: 0;
  }

  .token-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--foreground-color);
    font-variant-numeric: tabular-nums;
  }

  .token-meta {
    font-size: 0.7rem;
    color: var(--foreground-mid);
  }

  .type-lab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .type-lab-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .type-pairing-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .type-pairing-btn {
    font-size: 0.7rem;
    padding: 0.3rem 0.65rem;
    border-radius: 0.4rem;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    color: var(--foreground-mid);
    background: transparent;
  }

  .type-pairing-btn.is-active {
    color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
  }

  .type-pairing-note {
    margin-bottom: 0.25rem;
  }

  .type-samples {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding-top: 0.5rem;
    border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 14%, transparent);
  }

  /* Legacy comparison faces — not used in production */
  @font-face {
    font-family: "Bonobo";
    src: url("/fonts/BonoboSemiBold.ttf") format("truetype");
    font-weight: 600;
    font-style: normal;
  }

  @font-face {
    font-family: "Lora";
    src: url("/fonts/Lora.ttf") format("truetype");
    font-weight: normal;
    font-style: normal;
  }

  .sample-brand {
    font-family: var(--lab-brand, "Bonobo", serif);
    letter-spacing: var(--lab-tracking, 0.1em);
    color: var(--accent-1);
    font-size: 1.35rem;
    font-weight: 700;
  }

  .sample-display {
    font-family: var(--lab-display, "Lora", serif);
    font-size: clamp(1.35rem, 2.5vw, 1.85rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--foreground-color);
  }

  .sample-title {
    font-family: var(--lab-display, "Manrope", sans-serif);
    letter-spacing: var(--lab-tracking, 0.12em);
    text-transform: uppercase;
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground-color);
  }

  .sample-body {
    font-family: var(--lab-body, "Manrope", sans-serif);
    font-size: 0.95rem;
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .sample-meta {
    font-family: var(--lab-body, "Manrope", sans-serif);
    font-size: 0.75rem;
    color: var(--foreground-mid);
  }

  .sample-data {
    font-family: var(--lab-body, "Manrope", sans-serif);
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent-1);
  }

  .surface-row,
  .control-stack,
  .planned-grid {
    display: grid;
    gap: 0.75rem;
  }

  .surface-row {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .planned-grid {
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  }

  .segmented {
    display: inline-flex;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .segment {
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    text-transform: capitalize;
    background: var(--background-mid);
    color: var(--foreground-mid);
  }

  .segment-active {
    background: color-mix(in srgb, var(--accent-1) 12%, var(--background-mid));
    color: var(--accent-1);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .chip {
    font-size: 0.7rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 25%, transparent);
    color: var(--foreground-mid);
    background: transparent;
  }

  .chip-active {
    color: var(--accent-1);
    border-color: color-mix(in srgb, var(--accent-1) 55%, transparent);
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  }

  .toggle {
    width: 2.75rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    background: color-mix(in srgb, var(--foreground-mid) 12%, transparent);
    padding: 0.15rem;
    display: flex;
    align-items: center;
  }

  .toggle span {
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 999px;
    background: var(--foreground-mid);
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .toggle.is-on {
    background: color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .toggle.is-on span {
    transform: translateX(1.15rem);
    background: var(--accent-1);
  }

  .btn-secondary,
  .btn-ghost,
  .btn-icon {
    font-size: 0.75rem;
    border-radius: 0.45rem;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 6%, transparent);
    padding: 0.35rem 0.7rem;
  }

  .btn-ghost,
  .btn-icon {
    background: transparent;
    color: var(--foreground-mid);
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-icon {
    padding: 0.4rem;
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
  }

  .badge-gold {
    color: #1a1208;
    background: color-mix(in srgb, var(--accent-1) 85%, #f0c060);
  }

  .badge-mint {
    color: #0a120e;
    background: color-mix(in srgb, #6dd5a8 75%, var(--accent-1));
  }

  .badge-muted {
    color: var(--foreground-mid);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 25%, transparent);
  }

  .badge-warn {
    color: var(--accent-1);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .icon-row {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 4.5rem));
    gap: 0.5rem;
  }

  .icon-cell {
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--background-color);
  }

  .icon-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    color: var(--foreground-mid);
  }

  code {
    font-size: 0.75rem;
    color: var(--accent-2);
  }

  @media (max-width: 640px) {
    .icon-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
