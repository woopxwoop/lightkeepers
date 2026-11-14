<script lang="ts">
  import { resolve } from "$app/paths";
  import Team from "#lib/ui/components/Team.svelte";
  import ClearVideos from "#lib/ui/components/stygian-solution-board/ClearVideos.svelte";
  import { stygianSlotLabel } from "#lib/boards/slotLabels.js";
  import { boardSlotRate } from "#lib/boards/board-solutions.js";
  import type { StygianBoardSlot } from "#lib/boards/stygian-board.js";
  import type { StygianAssignment } from "#lib/boards/solver.js";
  import { getEnemyAsset } from "#lib/utils.js";
  import type {
    Character,
    StygianClearVideo,
    StygianEnemies,
  } from "#lib/definitions.js";

  let {
    slot,
    enemy,
    assignment,
    mapping,
    clears,
    time,
    showTime,
    clearsLimit,
    onshowmore,
  }: {
    slot: StygianBoardSlot;
    enemy: StygianEnemies[StygianBoardSlot] | undefined;
    assignment: StygianAssignment | undefined;
    mapping: Map<string, Character>;
    clears: StygianClearVideo[];
    /** Clear time in seconds for the seated team, if known. */
    time: number | null;
    showTime: boolean;
    clearsLimit: number;
    onshowmore: () => void;
  } = $props();

  let fieldName = $derived(enemy?.enemy_name ?? stygianSlotLabel[slot]);
</script>

<section class="field-hero" aria-label={fieldName}>
  {#if enemy?.asset}
    <img
      src={getEnemyAsset(enemy.asset)}
      alt=""
      class="hero-img"
      aria-hidden="true"
    />
  {/if}
  <div class="hero-scrim" aria-hidden="true"></div>

  <h2 class="field-heading">
    {#if enemy}
      <a
        class="field-heading-link"
        href={resolve(`tools/stygian/enemies/${enemy.id}`)}
        >{enemy.enemy_name ?? stygianSlotLabel[slot]}</a
      >
    {:else}
      {stygianSlotLabel[slot]}
    {/if}
  </h2>

  <div class="hero-body">
    {#if assignment}
      <Team
        team={assignment.team}
        {mapping}
        missingCharacters={assignment.missingCharacters}
      />

      <div class="rate-row">
        {#if showTime && time != null}
          <span>{time}s</span>
        {/if}
        {#if clears.length > 0}
          <ClearVideos {clears} limit={clearsLimit} {onshowmore} />
        {/if}
        <span class="rate-slot"
          >{boardSlotRate(assignment.team, slot).toFixed(0)}% usage in this
          field</span
        >
      </div>
    {:else}
      <div class="panel-empty">
        <p>No team available for this field</p>
      </div>
    {/if}
  </div>
</section>

<style>
  .field-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
    aspect-ratio: 10 / 9;
    overflow: hidden;
    background: var(--background-color);
  }

  .hero-img {
    position: absolute;
    left: 0;
    right: 0;
    top: -10%;
    width: 100%;
    height: 110%;
    object-fit: cover;
    object-position: 50% 0;
    pointer-events: none;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--background-color) 25%, transparent) 0%,
      transparent 28%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 58%,
      color-mix(in srgb, var(--background-color) 92%, transparent) 82%,
      var(--background-color) 100%
    );
    pointer-events: none;
  }

  .field-heading {
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    z-index: 2;
    margin: 0;
    padding: var(--space-3) 0;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    transition:
      opacity var(--control-duration) var(--control-ease),
      transform var(--control-duration) var(--control-ease);
  }

  /* Fine pointer: name is an overlay reveal, not layout. */
  @media (hover: hover) and (pointer: fine) {
    .field-heading {
      opacity: 0;
      transform: translateY(-0.15rem);
      pointer-events: none;
    }

    .field-hero:hover .field-heading,
    .field-hero:focus-within .field-heading {
      opacity: 1;
      transform: none;
      pointer-events: auto;
    }
  }

  .field-heading-link {
    color: inherit;
    text-decoration: none;
  }

  .field-heading-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .hero-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 80%;
    margin-top: auto;
    margin-inline: auto;
    padding: var(--space-5) 0 var(--space-3);
  }

  @media (max-width: 640px) {
    .hero-body {
      gap: 0.7rem;
      padding: var(--space-4) 0 var(--space-4);
    }
  }

  .rate-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .rate-row .rate-slot {
    margin-left: auto;
    color: var(--foreground-mid);
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 2rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }
</style>
