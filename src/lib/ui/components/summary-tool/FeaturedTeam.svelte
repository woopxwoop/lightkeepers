<script lang="ts">
  import { isIconCompact } from "#lib/stores/preferences.js";
  import type { BoardTeam } from "#lib/boards/summary-columns.js";
  import type { Tables } from "#lib/types/database.types.js";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";

  let {
    team,
    mapping,
    alt = false,
  }: {
    team: BoardTeam;
    mapping: Map<string, Tables<"characters">>;
    alt?: boolean;
  } = $props();

  let members = $derived(team.members ?? []);
  let lead = $derived(members[0]);
  let supports = $derived(members.slice(1, 4));
</script>

<div class="featured-team" class:featured-team-alt={alt}>
  <div
    class="featured-slot featured-lead"
    class:featured-slot-compact={$isIconCompact}
  >
    <div class="featured-slot-art">
      {#if lead}
        <CharacterIcon character={mapping.get(lead)} />
      {/if}
    </div>
  </div>
  <div class="featured-supports">
    {#each supports as member, i (i)}
      <div
        class="featured-slot featured-support"
        class:featured-slot-compact={$isIconCompact}
      >
        <div class="featured-slot-art">
          <CharacterIcon character={mapping.get(member)} />
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .featured-team {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 0.22rem;
    align-items: stretch;
    width: 100%;
    min-width: 0;
  }

  .featured-team-alt {
    opacity: 0.82;
  }

  .featured-supports {
    display: grid;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 0.18rem;
    min-width: 0;
    min-height: 0;
  }

  .featured-slot {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--background-mid);
  }

  .featured-lead {
    aspect-ratio: 3 / 4;
  }

  .featured-lead.featured-slot-compact {
    aspect-ratio: 1;
  }

  .featured-support {
    min-height: 0;
  }

  .featured-support .featured-slot-art {
    filter: brightness(0.55) saturate(0.75);
  }

  .featured-slot-art {
    position: absolute;
    inset: 0;
  }
</style>
