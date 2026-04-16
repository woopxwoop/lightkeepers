<script lang="ts">
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  import type { Tables } from "$lib/types/database.types";

  type Character = Tables<"characters">;
  type SlotSubstitute = {
    character: string;
    score: number;
  };

  let {
    team,
    mapping,
    missingCharacters = [],
    substitutesByIndex = [],
  }: {
    team: AbyssTeam | StygianTeam;
    mapping: Map<string, Character>;
    missingCharacters?: string[];
    substitutesByIndex?: SlotSubstitute[][];
  } = $props();

  let missingSet = $derived(new Set(missingCharacters));
</script>

<div class="grid grid-cols-4 gap-0.75">
  {#each team.members as member, i}
    {@const isMissing = missingSet.has(member)}
    {@const substitutes = substitutesByIndex[i] ?? []}
    <div
      class="group relative rounded-lg overflow-hidden bg-(--surface-color)"
      style="aspect-ratio: 3/4;
             {isMissing
        ? 'opacity: 0.6; outline: 1.5px dashed color-mix(in srgb, var(--secondary-color) 55%, transparent); outline-offset: -1.5px;'
        : ''}"
    >
      <CharacterIcon character={mapping.get(member)} />
      {#if isMissing}
        <div
          class="absolute bottom-0 left-0 right-0 flex items-center justify-center"
          style="background: color-mix(in srgb, var(--background-color) 75%, transparent);
                 padding: 2px 0;"
        >
          <span
            style="font-size: 8px; font-weight: 600; letter-spacing: 0.06em;
                   color: var(--secondary-color); text-transform: uppercase;"
            >need</span
          >
        </div>
      {/if}
      {#if substitutes.length > 0}
        <div
          class="hidden group-hover:flex absolute z-20 left-1/2 -translate-x-1/2 bottom-[calc(100%+5px)] w-40 max-h-32 overflow-auto rounded-md p-2 flex-col gap-1 text-[10px]"
          style="background: color-mix(in srgb, var(--background-color) 95%, transparent);
                 border: 0.5px solid var(--surface-border);"
        >
          <p class="text-(--faint-color)">slot substitutes</p>
          {#each substitutes as substitute}
            <p class="flex items-center justify-between gap-2">
              <span class="truncate">{substitute.character}</span>
              <span class="text-(--faint-color)">{substitute.score.toFixed(1)}</span>
            </p>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>
