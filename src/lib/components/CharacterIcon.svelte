<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { CharacterOwned, Character } from "$lib/definitions";
  import { isIconCompact } from "$lib/stores";

  let { character }: { character: CharacterOwned | Character | undefined } =
    $props();

  $effect(() => {
    if (!character)
      console.error("invalid character passed in as prop to CharacterIcon");
  });

  function makeCoopImg(name_id: string | null) {
    if (name_id)
      return `https://api.lunaris.moe/data/assets/coopimg/UI_CoopImg_${name_id}.webp`;
    return null;
  }
</script>

<div
  class="relative {character?.name_id && !isIconCompact
    ? `icon-container-coop`
    : `icon-container-compact`}"
>
  {#if character}
    <img
      src={!isIconCompact && character.name_id
        ? makeCoopImg(character.name_id)
        : (character.icon ?? avatarImg)}
      alt={character.name}
    />
  {/if}
</div>

<style>
  .icon-container-coop img {
    transform-origin: 50% 15%;
    object-position: center 30%;
    transform: scale(1.8);
  }

  .icon-container-coop {
    aspect-ratio: 3/4;
  }

  .icon-container-compact {
    height: 100%;
    width: 100%;
  }
</style>
