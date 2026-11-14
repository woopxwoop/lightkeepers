<script lang="ts">
  /** Enka Weapon block: icon + stars, name, ATK / substat chips, refinement and level. */
  import { statIconUrl } from "#lib/utils.js";
  import {
    useEquipmentData,
    useWeapon,
  } from "#lib/equipment/equipment-data.svelte.js";
  import { weaponIconUrl } from "#lib/asset-urls.js";
  import { resolveWeaponStats } from "#lib/equipment/build-stats.js";
  import {
    starCount,
    weaponBaseAtk,
    weaponSubstatDisplay,
  } from "#lib/equipment/build-stat-display.js";
  import { levelCapForAscension } from "#lib/planner/upgrade-costs.js";
  import WeaponTooltip from "#lib/ui/components/WeaponTooltip.svelte";
  import type { RosterWeapon } from "#lib/definitions.js";

  let { weapon }: { weapon: RosterWeapon | null } = $props();

  const equipment = useEquipmentData({ baseStats: true });
  const weaponLookup = useWeapon(() => weapon?.key ?? "");

  let weaponData = $derived(weaponLookup.weapon);
  let wIcon = $derived(
    weaponData ? weaponIconUrl(weaponData.awakenIcon) : weaponLookup.icon,
  );
  let stars = $derived(starCount(weaponData?.stars));

  let resolvedWeapon = $derived.by(() => {
    void equipment.version;
    const key = weapon?.key;
    if (!key) return null;
    return resolveWeaponStats(key, weapon?.level ?? 90, weapon?.ascension ?? 6);
  });
  let weaponAtk = $derived(weaponBaseAtk(resolvedWeapon));
  let weaponSub = $derived(weaponSubstatDisplay(resolvedWeapon, weaponData));
</script>

<div class="Weapon">
  {#if weapon}
    <figure data-rank={stars}>
      {#if wIcon}
        <img class="WeaponIcon" src={wIcon} alt="" loading="lazy" />
      {/if}
      <div class="Stars" aria-label="{stars} stars">
        {#each Array.from({ length: stars }, (_, i) => i) as i (i)}
          <span>{"\u{E938}"}</span>
        {/each}
      </div>
    </figure>
    <div class="weapon-caption">
      <div class="title">
        <span>{weaponData?.name ?? weapon.key}</span>
      </div>
      <div class="stats">
        {#if weaponAtk != null}
          <div class="Substat">
            {#if statIconUrl("atk")}
              <img src={statIconUrl("atk")} alt="" class="stat-icon" />
            {/if}
            <span>{weaponAtk}</span>
          </div>
        {/if}
        {#if weaponSub}
          <div class="Substat">
            {#if weaponSub.iconKey && statIconUrl(weaponSub.iconKey)}
              <img
                src={statIconUrl(weaponSub.iconKey)}
                alt=""
                class="stat-icon"
              />
            {/if}
            <span>{weaponSub.text}</span>
          </div>
        {/if}
      </div>
      <div class="sub">
        <div class="refine">R{weapon.refinement}</div>
        <div class="wlevel">
          Lv. {weapon.level} /
          {levelCapForAscension(weapon.ascension)}
        </div>
      </div>
    </div>
    <WeaponTooltip weaponKey={weapon.key} refinement={weapon.refinement} />
  {:else}
    <p class="empty-note">No weapon equipped</p>
  {/if}
</div>

<style>
  /* ── Weapon ───────────────────────────────────────────────────────── */

  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .Weapon img {
    pointer-events: none;
    display: block;
  }

  .Weapon {
    position: relative;
    display: flex;
    align-items: flex-start;
  }

  .Weapon figure {
    position: relative;
    width: 27%;
    line-height: 0;
    flex-shrink: 0;
    min-height: 5.5em;
    margin: 0;
  }

  .WeaponIcon {
    width: 100%;
  }

  .Weapon .Stars {
    font-size: 130%;
    text-align: center;
    position: absolute;
    width: 100%;
    top: 97%;
  }

  .Stars span {
    margin-left: -3%;
    font-size: 70%;
    color: rgb(255, 204, 50);
    text-shadow:
      0 1px 1px #000,
      0 1px 3px rgba(0, 0, 0, 0.5);
    display: inline-block;
    font-family: shicon !important;
  }

  .weapon-caption {
    padding: 0 5%;
    flex-grow: 1;
    color: #fff;
    align-self: center;
    min-width: 0;
  }

  .weapon-caption .title {
    font-weight: 400;
    margin: 0;
    font-size: 108%;
    line-height: 1.3;
    text-shadow:
      0 0.08em 0.1em rgba(0, 0, 0, 0.4),
      0 0.1em 0.3em rgba(0, 0, 0, 0.4);
  }

  .weapon-caption .stats {
    padding: 3% 0 2%;
  }

  .weapon-caption .Substat {
    display: inline-block;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 0.2em;
    padding: 2% 3%;
    margin-right: 0.5em;
    line-height: 1;
    font-size: 0.85em;
  }

  .weapon-caption .Substat :global(.stat-icon) {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.25em;
  }

  .Weapon .sub {
    display: flex;
    align-items: center;
    gap: 0.35em;
    margin-top: 0.25em;
  }

  .refine {
    text-shadow: 0 0.1em 0.1em rgba(0, 0, 0, 0.4);
    background: rgba(0, 0, 0, 0.5);
    display: inline-block;
    line-height: 1;
    padding: 1.5% 3%;
    border-radius: 0.2em;
    color: wheat;
  }

  .wlevel {
    background: rgba(0, 0, 0, 0.5);
    display: inline-block;
    line-height: 1;
    padding: 1.5% 3%;
    border-radius: 0.2em;
    white-space: nowrap;
    font-size: 0.9em;
  }

  .empty-note {
    margin: 0;
    opacity: 0.7;
    font-size: 0.9em;
  }
</style>
