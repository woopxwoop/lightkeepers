<script lang="ts">
  import type { CharacterUsageSeriesPoint } from "$lib/definitions";

  let {
    points = [],
    class: className = "",
  }: {
    points?: CharacterUsageSeriesPoint[];
    class?: string;
  } = $props();

  const uid = $props.id();
  const areaGradId = `usage-area-${uid}`;

  const W = 640;
  const H = 192;
  const PAD = { top: 14, right: 8, bottom: 12, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  let values = $derived(
    points.map((p) =>
      typeof p.usage_rate === "number" && Number.isFinite(p.usage_rate)
        ? p.usage_rate
        : 0,
    ),
  );

  let yMax = $derived.by(() => {
    const peak = Math.max(0, ...values);
    if (peak <= 0) return 100;
    const step = peak <= 20 ? 5 : peak <= 50 ? 10 : 20;
    return Math.min(100, Math.ceil(peak / step) * step);
  });

  let coords = $derived(
    values.map((v, i) => {
      const x =
        points.length <= 1
          ? PAD.left + innerW / 2
          : PAD.left + (i / (points.length - 1)) * innerW;
      const y = PAD.top + innerH - (v / yMax) * innerH;
      return { x, y, v, point: points[i]! };
    }),
  );

  let linePath = $derived(
    coords.length === 0
      ? ""
      : coords
          .map(
            (c, i) =>
              `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
          )
          .join(" "),
  );

  let areaPath = $derived(
    coords.length === 0
      ? ""
      : `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L${coords[0]!.x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`,
  );

  /** Interior grid only — baseline carries zero. */
  let yTicks = $derived.by(() => {
    const ticks: number[] = [];
    const step = yMax <= 20 ? 5 : yMax <= 50 ? 10 : 20;
    for (let t = step; t <= yMax; t += step) ticks.push(t);
    return ticks;
  });

  let firstLabel = $derived(points[0] ? labelFor(points[0]) : "");
  let lastLabel = $derived(
    points.length > 1 ? labelFor(points[points.length - 1]!) : "",
  );

  let hoverIndex = $state<number | null>(null);
  let hover = $derived(
    hoverIndex === null || !coords[hoverIndex] ? null : coords[hoverIndex],
  );

  function labelFor(point: CharacterUsageSeriesPoint): string {
    return point.version_name?.trim() || `v${point.version_number}`;
  }

  function formatRate(v: number): string {
    return `${v.toFixed(1)}%`;
  }

  function onMove(event: PointerEvent) {
    if (coords.length === 0) return;
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i]!.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    hoverIndex = best;
  }

  function onLeave() {
    hoverIndex = null;
  }
</script>

{#if points.length === 0}
  <p class="chart-empty">No usage data for this character yet.</p>
{:else}
  <div class="chart-wrap {className}">
    <svg
      class="chart"
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Usage rate over versions from {firstLabel}{lastLabel
        ? ` to ${lastLabel}`
        : ''}"
      onpointermove={onMove}
      onpointerleave={onLeave}
    >
      <defs>
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop class="area-stop-top" offset="0%" />
          <stop class="area-stop-bot" offset="100%" />
        </linearGradient>
      </defs>

      {#each yTicks as tick}
        {@const y = PAD.top + innerH - (tick / yMax) * innerH}
        <line
          class="grid"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y}
          y2={y}
        />
        <text class="tick" x={PAD.left - 6} y={y + 3} text-anchor="end"
          >{tick}</text
        >
      {/each}

      <line
        class="baseline"
        x1={PAD.left}
        x2={W - PAD.right}
        y1={PAD.top + innerH}
        y2={PAD.top + innerH}
      />

      <path class="area" d={areaPath} fill="url(#{areaGradId})" />
      <path class="line" d={linePath} fill="none" />

      <!-- Single focus mark — dense series stay quiet until hover. -->
      {#if hover}
        <line
          class="crosshair"
          x1={hover.x}
          x2={hover.x}
          y1={PAD.top}
          y2={PAD.top + innerH}
        />
        <circle class="dot" cx={hover.x} cy={hover.y} r="3.5" />
      {:else if coords.length === 1}
        {@const c = coords[0]!}
        <circle class="dot" cx={c.x} cy={c.y} r="3.5" />
      {/if}
    </svg>

    <div class="range" title="{firstLabel} → {lastLabel || firstLabel}">
      <span class="range-start">{firstLabel}</span>
      {#if lastLabel}
        <span class="range-sep" aria-hidden="true"></span>
        <span class="range-end">{lastLabel}</span>
      {/if}
    </div>

    {#if hover}
      <div class="tooltip" aria-live="polite">
        <span class="tooltip-ver">{labelFor(hover.point)}</span>
        <span class="tooltip-val">{formatRate(hover.v)}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chart-wrap {
    position: relative;
    width: 100%;
  }

  .chart {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
  }

  .grid {
    stroke: color-mix(in srgb, var(--foreground-color) 6%, transparent);
    stroke-width: 1;
  }

  .baseline {
    stroke: color-mix(in srgb, var(--foreground-color) 16%, transparent);
    stroke-width: 1;
  }

  .tick {
    fill: color-mix(in srgb, var(--foreground-mid) 85%, transparent);
    font-family: var(--font-body);
    font-size: 9px;
    font-variant-numeric: tabular-nums;
  }

  .area-stop-top {
    stop-color: var(--accent-1);
    stop-opacity: 0.22;
  }

  .area-stop-bot {
    stop-color: var(--accent-1);
    stop-opacity: 0;
  }

  .line {
    stroke: var(--accent-1);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--accent-1);
    stroke: var(--background-mid);
    stroke-width: 2;
  }

  .crosshair {
    stroke: color-mix(in srgb, var(--foreground-color) 14%, transparent);
    stroke-width: 1;
  }

  .range {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.45rem;
    padding-left: 2.15rem;
    color: color-mix(in srgb, var(--foreground-mid) 90%, transparent);
    font-size: 0.65rem;
    letter-spacing: 0.01em;
    min-width: 0;
  }

  .range-start,
  .range-end {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .range-start {
    flex: 1 1 0;
  }

  .range-end {
    flex: 1 1 0;
    text-align: right;
  }

  .range-sep {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1px;
    background: color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  .tooltip {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;
    max-width: min(14rem, calc(100% - 2.5rem));
    padding: 0.4rem 0.55rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--background-mid) 94%, transparent);
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--foreground-color) 10%, transparent);
    pointer-events: none;
  }

  .tooltip-ver {
    color: var(--foreground-mid);
    font-size: 0.65rem;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .tooltip-val {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .chart-empty {
    margin: 0;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
  }
</style>
