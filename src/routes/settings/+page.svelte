<script lang="ts">
  import {
    charactersOwned,
    displayPreferences,
    setDisplayPreferences,
    writeNearMissTeams,
    writeTeamsOwned,
    type IconStyle,
  } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";
  import { fly, slide } from "svelte/transition";

  const sections = [
    {
      id: "roster",
      label: "Roster",
      icon: "users",
    },
    {
      id: "sync",
      label: "Account",
      icon: "cloud",
    },
    {
      id: "display",
      label: "Display",
      icon: "monitor",
    },
  ] as const;

  type SettingsSection = (typeof sections)[number]["id"];

  let activeSectionIndex = $state(0);
  let activeSection = $derived(sections[activeSectionIndex].id);
  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let synced = $state(false);
  let showSaved = $state(false);
  let isSaving = $state(false);
  let hasUnsavedChanges = $state(false);

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let search = $state("");
  let filtersOpen = $state(false);

  let isFiltered = $derived(
    rarityFilter.size > 0 || elementFilter.size > 0 || weaponFilter.size > 0,
  );

  const elements = [
    "Dendro",
    "Cryo",
    "Hydro",
    "Anemo",
    "Pyro",
    "Geo",
    "Electro",
  ];
  const weaponTypes = ["Sword", "Catalyst", "Bow", "Claymore", "Polearm"];
  const rarities = [
    ["5", "5 star"],
    ["4", "4 star"],
  ];

  function toggleFilter(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  let visibleCharacters = $derived(
    tempCharactersOwned.filter((c) => {
      const matchesRarity =
        rarityFilter.size === 0 ||
        (rarityFilter.has("5") && c.rarity === 5) ||
        (rarityFilter.has("4") && c.rarity === 4);
      const matchesElement =
        elementFilter.size === 0 ||
        (c.element != null && elementFilter.has(c.element));
      const matchesWeapon =
        weaponFilter.size === 0 ||
        (c.weapon_type != null && weaponFilter.has(c.weapon_type));
      const matchesSearch =
        search === "" || c.name.toLowerCase().includes(search.toLowerCase());
      return matchesRarity && matchesElement && matchesWeapon && matchesSearch;
    }),
  );

  let savedSnapshot = $state<string>("");

  function toggleOwned(id: string) {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      c.id === id ? { ...c, isOwned: !c.isOwned } : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function selectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.id === c.id)
        ? { ...c, isOwned: true }
        : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function deselectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.id === c.id)
        ? { ...c, isOwned: false }
        : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  async function saveCharacters() {
    if (isSaving) return;
    isSaving = true;
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(tempCharactersOwned),
    );
    savedSnapshot = JSON.stringify(tempCharactersOwned);
    charactersOwned.set(tempCharactersOwned);

    await writeTeamsOwned(tempCharactersOwned);
    writeNearMissTeams(tempCharactersOwned).catch(console.error);

    showSaved = true;
    hasUnsavedChanges = false;
    isSaving = false;
    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  function setIconStyle(iconStyle: IconStyle) {
    setDisplayPreferences({ iconStyle });
  }

  function setActiveSection(index: number) {
    activeSectionIndex = index;
  }

  function handlePointerAction(event: PointerEvent, action: () => void) {
    if (event.button !== 0) return;
    action();
  }

  function handleKeyboardClick(event: MouseEvent, action: () => void) {
    if (event.detail === 0) action();
  }

  $effect(() => {
    if ($charactersOwned.length > 0 && !synced) {
      tempCharactersOwned = [...$charactersOwned];
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      synced = true;
    }
  });

  let ownedCount = $derived(
    tempCharactersOwned.filter((c) => c.isOwned).length,
  );
  let totalCount = $derived(tempCharactersOwned.length);
  let visibleOwnedCount = $derived(
    visibleCharacters.filter((c) => c.isOwned).length,
  );
</script>

