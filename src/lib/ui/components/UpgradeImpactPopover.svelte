<script lang="ts">
  import type { UpgradeTier } from "$lib/upgrade-priority";
  import InfoPopover from "./InfoPopover.svelte";

  let {
    label,
    tier,
    kind,
    mean,
    median,
    min,
    max,
    teams,
    align = "start",
  }: {
    label: string;
    tier: UpgradeTier;
    kind: "talent" | "level" | "constellation" | "signature";
    mean: number;
    median: number;
    min: number;
    max: number;
    teams: number;
    align?: "start" | "center" | "end";
  } = $props();

  const primary = $derived(Math.max(mean, median));
  const isGain = $derived(kind === "constellation" || kind === "signature");
  const direction = $derived(isGain ? "+" : "−");

  const summary = $derived(
    kind === "level"
      ? "If you stop at level 80, you lose this much DPS across teams."
      : kind === "talent"
        ? "Leaving this talent at level 1 costs this much DPS across teams."
        : kind === "constellation"
          ? "This constellation adds this much DPS across teams."
          : "Equipping this signature adds this much DPS across teams using F2P options.",
  );

  function percent(value: number) {
    return `${direction}${Math.abs(value).toFixed(1)}%`;
  }

  function rangePercent(low: number, high: number) {
    return `${direction}${Math.abs(low).toFixed(1)}–${Math.abs(high).toFixed(1)}%`;
  }
</script>

<span class="impact impact-{tier}">
  <span class="impact-label">{label} ·</span>
  <InfoPopover label={percent(primary)} {align}>
    <span class="impact-detail">
      <span class="impact-summary">{summary}</span>
      <span class="impact-stats">
        <span>Mean: <strong>{percent(mean)}</strong></span>
        <span>Median: <strong>{percent(median)}</strong></span>
        <span>Range: <strong>{rangePercent(min, max)}</strong></span>
        <span>Across <strong>{teams}</strong> teams</span>
      </span>
    </span>
  </InfoPopover>
</span>

<style>
  .impact {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3ch;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .impact-label {
    white-space: nowrap;
  }

  .impact-exceptional {
    color: var(--accent-1);
  }

  .impact-high {
    color: color-mix(in srgb, var(--accent-1) 72%, var(--accent-2));
  }

  .impact-solid {
    color: var(--accent-2);
  }

  .impact-modest {
    color: color-mix(in srgb, var(--accent-2) 58%, var(--accent-3));
  }

  .impact-negligible {
    color: var(--accent-3);
  }

  .impact-detail {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 12.5rem;
  }

  .impact-summary {
    color: color-mix(in srgb, var(--background-color) 82%, transparent);
  }

  .impact-stats {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-variant-numeric: tabular-nums;
  }

  .impact-stats strong {
    font-weight: 700;
    color: var(--background-color);
  }
</style>
