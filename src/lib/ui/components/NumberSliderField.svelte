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
    /** Optional start mark on the track. Editable when `onOriginChange` is set. */
    origin,
    /**
     * When split (origin + onOriginChange): which side is interactive.
     * `"origin"` = start inputs + circle; `"value"` = goal inputs + remain bar.
     */
    editSide = "value",
    step = 1,
    onchange,
    onOriginChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    /**
     * Lower bound for the value handle. When split handles are enabled
     * (`onOriginChange` + `origin`), value is also clamped to `origin`
     * (planner callers pass `floor` equal to `origin`).
     */
    floor?: number;
    cap?: number;
    origin?: number;
    editSide?: "origin" | "value";
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
  let splitHandles = $derived(Boolean(onOriginChange && origin != null));
  let editOrigin = $derived(splitHandles && editSide === "origin");
  let editValue = $derived(!splitHandles || editSide === "value");
  let draft = $state<string | null>(null);
  let originDraft = $state<string | null>(null);

  $effect(() => {
    void value;
    draft = null;
  });

  $effect(() => {
    void origin;
    originDraft = null;
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

  function valueFloor(): number {
    return splitHandles && origin != null
      ? Math.max(effectiveFloor, origin)
      : effectiveFloor;
  }

  function onRangeInput(el: HTMLInputElement) {
    if (!editValue) {
      el.value = String(value);
      return;
    }
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    const next = snapAndClamp(n, valueFloor(), effectiveCap);
    el.value = String(next);
    draft = null;
    if (next !== value) onchange(next);
  }

  function onOriginInput(el: HTMLInputElement) {
    if (!onOriginChange || !editOrigin) {
      el.value = String(origin ?? min);
      return;
    }
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    const next = snapAndClamp(n, min, value);
    el.value = String(next);
    originDraft = null;
    if (next !== origin) onOriginChange(next);
  }

  function clampAndEmitOrigin(raw: string) {
    if (!onOriginChange || !editOrigin) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const next = snapAndClamp(n, min, value);
    originDraft = null;
    if (next !== origin) onOriginChange(next);
    return true;
  }

  function onOriginNumberInput(raw: string) {
    if (!editOrigin) return;
    if (raw.trim() === "" || raw === "-" || raw.endsWith(".")) {
      originDraft = raw;
      return;
    }
    if (!clampAndEmitOrigin(raw)) originDraft = raw;
  }

  function commitOriginDraft() {
    if (originDraft === null) return;
    if (originDraft.trim() === "") {
      originDraft = null;
      return;
    }
    clampAndEmitOrigin(originDraft);
  }

  function clampAndEmit(raw: string) {
    if (!editValue) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const next = snapAndClamp(n, valueFloor(), effectiveCap);
    draft = null;
    if (next !== value) onchange(next);
    return true;
  }

  function onNumberInput(raw: string) {
    if (!editValue) return;
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

  /** Matches `.nsf-range-value` thumb width — marks/fill use the same inset. */
  const THUMB_REM = 0.9;
  const ORIGIN_HIT_PX = 16;
  const CLOSE_PX = 28;

  let trackEl: HTMLDivElement | undefined = $state();
  let dragHandle: "origin" | "value" | null = null;

  function thumbPx(): number {
    const root = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return THUMB_REM * (Number.isFinite(root) && root > 0 ? root : 16);
  }

  /** Thumb center X for a 0–100 track percentage (native range geometry). */
  function thumbCenterX(rect: DOMRect, pct: number): number {
    const thumb = thumbPx();
    return rect.left + thumb / 2 + ((rect.width - thumb) * pct) / 100;
  }

  function clientXToRaw(clientX: number): number {
    const rect = trackEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || span <= 0) return min;
    const thumb = thumbPx();
    const usable = rect.width - thumb;
    if (usable <= 0) return min;
    const pct = Math.min(
      1,
      Math.max(0, (clientX - rect.left - thumb / 2) / usable),
    );
    return min + pct * span;
  }

  function pickHandle(clientX: number): "origin" | "value" {
    if (!splitHandles || origin == null) return "value";
    if (editOrigin && !editValue) return "origin";
    if (editValue && !editOrigin) return "value";
    const rect = trackEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return "value";
    const originX = thumbCenterX(rect, originPct);
    const valueX = thumbCenterX(rect, fillPct);
    if (Math.abs(valueX - originX) < CLOSE_PX) {
      return clientX < originX ? "origin" : "value";
    }
    if (clientX >= originX - ORIGIN_HIT_PX && clientX <= originX + 6) {
      return "origin";
    }
    return "value";
  }

  function applyHandle(handle: "origin" | "value", clientX: number) {
    const raw = clientXToRaw(clientX);
    if (handle === "origin") {
      if (!editOrigin) return;
      const next = snapAndClamp(raw, min, value);
      originDraft = null;
      if (next !== origin) onOriginChange?.(next);
      return;
    }
    if (!editValue) return;
    const next = snapAndClamp(raw, valueFloor(), effectiveCap);
    draft = null;
    if (next !== value) onchange(next);
  }

  function onTrackPointerDown(e: PointerEvent) {
    if (!splitHandles || e.button !== 0) return;
    const handle = pickHandle(e.clientX);
    if (handle === "origin" && !editOrigin) return;
    if (handle === "value" && !editValue) return;
    dragHandle = handle;
    trackEl?.setPointerCapture(e.pointerId);
    applyHandle(dragHandle, e.clientX);
  }

  function onTrackPointerMove(e: PointerEvent) {
    if (!trackEl) return;
    if (dragHandle) {
      applyHandle(dragHandle, e.clientX);
      return;
    }
    if (!splitHandles) return;
    const handle = pickHandle(e.clientX);
    const can =
      (handle === "origin" && editOrigin) || (handle === "value" && editValue);
    trackEl.style.cursor = can
      ? handle === "origin"
        ? "ew-resize"
        : "pointer"
      : "default";
  }

  function onTrackPointerUp(e: PointerEvent) {
    if (dragHandle == null) return;
    if (trackEl?.hasPointerCapture(e.pointerId)) {
      trackEl.releasePointerCapture(e.pointerId);
    }
    dragHandle = null;
  }
</script>

<div
  class="nsf"
  class:edit-origin={editOrigin}
  class:edit-value={editValue && splitHandles}
>
  <div class="nsf-label">{label}</div>
  <div class="nsf-row" class:has-origin={hasOrigin}>
    {#if hasOrigin && origin != null}
      {#if onOriginChange}
        <input
          class="nsf-num nsf-num-origin"
          type="number"
          {min}
          max={value}
          {step}
          value={originDraft ?? origin}
          disabled={!editOrigin}
          aria-label="{label} starting point value"
          oninput={(e) => onOriginNumberInput(e.currentTarget.value)}
          onchange={commitOriginDraft}
          onblur={commitOriginDraft}
        />
      {:else}
        <span class="nsf-num nsf-num-static">{origin}</span>
      {/if}
    {/if}
    <div
      class="nsf-track"
      class:split={splitHandles}
      class:has-origin={hasOrigin}
      class:edit-origin={editOrigin}
      class:edit-value={editValue && splitHandles}
      style="--fill-ratio: {fillPct / 100}; --origin-ratio: {originPct /
        100}; --thumb: {THUMB_REM}rem"
      bind:this={trackEl}
      onpointerdown={onTrackPointerDown}
      onpointermove={onTrackPointerMove}
      onpointerup={onTrackPointerUp}
      onpointercancel={onTrackPointerUp}
      onlostpointercapture={onTrackPointerUp}
    >
      {#if hasOrigin}
        <span class="nsf-remain" aria-hidden="true"></span>
        <span class="nsf-origin-mark" aria-hidden="true"></span>
        {#if onOriginChange && origin != null}
          <input
            class="nsf-range nsf-range-origin"
            type="range"
            {min}
            max={value}
            {step}
            value={origin}
            disabled={!editOrigin}
            tabindex={editOrigin ? 0 : -1}
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
        disabled={!editValue}
        tabindex={editValue ? 0 : -1}
        aria-label={label}
        oninput={(e) => onRangeInput(e.currentTarget)}
      />
    </div>
    <div class="nsf-value">
      <input
        class="nsf-num nsf-num-value"
        type="number"
        min={valueFloor()}
        max={effectiveCap}
        {step}
        value={draft ?? value}
        disabled={!editValue}
        aria-label={`${label} value`}
        oninput={(e) => onNumberInput(e.currentTarget.value)}
        onchange={() => commitDraft()}
        onblur={commitDraft}
      />
      <span class="nsf-max" aria-hidden="true">/{effectiveCap}</span>
    </div>
  </div>
</div>

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

  .nsf-row.has-origin {
    grid-template-columns: 2.4rem minmax(0, 1fr) 5.25rem;
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
    border: var(--border-width) solid var(--accent-1);
    background: var(--background-color);
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
    appearance: textfield;
    transition:
      box-shadow 160ms ease,
      border-color 160ms ease,
      opacity 160ms ease;
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

  .nsf-num:disabled {
    border-color: var(--border-control-quiet);
    color: var(--foreground-mid);
    cursor: default;
    opacity: 1;
  }

  .nsf-num-static {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    pointer-events: none;
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
    --fill-ratio: 0;
    --origin-ratio: 0;
    --thumb: 0.9rem;
    /* Native range thumbs travel on (100% − thumb); centers match these. */
    --fill-x: calc(
      var(--thumb) / 2 + (100% - var(--thumb)) * var(--fill-ratio)
    );
    --origin-x: calc(
      var(--thumb) / 2 + (100% - var(--thumb)) * var(--origin-ratio)
    );
    --track-fill: var(--accent-1);
    --track-rest: color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  .nsf-track::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 0.28rem;
    transform: translateY(-50%);
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--track-fill) 0,
      var(--track-fill) var(--fill-x),
      var(--track-rest) var(--fill-x),
      var(--track-rest) 100%
    );
    pointer-events: none;
  }

  .nsf-track.has-origin::before {
    background: linear-gradient(
      to right,
      var(--track-fill) 0,
      var(--track-fill) var(--origin-x),
      var(--track-rest) var(--origin-x),
      var(--track-rest) 100%
    );
  }

  .nsf-track.split {
    touch-action: none;
    user-select: none;
  }

  .nsf-track.split .nsf-range {
    pointer-events: none;
  }

  .nsf-remain {
    position: absolute;
    left: var(--origin-x);
    width: calc(var(--fill-x) - var(--origin-x));
    top: calc(50% - 0.14rem);
    height: 0.28rem;
    pointer-events: none;
    z-index: 1;
    background: var(--accent-1);
    opacity: 0.35;
    transition: opacity 160ms ease;
  }

  .nsf-track.edit-value .nsf-remain {
    opacity: 1;
    animation: nsf-remain-pulse 2.2s ease-in-out infinite;
  }

  .nsf-track.edit-origin .nsf-remain {
    opacity: 0.2;
  }

  @keyframes nsf-remain-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nsf-track.edit-value .nsf-remain {
      animation: none;
      opacity: 1;
    }
  }

  .nsf-origin-mark {
    position: absolute;
    left: var(--origin-x);
    top: 0;
    width: 2px;
    height: 1.25rem;
    background: var(--foreground-color);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 6;
    opacity: 0.35;
    transition: opacity 160ms ease;
  }

  .nsf-track.edit-origin .nsf-origin-mark {
    opacity: 1;
  }

  .nsf-track.edit-value .nsf-origin-mark {
    opacity: 0.35;
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
    cursor: ew-resize;
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

  .nsf-range-origin:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range-origin:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .nsf-range::-webkit-slider-runnable-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: transparent;
  }

  .nsf-range::-webkit-slider-thumb {
    appearance: none;
    width: 0.9rem;
    height: 0.9rem;
    margin-top: -0.31rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: var(--foreground-color);
    opacity: 0.35;
    transition: opacity 160ms ease;
  }

  .nsf-track.edit-value .nsf-range-value::-webkit-slider-thumb,
  .nsf:not(.edit-origin):not(.edit-value)
    .nsf-range-value::-webkit-slider-thumb {
    opacity: 1;
  }

  .nsf-track.edit-origin .nsf-range-value::-webkit-slider-thumb {
    opacity: 0.25;
  }

  .nsf-range-origin::-webkit-slider-runnable-track {
    background: transparent;
  }

  .nsf-range-origin::-webkit-slider-thumb {
    width: 0.9rem;
    height: 0.9rem;
    margin-top: -0.31rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: transparent;
    opacity: 0;
  }

  .nsf-range-origin::-moz-range-track {
    background: transparent;
    border: none;
  }

  .nsf-range::-moz-range-track {
    height: 0.28rem;
    border-radius: var(--radius-pill);
    background: transparent;
    border: none;
  }

  .nsf-range::-moz-range-thumb {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: var(--foreground-color);
    opacity: 0.35;
    transition: opacity 160ms ease;
  }

  .nsf-track.edit-value .nsf-range-value::-moz-range-thumb,
  .nsf:not(.edit-origin):not(.edit-value) .nsf-range-value::-moz-range-thumb {
    opacity: 1;
  }

  .nsf-track.edit-origin .nsf-range-value::-moz-range-thumb {
    opacity: 0.25;
  }

  .nsf-range-origin::-moz-range-thumb {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: var(--border-width) solid var(--accent-1);
    background: transparent;
    opacity: 0;
  }
</style>
