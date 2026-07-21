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
    iconStyle = "preference",
  }: {
    character: CharacterOwned | Character | undefined;
    zoom?: number;
    iconStyle?: "preference" | "enka" | "coop" | "tcg";
  } = $props();

  $effect(() => {
    if (!character)
      console.error("invalid character passed in as prop to CharacterIcon");
  });

  let resolvedIconStyle = $derived(
    iconStyle === "preference" ? $displayPreferences.iconStyle : iconStyle,
  );
  let useEnkaIcon = $derived(resolvedIconStyle === "enka");
  let useTcg = $derived(resolvedIconStyle === "tcg");

  // When the TCG card image 404s, we fall back to the coop portrait.  But the
  // coop image needs the coop container styling (higher zoom, different origin)
  // — so we track whether the fallback fired and swap the container class.
  let tcgFailed = $state(false);
  let assetFailed = $state(false);
  let settled = $state(false);
  let characterKey = $state("");
  let imgEl: HTMLImageElement | undefined = $state();

  // Only reset the fallback and transition guard when the character or icon
  // style actually changes — avoids replaying the TCG→coop fallback cycle
  // when the parent re-renders with the same character (e.g., after Cancel).
  $effect(() => {
    const key = `${character?.name_id ?? ""}:${resolvedIconStyle}`;
    if (key !== characterKey) {
      characterKey = key;
      tcgFailed = false;
      assetFailed = false;
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
    assetFailed || !character?.name_id
      ? avatarImg
      : useEnkaIcon
        ? getCharacterPortrait(character.name_id)
        : useTcg && !tcgFailed
          ? getCharacterCard(character.name_id)
          : getCharacterCoop(character.name_id),
  );

  /** Whether the coop container styling should be used (including TCG fallback). */
  let useCoopContainer = $derived(!useEnkaIcon && (!useTcg || tcgFailed));
</script>

<div
  class="relative icon-root"
  class:icon-container-tcg={useTcg && !tcgFailed}
  class:icon-container-coop={useCoopContainer}
  class:icon-container-compact={useEnkaIcon}
  style:--czoom={zoom}
>
  <img
    bind:this={imgEl}
    src={imgSrc}
    alt={character?.name ?? "Character"}
    style={settled ? "" : "transition: none"}
    onerror={() => {
      if (useTcg && !tcgFailed) {
        tcgFailed = true;
        // Don't settle yet — the coop fallback image hasn't loaded.
        // Let the new image's own onload/onerror settle the component
        // so the transition: none guard stays active during the swap.
        return;
      }
      // Final fallback — keep the reserved frame even if the asset is missing.
      if (!assetFailed) {
        assetFailed = true;
        return;
      }
      onImgSettled();
    }}
    onload={onImgSettled}
  />
</div>

<style>
  /* Frame height comes from aspect-ratio; the image renders in normal flow
     at its natural scale (no object-fit) so crops/zoom match the original
     transform-based styling. */
  .icon-root {
    width: 100%;
    overflow: hidden;
  }

  .icon-root img {
    display: block;
    width: 100%;
  }

  /* ── Coop portrait & TCG card (shared 3:4 container) ──────────── */

  .icon-container-coop,
  .icon-container-tcg {
    aspect-ratio: 3 / 4;
  }

  .icon-container-coop img {
    transform-origin: 50% 15%;
    object-position: center 30%;
    transform: scale(calc(2 * var(--czoom)));
  }

  /* ── TCG card (less zoom) ────────────────────────────────────── */

  .icon-container-tcg img {
    /* Top-anchored: the card's own top edge stays at the frame top, so
       heads keep their headroom without a black gap above the art. */
    transform-origin: 50% 0%;
    transform: scale(calc(1.2 * var(--czoom)));
  }

  /* ── Enka headshot (square) ──────────────────────────────────── */

  .icon-container-compact {
    aspect-ratio: 1;
  }
</style>
