<script lang="ts">
  /** Enka `.set` block: lead set glyph + active set names with piece counts. */
  import {
    artifactSetIconSrc,
    artifactSetName,
  } from "#lib/equipment/equipment-data.js";
  import { useEquipmentData } from "#lib/equipment/equipment-data.svelte.js";
  import ArtifactTooltip from "#lib/ui/components/ArtifactTooltip.svelte";
  import type { RosterBuildSetCount } from "#lib/roster/roster-build-card.js";

  let { setCounts }: { setCounts: RosterBuildSetCount[] } = $props();

  const equipment = useEquipmentData();

  function setName(setKey: string): string {
    void equipment.version;
    return artifactSetName(setKey) ?? setKey;
  }

  function setIcon(setKey: string): string | null {
    void equipment.version;
    return artifactSetIconSrc(setKey);
  }
</script>

<div class="set">
  {#if setCounts[0] && setIcon(setCounts[0].setKey)}
    <i class="set-glyph" aria-hidden="true">
      <img src={setIcon(setCounts[0].setKey)} alt="" loading="lazy" />
    </i>
  {:else}
    <i class="set-glyph" aria-hidden="true"></i>
  {/if}
  <div class="sets">
    {#if setCounts.length === 0}
      <div>
        <div class="desc muted">No set bonus</div>
      </div>
    {:else}
      {#each setCounts as s (s.setKey)}
        <div class="group">
          <div class="desc">{setName(s.setKey)}</div>
          <div class="count">{s.count}</div>
          <ArtifactTooltip setKey={s.setKey} pieceCount={s.count} />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* Enka card images: no hit-testing, block layout (same as the card host). */
  .set img {
    pointer-events: none;
    display: block;
  }

  .set {
    display: flex;
    width: 100%;
    max-width: 100%;
    padding-top: 0.5em;
    text-shadow:
      0 0.08em 0.1em rgba(0, 0, 0, 0.4),
      0 0.1em 0.3em rgba(0, 0, 0, 0.4);
  }

  /* Enka `.set i` — 2em box at 1.3em font-size beside the set list */
  .set-glyph {
    width: 2em;
    flex-shrink: 0;
    height: 2em;
    font-size: 1.3em;
    display: block;
    line-height: 2.3em;
    background: rgba(0, 0, 0, 0.14);
    border-radius: 0.2em;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .set-glyph img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    inset: 0;
  }

  .sets {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: center;
    min-width: 0;
  }

  .sets .group {
    position: relative;
    display: flex;
    padding: 0 0 0 0.5em;
    font-size: 0.8em;
    min-width: 0;
  }

  .sets .group:nth-child(1) {
    margin-bottom: 0.1em;
  }

  .sets .desc {
    flex-grow: 1;
    text-align: center;
    color: rgb(144, 238, 144);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    min-width: 0;
    padding: 0 0.3em;
  }

  .sets .desc.muted {
    color: rgba(255, 255, 255, 0.55);
  }

  .sets .count {
    background: rgba(0, 0, 0, 0.14);
    border-radius: 0.2em;
    text-align: center;
    width: 2em;
    margin-left: 0.5em;
    flex-shrink: 0;
  }

  .muted {
    opacity: 0.55;
  }
</style>
