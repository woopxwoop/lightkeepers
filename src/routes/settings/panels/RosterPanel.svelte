<script lang="ts">
  import { page } from "$app/state";
  import { charactersOwned } from "#lib/stores/roster.js";
  import { authClient } from "#lib/auth-client.js";
  import CharacterPortraitCard from "#lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "#lib/ui/components/CharacterFilterBar.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import RosterBuildCard from "#lib/ui/components/RosterBuildCard.svelte";
  import RosterProgressFields from "#lib/ui/components/RosterProgressFields.svelte";
  import Toggle from "#lib/ui/components/Toggle.svelte";
  import type {
    Character,
    CharacterOwned,
    InventoryArtifact,
    InventoryWeapon,
    RosterProgress,
  } from "#lib/definitions.js";
  import { cloneRosterProgress } from "#lib/roster/roster-progress.js";
  import { rosterBuildViewFromOwned } from "#lib/roster/roster-build-card.js";
  import {
    getRosterArtifactsCached,
    getRosterWeaponsCached,
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "#lib/app/roster-inventory.js";
  import { weaponTypeLabel, ownedNameIds } from "#lib/utils.js";
  import { isNewCharacter } from "#lib/characters/is-new-character.js";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "#lib/characters/character-filter.js";
  import { rosterSync } from "#lib/app/roster-sync.js";
  import { useSyncedDraft } from "#lib/sync/draft.svelte.js";
  import { isSaved } from "#lib/sync/synced-doc.js";
  import {
    rosterDocOf,
    rosterDocSpec,
    rosterOwnedFrom,
  } from "#lib/sync/roster-doc.js";
  import { resolve } from "$app/paths";

  const session = authClient.useSession();
  const rosterSyncDoc = rosterSync();
  const rosterView = rosterSyncDoc.view;
  const characters = $derived((page.data.characters ?? []) as Character[]);
  /** Editor copy of the roster document. Joined onto the catalog here. */
  const roster = useSyncedDraft(rosterSyncDoc, {
    toDraft: (doc) => rosterOwnedFrom(characters, doc),
    fromDraft: (owned, baseline) => rosterDocOf(owned, baseline),
    sameContent: (a, b) => rosterDocSpec.equal(rosterDocOf(a), rosterDocOf(b)),
  });

  let showSaved = $state(false);
  let savedGeneration = 0;
  let rosterError = $state("");
  let shownError = $derived(rosterError || (roster.error ?? ""));
  let hasUnsavedChanges = $derived(roster.unsaved);
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);
  /** Stored edits the server has not accepted (a failed upload): Save retries. */
  let unsent = $derived(
    roster.unsent && roster.status !== "saving" && !hasUnsavedChanges,
  );
  let canSave = $derived(hasUnsavedChanges || unsent);

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let ownershipFilter = $state<OwnershipFilter>("all");
  let search = $state("");
  let sortBy = $state<CharacterSortKey>("release_date");
  let sortAsc = $state(false);

  let weapons = $state<InventoryWeapon[]>([]);
  let artifacts = $state<InventoryArtifact[]>([]);
  /** Simple slider layout vs Enka build card. */
  let simpleConfig = $state(false);

  let visibleCharacters = $derived(
    filterAndSortCharacters(roster.draft, {
      search,
      rarity: rarityFilter,
      elements: elementFilter,
      weapons: weaponFilter,
      ownership: ownershipFilter,
      sortBy,
      sortAsc,
    }),
  );

  function toggleOwned(name_id: string) {
    roster.draft = roster.draft.map((c) =>
      c.name_id === name_id ? { ...c, isOwned: !c.isOwned } : c,
    );
  }

  function selectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    roster.draft = roster.draft.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: true } : c,
    );
  }

  function deselectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    roster.draft = roster.draft.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: false } : c,
    );
  }

  function flashSaved() {
    const generation = ++savedGeneration;
    showSaved = true;
    setTimeout(() => {
      if (generation === savedGeneration) showSaved = false;
    }, 2000);
  }

  function cancelEdits() {
    roster.cancel();
    rosterError = "";
  }

  /**
   * Save through the roster document. A draft started from an older roster
   * is compared with the newer one (`basedOn`); a difference opens the
   * "Use cloud / Upload this device" popup instead of overwriting.
   */
  async function saveCharacters() {
    if (roster.saving) return;
    rosterError = "";
    // A previous save's "Saved" must not cover this one's result.
    savedGeneration += 1;
    showSaved = false;

    try {
      const result = await roster.save();
      if (result.account !== $rosterView.account) return;
      switch (result.status) {
        case "sent":
        case "local":
          // A guest save storage refused is not saved; the view says why.
          if (isSaved(result)) flashSaved();
          break;
        case "unsent":
          rosterError = result.error
            ? `Saved on this device — not synced: ${result.error}`
            : "Saved on this device — not synced";
          break;
      }
    } catch (e) {
      console.error("Roster save error:", e);
      rosterError = `Something went wrong — your changes may not be saved (${(e as Error)?.name ?? typeof e})`;
    }
  }

  $effect(() => {
    // After session resolves (and on login/logout), refresh uncached inventory.
    // Cached slices still win inside loadRosterWeapons / loadRosterArtifacts.
    void $session.data;
    const cachedW = getRosterWeaponsCached();
    const cachedA = getRosterArtifactsCached();
    if (cachedW) weapons = cachedW;
    if (cachedA) artifacts = cachedA;
    void refreshInventory();
  });

  async function refreshInventory() {
    try {
      if ($session.data) {
        const [nextWeapons, nextArtifacts] = await Promise.all([
          loadRosterWeapons(),
          loadRosterArtifacts(),
        ]);
        weapons = nextWeapons;
        artifacts = nextArtifacts;
      } else {
        weapons = getRosterWeaponsCached() ?? [];
        artifacts = getRosterArtifactsCached() ?? [];
      }
    } catch (err) {
      console.error("Roster inventory load failed:", err);
      weapons = getRosterWeaponsCached() ?? [];
      artifacts = getRosterArtifactsCached() ?? [];
    }
  }

  let savedOwnedSet = $derived(ownedNameIds($charactersOwned));
  let savedById = $derived(
    new Map($charactersOwned.map((c) => [c.name_id, c])),
  );

  let ownedCount = $derived(roster.draft.filter((c) => c.isOwned).length);
  let totalCount = $derived(roster.draft.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
  let changedCount = $derived(
    roster.draft.reduce((count, c) => {
      const prev = savedById.get(c.name_id);
      if (!prev) return count + 1;
      if (c.isOwned !== prev.isOwned) return count + 1;
      // Same progress clone the snapshot uses for equality.
      if (
        JSON.stringify(cloneRosterProgress(c.progress) ?? null) !==
        JSON.stringify(cloneRosterProgress(prev.progress) ?? null)
      ) {
        return count + 1;
      }
      return count;
    }, 0),
  );
  let configuringId = $state<string | null>(null);
  let configuring = $derived(
    roster.draft.find((c) => c.name_id === configuringId) ?? null,
  );
  let configuringView = $derived(
    configuring
      ? rosterBuildViewFromOwned(configuring, weapons, artifacts)
      : null,
  );

  function closeConfig() {
    configuringId = null;
  }

  function openConfig(nameId: string) {
    const row = roster.draft.find((c) => c.name_id === nameId);
    if (!row?.isOwned) return;
    configuringId = nameId;
  }

  function applyProgress(next: RosterProgress) {
    const id = configuringId;
    if (!id) return;
    const row = roster.draft.find((c) => c.name_id === id);
    if (!row?.isOwned) {
      closeConfig();
      return;
    }
    roster.draft = roster.draft.map((c) =>
      c.name_id === id
        ? { ...c, progress: cloneRosterProgress(next) ?? next }
        : c,
    );
  }

  $effect(() => {
    if (configuring && !configuring.isOwned) {
      configuringId = null;
    }
  });

  let isFiltered = $derived(
    rarityFilter.size > 0 ||
      elementFilter.size > 0 ||
      weaponFilter.size > 0 ||
      ownershipFilter !== "all" ||
      search.trim() !== "",
  );
</script>

{#if roster.hydrated}
  <div class="roster-page">
    <header class="panel-head">
      <div>
        <h2 class="section-title">Roster</h2>

        <a class="back-link" href={resolve("settings?tab=account")}
          >Import with GOOD</a
        >

        <span class="section-lede roster-lede"
          >or select the characters you own manually</span
        >
      </div>
    </header>

    <CharacterFilterBar
      bind:search
      bind:rarityFilter
      bind:elementFilter
      bind:weaponFilter
      bind:ownershipFilter
      bind:sortBy
      bind:sortAsc
    />

    <div class="roster-actions">
      <Button variant="secondary" onclick={selectAll}>
        Select all{#if isFiltered}
          ({visibleOwnedCount}/{visibleCharacters.length}){/if}
      </Button>
      <Button variant="secondary" onclick={deselectAll}>Deselect all</Button>
      <span class="owned-count">{ownedCount} / {totalCount}</span>
    </div>

    {#if canSave || roster.saving || savedVisible || shownError}
      <div class="save-bar">
        <div class="save-status">
          <span
            class="save-dot"
            class:saving={roster.saving}
            class:saved={savedVisible}
          ></span>
          <span
            class="save-label"
            class:save-error={!!shownError && !roster.saving && !savedVisible}
          >
            {roster.saving
              ? "Saving..."
              : savedVisible
                ? "Saved"
                : shownError
                  ? shownError
                  : unsent
                    ? "Not synced"
                    : "Unsaved changes"}
          </span>
          {#if hasUnsavedChanges}
            <span class="save-changed">({changedCount} changed)</span>
          {/if}
        </div>
        {#if canSave && !roster.saving}
          <div class="save-actions">
            {#if hasUnsavedChanges}
              <Button variant="ghost" onclick={cancelEdits}>Cancel</Button>
            {/if}
            <Button variant="primary" onclick={saveCharacters}>Save</Button>
            <div class="save-cue" aria-hidden="true">
              <IconChevronDown
                size={22}
                strokeWidth={2.5}
                class="save-cue-icon"
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if visibleCharacters.length === 0}
      <EmptyState message="No characters match." />
    {:else}
      <div class="character-grid">
        {#each visibleCharacters as character (character.name_id)}
          {@const showNew =
            isNewCharacter(character.released_at) &&
            !savedOwnedSet.has(character.name_id)}
          <CharacterPortraitCard
            {character}
            tintBackground
            dimmed={!character.isOwned}
            pressed={character.isOwned}
            onclick={() => toggleOwned(character.name_id)}
            title="{character.name ?? 'Unknown'}, {character.isOwned
              ? 'owned'
              : 'not owned'}"
          >
            {#snippet badge()}
              {#if character.isOwned}
                <button
                  type="button"
                  class="roster-gear absolute top-1.5 left-1.5"
                  aria-label="Edit {character.name ?? 'character'}"
                  onclick={(event) => {
                    event.stopPropagation();
                    openConfig(character.name_id);
                  }}
                  onpointerdown={(event) => event.stopPropagation()}
                >
                  <IconCog size={14} />
                </button>
              {/if}
              {#if showNew}
                <span class="new-badge absolute top-1.5 right-1.5">NEW</span>
              {/if}
            {/snippet}
            {#snippet meta()}
              <div class="meta-name">{character.name}</div>
              <div class="meta-sub">
                {character.rarity}★ · {weaponTypeLabel(
                  character.weapon_type ?? "",
                )}{character.progress
                  ? ` · C${character.progress.constellation} · Lv ${character.progress.level}`
                  : ""}
              </div>
            {/snippet}
          </CharacterPortraitCard>
        {/each}
      </div>
    {/if}

    <ModalSheet
      open={!!configuringView}
      onclose={closeConfig}
      label={configuring?.name ?? "Character"}
      size={simpleConfig ? "dialog" : "sheet"}
    >
      {#snippet head()}
        <label class="config-layout-toggle">
          <Toggle
            bind:pressed={simpleConfig}
            aria-label="Simple config layout"
          />
          <span>Simple</span>
        </label>
      {/snippet}
      {#if configuringView}
        {#if simpleConfig}
          <RosterProgressFields
            progress={configuring?.progress ?? null}
            onChange={applyProgress}
          />
        {:else}
          <div class="config-card-stage">
            <RosterBuildCard
              view={configuringView}
              editing="always"
              onProgressChange={applyProgress}
            />
          </div>
          <p class="section-lede config-note">
            Currently can edit constellation, level, and talents. Weapons and
            Artifacts can only be imported via GOOD for now.
          </p>
        {/if}
      {/if}
    </ModalSheet>
  </div>
{:else}
  <LoadingState message="Loading characters…" />
{/if}

<style>
  .roster-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: 6rem;
  }

  .panel-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 42rem;
  }

  .roster-lede {
    color: var(--foreground-color);
  }

  .roster-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .owned-count {
    margin-left: auto;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
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

  .new-badge {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.35rem;
    border-radius: var(--radius-sm);
    background: var(--accent-1);
    color: var(--background-color);
    z-index: 1;
  }

  .roster-gear {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: none;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--background-color) 62%, transparent);
    color: var(--foreground-color);
    cursor: pointer;
    z-index: 1;
  }

  .roster-gear:hover {
    background: color-mix(in srgb, var(--background-color) 82%, transparent);
  }

  .config-layout-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    cursor: pointer;
    user-select: none;
  }

  .config-note {
    margin: 0;
  }

  .config-card-stage {
    /* Keep full height inside ModalSheet's flex body: shrinking it would clip
       the card's own horizontal scrollbar (overflow-y: hidden). */
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .save-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Beneath ModalSheet (120) so the dialog stays on top while open. */
    z-index: 40;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: 0.75rem 1.5rem;
    background: color-mix(in srgb, var(--background-mid) 94%, transparent);
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.24);
    backdrop-filter: blur(12px);
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .save-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--accent-1);
    flex-shrink: 0;
  }

  .save-dot.saving {
    background: var(--accent-2);
  }

  .save-dot.saved {
    background: color-mix(in srgb, var(--accent-1) 40%, transparent);
  }

  .save-label {
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .save-changed {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .save-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .save-cue {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.15rem;
    color: var(--accent-1);
    animation: save-cue-nudge 1.1s ease-in-out infinite;
    pointer-events: none;
  }

  .save-cue :global(.save-cue-icon) {
    transform: rotate(90deg);
  }

  @keyframes save-cue-nudge {
    0%,
    100% {
      transform: translateX(0.3rem);
      opacity: 0.75;
    }
    50% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-cue {
      animation: none;
      transform: none;
      opacity: 1;
    }
  }

  .save-error {
    font-size: var(--text-xs);
    color: var(--accent-1);
  }
</style>
