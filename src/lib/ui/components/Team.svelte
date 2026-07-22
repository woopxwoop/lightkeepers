<script lang="ts">
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import { animationsEnabled, isIconCompact } from "$lib/stores";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  import type { Tables } from "$lib/types/database.types";

  type Character = Tables<"characters">;

  let {
    team,
    mapping,
    missingCharacters = [],
  }: {
    team: AbyssTeam | StygianTeam;
    mapping: Map<string, Character>;
    missingCharacters?: string[];
  } = $props();

  let missingSet = $derived(new Set(missingCharacters));
</script>

<div class="team-grid" style="perspective: 600px;">
  {#each team.members as member, idx}
    {@const isMissing = missingSet.has(member)}
    <div
      class="team-slot"
      class:team-slot-compact={$isIconCompact}
      style={$animationsEnabled
        ? `animation: flip-in 0.35s ease-out both; animation-delay: ${idx * 60}ms;`
        : undefined}
    >
      <div class="team-slot-art" class:team-slot-dimmed={isMissing}>
        <CharacterIcon character={mapping.get(member)} />
      </div>
      {#if isMissing}
        <div class="team-slot-missing">
          <span>missing</span>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .team-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.1875rem;
    align-items: start;
  }

  .team-slot {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--background-mid);
    /* Hard frame — image assets cannot change this box. */
    aspect-ratio: 3 / 4;
  }

  .team-slot-compact {
    aspect-ratio: 1;
  }

  .team-slot-art {
    position: absolute;
    inset: 0;
  }

  .team-slot-dimmed {
    opacity: 0.3;
  }

  .team-slot-missing {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 0;
    background: color-mix(in srgb, var(--background-color) 75%, transparent);
  }

  .team-slot-missing span {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--accent-1);
    text-transform: uppercase;
  }
</style>
