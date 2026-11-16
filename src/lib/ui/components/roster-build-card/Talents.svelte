<script lang="ts">
  /** Enka Talents strip: normal / skill / burst levels, with steppers when editing. */
  import EnkaTalentFrame from "#lib/ui/components/EnkaTalentFrame.svelte";
  import type { InvestmentBuildKitIcons } from "#lib/investment/investment-build-card.js";
  import type { RosterProgress } from "#lib/definitions.js";
  import {
    stepTalent,
    type TalentSlot,
  } from "#lib/roster/roster-progress-edit.js";

  let {
    kit,
    progress,
    editMode,
    elementClass,
    onCommit,
  }: {
    kit: InvestmentBuildKitIcons | null;
    progress: RosterProgress;
    editMode: boolean;
    elementClass: string;
    onCommit: (next: RosterProgress) => void;
  } = $props();

  type TalentRow = {
    slot: TalentSlot;
    level: number;
    icon: string | null | undefined;
  };

  let talentRows = $derived<TalentRow[]>([
    {
      slot: "normal",
      level: progress.talents.normal,
      icon: kit?.talents.auto,
    },
    {
      slot: "skill",
      level: progress.talents.skill,
      icon: kit?.talents.skill,
    },
    {
      slot: "burst",
      level: progress.talents.burst,
      icon: kit?.talents.burst,
    },
  ]);

  function bumpTalent(slot: TalentSlot, delta: number) {
    if (!editMode) return;
    const next = stepTalent(progress, slot, delta);
    if (next) onCommit(next);
  }
</script>

<div class="talent-wrap">
  <div
    class="Talents {elementClass}"
    class:editable={editMode}
    aria-label="Talent levels"
  >
    {#each talentRows as row (row.slot)}
      <div class="icon">
        <EnkaTalentFrame uid={row.slot} />
        {#if row.icon}
          <img src={row.icon} alt="" loading="lazy" />
        {/if}
        <div class="level-wrap">
          {#if editMode}
            <div class="talent-stepper">
              <button
                type="button"
                class="talent-nudge"
                aria-label="Decrease {row.slot} talent"
                onclick={() => bumpTalent(row.slot, -1)}>−</button
              >
              <div class="level">{row.level}</div>
              <button
                type="button"
                class="talent-nudge"
                aria-label="Increase {row.slot} talent"
                onclick={() => bumpTalent(row.slot, 1)}>+</button
              >
            </div>
          {:else}
            <div class="level">{row.level}</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* ── Talents (Enka Talents / SvgIcon Circl) ───────────────────────── */

  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .talent-wrap img {
    pointer-events: none;
    display: block;
  }

  .talent-wrap {
    display: flex;
    position: absolute;
    right: 5%;
    bottom: 6%;
    flex-direction: column;
    align-items: flex-end;
    width: 60%;
    z-index: 2;
  }

  .Talents {
    display: flex;
    flex-direction: column;
    align-self: flex-end;
    margin-left: auto;
    pointer-events: all;
  }

  .Talents.Rock :global(svg) {
    color: rgb(74, 58, 24) !important;
  }
  .Talents.Wind :global(svg) {
    color: rgb(29, 77, 71) !important;
  }
  .Talents.Ice :global(svg) {
    color: rgb(25, 61, 67) !important;
  }
  .Talents.Water :global(svg) {
    color: rgb(24, 41, 62) !important;
  }
  .Talents.Electric :global(svg) {
    color: rgb(52, 18, 59) !important;
  }
  .Talents.Fire :global(svg) {
    color: rgb(84, 25, 0) !important;
  }
  .Talents.Grass :global(svg) {
    color: rgb(19, 69, 23) !important;
  }

  .Talents .icon {
    margin-top: 0.3em;
    position: relative;
  }

  .Talents .icon :global(svg) {
    width: 3.6em;
    color: rgb(0, 0, 0);
    opacity: 0.8;
    display: block;
  }

  .Talents .icon > img {
    width: 2.5em;
    position: absolute;
    left: 0.15em;
    top: 0.15em;
    margin: 0.4em 0 0 0.4em;
  }

  .level-wrap {
    position: absolute;
    bottom: -0.1em;
    width: 100%;
    text-align: center;
  }

  .level {
    position: relative;
    z-index: 1;
  }

  .Talents .level {
    background: rgba(50, 50, 50, 0.7);
    line-height: 1;
    padding: 8.9% 11% 8%;
    font-size: 0.8em;
    border-radius: 1.4em;
    display: inline-block;
    text-shadow: none;
  }

  .talent-stepper {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    pointer-events: all;
  }

  .talent-nudge {
    width: 1.15em;
    height: 1.15em;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #f4f1e8;
    cursor: pointer;
    font-size: 0.75em;
    line-height: 1;
  }

  .talent-nudge:hover,
  .talent-nudge:focus-visible {
    border-color: rgba(255, 255, 255, 0.85);
  }

  .Talents.editable .talent-stepper .level {
    min-width: 1.4em;
  }
</style>
