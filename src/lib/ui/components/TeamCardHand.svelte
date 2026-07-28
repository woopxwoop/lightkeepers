<script lang="ts">
  import type { Character, CharacterOwned } from "$lib/definitions";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import { weaponIconUrl } from "$lib/asset-urls";
  import {
    displayWeaponRefinement,
    formatInvestmentCR,
    weaponByKey,
  } from "$lib/equipment-data";

  type BuildBadge = {
    cons: number;
    weaponRefinement: number;
    weaponKey: string;
  };

  let {
    characters,
    builds = [],
    dimmedKeys = new Set<string>(),
    starredKeys = new Set<string>(),
    spread = "hand",
    stack = "right",
    class: className = "",
  }: {
    /** Exactly four preferred; fewer still fans. */
    characters: Array<CharacterOwned | Character | undefined>;
    /** Optional C/R badges aligned to `characters` by index. */
    builds?: Array<BuildBadge | null | undefined>;
    dimmedKeys?: Set<string>;
    starredKeys?: Set<string>;
    /** `hand` = circular arc fan; `flat` = slight overlap without rotation. */
    spread?: "hand" | "flat";
    /** Which end of the fan sits on top of the stack. */
    stack?: "left" | "right";
    class?: string;
  } = $props();

  // Equal angular steps around a shared circle center below the hand.
  const HAND_ANGLES = [-24, -8, 8, 24] as const;

  function zFor(index: number, total: number): number {
    return stack === "left" ? total - index : index + 1;
  }
</script>

<div
  class="hand hand-{spread} {className}"
  style:--cards={characters.length || 4}
  role="group"
  aria-label="Team"
>
  {#each characters as character, i (character?.name_id ?? character?.name ?? i)}
    {@const key = character?.name_id ?? character?.name ?? ""}
    {@const build = builds[i]}
    {@const angle = HAND_ANGLES[i] ?? 0}
    {@const weapon = build ? weaponByKey.get(build.weaponKey) : null}
    {@const weaponIcon = weapon ? weaponIconUrl(weapon.awakenIcon) : null}
    {@const refine = build
      ? displayWeaponRefinement(build.weaponKey, build.weaponRefinement, {
          weaponShown: Boolean(weaponIcon),
        })
      : null}
    <div
      class="card"
      style:--angle="{angle}deg"
      style:--z={zFor(i, characters.length)}
    >
      <CharacterPortraitCard
        {character}
        tintBackground
        dimmed={key !== "" && dimmedKeys.has(key)}
        href={character?.name_id
          ? `/characters/${character.name_id}`
          : undefined}
      >
        {#snippet badge()}
          {#if weaponIcon}
            <div class="weapon group">
              <img
                src={weaponIcon}
                alt={weapon?.name ?? "Weapon"}
                class="weapon-img"
                loading="lazy"
              />
              {#if refine !== null}
                <span class="weapon-r">R{refine}</span>
              {/if}
              <WeaponTooltip {weapon} refinement={refine} />
            </div>
          {/if}
          {#if key && starredKeys.has(key)}
            <span class="star" aria-label="Best team for this character">★</span>
          {/if}
        {/snippet}
        {#snippet meta()}
          <div class="meta-name">{character?.name ?? "—"}</div>
          {#if build}
            <div class="meta-build">
              {#if weaponIcon}
                C{build.cons}
              {:else}
                {formatInvestmentCR(
                  build.cons,
                  build.weaponRefinement,
                  build.weaponKey,
                )}
              {/if}
            </div>
          {/if}
        {/snippet}
      </CharacterPortraitCard>
    </div>
  {/each}
</div>

<style>
  .hand {
    --card-width: clamp(6.6rem, 22vw, 11.4rem);
    width: 100%;
    isolation: isolate;
  }

  /* ── Circular arc fan ─────────────────────────────────────────────── */
  /* Every card shares one transform-origin (the circle center below the
     hand). Equal angles ⇒ constant radius — no outer cards sticking out. */
  .hand-hand {
    --radius: clamp(16.8rem, 50vw, 26.4rem);
    position: relative;
    /* Portrait height + a little room for the arc rise. */
    min-height: calc(var(--card-width) * 4 / 3 + 1.5rem);
    padding: 0.5rem 0 0;
  }

  .hand-hand .card {
    position: absolute;
    left: 50%;
    bottom: 0;
    z-index: var(--z);
    width: var(--card-width);
    margin-left: calc(var(--card-width) / -2);
    transform-origin: 50% calc(100% + var(--radius));
    transform: rotate(var(--angle));
    border-radius: var(--radius-md);
    /* Static box-shadow — cheaper than filter: drop-shadow while transforming. */
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.45);
    transition: transform 220ms ease;
  }

  .hand-hand .card:hover,
  .hand-hand .card:focus-within {
    z-index: 20;
    will-change: transform;
    transform: rotate(var(--angle)) scale(1.04);
  }

  /* ── Flat overlap (no arc) ────────────────────────────────────────── */
  .hand-flat {
    /* Never wider than 1/n of the row so a full unstack still fits. */
    --flat-width: min(var(--card-width), calc(100% / var(--cards, 4)));
    --overlap: calc(var(--flat-width) * -0.42);
    /* Fit leftover space, but never open wider than the old fixed gap. */
    --spread-gap-max: 0.4rem;
    --spread-gap: min(
      var(--spread-gap-max),
      max(
        0px,
        calc(
          (100% - (var(--cards, 4) * var(--flat-width))) /
            max(1, calc(var(--cards, 4) - 1))
        )
      )
    );
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
    box-sizing: border-box;
    padding: 1.75rem 1.25rem 0.5rem;
    overflow: hidden;
  }

  .hand-flat .card {
    position: relative;
    z-index: var(--z);
    width: var(--flat-width);
    flex-shrink: 0;
    margin-left: var(--overlap);
    border-radius: var(--radius-md);
    transition:
      margin-left 520ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 280ms ease,
      filter 280ms ease;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
  }

  .hand-flat .card:first-child {
    margin-left: 0;
  }

  /* Unstack into whatever gap still fits inside the row. */
  @media (hover: hover) and (pointer: fine) {
    .hand-flat:hover .card,
    .hand-flat:focus-within .card {
      margin-left: var(--spread-gap);
    }

    .hand-flat:hover .card:first-child,
    .hand-flat:focus-within .card:first-child {
      margin-left: 0;
    }
  }

  .hand-flat .card:hover,
  .hand-flat .card:focus-within {
    z-index: 20;
    will-change: transform;
    transform: translateY(-10px) scale(1.03);
  }

  .weapon {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    z-index: 20;
    width: 28%;
    aspect-ratio: 1;
    border-radius: 0.2rem;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    border: var(--border-width) solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  }

  .weapon-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 0.1rem;
  }

  .weapon-r {
    position: absolute;
    right: 0.1rem;
    bottom: 0.05rem;
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1;
    color: var(--accent-1);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  }

  .star {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    z-index: 20;
    font-size: 0.75rem;
    line-height: 1;
    color: var(--accent-1);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
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

  .meta-build {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--accent-2);
  }

  @media (max-width: 640px) {
    .hand {
      --card-width: clamp(5.1rem, 26vw, 7.8rem);
    }

    .hand-hand {
      --radius: clamp(13.2rem, 70vw, 19.2rem);
    }

    .hand-flat {
      --overlap: calc(var(--flat-width) * -0.38);
      padding: 1.25rem 0.5rem 0.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
  }
</style>
