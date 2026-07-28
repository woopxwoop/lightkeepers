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
  import Chip from "$lib/ui/components/Chip.svelte";
  import Badge from "$lib/ui/components/Badge.svelte";
  import SlidingTabs from "$lib/ui/components/SlidingTabs.svelte";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import BrowseFlipCard from "$lib/ui/components/BrowseFlipCard.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import CharacterTagSearch from "$lib/ui/components/CharacterTagSearch.svelte";
  import SolutionDots from "$lib/ui/components/SolutionDots.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
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
  import { ELEMENT_COLORS, elementColor } from "$lib/element-colors";
  import type { AbyssTeam, CharacterOwned } from "$lib/definitions";
  import { toGoodKey, weaponTypeLabel } from "$lib/utils";
  import { isNewCharacter } from "$lib/is-new-character";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";

  let demoTags: string[] = $state([]);
  let demoTagOptions = $derived(
    $charactersOwned.slice(0, 24).map((c) => toGoodKey(c.name)),
  );
  let demoCharByKey = $derived(
    new Map($charactersOwned.map((c) => [toGoodKey(c.name), c])),
  );

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
  let selectDemo = $state("stygian");
  let chipOn = $state(true);
  let toggleOn = $state(true);
  let slidingTab = $state<"top" | "bottom" | "skills">("top");
  let solutionIndex = $state(0);
  let iconStyleNote = $derived($displayPreferences.iconStyle);

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
</script>

<PageShell class="gap-10">
  <PageHeader
    eyebrow="Dev"
    title="UI gallery"
    lede="Living surface for tokens and shared primitives. Icon style follows Display settings ({iconStyleNote})."
  />

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

  <!-- ── Surfaces ───────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="surfaces">
    <div class="section-head">
      <h2>Surface</h2>
      <p>Shared <code>Surface</code> primitive — default / interactive / inset / empty.</p>
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
        Shared <code>SegmentedControl</code>, <code>Select</code>, <code>Chip</code>,
        <code>Toggle</code>, <code>Button</code>, <code>Badge</code>.
      </p>
    </div>

    <div class="control-stack">
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
          slot gold or element color.
        </p>
        <SlidingTabs
          options={SLIDING_TAB_OPTIONS}
          bind:value={slidingTab}
          accent={slidingAccent}
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
          Portrait tile with shine hover, optional dim / tint /
          meta overlay. Link vs static.
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
          <p class="token-meta">Roster not loaded yet — refresh after hydrate.</p>
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
              Hover tip
            </Button>
            <HoverTooltip>
              <p class="text-xs" style="color: var(--foreground-color);">
                Generic hover / focus tip shell.
              </p>
            </HoverTooltip>
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

  <!-- ── Planned ────────────────────────────────────────────────────────── -->
  <section class="gallery-section" id="planned">
    <div class="section-head">
      <h2>Still to extract</h2>
      <p>Defer until the matching route migration.</p>
    </div>
    <div class="planned-grid">
      {#each [
        "StatRow",
        "SectionLabel",
        "Tooltip (focus + touch)",
      ] as name}
        <Surface variant="empty">
          <p class="surface-label">{name}</p>
          <p class="token-meta">Not extracted yet</p>
        </Surface>
      {/each}
    </div>
  </section>
</PageShell>

<style>
  .gallery-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
  .control-stack,
  .planned-grid {
    display: grid;
    gap: var(--space-3);
  }

  .surface-row {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .planned-grid {
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
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
</style>
