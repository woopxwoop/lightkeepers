<script lang="ts">
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import { animationsEnabled } from "$lib/stores";
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

<div class="grid grid-cols-4 gap-0.75" style="perspective: 600px;">
  {#each team.members as member, idx}
    {@const isMissing = missingSet.has(member)}
    <div
      class="relative rounded-lg overflow-hidden"
      style="background: var(--background-mid);
             {$animationsEnabled
        ? `animation: flip-in 0.35s ease-out both; animation-delay: ${idx * 60}ms;`
        : ''}"
    >
      <div style="{isMissing ? 'opacity: 0.3;' : ''}">
        <CharacterIcon character={mapping.get(member)} />
      </div>
      {#if isMissing}
        <div
          class="absolute bottom-0 left-0 right-0 flex items-center justify-center"
          style="background: color-mix(in srgb, var(--background-color) 75%, transparent);
                 padding: 2px 0;"
        >
          <span
            style="font-size: 8px; font-weight: 600; letter-spacing: 0.06em;
                   color: var(--accent-1); text-transform: uppercase;"
          >missing</span>
        </div>
      {/if}
    </div>
  {/each}
</div>
