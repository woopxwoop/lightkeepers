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
  let settled = $state(false);
  let characterKey = $state("");
  let imgEl: HTMLImageElement | undefined = $state();

  // Only reset the fallback and transition guard when the character or icon
  // style actually changes — avoids replaying the TCG→coop fallback cycle
  // when the parent re-renders with the same character (e.g., after Cancel).
  $effect(() => {
    const key = `${character?.name_id ?? ""}:${useTcg}`;
    if (key !== characterKey) {
      characterKey = key;
      tcgFailed = false;
      settled = false;
    }
  });

  // If the image was already cached (complete before onload attached),
  // settle immediately so the transition guard doesn't persist forever.
  $effect(() => {
    characterKey;
    if (imgEl?.complete && imgEl.naturalWidth > 0 && !settled) {
      onImgSettled();
    }
  });

  function onImgSettled() {
    requestAnimationFrame(() => {
      settled = true;
    });
  }

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
      bind:this={imgEl}
      src={imgSrc}
      alt={character.name ?? "Character"}
      style={settled ? "" : "transition: none"}
      onerror={() => {
        if (useTcg && !tcgFailed) {
          tcgFailed = true;
          // Don't settle yet — the coop fallback image hasn't loaded.
          // Let the new image's own onload/onerror settle the component
          // so the transition: none guard stays active during the swap.
          return;
        }
        onImgSettled();
      }}
      onload={onImgSettled}
    />
  {/if}
</div>

<style>
  /* ── Coop portrait & TCG card (shared 3:4 container) ──────────── */

  .icon-container-coop,
  .icon-container-tcg {
    width: 100%;
    aspect-ratio: 3/4;
    overflow: hidden;
  }

  .icon-container-coop img {
    transform-origin: 50% 15%;
    object-position: center 30%;
    transform: scale(calc(2 * var(--czoom)));
  }

  /* ── TCG card (less zoom) ────────────────────────────────────── */

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
