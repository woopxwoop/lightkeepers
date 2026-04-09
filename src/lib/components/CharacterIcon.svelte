<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { CharacterOwned, Character } from "$lib/definitions";

  let { character }: { character: CharacterOwned | Character | undefined } =
    $props();

  $effect(() => {
    if (!character)
      console.error("invalid character passed in as prop to CharacterIcon");
  });
</script>

<div class="relative w-full h-full">
  {#if character}
    <img
      src={character.enka_icon ?? character.icon ?? avatarImg}
      alt={character.name}
      class="w-full h-full object-cover object-top"
    />
    {#if character.rarity !== null}
      <div
        class="absolute bottom-0 left-0 right-0 h-0.75"
        style="background: {character.rarity === 5
          ? 'var(--secondary-color)'
          : 'var(--quaternary-color)'};"
      ></div>
    {/if}
  {/if}
</div>
