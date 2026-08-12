<script lang="ts">
  let {
    label,
    value,
    min,
    max,
    /** Soft floor (e.g. ascension-gated). Track still spans from `min`. */
    floor,
    /** Soft ceiling (e.g. ascension-gated). Track still spans to `max`. */
    cap,
    step = 1,
    onchange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    floor?: number;
    cap?: number;
    step?: number;
    onchange: (next: number) => void;
  } = $props();

  let effectiveFloor = $derived(floor ?? min);
  let effectiveCap = $derived(cap ?? max);
  let fillPct = $derived(
    max <= min
      ? 0
      : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)),
  );
  let draft = $state<string | null>(null);

  function snapToStep(n: number): number {
    if (!(step > 0)) return n;
    return Math.round(n / step) * step;
  }

  function emit(raw: string) {
    if (raw.trim() === "") {
      draft = "";
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    let next = snapToStep(n);
    if (next < effectiveFloor) next = effectiveFloor;
    else if (next > effectiveCap) next = effectiveCap;
    draft = null;
    if (next !== value) onchange(next);
  }

  function commitDraft() {
    if (draft === null) return;
    if (draft.trim() === "") {
      draft = null;
      return;
    }
    emit(draft);
  }
</script>

<label class="nsf">
  <span class="nsf-label">{label}</span>
  <div class="nsf-row">
    <input
      class="nsf-range"
      type="range"
      {min}
      {max}
      {step}
      {value}
      style="--fill: {fillPct}%"
      aria-label={label}
      aria-valuemin={effectiveFloor}
      aria-valuemax={effectiveCap}
      oninput={(e) => emit(e.currentTarget.value)}
    />
    <div class="nsf-value">
      <input
        class="nsf-num"
        type="number"
        min={effectiveFloor}
        max={effectiveCap}
        {step}
        value={draft ?? value}
        aria-label={`${label} value`}
        oninput={(e) => emit(e.currentTarget.value)}
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
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
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

  .nsf-range {
    width: 100%;
    min-width: 0;
    height: 1.25rem;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
    --fill: 0%;
    --track-fill: var(--accent-1);
    --track-rest: color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  .nsf-range:focus {
    outline: none;
  }

  .nsf-range:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range::-webkit-slider-runnable-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--track-fill) 0%,
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

  .nsf-range::-moz-range-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--track-fill) 0%,
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
</style>
