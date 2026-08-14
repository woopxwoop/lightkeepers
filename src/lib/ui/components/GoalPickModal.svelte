<script lang="ts">
  /**
   * + Character / + Weapon pick overlay used by Planner and the itinerary.
   */
  import { assetUrl } from "$lib/asset-urls";
  import type { CharacterPortraitRef } from "$lib/definitions";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import { isOwnedNameId } from "$lib/utils";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import PickModal from "$lib/ui/components/PickModal.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import type { PlannerPickOption } from "$lib/planner-goal-edits";

  let {
    open = false,
    kind,
    catalog = null,
    options = [],
    query = $bindable(""),
    sortOwnedFirst = $bindable(true),
    ownedIds,
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
    getCharacter: (nameId: string) => CharacterPortraitRef | undefined;
    onClose: () => void;
    onChoose: (value: string) => void;
  } = $props();
</script>

<PickModal
  {open}
  title={kind === "character" ? "Add character" : "Add weapon"}
  searchPlaceholder={kind === "character"
    ? "Search character…"
    : "Search weapon…"}
  {options}
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
  {#snippet tile(opt)}
    {#if kind === "character"}
      <CharacterPortraitCard
        character={getCharacter(opt.value)}
        dimmed={sortOwnedFirst && !isOwnedNameId(opt.value, ownedIds)}
        tintBackground
      />
    {:else}
      {@const weapon = catalog?.weapons.find((w) => String(w.id) === opt.value)}
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
