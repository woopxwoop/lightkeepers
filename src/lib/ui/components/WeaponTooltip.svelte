<script lang="ts">
  import {
    useEquipmentData,
    useWeapon,
  } from "#lib/equipment/equipment-data.svelte.js";
  import {
    ensureWeaponRefinements,
    weaponRefinements,
    type WeaponData,
  } from "#lib/equipment/equipment-data.js";
  import { weaponTypeLabel } from "#lib/utils.js";
  import GameText from "#lib/ui/components/GameText.svelte";
  import HoverTooltip from "#lib/ui/components/HoverTooltip.svelte";

  let {
    weaponKey,
    weapon = null,
    refinement = null,
  }: {
    /** GOOD weapon key — looked up when `weapon` is omitted. */
    weaponKey?: string;
    weapon?: WeaponData | null;
    /** When set, show that rank's passive text (defaults to R1). */
    refinement?: number | null;
  } = $props();

  const lookup = useWeapon(() => weaponKey ?? "");
  // Refinement text (~80% of weapon data) loads on first open, not mount:
  // HoverTooltip keeps its body mounted on every page with a weapon.
  const equipment = useEquipmentData();
  function loadPassive() {
    void ensureWeaponRefinements().catch((error) => {
      console.error("[equipment-data] refinements load failed:", error);
    });
  }

  let resolved = $derived(weapon ?? lookup.weapon);

  let passive = $derived.by(() => {
    void equipment.version;
    const ranks = weaponRefinements(resolved);
    if (!ranks.length) return null;
    const rank = refinement ?? 1;
    return ranks.find((r) => r.rank === rank) ?? ranks[0];
  });

  function formatSubStat(sub: NonNullable<WeaponData["subStat"]>): string {
    if (sub.isPercent) return `${(sub.value * 100).toFixed(1)}%`;
    return Number.isInteger(sub.value)
      ? String(sub.value)
      : sub.value.toFixed(0);
  }
</script>

{#if resolved}
  <HoverTooltip class="max-w-72" label={resolved.name} onopen={loadPassive}>
    <div class="tip-detail-text font-medium">{resolved.name}</div>
    <div class="tip-detail-text tip-detail-text--small mt-0.5 opacity-85">
      {resolved.stars}★ · {weaponTypeLabel(resolved.weaponType)}
    </div>
    {#if resolved.baseAtk}
      <div class="tip-detail-text tip-detail-text--small mt-1 opacity-85">
        Base ATK {Math.round(resolved.baseAtk)}{#if resolved.subStat}
          {" · "}{resolved.subStat.label}
          {formatSubStat(resolved.subStat)}{/if}
      </div>
    {/if}
    {#if passive}
      <GameText
        class="tip-detail-text tip-detail-text--small mt-1.5 opacity-85"
        text={passive.description}
      />
    {/if}
  </HoverTooltip>
{/if}
