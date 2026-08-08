<script lang="ts">
  import { getCharacterGachaIcon, getCharacterCoop } from "$lib/utils";

  let {
    nameId = "",
    name = "",
    rarity = 5,
    dimmed = false,
    highlight = false,
    empty = false,
    loading = "lazy",
    /** When set, slot is a button instead of a character link. */
    onclick,
    /** Hover cue; defaults to “View details” for links. */
    cue,
    /** When false, render a non-interactive slot (e.g. inside another button). */
    link = true,
  }: {
    nameId?: string;
    name?: string;
    rarity?: number | null;
    /** Unowned — darkened until hover / focus. */
    dimmed?: boolean;
    /** Subject of the slot group — keeps the rim and glow lit at rest. */
    highlight?: boolean;
    /** Masked, non-interactive placeholder for an unrevealed team member. */
    empty?: boolean;
    loading?: "lazy" | "eager";
    onclick?: (e: MouseEvent) => void;
    cue?: string;
    link?: boolean;
  } = $props();

  let artFailed = $state(false);
  let tone = $derived(rarity != null && rarity >= 5 ? "gold" : "purple");
  // Traveler is never on a banner — no UI_Gacha_AvatarIcon_*; use coop portrait.
  let usePortrait = $derived(
    artFailed || nameId === "PlayerBoy" || nameId === "PlayerGirl",
  );
  let artSrc = $derived(
    usePortrait ? getCharacterCoop(nameId) : getCharacterGachaIcon(nameId),
  );
  let href = $derived(`/characters/${encodeURIComponent(nameId)}`);
  let cueText = $derived(cue ?? (onclick ? "Expand" : "View details"));
  let tip = $derived(name || nameId);
  let showCue = $derived(Boolean(onclick) || link);
</script>

