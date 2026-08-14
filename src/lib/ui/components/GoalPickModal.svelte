<script lang="ts">
  /**
   * + Character / + Weapon pick overlay used by Planner and the itinerary.
   */
  import { assetUrl } from "$lib/asset-urls";
  import type { CharacterOwned, CharacterPortraitRef } from "$lib/definitions";
  import { weaponById } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";
  import type { OwnershipFilter } from "$lib/character-filter";
  import type {
    UpgradeCostsCatalog,
    WeaponUpgradeCosts,
  } from "$lib/types/upgrade-costs";
  import { isOwnedNameId } from "$lib/utils";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import PickModal from "$lib/ui/components/PickModal.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import WeaponFilterBar from "$lib/ui/components/WeaponFilterBar.svelte";
  import {
    filterPlannerCharacterPickOptions,
    filterPlannerWeaponPickOptions,
    type PlannerPickOption,
  } from "$lib/planner-goal-edits";
  import { defaultWeaponRarityFilter } from "$lib/weapon-filter";

  let {
    open = false,
    kind,
    catalog = null,
    options = [],
    query = $bindable(""),
    sortOwnedFirst = $bindable(true),
    ownedIds,
    roster = [],
    getCharacter,
    onClose,
    onChoose,
  }: {
    open?: boolean;
    kind: "character" | "weapon";
    catalog?: UpgradeCostsCatalog | null;
    options?: PlannerPickOption[];
    query?: string;
    sortOwnedFirst?: boolean;
    ownedIds: ReadonlySet<string>;
    /** Full roster rows for rarity / weapon-type chips. */
    roster?: readonly CharacterOwned[];
    getCharacter: (nameId: string) => CharacterPortraitRef | undefined;
    onClose: () => void;
    onChoose: (value: string) => void;
  } = $props();

  const equipment = useEquipmentData();

  let rarityFilter = $state(new Set<string>());
  let elementFilter = $state(new Set<string>());
  let weaponFilter = $state(new Set<string>());
  let ownershipFilter = $state<OwnershipFilter>("all");
  let charFiltersOpen = $state(false);

  let weaponRarityFilter = $state(defaultWeaponRarityFilter());
  let weaponTypeFilter = $state(new Set<string>());
  let weaponFiltersOpen = $state(false);

  $effect(() => {
    if (!open) return;
    void kind;
    rarityFilter = new Set();
    elementFilter = new Set();
    weaponFilter = new Set();
    ownershipFilter = "all";
    charFiltersOpen = false;
    weaponRarityFilter = defaultWeaponRarityFilter();
    weaponTypeFilter = new Set();
    weaponFiltersOpen = false;
  });

  let filteredOptions = $derived.by(() => {
    if (kind === "character") {
      return filterPlannerCharacterPickOptions(
        options,
        roster,
        catalog,
        ownedIds,
        {
          rarity: rarityFilter,
          elements: elementFilter,
          weapons: weaponFilter,
          ownership: ownershipFilter,
        },
      );
    }
    void equipment.version;
    return filterPlannerWeaponPickOptions(
      options,
      catalog,
      { rarity: weaponRarityFilter, types: weaponTypeFilter },
      (id) => {
        const w = weaponById.get(id);
        return w
          ? { stars: w.stars, weaponType: w.weaponType }
          : undefined;
      },
    );
  });

  let weaponByCatalogId = $derived.by(() => {
    const map = new Map<string, WeaponUpgradeCosts>();
    for (const w of catalog?.weapons ?? []) {
      map.set(String(w.id), w);
    }
    return map;
  });
</script>

<PickModal
  {open}
  title={kind === "character" ? "Add character" : "Add weapon"}
  searchPlaceholder={kind === "character"
    ? "Search character…"
    : "Search weapon…"}
  options={filteredOptions}
  art={kind === "weapon" ? "square" : "portrait"}
  bind:query
  {onClose}
  {onChoose}
>
  {#snippet toolbar()}
    {#if kind === "character"}
      <div class="owned-first">
        <span class="owned-first-label">Owned first</span>
        <Toggle bind:pressed={sortOwnedFirst} aria-label="Owned first" />
      </div>
    {/if}
  {/snippet}
  {#snippet filters()}
    {#if kind === "character"}
      <CharacterFilterBar
        showSearch={false}
        showSort={false}
        bind:rarityFilter
        bind:elementFilter
        bind:weaponFilter
        bind:ownershipFilter
        bind:filtersOpen={charFiltersOpen}
      />
    {:else}
      <WeaponFilterBar
        bind:rarityFilter={weaponRarityFilter}
        bind:typeFilter={weaponTypeFilter}
        bind:filtersOpen={weaponFiltersOpen}
      />
    {/if}
  {/snippet}
  {#snippet tile(opt)}
    {#if kind === "character"}
      <CharacterPortraitCard
        character={getCharacter(opt.value)}
        dimmed={sortOwnedFirst && !isOwnedNameId(opt.value, ownedIds)}
        tintBackground
      />
    {:else}
      {@const weapon = weaponByCatalogId.get(opt.value)}
      <div class="weapon-tile">
        {#if weapon}
          {@const src = assetUrl(weapon.icon)}
          {#if src}
            <img src={src} alt="" loading="lazy" />
          {/if}
        {/if}
      </div>
    {/if}
  {/snippet}
</PickModal>

<style>
  .owned-first {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .owned-first-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-mid);
    user-select: none;
  }

  .weapon-tile {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--background-mid);
  }
</style>
