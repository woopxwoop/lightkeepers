<script lang="ts">
  import {
    charactersOwned,
    charactersHydrated,
    displayPreferences,
    setDisplayPreferences,
    writeNearMissTeams,
    writeTeamsOwned,
    type IconStyle,
  } from "$lib/stores";
  import { authClient } from "$lib/auth-client";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";
  import { fly, slide } from "svelte/transition";
  import { WEAPON_TYPE_MAP } from "$lib/utils";

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
  const session = authClient.useSession();
  let syncStatus = $state<"idle" | "checking" | "needs-upload" | "uploading" | "synced" | "error">("idle");

  $effect(() => {
    if ($session.data) {
      checkRosterSync();
    } else {
      syncStatus = "idle";
    }
  });

  async function checkRosterSync() {
    syncStatus = "checking";
    try {
      const res = await fetch("/api/roster");
      if (!res.ok) {
        console.error("checkRosterSync: unexpected status", res.status);
        syncStatus = "error";
        return;
      }
      const { roster } = await res.json();
      syncStatus = roster === null ? "needs-upload" : "synced";
    } catch (err) {
      console.error("checkRosterSync: network error", err);
      syncStatus = "error";
    }
  }

  async function uploadRoster() {
    syncStatus = "uploading";
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: $charactersOwned }),
      });
      if (!res.ok) {
        console.error("uploadRoster: unexpected status", res.status);
        syncStatus = "needs-upload";
      } else {
        syncStatus = "synced";
      }
    } catch (err) {
      console.error("uploadRoster: network error", err);
      syncStatus = "needs-upload";
    }
  }

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
        (c.weapon_type != null &&
          weaponFilter.has(WEAPON_TYPE_MAP[c.weapon_type as keyof typeof WEAPON_TYPE_MAP] ?? c.weapon_type));
      const matchesSearch =
        search === "" || (c.name ?? "").toLowerCase().includes(search.toLowerCase());
      return matchesRarity && matchesElement && matchesWeapon && matchesSearch;
    }),
  );

  let savedSnapshot = $state<string>("");

  function toggleOwned(name_id: string) {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      c.name_id === name_id ? { ...c, isOwned: !c.isOwned } : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function selectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.name_id === c.name_id)
        ? { ...c, isOwned: true }
        : c,
    );
    hasUnsavedChanges = JSON.stringify(tempCharactersOwned) !== savedSnapshot;
  }

  function deselectAll() {
    tempCharactersOwned = tempCharactersOwned.map((c) =>
      visibleCharacters.some((v) => v.name_id === c.name_id)
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

    if ($session.data) {
      fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: tempCharactersOwned }),
      }).then((res) => {
        syncStatus = res.ok ? "synced" : "needs-upload";
      }).catch(() => {
        syncStatus = "needs-upload";
      });
    }

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
    if ($charactersHydrated && !synced) {
      tempCharactersOwned = [...$charactersOwned];
      savedSnapshot = JSON.stringify(tempCharactersOwned);
      synced = true;
    } else if ($charactersHydrated && synced && !hasUnsavedChanges) {
      tempCharactersOwned = [...$charactersOwned];
      savedSnapshot = JSON.stringify($charactersOwned);
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
                      aria-expanded={filtersOpen}
                      class="settings-filter-button flex items-center gap-1.5 text-xs py-2 shrink-0 transition-opacity hover:opacity-75"
                      class:settings-filter-button-active={isFiltered}
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
                      aria-label="Search characters"
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
                              aria-pressed={elementFilter.has(el)}
                              onclick={() =>
                                (elementFilter = toggleFilter(
                                  elementFilter,
                                  el,
                                ))}
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
                              aria-pressed={rarityFilter.has(val)}
                              onclick={() =>
                                (rarityFilter = toggleFilter(
                                  rarityFilter,
                                  val,
                                ))}
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
                              aria-pressed={weaponFilter.has(wt)}
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
                  {#each visibleCharacters as character (character.name_id)}
                    <button
                      type="button"
                      onclick={() => toggleOwned(character.name_id)}
                      aria-pressed={character.isOwned}
                      aria-label="{character.name ?? 'Unknown'}, {character.isOwned
                        ? 'owned'
                        : 'not owned'}"
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
            <div class="settings-panel settings-sync-panel p-6 flex flex-col gap-6">
              <div class="flex flex-col gap-3 max-w-xl">
                <h3>Account / Sync</h3>
                <p>Log in to back up your roster and sync across devices.</p>
              </div>

              {#if $session.isPending}
                <div class="flex items-center justify-center min-h-[120px]">
                  <p style="color: var(--foreground-mid);">Loading...</p>
                </div>
              {:else if $session.data}
                <div class="flex flex-col gap-4">
                  <div class="flex items-center gap-3">
                    {#if $session.data.user.image}
                      <img
                        src={$session.data.user.image}
                        alt=""
                        width="36"
                        height="36"
                        class="rounded-full"
                        style="border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
                      />
                    {/if}
                    <div class="flex flex-col">
                      <span style="color: var(--foreground-color); font-size: 0.9rem;">{$session.data.user.name}</span>
                      <span style="color: var(--foreground-mid); font-size: 0.8rem;">{$session.data.user.email}</span>
                    </div>
                  </div>

                  {#if syncStatus === "checking"}
                    <p style="color: var(--foreground-mid); font-size: 0.85rem;">Checking roster sync...</p>
                  {:else if syncStatus === "error"}
                    <p style="color: var(--foreground-mid); font-size: 0.85rem;">Could not reach sync service. Check your connection and try again.</p>
                  {:else if syncStatus === "needs-upload"}
                    <div class="flex flex-col gap-3 p-4 rounded-lg" style="background: color-mix(in srgb, var(--background-color) 60%, transparent); border: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent);">
                      <p style="color: var(--foreground-mid); font-size: 0.85rem; margin: 0;">No roster found in cloud. Upload your local roster?</p>
                      <div class="flex gap-2">
                        <button type="button" class="primary-action" onclick={uploadRoster}>Upload roster</button>
                        <button type="button" class="secondary-action" onclick={() => syncStatus = "synced"}>Skip</button>
                      </div>
                    </div>
                  {:else if syncStatus === "uploading"}
                    <p style="color: var(--foreground-mid); font-size: 0.85rem;">Uploading roster...</p>
                  {:else if syncStatus === "synced"}
                    <p style="color: var(--foreground-mid); font-size: 0.85rem;">Roster synced</p>
                  {/if}

                  <button
                    type="button"
                    class="secondary-action"
                    style="width: fit-content;"
                    onclick={() => authClient.signOut()}
                  >
                    Sign out
                  </button>
                </div>
              {:else}
                <div class="flex flex-col gap-3">
                  <button
                    type="button"
                    class="oauth-button"
                    onclick={() => authClient.signIn.social({ provider: "google", callbackURL: "/settings" })}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    class="oauth-button"
                    onclick={() => authClient.signIn.social({ provider: "discord", callbackURL: "/settings" })}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    Continue with Discord
                  </button>
                </div>
              {/if}
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
                        animationsEnabled:
                          !$displayPreferences.animationsEnabled,
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
                      class:is-selected={$displayPreferences.iconStyle ===
                        "coop"}
                      onclick={() => setIconStyle("coop")}
                    >
                      Coop
                    </button>
                    <button
                      type="button"
                      class:is-selected={$displayPreferences.iconStyle ===
                        "enka"}
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
    position: sticky;
    top: 80px;
    z-index: 10;
    border-radius: 8px;
    background: var(--background-mid);
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
        color-mix(in srgb, var(--accent-1) 12%, transparent)
      ),
      color-mix(in srgb, var(--background-mid) 88%, transparent);
    box-shadow:
      inset 1px 0 0 var(--accent-1),
      inset 0 0 0 0.5px color-mix(in srgb, var(--accent-1) 20%, transparent);
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

  .settings-sync-panel {
    min-height: 340px;
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

  .filter-group > span {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent-1);
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

  .settings-filter-button {
    color: var(--foreground-mid);
  }

  .settings-filter-button-active {
    color: var(--accent-1);
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

  .oauth-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 320px;
    padding: 0.65rem 1.25rem;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent);
    background: color-mix(in srgb, var(--background-color) 60%, transparent);
    color: var(--foreground-color);
    font-size: 0.9rem;
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  .oauth-button:hover {
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
    border-color: color-mix(in srgb, var(--accent-1) 44%, transparent);
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
