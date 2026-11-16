<script lang="ts">
  import WeaponTooltip from "#lib/ui/components/WeaponTooltip.svelte";
  import WeaponIcon from "#lib/ui/components/WeaponIcon.svelte";
  import ArtifactTooltip from "#lib/ui/components/ArtifactTooltip.svelte";
  import ArtifactIcon from "#lib/ui/components/ArtifactIcon.svelte";
  import { weaponStars } from "#lib/equipment/equipment-data.js";
  import { useEquipmentData } from "#lib/equipment/equipment-data.svelte.js";
  import { rankWeaponsByRarityAndTeams } from "#lib/characters/character-builds.js";
  import type { CharacterIndex } from "#lib/types/investment.js";

  let {
    builds,
    elColor,
  }: {
    builds: CharacterIndex;
    elColor: string;
  } = $props();

  const equipment = useEquipmentData();

  /** Weapons: BT strength → teams → measured sigs → rarity → name. */
  let rankedWeapons = $derived.by(() => {
    void equipment.version;
    return rankWeaponsByRarityAndTeams(
      builds.weapons,
      (key) => weaponStars(key) ?? 0,
      builds.vertical_importance?.sig_weapons?.map((s) => s.key),
    );
  });
</script>

<section class="board-section">
  <h2 class="section-title">Weapons</h2>
  {#if rankedWeapons.length === 0}
    <p class="muted-note">No weapon data yet.</p>
  {:else}
    <div class="equip-grid">
      {#each rankedWeapons as w (w.key)}
        <div class="equip-tile relative group">
          <div class="equip-icon-wrap">
            <WeaponIcon weaponKey={w.key} class="equip-icon" />
          </div>
          <WeaponTooltip weaponKey={w.key} />
        </div>
      {/each}
    </div>
  {/if}
</section>

<section class="board-section">
  <h2 class="section-title">Artifact sets</h2>
  {#if !builds.sets?.length}
    <p class="muted-note">No set data yet.</p>
  {:else}
    <div class="equip-grid">
      {#each builds.sets as s}
        <div class="equip-tile relative group">
          <div class="equip-icon-wrap">
            <ArtifactIcon setKey={s.key} class="equip-icon" />
            {#if s.count}
              <div class="piece-badge">
                <span style="color: {elColor};">{s.count}pc</span>
              </div>
            {/if}
          </div>
          <ArtifactTooltip setKey={s.key} pieceCount={s.count ?? null} />
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .muted-note {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .equip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .equip-tile {
    width: 4.5rem;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .equip-icon-wrap {
    width: 4.5rem;
    height: 4.5rem;
    position: relative;
  }

  .equip-icon-wrap :global(.equip-icon) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .piece-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: flex-end;
    padding: 1rem 0.35rem 0.35rem;
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--background-color) 85%, transparent)
    );
    z-index: 10;
  }

  .piece-badge span {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }
</style>
