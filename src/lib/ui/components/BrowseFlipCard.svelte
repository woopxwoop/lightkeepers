<script lang="ts">
  import type { Character, CharacterOwned } from "$lib/definitions";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import { elementBg, elementColor } from "$lib/element-colors";
  import { weaponTypeLabel, isNewCharacter } from "$lib/utils";

  let {
    character,
    href,
    dimmed = false,
  }: {
    character: CharacterOwned | Character;
    href: string;
    dimmed?: boolean;
  } = $props();

  let shine = $derived(elementColor(character?.element, "transparent"));
  let bg = $derived(elementBg(character?.element));
</script>

<a
  {href}
  class="flip-card no-underline"
  style="--shine: {shine}; --card-bg: {bg};"
  title="View details — {character.name ?? character.name_id}"
>
  <span class="flip-inner">
    <span class="face face-front">
      {#if shine !== "transparent"}
        <span
          class="stripe absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style="background: {shine};"
        ></span>
      {/if}
      {#if isNewCharacter(character.released_at)}
        <span class="new-badge absolute top-1.5 right-1.5 z-20">NEW</span>
      {/if}
      <span class="portrait">
        <CharacterIcon {character} />
      </span>
      <span class="overlay absolute bottom-0 left-0 right-0 z-10">
        <span class="meta-name">{character.name}</span>
        <span class="meta-sub">
          {character.rarity}★ · {weaponTypeLabel(character.weapon_type ?? "")}
        </span>
      </span>
      {#if dimmed}
        <span class="dim absolute inset-0 z-[5]"></span>
      {/if}
      <span class="reduced-cue" aria-hidden="true">
        <span class="view-label">View details</span>
      </span>
    </span>

    <span class="face face-back" aria-hidden="true">
      <img
        class="back-art"
        src="https://images.lightkeepers.moe/genshin/ui/UI_Gcg_CardBack_01.webp"
        alt=""
        draggable="false"
      />
      <span class="back-prompt">
        <span class="view-label">View details</span>
      </span>
    </span>
  </span>
</a>

<style>
  .flip-card {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    perspective: 900px;
    cursor: pointer;
    border-radius: var(--radius-md);
  }

  .flip-inner {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.7s var(--control-ease, ease);
  }

  .face {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    background: var(--card-bg);
  }

  .face-front {
    z-index: 1;
  }

  .face-back {
    transform: rotateY(180deg);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: #1a1e2a;
  }

  .back-art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    pointer-events: none;
    user-select: none;
  }

  .back-prompt,
  .reduced-cue {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    color: var(--foreground-color);
  }

  .face-back .back-prompt {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 0.65rem 0.5rem 0.85rem;
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.88) 0%,
      rgba(2, 6, 11, 0.45) 70%,
      transparent 100%
    );
  }

  .stripe {
    height: 2px;
    opacity: 0.7;
  }

  .portrait {
    display: block;
    width: 100%;
    height: 100%;
  }

  .portrait :global(img) {
    display: block;
  }

  .overlay {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    padding: 1.5rem 0.375rem 0.375rem;
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.92) 0%,
      rgba(2, 6, 11, 0.55) 55%,
      transparent 100%
    );
  }

  .meta-name,
  .meta-sub,
  .view-label {
    display: block;
  }

  .meta-name {
    font-size: 0.7rem;
    font-weight: 500;
    line-height: 1.15;
    color: var(--foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-sub {
    font-size: 0.6rem;
    line-height: 1.15;
    color: var(--foreground-mid);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dim {
    background: rgba(2, 6, 11, 0.55);
  }

  .new-badge {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.35rem;
    border-radius: var(--radius-sm);
    background: var(--accent-1);
    color: var(--background-color);
  }

  .view-label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .reduced-cue {
    position: absolute;
    inset: 0;
    z-index: 12;
    justify-content: center;
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  /* Fine pointer + hover: flip on hover / keyboard focus */
  @media (hover: hover) and (pointer: fine) {
    .flip-card:hover .flip-inner,
    .flip-card:focus-visible .flip-inner {
      transform: rotateY(180deg);
    }

    .flip-card:hover,
    .flip-card:focus-visible {
      z-index: 5;
      box-shadow: 0 0 28px 4px color-mix(in srgb, var(--shine) 28%, transparent);
    }
  }

  /* Reduced motion: overlay cue instead of flip */
  @media (prefers-reduced-motion: reduce) {
    .flip-inner {
      transition: none;
    }

    .flip-card:hover .flip-inner,
    .flip-card:focus-visible .flip-inner {
      transform: none;
    }

    .face-back {
      display: none;
    }

    .flip-card:hover .reduced-cue,
    .flip-card:focus-visible .reduced-cue {
      opacity: 1;
    }
  }
</style>
