<script lang="ts">
  import {
    displayPreferences,
    THEME_COLOR_KEYS,
    DEFAULT_DARK_COLORS,
    type ThemeColorKey,
  } from "#lib/stores/preferences.js";
  import Surface from "#lib/ui/components/Surface.svelte";
  import Chip from "#lib/ui/components/Chip.svelte";

  const COLOR_LABELS: Record<ThemeColorKey, string> = {
    "background-color": "Background",
    "foreground-color": "Foreground",
    "background-mid": "Background mid",
    "foreground-mid": "Foreground mid",
    "accent-1": "Accent 1",
    "accent-2": "Accent 2",
    "accent-3": "Accent 3",
  };

  const SEMANTIC_TOKENS = [
    { name: "--surface-raised", swatch: "var(--surface-raised)" },
    { name: "--surface-inset", swatch: "var(--surface-inset)" },
    { name: "--surface-selected", swatch: "var(--surface-selected)" },
    { name: "--border-default", swatch: "var(--border-default)" },
    { name: "--border-strong", swatch: "var(--border-strong)" },
    { name: "--accent-1 (solid)", swatch: "var(--accent-1)" },
  ] as const;

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
      id: "legacy",
      label: "Legacy Bonobo + Lora",
      note: "Previous brand/display faces — ornamental / classical",
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

<section class="gallery-section" id="tokens">
  <div class="section-head">
    <h2>Paint tokens</h2>
    <p>Display-editable CSS variables (overrides apply live).</p>
  </div>
  <div class="token-grid">
    {#each THEME_COLOR_KEYS as key}
      {@const resolved =
        $displayPreferences.themeColors?.[key] ?? DEFAULT_DARK_COLORS[key]}
      <Surface class="token-card">
        <div class="swatch" style="background: var(--{key});"></div>
        <div class="min-w-0">
          <p class="token-name">--{key}</p>
          <p class="token-meta">{COLOR_LABELS[key]} · {resolved}</p>
        </div>
      </Surface>
    {/each}
  </div>

  <div class="section-head mt-2">
    <h2>Semantic tokens</h2>
    <p>
      Derived from paint. Accent is solid text/border only — selected fills use
      neutral surface washes.
    </p>
  </div>
  <div class="token-grid">
    {#each SEMANTIC_TOKENS as token}
      <Surface class="token-card">
        <div class="swatch" style="background: {token.swatch};"></div>
        <div class="min-w-0">
          <p class="token-name">{token.name}</p>
          <p class="token-meta">Derived · follows theme paint</p>
        </div>
      </Surface>
    {/each}
  </div>

  <Surface class="type-lab">
    <div class="type-lab-head">
      <p class="surface-label">Typography lab</p>
      <p class="token-meta">
        Flip pairings on real UI copy. Production uses Plex titles + Manrope.
      </p>
    </div>
    <div class="type-pairing-row" role="radiogroup" aria-label="Type pairing">
      {#each TYPE_PAIRINGS as pairing}
        <Chip
          active={typePairingId === pairing.id}
          onclick={() => (typePairingId = pairing.id)}
        >
          {pairing.label}
        </Chip>
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
  </Surface>
</section>

<style>
  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .surface-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    margin-bottom: 0.35rem;
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-3);
  }

  :global(.token-card) {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-3);
  }

  .swatch {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 15%, transparent);
    flex-shrink: 0;
  }

  .token-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    font-variant-numeric: tabular-nums;
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  :global(.type-lab) {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .type-lab-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .type-pairing-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .type-pairing-note {
    margin-bottom: var(--space-1);
  }

  .type-samples {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding-top: var(--space-2);
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .sample-brand {
    font-family: var(--lab-brand, var(--font-brand));
    letter-spacing: var(--lab-tracking, var(--tracking-brand));
    color: var(--accent-1);
    font-size: 1.35rem;
    font-weight: 700;
  }

  .sample-display {
    font-family: var(--lab-display, var(--font-display));
    font-size: clamp(1.35rem, 2.5vw, 1.85rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--foreground-color);
  }

  .sample-title {
    font-family: var(--lab-display, var(--font-display));
    letter-spacing: var(--lab-tracking, var(--tracking-title));
    text-transform: uppercase;
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground-color);
  }

  .sample-body {
    font-family: var(--lab-body, var(--font-body));
    font-size: var(--text-base);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .sample-meta {
    font-family: var(--lab-body, var(--font-body));
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .sample-data {
    font-family: var(--lab-body, var(--font-body));
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent-1);
  }

  .mt-2 {
    margin-top: var(--space-2);
  }
</style>
