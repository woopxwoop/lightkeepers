<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { CharacterOwned, Character } from "$lib/definitions";
  import { displayPreferences } from "$lib/stores";
  import { getCharacterPortrait, getCharacterCoop } from "$lib/utils";

  let { character }: { character: CharacterOwned | Character | undefined } =
    $props();

  $effect(() => {
    if (!character)
      console.error("invalid character passed in as prop to CharacterIcon");
  });

  let useEnkaIcon = $derived($displayPreferences.iconStyle === "enka");
</script>

<div
  class="relative"
  class:icon-container-coop={character?.name_id && !useEnkaIcon}
  class:icon-container-compact={!character?.name_id || useEnkaIcon}
>
  {#if character}
    <img
      src={character.name_id
        ? (useEnkaIcon ? getCharacterPortrait(character.name_id) : getCharacterCoop(character.name_id))
        : avatarImg}
      alt={character.name ?? ""}
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
