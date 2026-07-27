<script lang="ts">
  import {
    charactersOwned,
    charactersHydrated,
    setHasSavedRoster,
    writeNearMissTeams,
    writeTeamsOwned,
  } from "$lib/stores";
  import { authClient } from "$lib/auth-client";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import type { CharacterOwned } from "$lib/definitions";
  import { isNewCharacter, weaponTypeLabel } from "$lib/utils";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";

  const session = authClient.useSession();

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let isSaving = $state(false);
  let hasUnsavedChanges = $state(false);
  let rosterError = $state("");
  let savedSnapshot = $state("");

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let ownershipFilter = $state<OwnershipFilter>("all");
  let search = $state("");
  let sortBy = $state<CharacterSortKey>("release_date");
  let sortAsc = $state(false);

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

  function updateUnsavedState() {
    const changed = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
    hasUnsavedChanges = changed;
    if (changed) showSaved = false;
  }

  function toggleOwned(name_id: string) {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      c.name_id === name_id ? { ...c, isOwned: !c.isOwned } : c,
    );
    updateUnsavedState();
  }

  function selectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: true } : c,
    );
    updateUnsavedState();
  }

  function deselectAll() {
    const visibleIds = new Set(visibleCharacters.map((v) => v.name_id));
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleIds.has(c.name_id) ? { ...c, isOwned: false } : c,
    );
    updateUnsavedState();
  }

  async function saveCharacters() {
    if (isSaving) return;
    isSaving = true;
    rosterError = "";

    try {
      try {
        localStorage.setItem(
          "charactersOwned",
          JSON.stringify(tempCharactersOwned),
        );
      } catch {
        console.warn("localStorage unavailable — saving to memory only");
      }

      await writeTeamsOwned(tempCharactersOwned);
      await writeNearMissTeams(tempCharactersOwned);

      if ($session.data) {
        const res = await fetch("/api/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roster: tempCharactersOwned }),
        });
        if (!res.ok) {
          rosterError = `Sync failed (${res.status}) — roster not saved to cloud`;
          return;
        }
      }

      savedSnapshot = JSON.stringify(tempCharactersOwned);
      charactersOwned.set(tempCharactersOwned.map((c) => ({ ...c })));
      showSaved = true;
      hasUnsavedChanges = false;
      setHasSavedRoster();
    } catch (e) {
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
      tempCharactersOwned = $charactersOwned.map((c) => ({ ...c }));
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      synced = true;
    } else if ($charactersHydrated && synced && !hasUnsavedChanges) {
      const storeJson = JSON.stringify($charactersOwned);
      if (storeJson !== savedSnapshot) {
        tempCharactersOwned = $charactersOwned.map((c) => ({ ...c }));
        savedSnapshot = storeJson;
      }
    }
  });

  let savedOwnedSet = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name_id)),
  );

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
  let changedCount = $derived(
    tempCharactersOwned.reduce(
      (count, c) =>
        count +
        (c.isOwned !==
        $charactersOwned.find((o) => o.name_id === c.name_id)?.isOwned
          ? 1
          : 0),
      0,
    ),
  );
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
      <h2 class="section-title">Roster</h2>
      <p class="lede">Select the characters you own.</p>
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

    {#if hasUnsavedChanges || isSaving || showSaved || rosterError}
      <div class="save-bar">
        <div class="save-status">
          <span class="save-dot" class:saving={isSaving} class:saved={showSaved}
          ></span>
          <span class="save-label">
            {isSaving ? "Saving..." : showSaved ? "Saved" : "Unsaved changes"}
          </span>
          {#if hasUnsavedChanges}
            <span class="save-changed">({changedCount} changed)</span>
          {/if}
        </div>
        {#if hasUnsavedChanges && !isSaving && !showSaved}
          <div class="save-actions">
            <Button
              variant="ghost"
              onclick={() => {
                tempCharactersOwned = $charactersOwned.map((c) => ({ ...c }));
                savedSnapshot = JSON.stringify($charactersOwned);
                hasUnsavedChanges = false;
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
              {#if showNew}
                <span class="new-badge absolute top-1.5 right-1.5 z-20"
                  >NEW</span
                >
              {/if}
            {/snippet}
            {#snippet meta()}
              <div class="meta-name">{character.name}</div>
              <div class="meta-sub">
                {character.rarity}★ · {weaponTypeLabel(
                  character.weapon_type ?? "",
                )}
              </div>
            {/snippet}
          </CharacterPortraitCard>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <LoadingState message="Loading…" />
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

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-mid);
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

  .meta-name {
    font-size: 0.7rem;
    font-weight: 500;
    line-height: 1.15;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-sub {
    font-size: 0.6rem;
    line-height: 1.15;
    color: var(--foreground-mid);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .save-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
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