<main class="w-[80%] pb-24 flex flex-col gap-6">
  <div class="settings-shell grid items-start gap-5 lg:grid-cols-[160px_1fr]">
    <aside class="settings-sidebar lg:sticky overflow-hidden">
      <div class="flex flex-row lg:flex-col">
        {#each sections as section, sectionIndex}
          <button
            type="button"
            onclick={() => setActiveSection(sectionIndex)}
            class="settings-nav-item relative lg:min-w-0 w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            class:is-active={activeSectionIndex === sectionIndex}
          >
            <span class="settings-nav-icon" aria-hidden="true">
              {#if section.icon === "users"}
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              {:else if section.icon === "cloud"}
                <svg viewBox="0 0 24 24">
                  <path
                    d="M17.5 19H8a6 6 0 1 1 5.4-8.6A4.5 4.5 0 1 1 17.5 19Z"
                  />
                  <path d="M12 12v6" />
                  <path d="m9 15 3-3 3 3" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M8 20h8" />
                  <path d="M12 16v4" />
                </svg>
              {/if}
            </span>
            <span class="min-w-0">
              <span class="block">
                {section.label}
              </span>
            </span>
          </button>
        {/each}
      </div>
    </aside>

    <section class="min-w-0">
      {#key activeSection}
        <div in:fly={{ y: 6, duration: 180 }}>
        {#if activeSection === "roster"}
          <div class="flex flex-col gap-4">
            {#if synced}
              <div class="flex flex-col gap-0">
                <div
                  class="flex items-center gap-2 rounded-lg px-3"
                  style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
                >
                  <button
                    type="button"
                    onclick={() => (filtersOpen = !filtersOpen)}
                    class="flex items-center gap-1.5 text-xs py-2 shrink-0 transition-opacity hover:opacity-75"
                    style={isFiltered
                      ? "color: var(--accent-1);"
                      : "color: var(--foreground-mid);"}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polygon
                        points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                      />
                    </svg>
                    Filter
                  </button>
                  <div
                    style="width: 0.5px; height: 16px; background: color-mix(in srgb, var(--accent-1) 22%, transparent);"
                  ></div>
                  <input
                    type="text"
                    placeholder="Search characters..."
                    bind:value={search}
                    class="flex-1 text-xs py-2 bg-transparent outline-none"
                    style="color: var(--foreground-color);"
                  />
                </div>

                {#if filtersOpen}
                  <div
                    class="flex flex-col gap-3 px-4 py-4 rounded-b-lg"
                    style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent); border-top: none;"
                    transition:slide={{ duration: 200 }}
                  >
                    <div class="filter-group">
                      <span>Elements</span>
                      <div>
                        {#each elements as el}
                          <button
                            type="button"
                            class="filter-chip"
                            class:is-selected={elementFilter.has(el)}
                            onclick={() =>
                              (elementFilter = toggleFilter(elementFilter, el))}
                          >
                            {el}
                          </button>
                        {/each}
                      </div>
                    </div>

                    <div class="filter-group">
                      <span>Rarity</span>
                      <div>
                        {#each rarities as [val, label]}
                          <button
                            type="button"
                            class="filter-chip"
                            class:is-selected={rarityFilter.has(val)}
                            onclick={() =>
                              (rarityFilter = toggleFilter(rarityFilter, val))}
                          >
                            {label}
                          </button>
                        {/each}
                      </div>
                    </div>

                    <div class="filter-group">
                      <span>Weapon Type</span>
                      <div>
                        {#each weaponTypes as wt}
                          <button
                            type="button"
                            class="filter-chip"
                            class:is-selected={weaponFilter.has(wt)}
                            onclick={() =>
                              (weaponFilter = toggleFilter(weaponFilter, wt))}
                          >
                            {wt}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onclick={selectAll}
                  class="secondary-action"
                >
                  Select all
                  {#if isFiltered || search}
                    ({visibleOwnedCount}/{visibleCharacters.length})
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={deselectAll}
                  class="secondary-action"
                >
                  Deselect all
                </button>
                <div class="ml-auto">
                  <span class="text-sm" style="color: var(--foreground-mid);">
                    {ownedCount} / {totalCount}
                  </span>
                </div>
              </div>

              {#if hasUnsavedChanges || isSaving || showSaved}
                <div
                  class="fixed bottom-6 left-0 right-0 mx-auto w-fit z-20 flex items-center gap-4 px-5 py-3 rounded-lg"
                  style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 40%, transparent);"
                  transition:fly={{ y: 200, duration: 500 }}
                >
                  <span class="text-sm" style="color: var(--foreground-mid);">
                    {isSaving
                      ? "Saving..."
                      : showSaved
                        ? "Saved!"
                        : "Unsaved changes"}
                  </span>
                  <button
                    type="button"
                    onclick={saveCharacters}
                    disabled={isSaving || showSaved || !hasUnsavedChanges}
                    class="primary-action"
                    style:opacity={isSaving || showSaved || !hasUnsavedChanges
                      ? "0.7"
                      : "1"}
                  >
                    {isSaving ? "Saving..." : showSaved ? "Saved" : "Save"}
                  </button>
                </div>
              {/if}

              <div
                class="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3 pb-24"
              >
                {#each visibleCharacters as character (character.id)}
                  <button
                    type="button"
                    onclick={() => toggleOwned(character.id)}
                    class="cursor-pointer rounded-lg w-full h-fit overflow-hidden relative transition-all duration-75 character-icon-button"
                    style="border: 2px solid var(--foreground-color); opacity: {character.isOwned
                      ? '1'
                      : '.33'};"
                  >
                    <CharacterIcon {character} />
                  </button>
                {/each}

                {#if visibleCharacters.length === 0}
                  <p
                    class="col-span-full text-xs"
                    style="color: var(--foreground-mid);"
                  >
                    No characters match.
                  </p>
                {/if}
              </div>
            {:else}
              <div class="flex items-center justify-center min-h-[40vh]">
                <p style="color: var(--foreground-mid);">Loading...</p>
              </div>
            {/if}
          </div>
        {:else if activeSection === "sync"}
          <div
            class="settings-panel p-6 min-h-[340px] flex flex-col justify-between"
          >
            <div class="flex flex-col gap-3 max-w-xl">
              <span class="panel-kicker">Upcoming</span>
              <h3>Account / Sync</h3>
              <p>
                Cloud roster sync is not wired up yet. For now, your character
                roster and display settings stay on this device.
              </p>
            </div>
            <div class="sync-preview rounded-lg p-4">
              <span>Planned</span>
              <p>Account login, roster backup, and cross-device preferences.</p>
            </div>
          </div>
        {:else}
          <div class="settings-panel p-6">
            <div class="flex flex-col gap-1 mb-6">
              <h3>Display</h3>
              <p>Adjust animation and character portrait preferences.</p>
            </div>

            <div class="preference-list">
              <div class="preference-row">
                <div>
                  <span>Animations</span>
                  <p>Enable card flip and motion effects.</p>
                </div>
                <button
                  type="button"
                  class="toggle"
                  class:is-on={$displayPreferences.animationsEnabled}
                  aria-label="Toggle animations"
                  aria-pressed={$displayPreferences.animationsEnabled}
                  onclick={() =>
                    setDisplayPreferences({
                      animationsEnabled: !$displayPreferences.animationsEnabled,
                    })}
                >
                  <span></span>
                </button>
              </div>

              <div class="preference-row items-start">
                <div>
                  <span>Character Portraits</span>
                  <p>
                    Choose between stylized coop art and front-facing Enka
                    icons.
                  </p>
                </div>
                <div class="segmented-control">
                  <button
                    type="button"
                    class:is-selected={$displayPreferences.iconStyle === "coop"}
                    onclick={() => setIconStyle("coop")}
                  >
                    Coop
                  </button>
                  <button
                    type="button"
                    class:is-selected={$displayPreferences.iconStyle === "enka"}
                    onclick={() => setIconStyle("enka")}
                  >
                    Enka
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
        </div>
      {/key}
    </section>
  </div>
</main>

<style>
  .settings-sidebar {
    position: relative;
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--background-mid) 96%, transparent),
      color-mix(in srgb, var(--background-color) 42%, transparent)
    );
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--accent-1) 16%, transparent),
      inset 0 -1px 0 color-mix(in srgb, black 20%, transparent);
  }

  .settings-nav-item {
    color: var(--foreground-color);
    border-radius: 7px;
    overflow: hidden;
  }

  .settings-nav-item + .settings-nav-item {
    border-top: 0;
  }

  .settings-nav-item:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 4%, transparent);
  }

  .settings-nav-item.is-active {
    color: var(--foreground-color);
    background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--accent-1) 56%, transparent),
        color-mix(in srgb, var(--accent-1) 32%, transparent),
        color-mix(in srgb, var(--accent-1) 22%, transparent) 86%,
        transparent
      ),
      color-mix(in srgb, var(--background-mid) 88%, transparent);
    box-shadow:
      inset 1px 0 0 var(--accent-1),
      inset 0 0 0 0.5px color-mix(in srgb, var(--accent-1) 20%, transparent);
  }

  .settings-nav-item.is-active::after {
    content: "✦";
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--accent-1);
    font-size: 1rem;
    line-height: 1;
    text-shadow: 0 0 14px color-mix(in srgb, var(--accent-1) 80%, transparent);
  }

  .settings-nav-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: currentColor;
    flex: 0 0 auto;
  }

  .settings-nav-icon svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .settings-panel {
    border-radius: 8px;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--background-mid) 96%, transparent),
        color-mix(in srgb, var(--background-mid) 88%, transparent)
      ),
      color-mix(in srgb, var(--background-mid) 92%, transparent);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 34%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--accent-1) 14%, transparent),
      inset 0 -1px 0 color-mix(in srgb, black 18%, transparent);
  }

  .settings-panel h3 {
    font-size: 1rem;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--foreground-color);
  }

  .settings-panel p {
    margin-top: 0.35rem;
    max-width: 42rem;
    font-size: 0.9rem;
    color: var(--foreground-mid);
  }

  .panel-kicker,
  .sync-preview span,
  .filter-group > span {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent-1);
  }

  .sync-preview {
    background: color-mix(in srgb, var(--background-color) 32%, transparent);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .filter-chip,
  .secondary-action {
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s,
      opacity 0.15s;
  }

  .filter-chip.is-selected {
    color: var(--accent-1);
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
    background: color-mix(in srgb, var(--accent-1) 15%, transparent);
  }

  .secondary-action {
    background: var(--background-mid);
    color: var(--foreground-mid);
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
  }

  .primary-action {
    border-radius: 8px;
    padding: 0.35rem 1rem;
    color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 15%, transparent);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 45%, transparent);
  }

  .preference-list {
    display: flex;
    flex-direction: column;
    border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .preference-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 0.5px solid
      color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .preference-row span {
    color: var(--foreground-color);
    font-size: 0.95rem;
  }

  .preference-row p {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--foreground-mid);
  }

  .toggle {
    width: 44px;
    height: 24px;
    border-radius: 999px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-color);
    padding: 2px;
    flex: 0 0 auto;
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  .toggle span {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--foreground-mid);
    transition:
      transform 0.15s,
      background-color 0.15s;
  }

  .toggle.is-on {
    border-color: color-mix(in srgb, var(--accent-1) 50%, transparent);
    background: color-mix(in srgb, var(--accent-1) 24%, transparent);
  }

  .toggle.is-on span {
    transform: translateX(20px);
    background: var(--accent-1);
  }

  .segmented-control {
    display: grid;
    grid-template-columns: repeat(2, minmax(72px, 1fr));
    border-radius: 8px;
    overflow: hidden;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-color);
    flex: 0 0 auto;
  }

  .segmented-control button {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    color: var(--foreground-mid);
  }

  .segmented-control button.is-selected {
    color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 16%, transparent);
  }

  .character-icon-button :global(*) {
    transition-duration: 0.5s;
  }

  .character-icon-button:hover :global(.icon-container-compact img) {
    transform: scale(1.2);
  }

  .character-icon-button:hover :global(.icon-container-coop img) {
    transform: scale(2.5);
  }

  .character-icon-button:hover {
    opacity: 0.67;
  }

  .character-icon-button {
    transition-duration: 0.5s;
    opacity: 0.33;
  }
</style>
