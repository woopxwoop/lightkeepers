<script lang="ts">
  /**
   * Dense label/value row for build sheets: optional stat glyph and label on
   * the left, formatted value on the right.
   */
  let {
    label,
    value,
    icon = null,
  }: {
    label: string;
    value: string;
    /** Stat glyph URL; omitted when the stat has no icon. */
    icon?: string | null;
  } = $props();
</script>

<div class="stat-row">
  <span class="stat-label">
    {#if icon}
      <img src={icon} alt="" class="stat-icon" />
    {/if}
    {label}
  </span>
  <span class="stat-value">{value}</span>
</div>

<style>
  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .stat-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    color: var(--foreground-mid);
  }

  .stat-icon {
    width: 0.95rem;
    height: 0.95rem;
    flex-shrink: 0;
  }

  .stat-value {
    font-weight: 600;
    color: var(--foreground-color);
    font-variant-numeric: tabular-nums;
  }
</style>
