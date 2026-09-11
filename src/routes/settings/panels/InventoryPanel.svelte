<script lang="ts">
  /**
   * Read-only browse of GOOD weapons / artifacts already imported.
   * Adding or editing pieces is out of scope — Roster gear equips from this bag.
   */
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { authClient } from "$lib/auth-client";
  import {
    getRosterArtifactsCached,
    getRosterWeaponsCached,
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import type { InventoryArtifact, InventoryWeapon } from "$lib/definitions";
  import { artifactSetByKey } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";
  import ArtifactIcon from "$lib/ui/components/ArtifactIcon.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import WeaponIcon from "$lib/ui/components/WeaponIcon.svelte";
  import WeaponName from "$lib/ui/components/WeaponName.svelte";

  const session = authClient.useSession();
  const equipment = useEquipmentData();

  let weapons = $state<InventoryWeapon[]>([]);
  let artifacts = $state<InventoryArtifact[]>([]);
  let loading = $state(true);
  let loadError = $state("");

  onMount(() => {
    void refresh();
  });

  $effect(() => {
    // Re-read cache after Account import / logout while this tab is open.
    void $session.data;
    const cachedW = getRosterWeaponsCached();
    const cachedA = getRosterArtifactsCached();
    if (cachedW) weapons = cachedW;
    if (cachedA) artifacts = cachedA;
  });

  async function refresh() {
    loading = true;
    loadError = "";
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
      console.error("Inventory load failed:", err);
      loadError = "Could not load inventory.";
      weapons = getRosterWeaponsCached() ?? [];
      artifacts = getRosterArtifactsCached() ?? [];
    } finally {
      loading = false;
    }
  }

  let empty = $derived(weapons.length === 0 && artifacts.length === 0);

  function artifactSetName(setKey: string): string {
    void equipment.version;
    return artifactSetByKey.get(setKey)?.name ?? setKey;
  }
</script>

<div class="inventory-page">
  <header class="panel-head">
    <h2 class="section-title">Inventory</h2>
    <p class="lede">
      Weapons and artifacts from your GOOD import. Browse only for now —
      equipping and adding pieces are not supported yet.
    </p>
    <p class="section-lede">
      Import under
      <a class="back-link" href={resolve("/settings?tab=account")}>Account</a>,
      or browse your
      <a class="back-link" href={resolve("/settings")}>Roster</a>.
    </p>
  </header>

  {#if loading}
    <LoadingState message="Loading inventory…" />
  {:else if loadError && empty}
    <EmptyState message={loadError} />
  {:else if empty}
    <EmptyState message="No weapons or artifacts imported yet.">
      {#snippet action()}
        <a class="back-link" href={resolve("/settings?tab=account")}
          >Upload GOOD on Account</a
        >
      {/snippet}
    </EmptyState>
  {:else}
    {#if loadError}
      <p class="load-error">{loadError}</p>
    {/if}

    <section class="inv-section" aria-labelledby="inv-weapons-title">
      <h3 id="inv-weapons-title" class="section-title">
        Weapons
        <span class="meta-sub">({weapons.length})</span>
      </h3>
      {#if weapons.length === 0}
        <p class="section-lede">No weapons in the bag.</p>
      {:else}
        <ul class="inv-list">
          {#each weapons as weapon, index (index)}
            <li class="inv-row">
              <div class="inv-icon">
                <WeaponIcon weaponKey={weapon.key} class="inv-icon-img" />
              </div>
              <div class="inv-meta">
                <div class="meta-name">
                  <WeaponName weaponKey={weapon.key} />
                </div>
                <div class="meta-sub">
                  Lv {weapon.level} · R{weapon.refinement}{#if weapon.location}
                    · on {weapon.location}{/if}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="inv-section" aria-labelledby="inv-artifacts-title">
      <h3 id="inv-artifacts-title" class="section-title">
        Artifacts
        <span class="meta-sub">({artifacts.length})</span>
      </h3>
      {#if artifacts.length === 0}
        <p class="section-lede">No artifacts in the bag.</p>
      {:else}
        <ul class="inv-list">
          {#each artifacts as artifact, index (index)}
            <li class="inv-row">
              <div class="inv-icon">
                <ArtifactIcon setKey={artifact.setKey} class="inv-icon-img" />
              </div>
              <div class="inv-meta">
                <div class="meta-name">{artifactSetName(artifact.setKey)}</div>
                <div class="meta-sub">
                  {artifact.slotKey} · +{artifact.level} · {artifact.mainStatKey}{#if artifact.location}
                    · on {artifact.location}{/if}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .inventory-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .panel-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 42rem;
  }

  .lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-mid);
  }

  .load-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .inv-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .inv-section .section-title {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    margin: 0;
  }

  .inv-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .inv-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
  }

  .inv-row + .inv-row {
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .inv-icon {
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    overflow: hidden;
  }

  .inv-icon :global(.inv-icon-img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .inv-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
</style>