{#snippet body()}
  <div class="wish-body">
    {#if empty}
      <span class="wish-empty-mark" aria-hidden="true"></span>
    {:else}
      <img
        class="wish-art"
        src={artSrc}
        alt={name || nameId}
        {loading}
        decoding="async"
        onerror={() => {
          if (!artFailed) artFailed = true;
        }}
      />
    {/if}
    {#if dimmed}
      <div class="wish-dim" aria-hidden="true"></div>
    {/if}
    {#if highlight}
      <div class="wish-rim" aria-hidden="true"></div>
    {/if}
    {#if showCue}
      <span class="wish-cue" aria-hidden="true">{cueText}</span>
    {/if}
  </div>
{/snippet}

{#if empty}
  <div
    class="wish wish-static wish-empty"
    title={name || "Unrevealed teammate"}
    role="img"
    aria-label={name || "Unrevealed teammate"}
  >
    {@render body()}
  </div>
{:else if onclick}
  <button
    type="button"
    class="wish"
    class:wish-gold={tone === "gold"}
    class:wish-purple={tone === "purple"}
    class:wish-dimmed={dimmed}
    class:wish-highlight={highlight}
    title={tip}
    {onclick}
  >
    {@render body()}
  </button>
{:else if link}
  <a
    class="wish"
    class:wish-gold={tone === "gold"}
    class:wish-purple={tone === "purple"}
    class:wish-dimmed={dimmed}
    class:wish-highlight={highlight}
    {href}
    title={tip}
  >
    {@render body()}
  </a>
{:else}
  <div
    class="wish wish-static"
    class:wish-gold={tone === "gold"}
    class:wish-purple={tone === "purple"}
    class:wish-dimmed={dimmed}
    class:wish-highlight={highlight}
    title={tip}
  >
    {@render body()}
  </div>
{/if}

<style>
  .wish {
    --wish-glow: 90, 140, 210;
    --wish-glow-size: 0.35rem;
    --wish-glow-alpha: 0.5;
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    aspect-ratio: 5 / 16;
    transform: translateY(0);
    cursor: pointer;
    filter: drop-shadow(
      0 0 var(--wish-glow-size) rgba(var(--wish-glow), var(--wish-glow-alpha))
    );
    transition:
      transform var(--control-duration) var(--control-ease),
      filter var(--control-duration) var(--control-ease);
  }

  .wish-static {
    cursor: inherit;
  }

  .wish-gold {
    --wish-glow: 215, 154, 62;
  }

  .wish-purple {
    --wish-glow: 146, 110, 220;
  }

  .wish-dimmed {
    --wish-glow-size: 0.2rem;
    --wish-glow-alpha: 0.2;
  }

  .wish-highlight {
    --wish-glow-size: 0.55rem;
    --wish-glow-alpha: 0.85;
  }

  .wish-empty {
    --wish-glow: 142, 151, 166;
    --wish-glow-size: 0.18rem;
    --wish-glow-alpha: 0.22;
  }

  /* Clipped to the gacha silhouette by the mask on .wish-body. */
  .wish-rim {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    box-shadow:
      inset 0 0 0 1px rgba(var(--wish-glow), 0.8),
      inset 0 0 1rem rgba(var(--wish-glow), 0.3);
  }

  .wish-dim {
    position: absolute;
    inset: 0;
    background: rgba(2, 6, 11, 0.55);
    pointer-events: none;
    opacity: 1;
    transition: opacity var(--control-duration) var(--control-ease);
  }

  @media (hover: hover) and (pointer: fine) {
    .wish:not(.wish-static):hover {
      transform: translateY(-0.35rem);
      --wish-glow-size: 0.65rem;
      --wish-glow-alpha: 0.78;
      z-index: 1;
    }

    .wish-dimmed:not(.wish-static):hover {
      --wish-glow-size: 0.65rem;
      --wish-glow-alpha: 0.78;
    }

    .wish-dimmed:not(.wish-static):hover .wish-dim {
      opacity: 0;
    }
  }

  .wish:not(.wish-static):focus-visible {
    outline: none;
    transform: translateY(-0.35rem);
    --wish-glow-size: 0.65rem;
    --wish-glow-alpha: 0.78;
    z-index: 1;
  }

  .wish-dimmed:not(.wish-static):focus-visible {
    --wish-glow-size: 0.65rem;
    --wish-glow-alpha: 0.78;
  }

  .wish-dimmed:not(.wish-static):focus-visible .wish-dim {
    opacity: 0;
  }

  .wish-body {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(180deg, #0a1528 0%, #06101c 55%, #040a12 100%);
    /* Same-origin static file — CDN masks need CORS and fail silently otherwise */
    -webkit-mask-image: url(/gacha-slot-mask.png);
    mask-image: url(/gacha-slot-mask.png);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    /* Static PNG is opaque white-on-black (no alpha) */
    -webkit-mask-mode: luminance;
    mask-mode: luminance;
  }

  .wish-art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 12%;
  }

  .wish-empty .wish-body {
    background:
      radial-gradient(
        circle at 50% 42%,
        rgba(232, 225, 207, 0.08),
        transparent 34%
      ),
      linear-gradient(180deg, #111a25 0%, #09111b 58%, #050a10 100%);
  }

  .wish-empty-mark {
    position: absolute;
    top: 43%;
    left: 50%;
    width: 0.62rem;
    aspect-ratio: 1;
    border: 1px solid rgba(232, 225, 207, 0.22);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .wish-empty-mark::after {
    content: "";
    position: absolute;
    inset: 0.16rem;
    background: rgba(232, 225, 207, 0.16);
  }

  .wish-cue {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    text-align: center;
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--control-duration) var(--control-ease);
  }

  @media (hover: hover) and (pointer: fine) {
    .wish:not(.wish-static):hover .wish-cue,
    .wish:not(.wish-static):focus-visible .wish-cue {
      opacity: 1;
    }
  }

  .wish:not(.wish-static):focus-visible .wish-cue {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .wish,
    .wish-dim,
    .wish-cue {
      transition: none;
    }

    .wish:not(.wish-static):hover,
    .wish:not(.wish-static):focus-visible {
      transform: none;
    }
  }
</style>
