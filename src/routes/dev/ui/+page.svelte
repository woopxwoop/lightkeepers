<script lang="ts">
  import { charactersOwned, displayPreferences } from "$lib/stores";
  import {
    THEME_COLOR_KEYS,
    DEFAULT_DARK_COLORS,
    type ThemeColorKey,
  } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageHeader from "$lib/ui/components/PageHeader.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import PickModal from "$lib/ui/components/PickModal.svelte";
  import Chip from "$lib/ui/components/Chip.svelte";
  import Badge from "$lib/ui/components/Badge.svelte";
  import SlidingTabs from "$lib/ui/components/SlidingTabs.svelte";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import BrowseFlipCard from "$lib/ui/components/BrowseFlipCard.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import CharacterTagSearch from "$lib/ui/components/CharacterTagSearch.svelte";
  import SolutionDots from "$lib/ui/components/SolutionDots.svelte";
  import StatRow from "$lib/ui/components/StatRow.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import Team from "$lib/ui/components/Team.svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import UsageSeriesChart from "$lib/ui/components/UsageSeriesChart.svelte";
  import IconInfo from "$lib/ui/icons/IconInfo.svelte";
  import IconFilter from "$lib/ui/icons/IconFilter.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import { ELEMENT_COLORS, elementColor } from "$lib/element-colors";
  import type {
    AbyssTeam,
    CharacterAnalyticsMode,
    CharacterAnalyticsPayload,
    CharacterOwned,
  } from "$lib/definitions";
  import {
    getNamecardUrl,
    statIconUrl,
    toGoodKey,
    weaponTypeLabel,
  } from "$lib/utils";
  import { isNewCharacter } from "$lib/is-new-character";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";
  import {
    fetchCharacterAnalytics,
    isAbortError,
  } from "$lib/app/character-analytics";
  import {
    ensureEquipmentData,
    equipmentVersion,
    weaponByKey,
    weaponIconSrc,
  } from "$lib/equipment-data";

  void ensureEquipmentData().catch(() => {});

  let demoTags: string[] = $state([]);
  let demoTagOptions = $derived(
    $charactersOwned.slice(0, 24).map((c) => toGoodKey(c.name)),
  );
  let demoCharByKey = $derived(
    new Map($charactersOwned.map((c) => [toGoodKey(c.name), c])),
  );

  // ── Usage series chart (analytics study) ──────────────────────────────
  let analyticsNameId = $state("");
  let analyticsMode = $state<CharacterAnalyticsMode>("stygian");
  let analyticsPayload = $state<CharacterAnalyticsPayload | null>(null);
  let analyticsLoading = $state(false);
  let analyticsError = $state<string | null>(null);

  let analyticsCharOptions = $derived(
    $charactersOwned
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .map((c) => ({ value: c.name_id, label: c.name ?? c.name_id })),
  );

  let analyticsCharById = $derived(
    new Map($charactersOwned.map((c) => [c.name_id, c])),
  );

  $effect(() => {
    if (!analyticsNameId && analyticsCharOptions.length > 0) {
      const preferred =
        analyticsCharOptions.find((o) => o.value === "Mualani") ??
        analyticsCharOptions.find((o) => o.value === "Hutao") ??
        analyticsCharOptions[0];
      if (preferred) analyticsNameId = preferred.value;
    }
  });

  $effect(() => {
    const nameId = analyticsNameId;
    const mode = analyticsMode;
    if (!nameId) return;

    const controller = new AbortController();
    analyticsLoading = true;
    analyticsError = null;

    fetchCharacterAnalytics(nameId, mode, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        analyticsPayload = payload;
        analyticsLoading = false;
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        analyticsPayload = null;
        analyticsLoading = false;
        analyticsError =
          err instanceof Error ? err.message : "Failed to load analytics";
      });

    return () => {
      controller.abort();
    };
  });

  // Character grid demo (browse + roster modes)
  let gridMode = $state<"browse" | "roster">("browse");
  let gridAffordance = $state<"hint" | "flip" | "both">("both");
  let gridSearch = $state("");
  let gridRarity = $state(new Set<string>());
  let gridElements = $state(new Set<string>());
  let gridWeapons = $state(new Set<string>());
  let gridOwnership = $state<OwnershipFilter>("all");
  let gridSortBy = $state<CharacterSortKey>("name");
  let gridSortAsc = $state(true);
  let gridRoster = $state<CharacterOwned[]>([]);
  let showGridHint = $derived(
    gridMode === "browse" &&
      (gridAffordance === "hint" || gridAffordance === "both"),
  );
  let useFlipCards = $derived(
    gridMode === "browse" &&
      (gridAffordance === "flip" || gridAffordance === "both"),
  );

  $effect(() => {
    // Clone roster once characters load so toggles don't mutate the store.
    if (gridRoster.length === 0 && $charactersOwned.length > 0) {
      gridRoster = $charactersOwned.map((c) => ({ ...c }));
    }
  });

  let gridVisible = $derived(
    filterAndSortCharacters(
      gridMode === "roster" ? gridRoster : $charactersOwned,
      {
        search: gridSearch,
        rarity: gridRarity,
        elements: gridElements,
        weapons: gridWeapons,
        ownership: gridOwnership,
        sortBy: gridSortBy,
        sortAsc: gridSortAsc,
      },
    ).slice(0, 24),
  );

  function toggleGridOwned(nameId: string) {
    gridRoster = gridRoster.map((c) =>
      c.name_id === nameId ? { ...c, isOwned: !c.isOwned } : c,
    );
  }

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

  let sampleChars = $derived($charactersOwned.slice(0, 8));
  let detailDemoChar = $derived(
    $charactersOwned.find((character) => character.name === "Raiden Shogun") ??
      sampleChars[0],
  );
  let detailAccent = $derived(
    elementColor(detailDemoChar?.element, "var(--accent-1)"),
  );
  // Full background-image value: an empty url("") would resolve against the
  // current document and fetch the page itself as an image.
  let detailNamecard = $derived(
    detailDemoChar?.name_id
      ? `url('${getNamecardUrl(detailDemoChar.name_id)}')`
      : "none",
  );
  let detailTitle = $derived(
    detailDemoChar?.name === "Raiden Shogun"
      ? "Plane of Euthymia"
      : "Character dossier",
  );
  let detailRegion = $derived(
    detailDemoChar?.name === "Raiden Shogun" ? "Inazuma" : "Teyvat",
  );
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

  // ── Build-example team picker (row + gear expand) ─────────────────────
  let segment = $state<"roster" | "meta">("roster");
  let selectDemo = $state("stygian");
  let chipOn = $state(true);
  let toggleOn = $state(true);
  let slidingTab = $state<"top" | "bottom" | "skills">("top");
  let solutionIndex = $state(0);
  let iconStyleNote = $derived($displayPreferences.iconStyle);
  let detailConcept = $state<"dossier" | "nameplate" | "compact">("dossier");

  // ── PickModal demo (Planner character / weapon picker) ────────────────
  let pickDemoKind = $state<"character" | "weapon" | null>(null);
  let pickDemoQuery = $state("");
  let pickDemoChoice = $state("");
  let pickDemoCharValue = $state("");
  let pickDemoWeaponValue = $state("");

  let pickDemoCharOptions = $derived(
    $charactersOwned
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .map((c) => ({
        value: c.name_id,
        label: c.name ?? c.name_id,
      })),
  );

  let pickDemoCharById = $derived(
    new Map($charactersOwned.map((c) => [c.name_id, c])),
  );

  let pickDemoWeaponOptions = $derived.by(() => {
    void $equipmentVersion;
    return [...weaponByKey.entries()]
      .map(([key, w]) => ({
        value: key,
        label: `${w.name} (${w.stars}★)`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  function openPickDemo(kind: "character" | "weapon") {
    pickDemoKind = kind;
    pickDemoQuery = "";
  }

  function closePickDemo() {
    pickDemoKind = null;
    pickDemoQuery = "";
  }

  function choosePickDemo(value: string) {
    pickDemoChoice = value;
    closePickDemo();
  }

  const DETAIL_CONCEPTS = [
    {
      value: "dossier" as const,
      label: "Dossier",
      note: "Portrait anchors the identity; facts become a readable ledger.",
    },
    {
      value: "nameplate" as const,
      label: "Nameplate",
      note: "Art stays atmospheric while identity gets a quiet solid strip.",
    },
    {
      value: "compact" as const,
      label: "Compact",
      note: "A dense utility header that brings the build content forward.",
    },
  ];

  type CharacterDemoSection =
    "builds" | "teams" | "kit" | "links" | "notes" | "media";

  type CharacterSectionDemo = {
    value: CharacterDemoSection;
    label: string;
    summary: string;
    future?: boolean;
  };

  const CHARACTER_SECTION_DEMOS: CharacterSectionDemo[] = [
    {
      value: "builds",
      label: "Builds",
      summary: "Equipment, stats, and investment priorities",
    },
    {
      value: "teams",
      label: "Teams",
      summary: "Popular lineups and simulated teams",
    },
    {
      value: "kit",
      label: "Kit",
      summary: "Talents, passives, and constellations",
    },
    {
      value: "links",
      label: "Useful Links",
      summary: "External guides and references",
    },
    {
      value: "notes",
      label: "Notes",
      summary: "Future section used to test navigation scale",
      future: true,
    },
    {
      value: "media",
      label: "Media",
      summary: "Future section used to test navigation scale",
      future: true,
    },
  ];

  let railDemoSection = $state<CharacterDemoSection>("builds");
  let ledgerMobileOpen = $state(false);

  function sectionDemo(value: CharacterDemoSection) {
    return (
      CHARACTER_SECTION_DEMOS.find((section) => section.value === value) ??
      CHARACTER_SECTION_DEMOS[0]
    );
  }

  let railDemoActive = $derived(sectionDemo(railDemoSection));

  type TeamSourceDemo = "stygian" | "abyss" | "simulated";
  const TEAM_SOURCE_DEMOS = [
    {
      value: "stygian" as const,
      label: "Stygian",
      summary: "Current Stygian Onslaught meta teams",
    },
    {
      value: "abyss" as const,
      label: "Abyss",
      summary: "Current Spiral Abyss meta teams",
    },
    {
      value: "simulated" as const,
      label: "Simulated",
      summary: "Teams ranked from character investment simulations",
    },
  ];
  let teamSourceDemo = $state<TeamSourceDemo>("stygian");
  let activeTeamSourceDemo = $derived(
    TEAM_SOURCE_DEMOS.find((source) => source.value === teamSourceDemo) ??
      TEAM_SOURCE_DEMOS[0],
  );

  const SEGMENT_OPTIONS = [
    { value: "roster" as const, label: "roster" },
    { value: "meta" as const, label: "meta" },
  ];

  const SLIDING_TAB_OPTIONS = [
    { value: "top" as const, label: "First Half" },
    { value: "bottom" as const, label: "Second Half" },
    { value: "skills" as const, label: "Skills" },
  ];

  let slidingAccent = $derived(
    slidingTab === "skills"
      ? elementColor(sampleChars[0]?.element, "var(--accent-1)")
      : "var(--accent-1)",
  );

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

  // ── Stat goals layout study ────────────────────────────────────────────
  type StatGoalDemoArchetype = {
    id: string;
    label: string;
    invest: "mid" | "high";
    weapon: string;
    set: string;
    stats: { key: string; label: string; value: string }[];
  };

  const STAT_GOAL_ARCHETYPES: StatGoalDemoArchetype[] = [
    {
      id: "freeze",
      label: "Freeze",
      invest: "mid",
      weapon: "Thrilling Tales",
      set: "Noblesse 4pc",
      stats: [
        { key: "enerRech_", label: "Energy Recharge", value: "186.5%" },
      ],
    },
    {
      id: "hyperbloom",
      label: "Hyperbloom",
      invest: "high",
      weapon: "Dragon's Bane",
      set: "Flower of Paradise Lost 4pc",
      stats: [
        { key: "eleMas", label: "Elemental Mastery", value: "812" },
        { key: "enerRech_", label: "Energy Recharge", value: "148.2%" },
      ],
    },
    {
      id: "vape",
      label: "Vape",
      invest: "high",
      weapon: "Favonius Codex",
      set: "Emblem 4pc",
      stats: [
        { key: "enerRech_", label: "Energy Recharge", value: "221.0%" },
        { key: "critRate_", label: "CRIT Rate", value: "62.4%" },
        { key: "critDMG_", label: "CRIT DMG", value: "142.8%" },
      ],
    },
  ];

  let statGoalArchetypeId = $state("hyperbloom");
  let statGoalMenuOpen = $state(false);
  let statGoalArchetype = $derived(
    STAT_GOAL_ARCHETYPES.find((a) => a.id === statGoalArchetypeId) ??
      STAT_GOAL_ARCHETYPES[1],
  );
  let statGoalTeam = $derived($charactersOwned.slice(0, 4));
  let statGoalAlts = $derived(
    STAT_GOAL_ARCHETYPES.filter((a) => a.id !== statGoalArchetypeId),
  );

  const TIP_TONE_OPTIONS = [
    {
      id: "current",
      label: "Current",
      note: "cream bg · near-black text",
      bg: "var(--foreground-mid)",
      fg: "var(--background-color)",
      border: "color-mix(in srgb, var(--accent-1) 30%, transparent)",
    },
    {
      id: "ink-on-paper",
      label: "Ink on paper",
      note: "brighter cream · soft charcoal",
      bg: "var(--accent-3)",
      fg: "#1a1610",
      border: "color-mix(in srgb, var(--accent-1) 35%, transparent)",
    },
    {
      id: "raised-invert",
      label: "Raised invert",
      note: "mid surface · cream text",
      bg: "var(--background-mid)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 22%, transparent)",
    },
    {
      id: "deep-panel",
      label: "Deep panel",
      note: "near-black · cream text · hairline",
      bg: "var(--background-color)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 28%, transparent)",
    },
    {
      id: "gold-rim",
      label: "Gold rim",
      note: "deep panel · gold edge",
      bg: "color-mix(in srgb, var(--background-mid) 88%, #000)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--accent-1) 55%, transparent)",
    },
    {
      id: "warm-glass",
      label: "Warm glass",
      note: "translucent cream wash",
      bg: "color-mix(in srgb, var(--accent-3) 82%, transparent)",
      fg: "#16130e",
      border: "color-mix(in srgb, var(--accent-1) 40%, transparent)",
    },
    {
      id: "accent-wash",
      label: "Accent wash",
      note: "soft gold fill · dark text",
      bg: "color-mix(in srgb, var(--accent-1) 28%, var(--background-mid))",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--accent-1) 50%, transparent)",
    },
    {
      id: "neutral-chip",
      label: "Neutral chip",
      note: "selected surface · cream text",
      bg: "var(--surface-selected)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 18%, transparent)",
    },
  ] as const;
</script>

<PageShell class="gap-10">
  <PageHeader
    eyebrow="Dev"
    title="UI gallery"
    lede="Living surface for tokens and shared primitives. Icon style follows Display settings ({iconStyleNote})."
  />

  <!-- ── Usage series chart ─────────────────────────────────────────────── -->
  <section class="gallery-section" id="usage-series">
    <div class="section-head">
      <p class="concept-kicker">Analytics · usage over versions</p>
      <h2>Usage series chart</h2>
      <p>
        Live <code>/api/character-analytics</code> → SVG line. Prototype for the character
        Analytics tab.
      </p>
    </div>

    <Surface class="analytics-demo">
      <div class="analytics-controls">
        <div class="analytics-field">
          <span class="token-meta">Character</span>
          {#if analyticsCharOptions.length}
            <CharacterSearchSelect
              options={analyticsCharOptions}
              bind:value={analyticsNameId}
              getCharacter={(id) => analyticsCharById.get(id)}
              aria-label="Analytics character"
            />
          {:else}
            <p class="token-meta">Roster not loaded yet.</p>
          {/if}
        </div>
        <div class="analytics-field">
          <span class="token-meta">Mode</span>
          <SegmentedControl
            options={[
              { value: "stygian", label: "Stygian" },
              { value: "abyss", label: "Abyss" },
            ]}
            bind:value={analyticsMode}
            aria-label="Analytics mode"
          />
        </div>
      </div>

      {#if analyticsLoading}
        <LoadingState message="Loading analytics…" class="analytics-loading" />
      {:else if analyticsError}
        <EmptyState message={analyticsError} />
      {:else if analyticsPayload}
        <UsageSeriesChart points={analyticsPayload.usage} />
        <p class="token-meta analytics-meta">
          {analyticsPayload.usage.length} versions · {analyticsPayload.teams
            .length} team rows
        </p>
      {:else}
        <EmptyState message="Pick a character to load usage history." />
      {/if}
    </Surface>
  </section>

  <!-- ── Unboxed route chrome ───────────────────────────────────────────── -->
  <section class="gallery-section" id="unboxed-chrome">
    <div class="section-head">
      <p class="concept-kicker">Route study · drop the outer board</p>
      <h2>Unboxed character &amp; settings</h2>
      <p>
        Left = current flush <code>Surface</code> wrapping everything. Right = hero
        / page head on the page, rail + body without an outer card — Surfaces only
        on content chunks.
      </p>
    </div>

    <div class="unbox-compare">
      <article class="unbox-col">
        <header class="unbox-col-head">
          <span class="unbox-badge">Current</span>
          <p class="nav-study-name">Boxed board</p>
        </header>
        <Surface flush class="unbox-board">
          <div
            class="unbox-hero"
            style="--detail-accent: {detailAccent}; background-image: {detailNamecard};"
          >
            <div class="unbox-hero-scrim"></div>
            <div class="unbox-hero-copy">
              <p class="detail-eyebrow">
                {detailDemoChar?.name ?? "Character"}
              </p>
              <p class="unbox-hero-title">Builds · Teams · Kit</p>
            </div>
          </div>
          <div class="unbox-split">
            <nav class="unbox-rail" aria-hidden="true">
              <span class="active">Builds</span>
              <span>Teams</span>
              <span>Analytics</span>
              <span>Kit</span>
            </nav>
            <div class="unbox-body">
              <p class="token-meta">Tab content lives inside the same card.</p>
              <div class="unbox-fake-rows">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </Surface>
      </article>

      <article class="unbox-col">
        <header class="unbox-col-head">
          <span class="unbox-badge unbox-badge-next">Proposed</span>
          <p class="nav-study-name">Unboxed</p>
        </header>
        <div class="unbox-open">
          <div
            class="unbox-hero unbox-hero-open"
            style="--detail-accent: {detailAccent}; background-image: {detailNamecard};"
          >
            <div class="unbox-hero-scrim"></div>
            <div class="unbox-hero-copy">
              <p class="detail-eyebrow">
                {detailDemoChar?.name ?? "Character"}
              </p>
              <p class="unbox-hero-title">Builds · Teams · Kit</p>
            </div>
          </div>
          <div class="unbox-split unbox-split-open">
            <nav class="unbox-rail" aria-hidden="true">
              <span class="active">Builds</span>
              <span>Teams</span>
              <span>Analytics</span>
              <span>Kit</span>
            </nav>
            <div class="unbox-body">
              <p class="token-meta">Page background shows through.</p>
              <Surface class="unbox-chunk">
                <p class="surface-label">Local surface</p>
                <p class="token-meta">Only content blocks get a card.</p>
              </Surface>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="unbox-compare">
      <article class="unbox-col">
        <header class="unbox-col-head">
          <span class="unbox-badge">Current</span>
          <p class="nav-study-name">Settings board</p>
        </header>
        <Surface flush class="unbox-board">
          <div class="unbox-split">
            <nav class="unbox-rail" aria-hidden="true">
              <span class="active">Roster</span>
              <span>Account</span>
              <span>Display</span>
            </nav>
            <div class="unbox-body">
              <p class="surface-label">Display</p>
              <div class="unbox-fake-rows">
                <span></span><span></span>
              </div>
            </div>
          </div>
        </Surface>
      </article>

      <article class="unbox-col">
        <header class="unbox-col-head">
          <span class="unbox-badge unbox-badge-next">Proposed</span>
          <p class="nav-study-name">Settings open</p>
        </header>
        <div class="unbox-open">
          <p class="unbox-page-title">Settings</p>
          <div class="unbox-split unbox-split-open">
            <nav class="unbox-rail" aria-hidden="true">
              <span class="active">Roster</span>
              <span>Account</span>
              <span>Display</span>
            </nav>
            <div class="unbox-body">
              <Surface class="unbox-chunk">
                <p class="surface-label">Display</p>
                <p class="token-meta">Panel content in a local surface.</p>
              </Surface>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>

  <!-- ── Character detail concepts ─────────────────────────────────────── -->
  <section class="gallery-section detail-concepts" id="character-detail">
    <div class="section-head detail-concept-head">
      <div>
        <p class="concept-kicker">Route study · /characters/[slug]</p>
        <h2>Character detail concepts</h2>
        <p>
          Three ways to separate the portrait from the identity copy while
          leaving the existing tab content and information density intact.
        </p>
      </div>
      <div
        class="concept-picker"
        role="group"
        aria-label="Character detail concept"
      >
        {#each DETAIL_CONCEPTS as concept}
          <Chip
            active={detailConcept === concept.value}
            onclick={() => (detailConcept = concept.value)}
          >
            {concept.label}
          </Chip>
        {/each}
      </div>
    </div>

    <p class="concept-note">
      {DETAIL_CONCEPTS.find((concept) => concept.value === detailConcept)?.note}
    </p>

    {#if detailDemoChar}
      <div class="detail-prototype" style="--detail-accent: {detailAccent};">
        {#if detailConcept === "dossier"}
          <header class="detail-hero detail-hero-dossier">
            <div
              class="detail-atmosphere"
              style="background-image: {detailNamecard};"
            ></div>
            <div class="detail-hero-scrim"></div>
            <a class="detail-back" href="#character-detail">← All characters</a>

            <div class="dossier-layout">
              <div class="dossier-portrait">
                <CharacterIcon
                  character={detailDemoChar}
                  iconStyle="tcg"
                  loading="eager"
                />
              </div>

              <div class="dossier-identity">
                <p class="detail-eyebrow">{detailTitle}</p>
                <h3>{detailDemoChar.name}</h3>
                <div class="detail-meta-line">
                  <span>{detailDemoChar.element}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    >{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</span
                  >
                  <span aria-hidden="true">·</span>
                  <span>{detailDemoChar.rarity}★</span>
                  <span aria-hidden="true">·</span>
                  <span>{detailRegion}</span>
                </div>
              </div>
            </div>
          </header>
        {:else if detailConcept === "nameplate"}
          <header class="detail-hero detail-hero-nameplate">
            <div
              class="detail-atmosphere"
              style="background-image: {detailNamecard};"
            ></div>
            <div class="detail-hero-scrim"></div>
            <a class="detail-back" href="#character-detail">← All characters</a>
            <div class="nameplate-portrait">
              <CharacterIcon
                character={detailDemoChar}
                iconStyle="tcg"
                loading="eager"
              />
            </div>
            <div class="nameplate-bar">
              <div>
                <p class="detail-eyebrow">{detailTitle}</p>
                <h3>{detailDemoChar.name}</h3>
              </div>
              <div class="nameplate-meta">
                <span>{detailDemoChar.element}</span>
                <span>{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</span>
                <span>{detailDemoChar.rarity}★</span>
                <span>{detailRegion}</span>
              </div>
            </div>
          </header>
        {:else}
          <header class="detail-hero detail-hero-compact">
            <div class="compact-portrait">
              <CharacterIcon
                character={detailDemoChar}
                iconStyle="enka"
                loading="eager"
              />
            </div>
            <div class="compact-identity">
              <a class="detail-back" href="#character-detail"
                >← All characters</a
              >
              <p class="detail-eyebrow">{detailTitle}</p>
              <h3>{detailDemoChar.name}</h3>
            </div>
            <dl class="compact-facts">
              <div>
                <dt>Element</dt>
                <dd>{detailDemoChar.element}</dd>
              </div>
              <div>
                <dt>Weapon</dt>
                <dd>{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{detailRegion}</dd>
              </div>
            </dl>
          </header>
        {/if}
      </div>
    {:else}
      <Surface variant="empty">
        <p class="token-meta">
          Character data has not loaded yet. The concept will appear once the
          roster store is ready.
        </p>
      </Surface>
    {/if}
  </section>

  <!-- ── Scalable character navigation ─────────────────────────────────── -->
  <section class="gallery-section" id="character-navigation">
    <div class="section-head">
      <p class="concept-kicker">Navigation study · six-section stress test</p>
      <h2>Responsive ledger index</h2>
      <p>
        A persistent rail when space allows, collapsing into a full-width
        section disclosure on mobile. Notes and Media are marked future so the
        pattern can be tested under growth.
      </p>
    </div>

    <div class="nav-study-stack">
      <article class="nav-study">
        <header class="nav-study-head">
          <div>
            <p class="nav-study-name">Ledger rail</p>
            <p class="nav-study-note">
              Same visual language at both sizes—only its orientation changes.
            </p>
          </div>
          <span class="nav-study-fit">Responsive</span>
        </header>

        <div class="ledger-shell" class:mobile-open={ledgerMobileOpen}>
          <button
            type="button"
            class="ledger-mobile-trigger"
            aria-expanded={ledgerMobileOpen}
            aria-controls="ledger-mobile-index"
            onclick={() => (ledgerMobileOpen = !ledgerMobileOpen)}
          >
            <span>
              <small>Section</small>
              <strong>{railDemoActive.label}</strong>
            </span>
            <span class="ledger-trigger-mark" aria-hidden="true"></span>
          </button>

          <nav
            class="ledger-rail"
            id="ledger-mobile-index"
            aria-label="Character section index"
            style:--section-count={CHARACTER_SECTION_DEMOS.length}
          >
            {#each CHARACTER_SECTION_DEMOS as section (section.value)}
              <button
                type="button"
                aria-pressed={railDemoSection === section.value}
                class:active={railDemoSection === section.value}
                onclick={() => {
                  railDemoSection = section.value;
                  ledgerMobileOpen = false;
                }}
              >
                <span>{section.label}</span>
                {#if section.future}<small>Future</small>{/if}
              </button>
            {/each}
          </nav>
          <div class="nav-content-sample">
            <p class="nav-content-kicker">Character record</p>
            <h3>{railDemoActive.label}</h3>
            <p>{railDemoActive.summary}</p>
            {#if railDemoActive.future}
              <span class="future-notice">Scale test only</span>
            {/if}
          </div>
        </div>
      </article>
    </div>
  </section>

  <!-- ── Stat goals layout study ───────────────────────────────────────── -->
  <section class="gallery-section" id="stat-goals-layout">
    <div class="section-head">
      <p class="concept-kicker">Character builds · Stat goals</p>
      <h2>Layout options</h2>
      <p>
        Current character page stacks team picker → gear list → link → sheet in
        a 22rem column. Compare denser arrangements — same mock content.
      </p>
    </div>

    <div class="sg-archetype-bar">
      <span class="token-meta">Active archetype</span>
      <SegmentedControl
        options={STAT_GOAL_ARCHETYPES.map((a) => ({
          value: a.id,
          label: a.label,
        }))}
        bind:value={statGoalArchetypeId}
        aria-label="Stat goal archetype"
      />
    </div>

    <div class="sg-options">
      <!-- A · Current stack -->
      <article class="sg-option">
        <header class="sg-option-head">
          <h3>A · Current stack</h3>
          <p>
            Narrow column: party strip, then named gear rows, then stats. Gear
            names dominate; goals feel like an afterthought.
          </p>
        </header>
        <div class="sg-frame">
          <h4 class="section-title">Stat goals</h4>
          <p class="section-lede sg-lede">
            One team per reaction archetype (highest DPS).
          </p>
          <div class="sg-a">
            <div class="sg-a-picker">
              <div class="sg-party">
                {#each statGoalTeam as c, i (c.name_id ?? i)}
                  <div class="sg-slot" class:featured={i === 0}>
                    <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                  </div>
                {/each}
              </div>
              <button type="button" class="sg-gear-btn" aria-label="Other teams">
                <IconCog size={16} />
              </button>
            </div>
            <div class="sg-gear-list">
              <div class="sg-gear-row">
                <span class="sg-gear-box" aria-hidden="true"></span>
                <div>
                  <p class="meta-name">{statGoalArchetype.weapon}</p>
                  <p class="meta-sub">R5</p>
                </div>
              </div>
              <div class="sg-gear-row">
                <span class="sg-gear-box" aria-hidden="true"></span>
                <div>
                  <p class="meta-name">{statGoalArchetype.set}</p>
                  <p class="meta-sub">artifact</p>
                </div>
              </div>
            </div>
            <a class="sg-team-link" href="#stat-goals-layout">View team details →</a>
            <div class="sg-stat-stack">
              {#each statGoalArchetype.stats as row (row.key)}
                <StatRow
                  label={row.label}
                  value={row.value}
                  icon={statIconUrl(row.key)}
                />
              {/each}
            </div>
          </div>
        </div>
      </article>

      <!-- B · Split pane -->
      <article class="sg-option">
        <header class="sg-option-head">
          <h3>B · Split pane</h3>
          <p>
            Context left (party + compact gear), goals right. Stats get equal
            weight without fighting the picker for vertical space.
          </p>
        </header>
        <div class="sg-frame">
          <h4 class="section-title">Stat goals</h4>
          <div class="sg-b">
            <div class="sg-b-context">
              <div class="sg-party">
                {#each statGoalTeam as c, i (c.name_id ?? i)}
                  <div class="sg-slot" class:featured={i === 0}>
                    <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                  </div>
                {/each}
              </div>
              <p class="sg-fingerprint meta-sub">
                {statGoalArchetype.label}
                · {statGoalArchetype.invest === "high" ? "high invest" : "checklist"}
              </p>
              <div class="sg-gear-chips">
                <span class="sg-chip">{statGoalArchetype.weapon}</span>
                <span class="sg-chip">{statGoalArchetype.set}</span>
              </div>
              <a class="sg-team-link" href="#stat-goals-layout">Team details →</a>
            </div>
            <div class="sg-b-goals" aria-label="Target sheet">
              {#each statGoalArchetype.stats as row (row.key)}
                <StatRow
                  label={row.label}
                  value={row.value}
                  icon={statIconUrl(row.key)}
                />
              {/each}
            </div>
          </div>
        </div>
      </article>

      <!-- C · Goals first -->
      <article class="sg-option">
        <header class="sg-option-head">
          <h3>C · Goals first</h3>
          <p>
            Sheet is the hero. Archetype tabs pick the team; gear stays a thin
            caption under the numbers.
          </p>
        </header>
        <div class="sg-frame">
          <div class="sg-c-head">
            <h4 class="section-title">Stat goals</h4>
            <div class="sg-arch-tabs" role="group" aria-label="Archetype">
              {#each STAT_GOAL_ARCHETYPES as arch (arch.id)}
                <button
                  type="button"
                  class="sg-arch-tab"
                  class:active={statGoalArchetypeId === arch.id}
                  aria-pressed={statGoalArchetypeId === arch.id}
                  onclick={() => (statGoalArchetypeId = arch.id)}
                >
                  {arch.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="sg-c-goals">
            {#each statGoalArchetype.stats as row (row.key)}
              {@const icon = statIconUrl(row.key)}
              <div class="sg-goal-cell">
                <span class="sg-goal-label">
                  {#if icon}
                    <img src={icon} alt="" />
                  {/if}
                  {row.label}
                </span>
                <strong class="sg-goal-value">{row.value}</strong>
              </div>
            {/each}
          </div>
          <div class="sg-c-foot">
            <div class="sg-party sg-party--sm">
              {#each statGoalTeam as c, i (c.name_id ?? i)}
                <div class="sg-slot" class:featured={i === 0}>
                  <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                </div>
              {/each}
            </div>
            <p class="meta-sub">
              {statGoalArchetype.weapon} · {statGoalArchetype.set}
              <a class="sg-inline-link" href="#stat-goals-layout"> details</a>
            </p>
          </div>
        </div>
      </article>

      <!-- D · Compact strip -->
      <article class="sg-option">
        <header class="sg-option-head">
          <h3>D · Compact strip</h3>
          <p>
            One chrome row (party + cog + gear icons), then a 2-column goal
            grid. Closest to “one card, one job.”
          </p>
        </header>
        <div class="sg-frame">
          <h4 class="section-title">Stat goals</h4>
          <div class="sg-d">
            <div class="sg-d-chrome">
              <div class="sg-party sg-party--sm">
                {#each statGoalTeam as c, i (c.name_id ?? i)}
                  <div class="sg-slot" class:featured={i === 0}>
                    <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                  </div>
                {/each}
              </div>
              <div class="sg-d-gear">
                <span
                  class="sg-gear-box sg-gear-box--sm"
                  role="img"
                  aria-label={`Weapon: ${statGoalArchetype.weapon}`}
                  title={`Weapon: ${statGoalArchetype.weapon}`}
                ></span>
                <span
                  class="sg-gear-box sg-gear-box--sm"
                  role="img"
                  aria-label={`Artifact set: ${statGoalArchetype.set}`}
                  title={`Artifact set: ${statGoalArchetype.set}`}
                ></span>
              </div>
              <button
                type="button"
                class="sg-gear-btn"
                class:open={statGoalMenuOpen}
                aria-expanded={statGoalMenuOpen}
                aria-label="Other teams"
                onclick={() => (statGoalMenuOpen = !statGoalMenuOpen)}
              >
                <IconCog size={16} />
              </button>
            </div>
            {#if statGoalMenuOpen}
              <div class="sg-d-alts">
                {#each statGoalAlts as alt (alt.id)}
                  <button
                    type="button"
                    class="sg-d-alt"
                    onclick={() => {
                      statGoalArchetypeId = alt.id;
                      statGoalMenuOpen = false;
                    }}
                  >
                    <span class="meta-name">{alt.label}</span>
                    <span class="meta-sub">{alt.weapon}</span>
                  </button>
                {/each}
              </div>
            {/if}
            <div class="sg-d-goals">
              {#each statGoalArchetype.stats as row (row.key)}
                <StatRow
                  label={row.label}
                  value={row.value}
                  icon={statIconUrl(row.key)}
                />
              {/each}
            </div>
            <a class="sg-team-link" href="#stat-goals-layout">View team details →</a>
          </div>
        </div>
      </article>
    </div>
  </section>

  <!-- ── Character team source control ─────────────────────────────────── -->
  <section class="gallery-section" id="team-source-control">
    <div class="section-head">
      <p class="concept-kicker">Character teams · source control</p>
      <h2>Borderless source menu</h2>
      <p>
        Keep the familiar dropdown, but reduce its trigger to selected text and
        a chevron. The menu itself retains the bordered surface.
      </p>
    </div>

    <div class="team-source-demo">
      <header class="team-source-demo-head">
        <div>
          <p class="nav-content-kicker">Teams</p>
          <h3>Popular lineups</h3>
        </div>
        <p>Choose where the rankings come from.</p>
      </header>

      <div class="source-menu-row">
        <span>Teams:</span>
        <Select
          options={TEAM_SOURCE_DEMOS}
          bind:value={teamSourceDemo}
          bare
          aria-label="Team source demo"
        />
      </div>

      <div class="team-source-result" aria-live="polite">
        <span>Showing</span>
        <p>{activeTeamSourceDemo.summary}</p>
      </div>
    </div>
  </section>

  <!-- ── Tokens ─────────────────────────────────────────────────────────── -->
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
        Derived from paint. Accent is solid text/border only — selected fills
        use neutral surface washes.
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

  <!-- ── Surfaces ───────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="surfaces">
    <div class="section-head">
      <h2>Surface</h2>
      <p>
        Shared <code>Surface</code> primitive — default / interactive / inset / empty.
      </p>
    </div>
    <div class="surface-row">
      <Surface>
        <p class="surface-label">Default</p>
        <p class="token-meta">surface-raised + border-default</p>
      </Surface>
      <Surface variant="interactive">
        <p class="surface-label">Interactive</p>
        <p class="token-meta">Hover strengthens border</p>
      </Surface>
      <Surface variant="inset">
        <p class="surface-label">Inset</p>
        <p class="token-meta">Neutral wash for nested blocks</p>
      </Surface>
      <Surface variant="empty">
        <p class="surface-label">Empty / loading</p>
        <p class="token-meta">Quiet mid text, dashed border</p>
      </Surface>
    </div>
  </section>

  <!-- ── Controls ───────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="controls">
    <div class="section-head">
      <h2>Controls</h2>
      <p>
        Shared <code>PickModal</code>, <code>CharacterSearchSelect</code>,
        <code>SegmentedControl</code>, <code>Select</code>, <code>Chip</code>,
        <code>Toggle</code>, <code>Button</code>, <code>Badge</code>.
      </p>
    </div>

    <div class="control-stack">
      <Surface>
        <p class="surface-label">PickModal</p>
        <p class="token-meta mb-2">
          Full-viewport character / weapon picker (Planner + Character / +
          Weapon). Portrait grid for characters, square icon grid for weapons.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onclick={() => openPickDemo("character")}
            >Open character pick</Button
          >
          <Button variant="secondary" onclick={() => openPickDemo("weapon")}
            >Open weapon pick</Button
          >
          {#if pickDemoChoice}
            <span class="token-meta">Last pick: {pickDemoChoice}</span>
          {/if}
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">CharacterSearchSelect</p>
        <p class="token-meta mb-2">
          Combobox used in Planner configure — character portraits or weapon
          icons in the suggestion menu.
        </p>
        <div class="flex flex-wrap items-end gap-4">
          <label class="demo-field">
            <span class="token-meta">Character</span>
            <CharacterSearchSelect
              bind:value={pickDemoCharValue}
              options={pickDemoCharOptions}
              getCharacter={(id) => pickDemoCharById.get(id)}
              placeholder="Search character…"
              aria-label="Demo character search"
            />
          </label>
          <label class="demo-field">
            <span class="token-meta">Weapon</span>
            <CharacterSearchSelect
              bind:value={pickDemoWeaponValue}
              options={pickDemoWeaponOptions}
              getIconSrc={(key) => weaponIconSrc(key)}
              placeholder="Search weapon…"
              aria-label="Demo weapon search"
            />
          </label>
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">SegmentedControl</p>
        <SegmentedControl
          options={SEGMENT_OPTIONS}
          bind:value={segment}
          aria-label="Demo segment"
        />
      </Surface>

      <Surface>
        <p class="surface-label">Select</p>
        <p class="token-meta mb-2">
          Custom listbox dropdown (same chrome as the character filter Sort
          control). Menu anchors left/right from the trigger’s viewport side.
          Optional fixed <code>trigger</code> label.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Select
            bind:value={selectDemo}
            aria-label="Demo select"
            options={[
              { value: "stygian", label: "Stygian" },
              { value: "abyss", label: "Abyss" },
              { value: "simulated", label: "Simulated" },
            ]}
          />
          <Select
            bind:value={selectDemo}
            trigger="Sort"
            aria-label="Demo sort"
            options={[
              { value: "stygian", label: "Stygian" },
              { value: "abyss", label: "Abyss" },
              { value: "simulated", label: "Simulated" },
            ]}
          />
        </div>
        <p class="token-meta mt-2">Value: {selectDemo}</p>
      </Surface>

      <Surface>
        <p class="surface-label">Chips</p>
        <div class="chip-row">
          <Chip active={chipOn} onclick={() => (chipOn = !chipOn)}>Owned</Chip>
          {#each Object.entries(ELEMENT_COLORS) as [el, color]}
            <Chip style="border-color: {color}; color: {color};">{el}</Chip>
          {/each}
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">Toggle + Button</p>
        <div class="flex flex-wrap items-center gap-3">
          <Toggle bind:pressed={toggleOn} aria-label="Demo toggle" />
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">
            <IconFilter size={14} />
            Filters
          </Button>
          <Button variant="icon" aria-label="Settings">
            <IconCog size={16} />
          </Button>
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">Badges</p>
        <div class="chip-row">
          <Badge tone="gold">R5</Badge>
          <Badge tone="mint">4pc</Badge>
          <Badge tone="muted">NEW</Badge>
          <Badge tone="warn">missing</Badge>
        </div>
      </Surface>
    </div>
  </section>

  <!-- ── New patterns (pre-migration) ───────────────────────────────────── -->
  <section class="gallery-section" id="patterns">
    <div class="section-head">
      <h2>New patterns</h2>
      <p>
        Candidates for route migration — SlidingTabs, CharacterPortraitCard,
        CharacterFilterBar, TeamCardHand, CharacterTagSearch, SolutionDots,
        EmptyState, LoadingState.
      </p>
    </div>

    <div class="control-stack">
      <Surface>
        <p class="surface-label">SlidingTabs</p>
        <p class="token-meta mb-2">
          Indicator tablist (Abyss / Stygian / character detail). Accent can be
          slot gold or element color. Below 640px only the first tab stays
          direct and the other two move into the "More" control (<code
            >mobileMaxVisible</code
          >).
        </p>
        <SlidingTabs
          options={SLIDING_TAB_OPTIONS}
          bind:value={slidingTab}
          accent={slidingAccent}
          maxVisible={3}
          mobileMaxVisible={2}
          aria-label="Demo sliding tabs"
        />
        <div
          role="tabpanel"
          id="tabpanel-{slidingTab}"
          aria-labelledby="tab-{slidingTab}"
          class="token-meta mt-2"
        >
          Active: {slidingTab}
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">SolutionDots</p>
        <p class="token-meta mb-2">
          Pager for alternate Abyss / Stygian solutions.
        </p>
        <SolutionDots count={4} bind:index={solutionIndex} />
        <p class="token-meta mt-2">Index: {solutionIndex}</p>
      </Surface>

      <Surface>
        <p class="surface-label">CharacterPortraitCard</p>
        <p class="token-meta mb-2">
          Portrait tile with shine hover, optional dim / tint / meta overlay.
          Link vs static.
        </p>
        {#if sampleChars.length}
          <div class="portrait-grid">
            {#each sampleChars.slice(0, 4) as character, i (character.name_id)}
              <CharacterPortraitCard
                {character}
                href="/characters/{character.name_id}"
                tintBackground={i % 2 === 1}
                dimmed={i === 3}
              >
                {#snippet badge()}
                  {#if isNewCharacter(character.released_at)}
                    <span class="new-badge absolute top-1.5 right-1.5 z-20"
                      >NEW</span
                    >
                  {:else if i === 1}
                    <span
                      class="absolute top-1 right-1 z-20 text-[0.7rem] leading-none"
                      style="color: var(--accent-1);"
                      aria-label="Best team">★</span
                    >
                  {/if}
                {/snippet}
                {#snippet meta()}
                  <div
                    class="text-[0.7rem] font-medium leading-tight truncate"
                    style="color: var(--foreground-color);"
                  >
                    {character.name}
                  </div>
                  <div
                    class="text-[0.6rem] leading-tight truncate"
                    style="color: var(--foreground-mid);"
                  >
                    {character.rarity}★ · {weaponTypeLabel(
                      character.weapon_type ?? "",
                    )}
                  </div>
                {/snippet}
              </CharacterPortraitCard>
            {/each}
          </div>
        {:else}
          <p class="token-meta">Roster not loaded yet.</p>
        {/if}
      </Surface>

      <Surface>
        <p class="surface-label">TeamCardHand</p>
        <p class="token-meta mb-2">
          Four portraits as a held hand — fan + overlap. Candidate for the Teams
          spotlight card. Hover lifts a card.
        </p>
        {#if sampleChars.length >= 4}
          {@const handChars = sampleChars.slice(0, 4)}
          {@const demoBuilds = [
            { cons: 0, weaponRefinement: 1, weaponKey: "PrototypeAmber" },
            { cons: 2, weaponRefinement: 1, weaponKey: "StaffOfHoma" },
            { cons: 0, weaponRefinement: 5, weaponKey: "FavoniusCodex" },
            { cons: 6, weaponRefinement: 1, weaponKey: "SkywardBlade" },
          ]}
          <p class="token-meta mb-1">spread = hand · stack = right (default)</p>
          <TeamCardHand
            characters={handChars}
            builds={demoBuilds}
            starredKeys={new Set([handChars[1]?.name_id ?? ""])}
            dimmedKeys={new Set([handChars[3]?.name_id ?? ""])}
          />
          <p class="token-meta mb-1 mt-4">spread = hand · stack = left</p>
          <TeamCardHand
            characters={handChars}
            builds={demoBuilds}
            stack="left"
          />
          <p class="token-meta mb-1 mt-4">spread = flat (overlap only)</p>
          <TeamCardHand
            characters={handChars}
            builds={demoBuilds}
            spread="flat"
          />
        {:else}
          <p class="token-meta">Need at least 4 roster characters to demo.</p>
        {/if}
      </Surface>

      <Surface>
        <p class="surface-label">CharacterTagSearch</p>
        <p class="token-meta mb-2">
          Combobox tag filter with optional leading control (gear). Used on
          Teams.
        </p>
        {#if demoTagOptions.length}
          <CharacterTagSearch
            bind:tags={demoTags}
            options={demoTagOptions}
            getLabel={(key) => demoCharByKey.get(key)?.name ?? key}
            getCharacter={(key) => demoCharByKey.get(key)}
            countLabel="{demoTags.length} selected"
          >
            {#snippet leading()}
              <button
                type="button"
                class="demo-gear"
                aria-label="Demo settings gear"
              >
                <IconCog size={16} />
              </button>
            {/snippet}
          </CharacterTagSearch>
          <p class="token-meta mt-2">
            Type a name to add tags. Tags: {demoTags.length
              ? demoTags.join(", ")
              : "none"}
          </p>
        {:else}
          <p class="token-meta">Roster not loaded yet.</p>
        {/if}
      </Surface>

      <Surface>
        <p class="surface-label">Character grid</p>
        <p class="token-meta mb-2">
          Shared filter bar + CharacterPortraitCard. Browse = links; Roster =
          toggle owned with the same dim overlay. Affordance prototypes apply to
          Browse only. Cap 24 for the gallery.
        </p>
        <SegmentedControl
          options={[
            { value: "browse", label: "Browse" },
            { value: "roster", label: "Roster" },
          ]}
          bind:value={gridMode}
          aria-label="Grid interaction mode"
        />
        {#if gridMode === "browse"}
          <div class="mt-2">
            <p class="token-meta mb-1">Affordance</p>
            <SegmentedControl
              options={[
                { value: "hint", label: "Hint" },
                { value: "flip", label: "Flip" },
                { value: "both", label: "Both" },
              ]}
              bind:value={gridAffordance}
              aria-label="Browse navigate affordance"
            />
          </div>
        {/if}
        <div class="mt-2">
          <CharacterFilterBar
            bind:search={gridSearch}
            bind:rarityFilter={gridRarity}
            bind:elementFilter={gridElements}
            bind:weaponFilter={gridWeapons}
            bind:ownershipFilter={gridOwnership}
            bind:sortBy={gridSortBy}
            bind:sortAsc={gridSortAsc}
          />
        </div>
        {#if showGridHint}
          <div class="grid-page-head mt-3">
            <p class="grid-page-title">Characters</p>
            <p class="grid-page-hint">Tap a character for details</p>
          </div>
        {/if}
        <p class="token-meta mt-2 mb-2">{gridVisible.length} shown</p>
        {#if gridVisible.length}
          <div class="character-grid">
            {#each gridVisible as character (character.name_id)}
              {#if gridMode === "browse"}
                {#if useFlipCards}
                  <BrowseFlipCard
                    {character}
                    href="/characters/{character.name_id}"
                    dimmed={!character.isOwned}
                  />
                {:else}
                  <CharacterPortraitCard
                    {character}
                    href="/characters/{character.name_id}"
                    tintBackground
                    dimmed={!character.isOwned}
                  >
                    {#snippet badge()}
                      {#if isNewCharacter(character.released_at)}
                        <span class="new-badge absolute top-1.5 right-1.5 z-20"
                          >NEW</span
                        >
                      {/if}
                    {/snippet}
                    {#snippet meta()}
                      <div class="grid-meta-name">{character.name}</div>
                      <div class="grid-meta-sub">
                        {character.rarity}★ · {weaponTypeLabel(
                          character.weapon_type ?? "",
                        )}
                      </div>
                    {/snippet}
                  </CharacterPortraitCard>
                {/if}
              {:else}
                <CharacterPortraitCard
                  {character}
                  tintBackground
                  dimmed={!character.isOwned}
                  pressed={character.isOwned}
                  onclick={() => toggleGridOwned(character.name_id)}
                >
                  {#snippet badge()}
                    {#if isNewCharacter(character.released_at)}
                      <span class="new-badge absolute top-1.5 right-1.5 z-20"
                        >NEW</span
                      >
                    {/if}
                  {/snippet}
                  {#snippet meta()}
                    <div class="grid-meta-name">{character.name}</div>
                    <div class="grid-meta-sub">
                      {character.rarity}★ · {weaponTypeLabel(
                        character.weapon_type ?? "",
                      )}
                    </div>
                  {/snippet}
                </CharacterPortraitCard>
              {/if}
            {/each}
          </div>
        {:else}
          <EmptyState message="No characters match." />
        {/if}
      </Surface>

      <div class="status-row">
        <div>
          <p class="surface-label">EmptyState</p>
          <EmptyState message="No teams found with those characters.">
            {#snippet action()}
              <Button variant="primary">Clear filters</Button>
            {/snippet}
          </EmptyState>
        </div>
        <div>
          <p class="surface-label">LoadingState (plain)</p>
          <LoadingState message="Loading…" class="min-h-status" />
        </div>
        <div>
          <p class="surface-label">LoadingState (pulse)</p>
          <LoadingState variant="pulse" message="Loading investment data…" />
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
      <Surface>
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
          <p class="token-meta">
            Roster not loaded yet — refresh after hydrate.
          </p>
        {/if}
      </Surface>

      <Surface>
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
      </Surface>

      <Surface>
        <p class="surface-label">GameText</p>
        <GameText
          text={"Deals <color=#FFD780FF>Pyro DMG</color> equal to 200% of ATK. {LINK#demo}See talent{/LINK}."}
          resolveLink={() => "#components"}
        />
      </Surface>

      <Surface>
        <p class="surface-label">Tooltips</p>
        <p class="token-meta tip-palette-note">
          Hover shows a capped tip; click / tap opens a scrollable detail sheet.
          Color candidates below are always-visible mockups (current shell
          stays).
        </p>
        <div class="chip-row">
          <div class="group relative inline-flex">
            <Button>Weapon</Button>
            <WeaponTooltip weaponKey="EngulfingLightning" refinement={1} />
          </div>
          <div class="group relative inline-flex">
            <Button>Artifact</Button>
            <ArtifactTooltip setKey="EmblemOfSeveredFate" pieceCount={4} />
          </div>
          <div class="group relative inline-flex">
            <Button variant="ghost">
              <IconInfo size={14} />
              Current shell
            </Button>
            <HoverTooltip class="max-w-64" label="Current shell">
              <div class="tip-detail-text font-medium">Engulfing Lightning</div>
              <div
                class="tip-detail-text tip-detail-text--small mt-0.5 opacity-85"
              >
                5★ · Polearm · Base ATK 608 · ER 55.1%
              </div>
              <div
                class="tip-detail-text tip-detail-text--small mt-1.5 opacity-85"
              >
                Current: creamy --foreground-mid on near-black
                --background-color.
              </div>
            </HoverTooltip>
          </div>
        </div>

        <div class="tip-palette">
          {#each TIP_TONE_OPTIONS as tone (tone.id)}
            <div class="tip-candidate">
              <div class="tip-candidate-head">
                <span class="tip-candidate-label">{tone.label}</span>
                <span class="token-meta">{tone.note}</span>
              </div>
              <div
                class="tip-mock"
                style:background={tone.bg}
                style:color={tone.fg}
                style:border-color={tone.border}
              >
                <div class="tip-mock-title">Engulfing Lightning</div>
                <div class="tip-mock-meta">
                  5★ · Polearm · Base ATK 608 · ER 55.1%
                </div>
                <div class="tip-mock-body">
                  ATK increased by 28% of Energy Recharge over 100%. You can
                  gain a maximum of 80% ATK.
                </div>
              </div>
            </div>
          {/each}
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">Animation performance</p>
        <p class="token-meta perf-note">
          Hover each card. Left column = cheap (compositor-only), right column =
          costly (triggers paint / layout). Same visual, different cost.
        </p>

        <div class="perf-grid">
          <div class="perf-pair">
            <span class="perf-pair-label good">✓ box-shadow, static</span>
            <div class="perf-card perf-shadow-good">
              <span>Cheap shadow</span>
            </div>
            <span class="token-meta">Shadow baked in; hover only moves it.</span
            >
          </div>

          <div class="perf-pair">
            <span class="perf-pair-label bad">✗ drop-shadow filter</span>
            <div class="perf-card perf-shadow-bad">
              <span>Costly shadow</span>
            </div>
            <span class="token-meta">
              <code>filter: drop-shadow</code> repaints on every frame.
            </span>
          </div>

          <div class="perf-pair">
            <span class="perf-pair-label good">✓ transform + opacity</span>
            <div class="perf-card perf-transform-good">
              <span>Transform</span>
            </div>
            <span class="token-meta">
              <code>translate</code>/<code>scale</code> stay on the compositor.
            </span>
          </div>

          <div class="perf-pair">
            <span class="perf-pair-label bad">✗ animating layout</span>
            <div class="perf-card perf-transform-bad">
              <span>Layout</span>
            </div>
            <span class="token-meta">
              Animating <code>top</code>/<code>width</code> forces reflow.
            </span>
          </div>

          <div class="perf-pair">
            <span class="perf-pair-label good">✓ will-change on hover</span>
            <div class="perf-card perf-willchange">
              <span>Promoted</span>
            </div>
            <span class="token-meta">
              Layer hint added on hover, not left on permanently.
            </span>
          </div>

          <div class="perf-pair">
            <span class="perf-pair-label bad">✗ transitioning filter</span>
            <div class="perf-card perf-filter-bad">
              <span>Filter tween</span>
            </div>
            <span class="token-meta">
              Transitioning <code>filter</code> repaints the whole box.
            </span>
          </div>
        </div>
      </Surface>

      <Surface>
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
      </Surface>
    </div>
  </section>

  <!-- ── Sheet primitives ───────────────────────────────────────────────── -->
  <section class="gallery-section" id="sheet">
    <div class="section-head">
      <h2>Sheet primitives</h2>
      <p>Build-sheet rows and the shared section label recipe.</p>
    </div>
    <div class="surface-row">
      <Surface>
        <p class="surface-label">StatRow</p>
        <p class="token-meta mb-2">
          Label/value row for build sheets (<code>/teams/configs/[slug]</code>).
          Icon optional.
        </p>
        <div class="stat-stack">
          <StatRow label="ATK" value="2,184" icon={statIconUrl("atk")} />
          <StatRow
            label="CRIT Rate"
            value="72.4%"
            icon={statIconUrl("critRate_")}
          />
          <StatRow label="Energy Recharge" value="128.5%" />
        </div>
      </Surface>

      <Surface>
        <p class="surface-label">.eyebrow</p>
        <p class="token-meta mb-2">
          Global utility in <code>app.css</code>, not a component — pages layer
          color and spacing on top.
        </p>
        <div class="eyebrow-stack">
          <p class="eyebrow">Most used 5★</p>
          <p class="eyebrow eyebrow-accent">Solution 1 of 4</p>
        </div>
      </Surface>
    </div>
  </section>

  {#if pickDemoKind}
    <PickModal
      open
      title={pickDemoKind === "character" ? "Add character" : "Add weapon"}
      searchPlaceholder={pickDemoKind === "character"
        ? "Search character…"
        : "Search weapon…"}
      options={pickDemoKind === "character"
        ? pickDemoCharOptions
        : pickDemoWeaponOptions}
      art={pickDemoKind === "weapon" ? "square" : "portrait"}
      bind:query={pickDemoQuery}
      onClose={closePickDemo}
      onChoose={choosePickDemo}
    >
      {#snippet tile(opt)}
        {#if pickDemoKind === "character"}
          <CharacterPortraitCard
            character={pickDemoCharById.get(opt.value)}
            tintBackground
          />
        {:else}
          {@const src = weaponIconSrc(opt.value)}
          <div class="weapon-tile">
            {#if src}
              <img {src} alt="" loading="lazy" />
            {/if}
          </div>
        {/if}
      {/snippet}
    </PickModal>
  {/if}
</PageShell>

<style>
  .gallery-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .demo-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 14rem;
  }

  .weapon-tile {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--background-mid);
  }

  :global(.analytics-demo) {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .analytics-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: end;
  }

  .analytics-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 10rem;
  }

  :global(.analytics-loading) {
    min-height: 12rem;
  }

  .analytics-meta {
    margin: 0;
  }

  /* ── Unboxed route chrome ─────────────────────────────────────────── */
  .unbox-compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .unbox-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .unbox-col-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .unbox-badge {
    flex-shrink: 0;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 20%, transparent);
    border-radius: var(--radius-pill);
    padding: 0.15rem 0.45rem;
    color: var(--foreground-mid);
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .unbox-badge-next {
    border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
    color: var(--accent-1);
  }

  :global(.unbox-board) {
    overflow: hidden;
  }

  .unbox-open {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .unbox-page-title {
    margin: 0;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  .unbox-hero {
    position: relative;
    isolation: isolate;
    min-height: 7.5rem;
    background-position: center;
    background-size: cover;
  }

  .unbox-hero-open {
    overflow: hidden;
    border-radius: var(--radius-lg);
  }

  .unbox-hero-scrim {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--background-color) 88%, transparent),
      color-mix(in srgb, var(--background-color) 35%, transparent)
    );
  }

  .unbox-hero-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: var(--space-4);
  }

  .unbox-hero-title {
    margin: 0;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .unbox-split {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    min-height: 8rem;
  }

  .unbox-split-open {
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .unbox-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .unbox-rail span {
    padding: 0.55rem 0.65rem;
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: 0.65rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .unbox-rail span.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
    box-shadow: inset 2px 0 0 var(--accent-1);
  }

  .unbox-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .unbox-fake-rows {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .unbox-fake-rows span {
    display: block;
    height: 0.55rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .unbox-fake-rows span:nth-child(1) {
    width: 88%;
  }
  .unbox-fake-rows span:nth-child(2) {
    width: 72%;
  }
  .unbox-fake-rows span:nth-child(3) {
    width: 64%;
  }

  :global(.unbox-chunk) {
    padding: var(--space-3);
  }

  @media (max-width: 720px) {
    .unbox-compare {
      grid-template-columns: 1fr;
    }
  }

  /* ── Character detail route study ────────────────────────────────── */
  .detail-concepts {
    gap: var(--space-3);
  }

  .detail-concept-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .concept-kicker,
  .detail-eyebrow {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .concept-kicker {
    margin-bottom: 0.25rem;
    color: var(--accent-1) !important;
  }

  .concept-picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .concept-note {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .detail-prototype {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
  }

  .detail-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 18rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--detail-accent) 42%, transparent);
  }

  .detail-atmosphere,
  .detail-hero-scrim {
    position: absolute;
    inset: 0;
    z-index: -2;
  }

  .detail-atmosphere {
    background-position: center;
    background-size: cover;
    opacity: 0.55;
    filter: saturate(0.85);
    transform: scale(1.02);
  }

  .detail-hero-scrim {
    z-index: -1;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--background-color) 94%, transparent) 0%,
        color-mix(in srgb, var(--background-color) 62%, transparent) 54%,
        color-mix(in srgb, var(--background-color) 80%, transparent) 100%
      ),
      linear-gradient(
        0deg,
        color-mix(in srgb, var(--background-mid) 92%, transparent),
        transparent 65%
      );
  }

  .detail-back {
    width: fit-content;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    font-weight: 500;
    text-decoration: none;
  }

  .detail-back:hover {
    color: var(--foreground-color);
  }

  .detail-hero-dossier {
    min-height: 26rem;
    padding: var(--space-5);
  }

  .detail-hero-dossier > .detail-back {
    position: relative;
    z-index: 2;
  }

  .dossier-layout {
    display: grid;
    grid-template-columns: minmax(11rem, 15rem) minmax(12rem, 32rem);
    gap: clamp(1.25rem, 4vw, 3.5rem);
    align-items: end;
    min-height: 20.5rem;
    padding-top: var(--space-4);
  }

  .dossier-portrait {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 34%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-color);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.42);
  }

  .dossier-portrait :global(.icon-root) {
    min-height: 20rem;
  }

  .dossier-identity {
    align-self: center;
    padding-bottom: 0.5rem;
  }

  .detail-eyebrow {
    margin-bottom: 0.45rem;
    color: var(--detail-accent);
  }

  .dossier-identity h3,
  .nameplate-bar h3,
  .compact-identity h3 {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 4vw, 2.8rem);
    font-weight: 600;
    line-height: 1.02;
    color: var(--foreground-color);
  }

  .dossier-identity h3 {
    max-width: 10ch;
    font-size: clamp(2rem, 5vw, 3.6rem);
  }

  .detail-meta-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.65rem;
    margin-top: var(--space-3);
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .detail-meta-line span:nth-child(even) {
    color: color-mix(in srgb, var(--detail-accent) 65%, transparent);
  }

  .compact-facts div {
    padding: 0.75rem;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
  }

  .compact-facts dt {
    margin-bottom: 0.3rem;
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .compact-facts dd {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .detail-hero-nameplate {
    min-height: 25rem;
    padding: var(--space-5);
  }

  .detail-hero-nameplate .detail-hero-scrim {
    background: linear-gradient(
      0deg,
      color-mix(in srgb, var(--background-color) 94%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 28%, transparent) 70%
    );
  }

  .nameplate-portrait {
    position: absolute;
    right: clamp(1rem, 7vw, 5rem);
    bottom: 0;
    width: clamp(10rem, 27vw, 16rem);
    opacity: 0.92;
  }

  .nameplate-bar {
    position: absolute;
    right: var(--space-5);
    bottom: var(--space-5);
    left: var(--space-5);
    z-index: 2;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
    padding: var(--space-4);
    border-left: 2px solid var(--detail-accent);
    background: color-mix(in srgb, var(--background-mid) 88%, transparent);
    backdrop-filter: blur(12px);
  }

  .nameplate-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem 1rem;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .detail-hero-compact {
    display: grid;
    grid-template-columns: 7rem minmax(10rem, 1fr) minmax(20rem, auto);
    align-items: center;
    gap: var(--space-4);
    min-height: auto;
    padding: var(--space-4);
    background:
      linear-gradient(
        100deg,
        color-mix(in srgb, var(--detail-accent) 7%, transparent),
        transparent 42%
      ),
      var(--background-mid);
  }

  .compact-portrait {
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--background-color);
  }

  .compact-identity {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .compact-identity .detail-back {
    margin-bottom: 0.55rem;
  }

  .compact-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(7rem, 1fr));
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-left: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  @media (max-width: 900px) {
    .dossier-layout {
      grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
    }

    .dossier-portrait :global(.icon-root) {
      min-height: 17rem;
    }

    .detail-hero-compact {
      grid-template-columns: 6rem minmax(0, 1fr);
    }

    .compact-facts {
      grid-column: 1 / -1;
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 640px) {
    .detail-concept-head {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-3);
    }

    .concept-picker {
      justify-content: flex-start;
    }

    .detail-hero-dossier {
      min-height: auto;
      padding: var(--space-4);
    }

    .dossier-layout {
      grid-template-columns: 6.5rem minmax(0, 1fr);
      align-items: center;
      min-height: auto;
      padding-top: var(--space-5);
    }

    .dossier-portrait :global(.icon-root) {
      min-height: 9rem;
    }

    .detail-meta-line {
      gap: 0.3rem 0.45rem;
      margin-top: var(--space-2);
    }

    .dossier-identity h3,
    .nameplate-bar h3,
    .compact-identity h3 {
      font-size: clamp(1.35rem, 7vw, 1.8rem);
    }

    .detail-hero-nameplate {
      min-height: 21rem;
      padding: var(--space-4);
    }

    .nameplate-portrait {
      right: 0;
      width: 12rem;
    }

    .nameplate-bar {
      right: var(--space-4);
      bottom: var(--space-4);
      left: var(--space-4);
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }

    .nameplate-meta {
      justify-content: flex-start;
    }

    .detail-hero-compact {
      grid-template-columns: 4.75rem minmax(0, 1fr);
      padding: var(--space-3);
    }

    .compact-facts {
      grid-template-columns: repeat(3, 1fr);
    }

    .compact-facts div {
      padding: 0.55rem;
    }
  }

  /* ── Character section navigation studies ───────────────────────── */
  .nav-study-stack {
    display: grid;
    gap: var(--space-4);
  }

  .nav-study {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
  }

  .nav-study-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .nav-study-name {
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .nav-study-note {
    max-width: 60ch;
    margin-top: 0.2rem;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    line-height: 1.45;
  }

  .nav-study-fit,
  .future-notice {
    flex-shrink: 0;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 20%, transparent);
    border-radius: var(--radius-pill);
    padding: 0.2rem 0.5rem;
    color: var(--foreground-mid);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ledger-shell {
    display: grid;
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
  }

  .ledger-mobile-trigger {
    display: none;
  }

  .ledger-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .ledger-rail button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 2.8rem;
    padding: 0.65rem var(--space-3);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 10%, transparent);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    text-align: left;
    transition: var(--control-transition);
  }

  .ledger-rail button::before {
    position: absolute;
    inset-block: 0;
    left: 0;
    width: 2px;
    background: transparent;
    content: "";
  }

  .ledger-rail button:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .ledger-rail button.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
  }

  .ledger-rail button.active::before {
    background: var(--accent-1);
  }

  .ledger-rail small {
    color: var(--foreground-mid);
    font-size: 0.52rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .nav-content-sample {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 12rem;
    padding: clamp(1.25rem, 4vw, 2.5rem);
    background:
      linear-gradient(
        115deg,
        color-mix(in srgb, var(--foreground-color) 3%, transparent),
        transparent 60%
      ),
      var(--background-mid);
  }

  .nav-content-kicker {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .nav-content-sample h3 {
    margin-top: 0.3rem;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: clamp(1.45rem, 3vw, 2rem);
    font-weight: 600;
  }

  .nav-content-sample > p:last-of-type {
    max-width: 48ch;
    margin-top: 0.35rem;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
  }

  .future-notice {
    width: fit-content;
    margin-top: var(--space-3);
  }

  @media (max-width: 640px) {
    .nav-study-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .ledger-shell {
      display: block;
    }

    .ledger-mobile-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 3.6rem;
      padding: 0.65rem var(--space-4);
      border-bottom: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 14%, transparent);
      color: var(--foreground-color);
      text-align: left;
      background: var(--surface-selected);
    }

    .ledger-mobile-trigger > span:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .ledger-mobile-trigger small {
      color: var(--foreground-mid);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ledger-mobile-trigger strong {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
    }

    .ledger-trigger-mark {
      position: relative;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 22%, transparent);
      border-radius: var(--radius-pill);
      color: var(--accent-1);
    }

    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      position: absolute;
      width: 0.65rem;
      height: 1px;
      background: currentColor;
      content: "";
      transition: transform var(--control-duration) var(--control-ease);
    }

    .ledger-trigger-mark::after {
      transform: rotate(90deg);
    }

    .ledger-shell.mobile-open .ledger-trigger-mark::after {
      transform: rotate(90deg) scaleX(0);
    }

    .ledger-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      max-height: 0;
      overflow: hidden;
      border-right: 0;
      border-bottom: var(--border-width) solid transparent;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-0.35rem);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s linear 260ms;
    }

    .ledger-shell.mobile-open .ledger-rail {
      max-height: calc(var(--section-count) * 2.8rem);
      border-bottom-color: color-mix(
        in srgb,
        var(--foreground-color) 14%,
        transparent
      );
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s;
    }

    .ledger-rail button:nth-child(even) {
      border-left: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 10%, transparent);
    }

    .nav-content-sample {
      min-height: 9rem;
      padding: var(--space-4);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* The open state sets its own transition at higher specificity, so it has
       to be named here too. */
    .ledger-rail,
    .ledger-shell.mobile-open .ledger-rail,
    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      transition: none;
    }
  }

  /* ── Character team source study ─────────────────────────────────── */
  .team-source-demo {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
  }

  .team-source-demo-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .team-source-demo-head h3 {
    margin-top: 0.25rem;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 3vw, 1.65rem);
    font-weight: 600;
  }

  .team-source-demo-head > p {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .source-menu-row {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    padding: 0.8rem var(--space-4);
    border-block: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .source-menu-row > span {
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  .team-source-result {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .team-source-result span {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .team-source-result p {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  @media (max-width: 560px) {
    .team-source-demo-head {
      align-items: start;
      flex-direction: column;
      gap: var(--space-2);
    }

    .team-source-result {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
  }

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

  .surface-row,
  .control-stack {
    display: grid;
    gap: var(--space-3);
  }

  .surface-row {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .stat-stack,
  .eyebrow-stack {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .eyebrow-accent {
    color: var(--accent-1);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .tip-palette-note {
    margin-bottom: var(--space-3);
  }

  .tip-palette {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .tip-candidate {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .tip-candidate-head {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .tip-candidate-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .tip-mock {
    border-radius: var(--radius-lg);
    padding: 0.55rem 0.7rem;
    border: 0.5px solid;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    max-width: 18rem;
  }

  .tip-mock-title {
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .tip-mock-meta,
  .tip-mock-body {
    font-size: 0.65rem;
    line-height: 1.35;
    margin-top: 0.3rem;
    opacity: 0.85;
  }

  /* ── Animation performance demos ─────────────────────────────────── */
  .perf-note {
    margin-bottom: var(--space-3);
  }

  .perf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-4) var(--space-3);
  }

  .perf-pair {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .perf-pair-label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .perf-pair-label.good {
    color: var(--accent-2);
  }

  .perf-pair-label.bad {
    color: color-mix(in srgb, #ff9b9b 80%, var(--foreground-color));
  }

  .perf-card {
    display: grid;
    place-items: center;
    height: 5rem;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    font-weight: 600;
    position: relative;
  }

  /* ✓ Cheap: static box-shadow, hover only translates (compositor only). */
  .perf-shadow-good {
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.45);
    transition: transform 0.22s ease;
  }
  .perf-shadow-good:hover {
    transform: translateY(-6px) scale(1.04);
  }

  /* ✗ Costly: drop-shadow filter recomputed every frame while it scales. */
  .perf-shadow-bad {
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
    transition: transform 0.22s ease;
  }
  .perf-shadow-bad:hover {
    transform: translateY(-6px) scale(1.04);
  }

  /* ✓ Cheap: transform + opacity only. */
  .perf-transform-good {
    transition:
      transform 0.22s ease,
      opacity 0.22s ease;
  }
  .perf-transform-good:hover {
    transform: scale(1.06);
    opacity: 0.92;
  }

  /* ✗ Costly: animating layout box (top / width) forces reflow. */
  .perf-transform-bad {
    top: 0;
    width: 100%;
    transition:
      top 0.22s ease,
      width 0.22s ease;
  }
  .perf-transform-bad:hover {
    top: -6px;
    width: 108%;
  }

  /* ✓ Cheap: promote to its own layer only while interacting. */
  .perf-willchange {
    transition: transform 0.22s ease;
  }
  .perf-willchange:hover {
    will-change: transform;
    transform: translateY(-6px) scale(1.04);
  }

  /* ✗ Costly: transitioning the filter value repaints the box each frame. */
  .perf-filter-bad {
    filter: brightness(1);
    transition: filter 0.22s ease;
  }
  .perf-filter-bad:hover {
    filter: brightness(1.25) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .perf-card {
      transition: none;
    }
  }

  .portrait-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 5.5rem));
    gap: var(--space-2);
  }

  .character-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  @media (min-width: 640px) {
    .character-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 768px) {
    .character-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .character-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  .grid-page-head {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .grid-page-title {
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .grid-page-hint {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .grid-meta-name {
    font-size: 0.7rem;
    font-weight: 500;
    line-height: 1.15;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid-meta-sub {
    font-size: 0.6rem;
    line-height: 1.15;
    color: var(--foreground-mid);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
    align-items: start;
  }

  .demo-gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .demo-gear:hover {
    background: var(--surface-quiet);
    color: var(--accent-1);
  }

  :global(.min-h-status) {
    min-height: 8rem;
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    border: var(--border-width) solid var(--border-default);
  }

  .new-badge {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.35rem;
    border-radius: var(--radius-sm);
    background: var(--accent-1);
    color: var(--background-color);
  }

  .mb-2 {
    margin-bottom: var(--space-2);
  }

  .mt-2 {
    margin-top: var(--space-2);
  }

  .icon-row {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 4.5rem));
    gap: var(--space-2);
  }

  .icon-cell {
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface-base);
  }

  .icon-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    color: var(--foreground-mid);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }

  @media (max-width: 640px) {
    .icon-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .portrait-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* ── Stat goals layout study ─────────────────────────────────────────── */
  .sg-archetype-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .sg-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .sg-option {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .sg-option-head h3 {
    margin: 0 0 0.35rem;
    font-size: var(--text-md);
    font-family: var(--font-display);
  }

  .sg-option-head p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  .sg-frame {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    background: var(--background-mid);
  }

  .sg-lede {
    margin: 0.35rem 0 var(--space-3);
  }

  .sg-party {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .sg-party--sm {
    max-width: 11rem;
  }

  .sg-slot {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: var(--background-color);
  }

  .sg-slot.featured {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 55%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .sg-gear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .sg-gear-btn.open,
  .sg-gear-btn:hover {
    color: var(--accent-1);
  }

  .sg-team-link,
  .sg-inline-link {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    text-decoration: none;
  }

  .sg-team-link:hover,
  .sg-inline-link:hover {
    color: var(--foreground-color);
    text-decoration: underline;
  }

  .sg-stat-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sg-gear-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .sg-gear-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .sg-gear-box {
    width: 2.1rem;
    height: 2.1rem;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    background: color-mix(in srgb, var(--accent-1) 18%, var(--background-color));
  }

  .sg-gear-box--sm {
    width: 1.55rem;
    height: 1.55rem;
  }

  /* A */
  .sg-a {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 18rem;
  }

  .sg-a-picker {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: center;
  }

  /* B */
  .sg-b {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: var(--space-3);
    align-items: start;
  }

  .sg-b-context {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .sg-fingerprint {
    margin: 0;
  }

  .sg-gear-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .sg-chip {
    font-size: 0.68rem;
    padding: 0.2rem 0.45rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    color: var(--foreground-mid);
  }

  .sg-b-goals {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.1);
    background: var(--background-color);
  }

  /* C */
  .sg-c-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .sg-arch-tabs {
    display: inline-flex;
    gap: 0.15rem;
    flex-wrap: wrap;
  }

  .sg-arch-tab {
    border: none;
    background: transparent;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
    padding: 0.2rem 0.45rem;
    cursor: pointer;
    border-bottom: 1px solid transparent;
  }

  .sg-arch-tab.active {
    color: var(--foreground-color);
    border-bottom-color: var(--accent-1);
  }

  .sg-c-goals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.65rem;
    margin-bottom: var(--space-3);
  }

  .sg-goal-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.45rem 0.55rem;
    border-radius: var(--radius-md);
    background: var(--background-color);
    border: var(--border-width) solid rgba(255, 255, 255, 0.08);
  }

  .sg-goal-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.68rem;
    color: var(--foreground-mid);
  }

  .sg-goal-label img {
    width: 0.9rem;
    height: 0.9rem;
  }

  .sg-goal-value {
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    color: var(--foreground-color);
  }

  .sg-c-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .sg-c-foot .meta-sub {
    margin: 0;
  }

  /* D */
  .sg-d {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sg-d-chrome {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .sg-d-gear {
    display: flex;
    gap: 0.3rem;
    margin-left: auto;
  }

  .sg-d-alts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.1);
    background: var(--background-color);
  }

  .sg-d-alt {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    text-align: left;
    border: none;
    background: transparent;
    color: inherit;
    padding: 0.35rem 0.45rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .sg-d-alt:hover {
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
  }

  .sg-d-goals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 1rem;
  }

  @media (max-width: 900px) {
    .sg-options {
      grid-template-columns: 1fr;
    }

    .sg-b {
      grid-template-columns: 1fr;
    }

    .sg-d-goals {
      grid-template-columns: 1fr;
    }
  }
</style>
