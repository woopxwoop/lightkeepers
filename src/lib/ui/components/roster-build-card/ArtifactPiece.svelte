<script lang="ts">
  /** One Enka Artifact row: piece icon, main stat, rarity + level, substat grid (or empty slot). */
  import { artifactSlotIconUrl, statIconUrl } from "#lib/utils.js";
  import { artifactPieceIconSrc } from "#lib/equipment/equipment-data.js";
  import { useEquipmentData } from "#lib/equipment/equipment-data.svelte.js";
  import {
    artifactMainStatText,
    starCount,
  } from "#lib/equipment/build-stat-display.js";
  import { formatGoodStatValue } from "#lib/roster/roster-build-card.js";
  import type {
    InventoryArtifact,
    InventoryArtifactSlot,
  } from "#lib/definitions.js";

  let {
    slot,
    piece,
    showSubstats,
  }: {
    slot: InventoryArtifactSlot;
    piece: InventoryArtifact | null;
    showSubstats: boolean;
  } = $props();

  const equipment = useEquipmentData({ baseStats: true });

  let icon = $derived.by(() => {
    void equipment.version;
    return piece
      ? artifactPieceIconSrc(piece.setKey, slot)
      : artifactSlotIconUrl(slot);
  });

  let mainStatText = $derived.by(() => {
    void equipment.version;
    return piece ? artifactMainStatText(piece) : "";
  });
</script>

<div class="Artifact" class:empty={!piece}>
  {#if icon}
    <img class="ArtifactIcon" src={icon} alt="" loading="lazy" />
  {/if}
  {#if piece}
    <div class="mainstat">
      <div>
        {#if statIconUrl(piece.mainStatKey)}
          <img src={statIconUrl(piece.mainStatKey)} alt="" class="stat-icon" />
        {/if}
      </div>
      <div>{mainStatText}</div>
      <div>
        <span class="Stars" aria-hidden="true">
          {#each Array.from({ length: starCount(piece.rarity) }, (_, i) => i) as i (i)}
            <span>{"\u{E938}"}</span>
          {/each}
        </span>
        <span class="level">+{piece.level}</span>
      </div>
    </div>
    <hr />
    {#if showSubstats}
      <div class="substats">
        {#each [0, 1, 2, 3] as i (i)}
          {@const sub = piece.substats[i]}
          <div class="Substat">
            {#if sub}
              {#if statIconUrl(sub.key)}
                <img src={statIconUrl(sub.key)} alt="" class="stat-icon" />
              {/if}
              <span>{formatGoodStatValue(sub.key, sub.value)}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="mainstat">
      <div class="muted">{slot}</div>
    </div>
  {/if}
</div>

<style>
  /* ── Artifacts (Enka Artifact / mainstat / substats) ───────────────── */

  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .Artifact img {
    pointer-events: none;
    display: block;
  }

  .Artifact {
    height: 18%;
    background: rgba(0, 0, 0, 0.31);
    border-radius: 0.3em;
    position: relative;
    overflow: hidden;
    color: #fff;
  }

  .Artifact.empty {
    opacity: 0.2;
  }

  .ArtifactIcon {
    position: absolute;
    top: -38%;
    width: 40%;
    bottom: -2%;
    left: -10%;
    object-fit: contain;
    /* Enka draws ArtifactIcon on canvas with a right-edge alpha fade. */
    -webkit-mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 45%,
      rgba(0, 0, 0, 0.45) 72%,
      transparent 100%
    );
    mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 45%,
      rgba(0, 0, 0, 0.45) 72%,
      transparent 100%
    );
  }

  .mainstat {
    position: absolute;
    height: 100%;
    width: 30%;
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 1;
  }

  .mainstat > div {
    flex-grow: 1;
  }

  .mainstat > div:nth-child(1) {
    max-height: 22%;
    align-self: flex-end;
    margin-left: auto;
  }

  .mainstat > div:nth-child(1) :global(.stat-icon) {
    width: 1em;
    height: 1em;
  }

  .mainstat > div:nth-child(2) {
    text-shadow: 0 0.07em 0.1em #000;
    max-height: 32%;
    font-size: 1.2em;
    padding: 2% 0;
    font-variant-numeric: tabular-nums;
  }

  .mainstat > div:nth-child(3) {
    max-height: 20%;
  }

  .Stars span {
    margin-left: -3%;
    font-size: 70%;
    color: rgb(255, 204, 50);
    text-shadow:
      0 1px 1px #000,
      0 1px 3px rgba(0, 0, 0, 0.5);
    display: inline-block;
    font-family: shicon !important;
  }

  .Artifact .Stars {
    display: inline-block;
  }

  .level {
    position: relative;
    z-index: 1;
  }

  .Artifact .level {
    display: inline-block;
    font-size: 60%;
    background: rgba(0, 0, 0, 0.5);
    line-height: 1;
    vertical-align: middle;
    padding: 1.5% 2%;
    border-radius: 0.2em;
    margin-left: 5%;
    box-sizing: content-box;
  }

  .Artifact hr {
    position: absolute;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.3);
    left: 34%;
    height: 84%;
    margin-top: 2%;
    padding: 0;
  }

  .substats {
    position: absolute;
    inset: 0.35em 0.35em 0.35em 38%;
    display: flex;
    flex-flow: column wrap;
    z-index: 1;
  }

  .substats > .Substat {
    width: 50%;
    height: 50%;
    display: block;
    position: absolute;
    inset: 0;
    line-height: 1;
    font-size: 1em;
  }

  .substats > .Substat:nth-child(1) {
    bottom: 50%;
    right: 50%;
    top: auto;
    left: auto;
  }
  .substats > .Substat:nth-child(2) {
    top: 50%;
    right: 50%;
    bottom: auto;
    left: auto;
  }
  .substats > .Substat:nth-child(3) {
    bottom: 50%;
    left: 50%;
    top: auto;
    right: auto;
  }
  .substats > .Substat:nth-child(4) {
    top: 50%;
    left: 50%;
    bottom: auto;
    right: auto;
  }

  .substats > .Substat::after {
    content: "";
    width: 0;
    height: 100%;
    display: inline-block;
    vertical-align: middle;
  }

  .substats > .Substat > :global(*) {
    vertical-align: middle;
    display: inline-block;
  }

  .substats .Substat :global(.stat-icon) {
    height: 1em;
    width: 1em;
    margin-right: 4%;
  }

  .muted {
    opacity: 0.55;
  }
</style>
