<script lang="ts">
  import WeaponIcon from "#lib/ui/components/WeaponIcon.svelte";
  import WeaponName from "#lib/ui/components/WeaponName.svelte";
  import UpgradeImpactPopover from "#lib/ui/components/UpgradeImpactPopover.svelte";
  import type { UpgradeTier } from "#lib/investment/upgrade-priority.js";

  let {
    name = "",
    icon = null,
    weaponKey,
    rank,
    rankColor,
    priority,
    kind,
    priorityLabel,
    mean,
    median,
    min,
    max,
    teams,
  }: {
    name?: string;
    icon?: string | null;
    /** Signature-weapon rows: weapon icon + name replace `icon` / `name`. */
    weaponKey?: string;
    rank?: string | number;
    rankColor: string;
    priority?: UpgradeTier;
    kind?: "talent" | "level" | "constellation" | "signature";
    priorityLabel?: string;
    mean?: number;
    median?: number;
    min?: number;
    max?: number;
    teams?: number;
  } = $props();
</script>

<li class="talent-priority-row" data-priority={priority}>
  {#if rank != null}
    <span class="talent-priority-rank" style="color: {rankColor};">{rank}</span>
  {/if}
  {#if weaponKey}
    <span class="kit-icon talent-priority-icon shrink-0">
      <WeaponIcon {weaponKey} alt="" class="h-full w-full object-contain" />
    </span>
  {:else if icon}
    <img
      src={icon}
      alt=""
      class="kit-icon talent-priority-icon shrink-0"
      loading="lazy"
    />
  {/if}
  <div class="talent-priority-copy">
    <div class="talent-priority-name">
      {#if weaponKey}
        <WeaponName {weaponKey} />
      {:else}
        {name}
      {/if}
    </div>
    {#if kind != null && priority != null && priorityLabel != null}
      <UpgradeImpactPopover
        label={priorityLabel}
        tier={priority}
        {kind}
        {mean}
        {median}
        {min}
        {max}
        {teams}
      />
    {/if}
  </div>
</li>

<style>
  .talent-priority-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0;
  }

  .talent-priority-rank {
    font-size: 0.85rem;
    font-weight: 700;
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .talent-priority-icon {
    width: 40px;
    height: 40px;
  }

  .talent-priority-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .talent-priority-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }
</style>
