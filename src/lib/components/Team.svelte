<script lang="ts">
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  import { charactersOwned } from "$lib/stores";

  let {
    team,
    mapping,
  }: {
    team: AbyssTeam | StygianTeam;
    mapping: Map<string, string>;
  } = $props();

  let rarityMapping = $derived(
    new Map($charactersOwned.map((c) => [c.name, c.rarity ?? 4])),
  );
</script>

<div class="grid grid-cols-4 gap-0.75">
  {#each team.members as member}
    <div
      class="relative rounded-lg overflow-hidden bg-(--surface-color)"
      style="aspect-ratio: 3/4;"
    >
      <CharacterIcon
        name={member}
        icon={mapping.get(member) ?? avatarImg}
        rarity={rarityMapping.get(member) ?? null}
      />
    </div>
  {/each}
</div>
