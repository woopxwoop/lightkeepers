<script lang="ts">
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import {
    charactersOwned,
    charactersHydrated,
    setHasSavedRoster,
    invalidateNearMissTeams,
    invalidateTeamsOwned,
  } from "$lib/stores";
  import { authClient } from "$lib/auth-client";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import RosterBuildCard from "$lib/ui/components/RosterBuildCard.svelte";
  import RosterProgressFields from "$lib/ui/components/RosterProgressFields.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import type {
    CharacterOwned,
    InventoryArtifact,
    InventoryWeapon,
    RosterProgress,
  } from "$lib/definitions";
  import { cloneRosterProgress } from "$lib/roster-progress";
  import { rosterBuildViewFromOwned } from "$lib/roster-build-card";
  import {
    getRosterArtifactsCached,
    getRosterWeaponsCached,
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import { weaponTypeLabel, ownedNameIds } from "$lib/utils";
  import { isNewCharacter } from "$lib/is-new-character";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";
  import {
    captureRoster,
    postRoster,
    rosterDiffersFromSnapshot,
    writeRosterLocal,
    type RosterCapture,
  } from "$lib/roster-snapshot";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { resolve } from "$app/paths";

  const session = authClient.useSession();

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let isSaving = $state(false);
  let rosterError = $state("");
  let savedSnapshot = $state("");
  let hasUnsavedChanges = $derived(
    synced && rosterDiffersFromSnapshot(tempCharactersOwned, savedSnapshot),
  );
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);

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
    filterAndSortCharacters(tempCharactersOwned, {
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
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      c.name_id === name_id ? { ...c, isOwned: !c.isOwned } : c,
    );
  }

  function selectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: true } : c,
    );
  }

  function deselectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: false } : c,
    );
  }

  function restoreSavedSnapshot() {
    writeRosterLocal(savedSnapshot);
  }

  function commitSaved(pending: RosterCapture) {
    savedSnapshot = pending.json;
    charactersOwned.set(pending.roster);
    invalidateTeamsOwned();
    invalidateNearMissTeams();
    showSaved = true;
    setHasSavedRoster();
  }

  async function saveCharacters() {
    if (isSaving) return;
    isSaving = true;
    rosterError = "";

    // Freeze the editor state before any await so concurrent toggles stay unsaved.
    const pending = captureRoster(tempCharactersOwned);

    try {
      if (!writeRosterLocal(pending.json)) {
        console.warn("localStorage unavailable — saving to memory only");
      }

      if ($session.data) {
        const result = await postRoster(pending.roster);
        if (!result.ok) {
          restoreSavedSnapshot();
          rosterError = result.message
            ? `Sync failed (${result.status}): ${result.message}`
            : `Sync failed (${result.status}) — roster not saved to cloud`;
          return;
        }
        commitSaved(pending);
      } else {
        commitSaved(pending);
      }
    } catch (e) {
      restoreSavedSnapshot();
      console.error("Roster save error:", e);
      rosterError = `Something went wrong — your changes may not be saved (${(e as Error)?.name ?? typeof e})`;
    } finally {
      isSaving = false;
    }

    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  $effect(() => {
    if ($charactersHydrated && !synced) {
      const pending = captureRoster($charactersOwned);
      tempCharactersOwned = pending.roster;
      savedSnapshot = pending.json;
      synced = true;
    } else if ($charactersHydrated && synced && !hasUnsavedChanges) {
      const storeJson = JSON.stringify($charactersOwned);
      if (storeJson !== savedSnapshot) {
        const pending = captureRoster($charactersOwned);
        tempCharactersOwned = pending.roster;
        savedSnapshot = pending.json;
      }
    }
  });

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

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
  let changedCount = $derived(
    tempCharactersOwned.reduce((count, c) => {
      const prev = savedById.get(c.name_id);
      if (!prev) return count + 1;
      if (c.isOwned !== prev.isOwned) return count + 1;
      // Same progress clone as captureRoster / rosterDiffersFromSnapshot.
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
    tempCharactersOwned.find((c) => c.name_id === configuringId) ?? null,
  );
  let configuringView = $derived(
    configuring
      ? rosterBuildViewFromOwned(configuring, weapons, artifacts)
      : null,
  );

  let configPanelEl: HTMLDivElement | null = $state(null);
  let configCloseEl: HTMLButtonElement | null = $state(null);
  let reduced = $derived(prefersReducedMotion.current);

  function closeConfig() {
    configuringId = null;
  }

  function openConfig(nameId: string) {
    const row = tempCharactersOwned.find((c) => c.name_id === nameId);
    if (!row?.isOwned) return;
    configuringId = nameId;
  }

  function applyProgress(next: RosterProgress) {
    const id = configuringId;
    if (!id) return;
    const row = tempCharactersOwned.find((c) => c.name_id === id);
    if (!row?.isOwned) {
      closeConfig();
      return;
    }
    tempCharactersOwned = tempCharactersOwned.map((c) =>
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

  $effect(() => {
    if (!configuringId) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void tick().then(() => configCloseEl?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfig();
        return;
      }
      if (configPanelEl) trapTabKey(event, configPanelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  });

  let isFiltered = $derived(
    rarityFilter.size > 0 ||
      elementFilter.size > 0 ||
      weaponFilter.size > 0 ||
      ownershipFilter !== "all" ||
      search.trim() !== "",
  );
</script>

{#if synced}
  <div class="roster-page">
    <header class="panel-head">
      <div>
        <h2 class="section-title">Roster</h2>
        <a class="back-link" href={resolve("/settings?tab=account")}>
          Import with GOOD
        </a>
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

    {#if hasUnsavedChanges || isSaving || savedVisible || rosterError}
      <div class="save-bar">
        <div class="save-status">
          <span
            class="save-dot"
            class:saving={isSaving}
            class:saved={savedVisible}
          ></span>
          <span class="save-label">
            {isSaving
              ? "Saving..."
              : savedVisible
                ? "Saved"
                : "Unsaved changes"}
          </span>
          {#if hasUnsavedChanges}
            <span class="save-changed">({changedCount} changed)</span>
          {/if}
        </div>
        {#if hasUnsavedChanges && !isSaving}
          <div class="save-actions">
            <Button
              variant="ghost"
              onclick={() => {
                const pending = captureRoster($charactersOwned);
                tempCharactersOwned = pending.roster;
                savedSnapshot = pending.json;
              }}
            >
              Cancel
            </Button>
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
        {#if rosterError}
          <span class="save-error">{rosterError}</span>
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

    {#if configuringView}
      <div class="config-root">
        <button
          type="button"
          class="config-backdrop"
          aria-label="Close"
          onclick={closeConfig}
          transition:fade={{ duration: reduced ? 0 : 120 }}
        ></button>
        <div
          class="config-panel"
          class:config-panel--simple={simpleConfig}
          role="dialog"
          aria-modal="true"
          aria-label={configuring?.name ?? "Character"}
          tabindex="-1"
          bind:this={configPanelEl}
          transition:scale={{ duration: reduced ? 0 : 160, start: 0.98 }}
        >
          <div class="config-toolbar">
            <label class="config-layout-toggle">
              <Toggle
                bind:pressed={simpleConfig}
                aria-label="Simple config layout"
              />
              <span>Simple</span>
            </label>
            <button
              type="button"
              class="config-close"
              aria-label="Close"
              bind:this={configCloseEl}
              onclick={closeConfig}
            >
              <IconX size={16} />
            </button>
          </div>
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
            <p class="section-lede">
              Currently can edit constellation, level, and talents. Weapons and
              Artifacts can only be imported via GOOD for now.
            </p>
          {/if}
        </div>
      </div>
    {/if}
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

  .config-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .config-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .config-panel {
    position: relative;
    z-index: 1;
    width: min(72rem, 100%);
    max-height: min(46rem, calc(100vh - 2rem));
    overflow: auto;
    padding: 0.25rem 0.75rem 0.5rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.18);
    background: var(--background-mid);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .config-panel--simple {
    width: min(28rem, 100%);
    max-height: min(40rem, calc(100vh - 2rem));
    padding: 0.65rem 0.85rem 0.85rem;
    gap: var(--space-3);
  }

  .config-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 1.85rem;
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

  .config-panel > .section-lede {
    margin: 0;
  }

  .config-close {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    margin-left: auto;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .config-close:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .config-card-stage {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .save-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Beneath .config-root (120) so the dialog stays on top while open. */
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
