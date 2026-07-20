<script lang="ts">
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import {
    WEAPON_TYPE_MAP,
    weaponTypeLabel,
    isNewCharacter,
  } from "$lib/utils";
  import IconFilter from "$lib/ui/icons/IconFilter.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import { slide } from "svelte/transition";

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let ownershipFilter = $state<"all" | "owned" | "unowned">("all");
  let search = $state("");
  let sortBy = $state<"name" | "release_date" | "game_id">("name");
  let sortAsc = $state(true);
  let sortOpen = $state(false);
  let filtersOpen = $state(false);
  let sortTriggerEl: HTMLButtonElement | null = $state(null);

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

  const ELEMENT_COLORS: Record<string, string> = {
    Pyro: "#f07b4a",
    Hydro: "#5eb8f5",
    Anemo: "#6dd5a8",
    Electro: "#c48ad5",
    Dendro: "#b1d94c",
    Cryo: "#8fd5e5",
    Geo: "#f5c242",
  };

  $effect(() => {
    if (!sortOpen) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") sortOpen = false;
    }
    function onClick(e: MouseEvent) {
      if (sortTriggerEl && !sortTriggerEl.contains(e.target as Node)) {
        const dropdown = document.querySelector(".char-sort-dropdown");
        if (dropdown && !dropdown.contains(e.target as Node)) sortOpen = false;
      }
    }
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("click", onClick);
    };
  });

  function toggleFilter(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  let isFiltered = $derived(
    rarityFilter.size > 0 ||
      elementFilter.size > 0 ||
      weaponFilter.size > 0 ||
      ownershipFilter !== "all",
  );

  let visible = $derived(
    $charactersOwned
      .filter((c) => {
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
            weaponFilter.has(
              WEAPON_TYPE_MAP[c.weapon_type as keyof typeof WEAPON_TYPE_MAP] ??
                c.weapon_type,
            ));
        const matchesOwnership =
          ownershipFilter === "all" ||
          (ownershipFilter === "owned" && c.isOwned) ||
          (ownershipFilter === "unowned" && !c.isOwned);
        const matchesSearch =
          search === "" ||
          (c.name ?? "").toLowerCase().includes(search.toLowerCase());
        return (
          matchesRarity &&
          matchesElement &&
          matchesWeapon &&
          matchesOwnership &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const cmp = (() => {
          if (sortBy === "game_id") return (a.game_id ?? 0) - (b.game_id ?? 0);
          if (sortBy === "release_date") {
            const ta = a.released_at ? new Date(a.released_at).getTime() : 0;
            const tb = b.released_at ? new Date(b.released_at).getTime() : 0;
            return ta - tb;
          }
          return (a.name ?? "").localeCompare(b.name ?? "");
        })();
        return sortAsc ? cmp : -cmp;
      }),
  );
</script>

<main
  class="w-[80%] pb-20 flex flex-col gap-6"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  <div
    class="page-banner relative overflow-hidden rounded-2xl"
    style="border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
  >
    <div
      class="absolute inset-0 bg-cover bg-center"
      style="background-image: url('https://images.lightkeepers.moe/site/xiao.webp'); opacity: 0.35;"
    ></div>
    <div
      class="absolute inset-0"
      style="background: linear-gradient(90deg, color-mix(in srgb, var(--background-color) 88%, transparent) 0%, color-mix(in srgb, var(--background-color) 35%, transparent) 100%);"
    ></div>
    <div class="relative z-10 flex flex-col gap-1 px-5 py-6 md:px-7 md:py-8">
      <h2
        class="tracking-widest uppercase"
        style="color: var(--foreground-color);"
      >
        Characters
      </h2>
      <p class="text-sm" style="color: var(--foreground-mid);">
        {visible.length} shown
      </p>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <input
      type="search"
      placeholder="Search…"
      bind:value={search}
      class="search-input"
    />
    <button
      type="button"
      class="filter-toggle"
      class:active={filtersOpen || isFiltered}
      onclick={() => (filtersOpen = !filtersOpen)}
      aria-expanded={filtersOpen}
    >
      <IconFilter size={14} />
      Filters
    </button>
    <div class="relative">
      <button
        type="button"
        class="filter-toggle"
        bind:this={sortTriggerEl}
        onclick={() => (sortOpen = !sortOpen)}
        aria-expanded={sortOpen}
      >
        Sort
        <span class:sort-chevron-up={!sortAsc}>
          <IconChevronDown size={10} strokeWidth={2.5} />
        </span>
      </button>
      {#if sortOpen}
        <div
          class="char-sort-dropdown"
          role="listbox"
          aria-label="Sort by"
          transition:slide={{ duration: 150 }}
        >
          <button
            type="button"
            role="option"
            aria-selected={sortBy === "name"}
            class="sort-option"
            class:sort-option-selected={sortBy === "name"}
            onclick={() => {
              sortBy = "name";
              sortOpen = false;
            }}>Alphabetical</button
          >
          <button
            type="button"
            role="option"
            aria-selected={sortBy === "release_date"}
            class="sort-option"
            class:sort-option-selected={sortBy === "release_date"}
            onclick={() => {
              sortBy = "release_date";
              sortOpen = false;
            }}>Release Date</button
          >
          <button
            type="button"
            role="option"
            aria-selected={sortBy === "game_id"}
            class="sort-option"
            class:sort-option-selected={sortBy === "game_id"}
            onclick={() => {
              sortBy = "game_id";
              sortOpen = false;
            }}>Game ID</button
          >
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="filter-toggle"
      onclick={() => (sortAsc = !sortAsc)}
      aria-label={sortAsc ? "Ascending" : "Descending"}
      title={sortAsc ? "Ascending" : "Descending"}
    >
      <span class:sort-chevron-up={sortAsc}>
        <IconChevronDown size={12} strokeWidth={2.5} />
      </span>
    </button>
  </div>

  {#if filtersOpen}
    <div
      class="filters-panel flex flex-col gap-3"
      transition:slide={{ duration: 180 }}
    >
      <div class="flex flex-wrap gap-1.5">
        {#each elements as el}
          <button
            type="button"
            class="chip"
            class:chip-active={elementFilter.has(el)}
            style={elementFilter.has(el)
              ? `border-color: ${ELEMENT_COLORS[el]}; color: ${ELEMENT_COLORS[el]};`
              : ""}
            onclick={() => (elementFilter = toggleFilter(elementFilter, el))}
            >{el}</button
          >
        {/each}
      </div>
      <div class="flex flex-wrap gap-1.5">
        {#each weaponTypes as wt}
          <button
            type="button"
            class="chip"
            class:chip-active={weaponFilter.has(wt)}
            onclick={() => (weaponFilter = toggleFilter(weaponFilter, wt))}
            >{wt}</button
          >
        {/each}
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("5")}
          onclick={() => (rarityFilter = toggleFilter(rarityFilter, "5"))}
          >5★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("4")}
          onclick={() => (rarityFilter = toggleFilter(rarityFilter, "4"))}
          >4★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={ownershipFilter === "owned"}
          onclick={() =>
            (ownershipFilter =
              ownershipFilter === "owned" ? "all" : "owned")}>Owned</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={ownershipFilter === "unowned"}
          onclick={() =>
            (ownershipFilter =
              ownershipFilter === "unowned" ? "all" : "unowned")}
          >Unowned</button
        >
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
    {#each visible as char (char.name_id)}
      {@const elColor = ELEMENT_COLORS[char.element ?? ""] ?? "transparent"}
      <a
        href="/characters/{char.name_id}"
        class="char-card rounded-md overflow-hidden relative no-underline"
        style="--shine: {elColor};"
        title={char.name ?? char.name_id}
      >
        {#if elColor !== "transparent"}
          <div
            class="absolute top-0 left-0 right-0 z-10 pointer-events-none"
            style="height: 2px; background: {elColor}; opacity: 0.7;"
          ></div>
        {/if}
        <div class="char-portrait">
          <CharacterIcon character={char} />
        </div>
        <div class="char-overlay absolute bottom-0 left-0 right-0 z-10 px-1.5 pb-1.5 pt-6">
          <div
            class="text-[0.7rem] font-medium leading-tight truncate"
            style="color: var(--foreground-color);"
          >
            {char.name}
          </div>
          <div class="text-[0.6rem] leading-tight truncate" style="color: var(--foreground-mid);">
            {char.rarity}★ · {weaponTypeLabel(char.weapon_type ?? "")}
          </div>
        </div>
        {#if isNewCharacter(char.released_at)}
          <span class="new-badge absolute top-1.5 right-1.5 z-10">NEW</span>
        {/if}
      </a>
    {/each}
  </div>
</main>

<style>
  .search-input {
    flex: 1;
    min-width: 10rem;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-color);
    font: inherit;
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent-1) 55%, transparent);
  }

  .filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    border-radius: 0.5rem;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-mid);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .filter-toggle.active,
  .filter-toggle:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
  }

  .char-sort-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    min-width: 9rem;
    padding: 0.35rem;
    border-radius: 0.5rem;
    background: var(--background-mid);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .sort-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.55rem;
    border: none;
    border-radius: 0.35rem;
    background: transparent;
    color: var(--foreground-mid);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .sort-option:hover,
  .sort-option-selected {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  }

  .sort-chevron-up {
    display: inline-flex;
    transform: rotate(180deg);
  }

  .chip {
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .chip-active {
    color: var(--accent-1);
    border-color: color-mix(in srgb, var(--accent-1) 55%, transparent);
    background: color-mix(in srgb, var(--accent-1) 8%, transparent);
  }

  .char-card {
    aspect-ratio: 3 / 4;
    background: var(--background-color);
    transition:
      box-shadow 0.35s ease,
      transform 0.2s ease;
  }

  .char-card::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      ellipse 100% 70% at 50% 60%,
      var(--shine) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none;
    z-index: 10;
  }

  .char-card:hover {
    box-shadow: 0 0 28px 4px color-mix(in srgb, var(--shine) 28%, transparent);
    z-index: 5;
  }

  .char-card:hover::after {
    opacity: 0.3;
  }

  .char-portrait {
    width: 100%;
    height: 100%;
  }

  .char-portrait :global(img) {
    display: block;
  }

  .char-overlay {
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.92) 0%,
      rgba(2, 6, 11, 0.55) 55%,
      transparent 100%
    );
  }

  .new-badge {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    background: var(--accent-1);
    color: var(--background-color);
  }

  .page-banner {
    min-height: 7.5rem;
  }
</style>
