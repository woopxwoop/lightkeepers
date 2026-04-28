<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { CharacterOwned, Character } from "$lib/definitions";
  import { displayPreferences } from "$lib/stores";

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

  let useEnkaIcon = $derived($displayPreferences.iconStyle === "enka");
</script>

<div
  class="relative"
  class:icon-container-coop={character?.name_id && !useEnkaIcon}
  class:icon-container-compact={!character?.name_id || useEnkaIcon}
>
  {#if character}
    <img
      src={!useEnkaIcon && character.name_id
        ? makeCoopImg(character.name_id)
        : (character.enka_icon ?? character.icon ?? avatarImg)}
      alt={character.name}
    />
  {/if}
</div>

<style>
  .icon-container-coop img {
    transform-origin: 50% 15%;
    object-position: center 30%;
    transform: scale(2);
  }

  .icon-container-coop {
    aspect-ratio: 3/4;
  }

  .icon-container-compact {
    width: 100%;
    aspect-ratio: 1;
  }
</style>
