<script lang="ts">
  /** Enka Consts column: kit icons (toggle + hover preview when editing) or a C-number fallback. */
  import EnkaConstFrame from "#lib/ui/components/EnkaConstFrame.svelte";
  import type { InvestmentBuildKitIcons } from "#lib/investment/investment-build-card.js";
  import type { RosterProgress } from "#lib/definitions.js";
  import {
    activateConstellation,
    constellationAfterActivate,
    stepConstellation,
  } from "#lib/roster/roster-progress-edit.js";

  let {
    kit,
    progress,
    editMode,
    elementClass,
    hoverIndex = $bindable(),
    onCommit,
  }: {
    kit: InvestmentBuildKitIcons | null;
    progress: RosterProgress;
    editMode: boolean;
    elementClass: string;
    /** Constellation index under pointer — desktop hover preview only. */
    hoverIndex: number | null;
    onCommit: (next: RosterProgress) => void;
  } = $props();

  let cons = $derived(progress.constellation);
  let consPreview = $derived(
    editMode && hoverIndex != null
      ? constellationAfterActivate(cons, hoverIndex)
      : null,
  );
  let displayCons = $derived(consPreview ?? cons);

  function onConstellationActivate(index: number) {
    if (!editMode) return;
    onCommit(activateConstellation(progress, index));
  }

  function bumpConstellation(delta: number) {
    if (!editMode) return;
    onCommit(stepConstellation(progress, delta));
  }
</script>

<div
  class="Consts {elementClass}"
  class:editable={editMode}
  aria-label="Constellations C{cons}"
>
  {#if kit?.constellations?.length}
    {#each kit.constellations as c (c.index)}
      {@const unlocked = c.index <= displayCons}
      {@const truthLocked = c.index > cons}
      {@const wouldChange =
        consPreview != null && c.index <= cons !== c.index <= consPreview}
      {#if editMode}
        <button
          type="button"
          class="icon"
          class:locked={!unlocked}
          class:truth-locked={truthLocked}
          class:pulse={wouldChange}
          title="C{c.index}: {c.name}"
          aria-label="{truthLocked ? 'Unlock' : 'Lock'} constellation {c.index}"
          aria-pressed={!truthLocked}
          onpointerenter={() => (hoverIndex = c.index)}
          onpointerleave={() => {
            if (hoverIndex === c.index) hoverIndex = null;
          }}
          onclick={() => onConstellationActivate(c.index)}
        >
          <EnkaConstFrame uid="c{c.index}" />
          {#if c.icon}
            <img src={c.icon} alt="" loading="lazy" />
          {/if}
        </button>
      {:else}
        <div
          class="icon"
          class:locked={!unlocked}
          class:truth-locked={truthLocked}
          title="C{c.index}: {c.name}"
        >
          <EnkaConstFrame uid="c{c.index}" />
          {#if c.icon}
            <img src={c.icon} alt="" loading="lazy" />
          {/if}
        </div>
      {/if}
    {/each}
  {:else if editMode}
    <div class="cons-fallback cons-stepper">
      <button
        type="button"
        aria-label="Decrease constellation"
        onclick={() => bumpConstellation(-1)}>−</button
      >
      <span>C{cons}</span>
      <button
        type="button"
        aria-label="Increase constellation"
        onclick={() => bumpConstellation(1)}>+</button
      >
    </div>
  {:else}
    <div class="cons-fallback">C{cons}</div>
  {/if}
</div>

<style>
  /* ── Constellations (Enka Consts / SvgIcon Const) ─────────────────── */

  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .Consts img {
    pointer-events: none;
    display: block;
  }

  .Consts {
    display: flex;
    align-self: flex-start;
    flex-direction: column;
    flex-shrink: 0;
    font-size: 1.12em;
    pointer-events: none;
    position: relative;
    z-index: 2;
  }

  .Consts.Rock {
    color: rgb(255, 198, 74);
  }
  .Consts.Wind {
    color: rgb(113, 253, 236);
  }
  .Consts.Ice {
    color: rgb(152, 239, 255);
  }
  .Consts.Water {
    color: rgb(86, 162, 255);
  }
  .Consts.Electric {
    color: rgb(255, 161, 255);
  }
  .Consts.Fire {
    color: rgb(245, 132, 83);
  }
  .Consts.Grass {
    color: rgb(165, 255, 171);
  }

  .Consts .icon {
    margin: -0.2em 0 -0.2em -0.6em;
    position: relative;
    border: none;
    background: transparent;
    padding: 0;
    color: inherit;
    font: inherit;
  }

  .Consts.editable {
    pointer-events: all;
  }

  .Consts.editable .icon {
    pointer-events: all;
    cursor: pointer;
  }

  .Consts.editable .icon:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.7);
    outline-offset: 0.1em;
  }

  .Consts.editable .icon.pulse {
    filter: drop-shadow(0 0 0.35em currentColor);
    animation: cons-pulse 1.1s ease-in-out infinite;
  }

  @keyframes cons-pulse {
    0%,
    100% {
      filter: drop-shadow(0 0 0.15em currentColor);
      opacity: 0.85;
    }
    50% {
      filter: drop-shadow(0 0 0.55em currentColor);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .Consts.editable .icon.pulse {
      animation: none;
      filter: drop-shadow(0 0 0.4em currentColor);
      opacity: 1;
    }
  }

  .Consts .icon:nth-child(1) {
    z-index: 6;
  }
  .Consts .icon:nth-child(2) {
    z-index: 5;
  }
  .Consts .icon:nth-child(3) {
    z-index: 4;
  }
  .Consts .icon:nth-child(4) {
    z-index: 3;
  }
  .Consts .icon:nth-child(5) {
    z-index: 2;
  }
  .Consts .icon:nth-child(6) {
    z-index: 1;
  }

  .Consts .icon :global(svg) {
    width: 3em;
    display: block;
  }

  .Consts .icon > img {
    width: 1.6em;
    top: 0;
    position: absolute;
    left: 0;
    margin: 0.72em 0 0 0.7em;
    pointer-events: all;
  }

  .Consts .icon.locked > img {
    opacity: 0.4;
  }

  .cons-fallback {
    font-weight: 700;
    font-size: 1.1em;
  }

  .cons-stepper {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    pointer-events: all;
  }

  .cons-stepper button {
    width: 1.4em;
    height: 1.4em;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 0.25em;
    background: rgba(0, 0, 0, 0.4);
    color: #f4f1e8;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }
</style>
