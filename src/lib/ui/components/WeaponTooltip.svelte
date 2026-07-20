<script lang="ts">
  import { weaponByKey, weaponTypeLabel, type WeaponData } from "$lib/utils";
  import HoverTooltip from "./HoverTooltip.svelte";

  let {
    weaponKey,
    weapon = null,
    refinement = null,
  }: {
    /** GOOD weapon key — looked up in `weaponByKey` when `weapon` is omitted. */
    weaponKey?: string;
    weapon?: WeaponData | null;
    /** When set, show that rank's passive text (defaults to R1). */
    refinement?: number | null;
  } = $props();

  let resolved = $derived(
    weapon ?? (weaponKey ? (weaponByKey.get(weaponKey) ?? null) : null),
  );

  let passive = $derived.by(() => {
    if (!resolved?.refinements.length) return null;
    const rank = refinement ?? 1;
    return (
      resolved.refinements.find((r) => r.rank === rank) ??
      resolved.refinements[0]
    );
  });

  function formatSubStat(sub: NonNullable<WeaponData["subStat"]>): string {
    if (sub.isPercent) return `${(sub.value * 100).toFixed(1)}%`;
    return Number.isInteger(sub.value)
      ? String(sub.value)
      : sub.value.toFixed(0);
  }
</script>

{#if resolved}
  <HoverTooltip class="max-w-72">
    <div class="text-xs font-medium leading-tight">{resolved.name}</div>
    <div class="text-[0.65rem] leading-tight mt-0.5 opacity-85">
      {resolved.stars}★ · {weaponTypeLabel(resolved.weaponType)}
    </div>
    {#if resolved.baseAtk}
      <div class="text-[0.65rem] leading-tight mt-1 opacity-85">
        Base ATK {Math.round(resolved.baseAtk)}{#if resolved.subStat}
          {" · "}{resolved.subStat.label}
          {formatSubStat(resolved.subStat)}{/if}
      </div>
    {/if}
    {#if passive}
      <div class="text-[0.65rem] leading-snug mt-1.5 opacity-85">
        {passive.description}
      </div>
    {/if}
  </HoverTooltip>
{/if}
