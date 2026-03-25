<script lang="ts">
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  import { charactersOwned } from "$lib/stores";

  let {
    team,
    mapping,
    missingCharacters = [],
  }: {
    team: AbyssTeam | StygianTeam;
    mapping: Map<string, string>;
    missingCharacters?: string[];
  } = $props();

  let rarityMapping = $derived(
    new Map($charactersOwned.map((c) => [c.name, c.rarity ?? 4])),
  );

  let missingSet = $derived(new Set(missingCharacters));
</script>

<div class="grid grid-cols-4 gap-0.75">
  {#each team.members as member}
    {@const isMissing = missingSet.has(member)}
    <div
      class="relative rounded-lg overflow-hidden bg-(--surface-color)"
      style="aspect-ratio: 3/4;
             {isMissing
        ? 'opacity: 0.6; outline: 1.5px dashed color-mix(in srgb, var(--secondary-color) 55%, transparent); outline-offset: -1.5px;'
        : ''}"
    >
      <CharacterIcon
        name={member}
        icon={mapping.get(member) ?? avatarImg}
        rarity={rarityMapping.get(member) ?? null}
      />
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
    </div>
  {/each}
</div>
