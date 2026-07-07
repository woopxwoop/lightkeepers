<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import type { CharacterOwned, Character } from "$lib/definitions";
  import { displayPreferences } from "$lib/stores";
  import {
    getCharacterPortrait,
    getCharacterCoop,
    getCharacterCard,
  } from "$lib/utils";

  let {
    character,
    zoom = 1,
  }: {
    character: CharacterOwned | Character | undefined;
    zoom?: number;
  } = $props();

  $effect(() => {
    if (!character)
      console.error("invalid character passed in as prop to CharacterIcon");
  });

  let useEnkaIcon = $derived($displayPreferences.iconStyle === "enka");
  let useTcg = $derived($displayPreferences.iconStyle === "tcg");

  // When the TCG card image 404s, we fall back to the coop portrait.  But the
  // coop image needs the coop container styling (higher zoom, different origin)
  // — so we track whether the fallback fired and swap the container class.
  let tcgFailed = $state(false);

  // Reset the fallback flag whenever the character or icon style changes.
  $effect(() => {
    void (character?.name_id, useTcg);
    tcgFailed = false;
  });

  let imgSrc = $derived(
    character?.name_id
      ? useEnkaIcon
        ? getCharacterPortrait(character.name_id)
        : useTcg && !tcgFailed
          ? getCharacterCard(character.name_id)
          : getCharacterCoop(character.name_id)
      : avatarImg,
  );

  /** Whether the coop container styling should be used (including TCG fallback). */
  let useCoopContainer = $derived(
    character?.name_id && !useEnkaIcon && (!useTcg || tcgFailed),
  );
</script>

<div
  class="relative"
  class:icon-container-tcg={character?.name_id && useTcg && !tcgFailed}
  class:icon-container-coop={useCoopContainer}
  class:icon-container-compact={!character?.name_id || useEnkaIcon}
  style:--czoom={zoom}
>
  {#if character}
    <img
      src={imgSrc}
      alt={character.name ?? "Character"}
      onerror={() => {
        if (useTcg && !tcgFailed) tcgFailed = true;
      }}
    />
  {/if}
</div>

<style>
  /* ── Coop portrait (default) ──────────────────────────────────── */

  .icon-container-coop {
    width: 100%;
    aspect-ratio: 3/4;
    overflow: hidden;
  }

  .icon-container-coop img {
    transform-origin: 50% 15%;
    object-position: center 30%;
    transform: scale(calc(2 * var(--czoom)));
  }

  /* ── TCG card (same 3:4 aspect, less zoom) ───────────────────── */

  .icon-container-tcg {
    width: 100%;
    aspect-ratio: 3/4;
    overflow: hidden;
  }

  .icon-container-tcg img {
    object-position: center 30%;
    transform-origin: 50% 15%;
    transform: scale(calc(1.2 * var(--czoom)));
  }

  /* ── Enka headshot (square) ──────────────────────────────────── */

  .icon-container-compact {
    width: 100%;
    aspect-ratio: 1;
  }
</style>
