<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import Surface from "#lib/ui/components/Surface.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";
  import SlidingTabs from "#lib/ui/components/SlidingTabs.svelte";
  import CharacterPortraitCard from "#lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "#lib/ui/components/CharacterFilterBar.svelte";
  import BrowseFlipCard from "#lib/ui/components/BrowseFlipCard.svelte";
  import TeamCardHand from "#lib/ui/components/TeamCardHand.svelte";
  import CharacterTagSearch from "#lib/ui/components/CharacterTagSearch.svelte";
  import SolutionDots from "#lib/ui/components/SolutionDots.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import { elementColor } from "#lib/element-colors.js";
  import type { CharacterOwned } from "#lib/definitions.js";
  import { toGoodKey, weaponTypeLabel } from "#lib/utils.js";
  import { isNewCharacter } from "#lib/is-new-character.js";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "#lib/character-filter.js";

  let {
    sampleChars,
  }: {
    sampleChars: CharacterOwned[];
  } = $props();

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

  let slidingTab = $state<"top" | "bottom" | "skills">("top");
  let solutionIndex = $state(0);

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
</script>

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
        slot gold or element color. Below 640px only the first tab stays direct
        and the other two move into the "More" control (<code
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
        Portrait tile with shine hover, optional dim / tint / meta overlay. Link
        vs static.
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
        <TeamCardHand characters={handChars} builds={demoBuilds} stack="left" />
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
        Combobox tag filter with optional leading control (gear). Used on Teams.
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

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .control-stack {
    display: grid;
    gap: var(--space-3);
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

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }

  @media (max-width: 640px) {
    .portrait-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
