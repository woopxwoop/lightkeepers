<script lang="ts">
  let {
    label,
    value,
    min,
    max,
    /** Lower bound for the value (e.g. planner start). Track still spans `min`. */
    floor,
    /** Upper bound for the value. Track still spans `max`. */
    cap,
    /** Optional start mark on the track (dashed line). Draggable when `onOriginChange` is set. */
    origin,
    step = 1,
    onchange,
    onOriginChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    floor?: number;
    cap?: number;
    origin?: number;
    step?: number;
    onchange: (next: number) => void;
    onOriginChange?: (next: number) => void;
  } = $props();

  let effectiveFloor = $derived(floor ?? min);
  let effectiveCap = $derived(cap ?? max);
  let span = $derived(max - min);
  let fillPct = $derived(
    span <= 0 ? 0 : Math.min(100, Math.max(0, ((value - min) / span) * 100)),
  );
  let originPct = $derived(
    origin == null || span <= 0
      ? 0
      : Math.min(100, Math.max(0, ((origin - min) / span) * 100)),
  );
  let hasOrigin = $derived(origin != null);
  let showFrom = $derived(origin != null && origin > min);
  let draft = $state<string | null>(null);

  $effect(() => {
    void value;
    draft = null;
  });

  function snapToStep(n: number): number {
    if (!(step > 0)) return n;
    return min + Math.round((n - min) / step) * step;
  }

  function snapAndClamp(n: number, lo: number, hi: number): number {
    let next = snapToStep(n);
    if (next < lo) next = lo;
    else if (next > hi) next = hi;
    return next;
  }

  function onRangeInput(el: HTMLInputElement) {
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    const next = snapAndClamp(n, effectiveFloor, effectiveCap);
    el.value = String(next);
    draft = null;
    if (next !== value) onchange(next);
  }

  function onOriginInput(el: HTMLInputElement) {
    if (!onOriginChange) return;
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    const next = snapAndClamp(n, min, value);
    el.value = String(next);
    if (next !== origin) onOriginChange(next);
  }

  function clampAndEmit(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const next = snapAndClamp(n, effectiveFloor, effectiveCap);
    draft = null;
    if (next !== value) onchange(next);
    return true;
  }

  function onNumberInput(raw: string) {
    if (raw.trim() === "" || raw === "-" || raw.endsWith(".")) {
      draft = raw;
      return;
    }
    if (!clampAndEmit(raw)) draft = raw;
  }

  function commitDraft() {
    if (draft === null) return;
    if (draft.trim() === "") {
      draft = null;
      return;
    }
    clampAndEmit(draft);
  }
</script>

<label class="nsf">
  <span class="nsf-label">
    {label}
    {#if showFrom}
      <span class="nsf-from">from {origin}</span>
    {/if}
  </span>
  <div class="nsf-row">
    <div class="nsf-track" style="--fill: {fillPct}%; --origin: {originPct}%">
      {#if hasOrigin}
        <span class="nsf-origin-mark" style="left: {originPct}%"></span>
        {#if onOriginChange && origin != null}
          <input
            class="nsf-range nsf-range-origin"
            type="range"
            {min}
            {max}
            {step}
            value={origin}
            aria-label="{label} starting point"
            oninput={(e) => onOriginInput(e.currentTarget)}
          />
        {/if}
      {/if}
      <input
        class="nsf-range nsf-range-value"
        type="range"
        {min}
        {max}
        {step}
        {value}
        aria-label={label}
        oninput={(e) => onRangeInput(e.currentTarget)}
      />
    </div>
    <div class="nsf-value">
      <input
        class="nsf-num"
        type="number"
        min={effectiveFloor}
        max={effectiveCap}
        {step}
        value={draft ?? value}
        aria-label={`${label} value`}
        oninput={(e) => onNumberInput(e.currentTarget.value)}
        onchange={() => commitDraft()}
        onblur={commitDraft}
      />
      <span class="nsf-max" aria-hidden="true">/{effectiveCap}</span>
    </div>
  </div>
</label>

<style>
  .nsf {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nsf-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .nsf-from {
    letter-spacing: 0.02em;
    text-transform: none;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--foreground-mid) 80%, transparent);
  }

  .nsf-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5.25rem;
    gap: 0.65rem;
    align-items: center;
  }

  .nsf-value {
    display: grid;
    grid-template-columns: 2.4rem 2.5rem;
    align-items: center;
    width: 100%;
  }

  .nsf-num {
    width: 100%;
    min-width: 0;
    padding: 0.28rem 0.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 28%, transparent);
    background: var(--background-color);
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
    appearance: textfield;
    transition:
      box-shadow 160ms ease,
      border-color 160ms ease;
  }

  .nsf-num::-webkit-outer-spin-button,
  .nsf-num::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  .nsf-num:focus {
    outline: none;
    border-color: var(--accent-1);
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-max {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
    text-align: left;
    padding-left: 0.15rem;
  }

  .nsf-track {
    position: relative;
    min-width: 0;
    height: 1.25rem;
    --fill: 0%;
    --origin: 0%;
    --track-fill: var(--accent-1);
    --track-rest: color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  .nsf-origin-mark {
    position: absolute;
    top: 0;
    height: 1.25rem;
    width: 0;
    border-left: 1px dashed
      color-mix(in srgb, var(--foreground-color) 55%, transparent);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 2;
  }

  .nsf-range {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 1.25rem;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .nsf-range-origin {
    z-index: 4;
    pointer-events: none;
  }

  .nsf-range-value {
    z-index: 3;
  }

  .nsf-range:focus {
    outline: none;
  }

  .nsf-range-value:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range-value:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range::-webkit-slider-runnable-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--track-rest) 0%,
      var(--track-rest) var(--origin),
      var(--track-fill) var(--origin),
      var(--track-fill) var(--fill),
      var(--track-rest) var(--fill),
      var(--track-rest) 100%
    );
  }

  .nsf-range::-webkit-slider-thumb {
    appearance: none;
    width: 0.9rem;
    height: 0.9rem;
    margin-top: -0.31rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: var(--foreground-color);
  }

  .nsf-range-origin::-webkit-slider-runnable-track {
    background: transparent;
  }

  .nsf-range-origin::-webkit-slider-thumb {
    pointer-events: auto;
    width: 0.55rem;
    height: 1.05rem;
    margin-top: -0.38rem;
    border-radius: 1px;
    border: none;
    background: transparent;
  }

  .nsf-range-origin::-moz-range-track {
    background: transparent;
    border: none;
  }

  .nsf-range::-moz-range-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--track-rest) 0%,
      var(--track-rest) var(--origin),
      var(--track-fill) var(--origin),
      var(--track-fill) var(--fill),
      var(--track-rest) var(--fill),
      var(--track-rest) 100%
    );
  }

  .nsf-range::-moz-range-thumb {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: var(--foreground-color);
  }

  .nsf-range-origin::-moz-range-thumb {
    pointer-events: auto;
    width: 0.55rem;
    height: 1.05rem;
    border-radius: 1px;
    border: none;
    background: transparent;
  }
</style>
