<script lang="ts">
  import Surface from "#lib/ui/components/Surface.svelte";
  import Chip from "#lib/ui/components/Chip.svelte";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "#lib/definitions.js";
  import { weaponTypeLabel } from "#lib/utils.js";

  let {
    detailDemoChar,
    detailAccent,
    detailNamecard,
  }: {
    detailDemoChar: CharacterOwned | undefined;
    detailAccent: string;
    detailNamecard: string;
  } = $props();

  let detailTitle = $derived(
    detailDemoChar?.name === "Raiden Shogun"
      ? "Plane of Euthymia"
      : "Character dossier",
  );
  let detailRegion = $derived(
    detailDemoChar?.name === "Raiden Shogun" ? "Inazuma" : "Teyvat",
  );
  let detailConcept = $state<"dossier" | "nameplate" | "compact">("dossier");

  const DETAIL_CONCEPTS = [
    {
      value: "dossier" as const,
      label: "Dossier",
      note: "Portrait anchors the identity; facts become a readable ledger.",
    },
    {
      value: "nameplate" as const,
      label: "Nameplate",
      note: "Art stays atmospheric while identity gets a quiet solid strip.",
    },
    {
      value: "compact" as const,
      label: "Compact",
      note: "A dense utility header that brings the build content forward.",
    },
  ];
</script>

<section class="gallery-section detail-concepts" id="character-detail">
  <div class="section-head detail-concept-head">
    <div>
      <p class="concept-kicker">Route study · /characters/[slug]</p>
      <h2>Character detail concepts</h2>
      <p>
        Three ways to separate the portrait from the identity copy while leaving
        the existing tab content and information density intact.
      </p>
    </div>
    <div
      class="concept-picker"
      role="group"
      aria-label="Character detail concept"
    >
      {#each DETAIL_CONCEPTS as concept}
        <Chip
          active={detailConcept === concept.value}
          onclick={() => (detailConcept = concept.value)}
        >
          {concept.label}
        </Chip>
      {/each}
    </div>
  </div>

  <p class="concept-note">
    {DETAIL_CONCEPTS.find((concept) => concept.value === detailConcept)?.note}
  </p>

  {#if detailDemoChar}
    <div class="detail-prototype" style="--detail-accent: {detailAccent};">
      {#if detailConcept === "dossier"}
        <header class="detail-hero detail-hero-dossier">
          <div
            class="detail-atmosphere"
            style="background-image: {detailNamecard};"
          ></div>
          <div class="detail-hero-scrim"></div>
          <a class="detail-back" href="#character-detail">← All characters</a>

          <div class="dossier-layout">
            <div class="dossier-portrait">
              <CharacterIcon
                character={detailDemoChar}
                iconStyle="tcg"
                loading="eager"
              />
            </div>

            <div class="dossier-identity">
              <p class="detail-eyebrow">{detailTitle}</p>
              <h3>{detailDemoChar.name}</h3>
              <div class="detail-meta-line">
                <span>{detailDemoChar.element}</span>
                <span aria-hidden="true">·</span>
                <span>{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</span>
                <span aria-hidden="true">·</span>
                <span>{detailDemoChar.rarity}★</span>
                <span aria-hidden="true">·</span>
                <span>{detailRegion}</span>
              </div>
            </div>
          </div>
        </header>
      {:else if detailConcept === "nameplate"}
        <header class="detail-hero detail-hero-nameplate">
          <div
            class="detail-atmosphere"
            style="background-image: {detailNamecard};"
          ></div>
          <div class="detail-hero-scrim"></div>
          <a class="detail-back" href="#character-detail">← All characters</a>
          <div class="nameplate-portrait">
            <CharacterIcon
              character={detailDemoChar}
              iconStyle="tcg"
              loading="eager"
            />
          </div>
          <div class="nameplate-bar">
            <div>
              <p class="detail-eyebrow">{detailTitle}</p>
              <h3>{detailDemoChar.name}</h3>
            </div>
            <div class="nameplate-meta">
              <span>{detailDemoChar.element}</span>
              <span>{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</span>
              <span>{detailDemoChar.rarity}★</span>
              <span>{detailRegion}</span>
            </div>
          </div>
        </header>
      {:else}
        <header class="detail-hero detail-hero-compact">
          <div class="compact-portrait">
            <CharacterIcon
              character={detailDemoChar}
              iconStyle="enka"
              loading="eager"
            />
          </div>
          <div class="compact-identity">
            <a class="detail-back" href="#character-detail">← All characters</a>
            <p class="detail-eyebrow">{detailTitle}</p>
            <h3>{detailDemoChar.name}</h3>
          </div>
          <dl class="compact-facts">
            <div>
              <dt>Element</dt>
              <dd>{detailDemoChar.element}</dd>
            </div>
            <div>
              <dt>Weapon</dt>
              <dd>{weaponTypeLabel(detailDemoChar.weapon_type ?? "")}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>{detailRegion}</dd>
            </div>
          </dl>
        </header>
      {/if}
    </div>
  {:else}
    <Surface variant="empty">
      <p class="token-meta">
        Character data has not loaded yet. The concept will appear once the
        roster store is ready.
      </p>
    </Surface>
  {/if}
</section>

<style>
  /* ── Character detail route study ────────────────────────────────── */
  .detail-concepts {
    gap: var(--space-3);
  }

  .detail-concept-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .concept-kicker,
  .detail-eyebrow {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .concept-kicker {
    margin-bottom: 0.25rem;
    color: var(--accent-1) !important;
  }

  .concept-picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .concept-note {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .detail-prototype {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
  }

  .detail-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 18rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--detail-accent) 42%, transparent);
  }

  .detail-atmosphere,
  .detail-hero-scrim {
    position: absolute;
    inset: 0;
    z-index: -2;
  }

  .detail-atmosphere {
    background-position: center;
    background-size: cover;
    opacity: 0.55;
    filter: saturate(0.85);
    transform: scale(1.02);
  }

  .detail-hero-scrim {
    z-index: -1;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--background-color) 94%, transparent) 0%,
        color-mix(in srgb, var(--background-color) 62%, transparent) 54%,
        color-mix(in srgb, var(--background-color) 80%, transparent) 100%
      ),
      linear-gradient(
        0deg,
        color-mix(in srgb, var(--background-mid) 92%, transparent),
        transparent 65%
      );
  }

  .detail-back {
    width: fit-content;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    font-weight: 500;
    text-decoration: none;
  }

  .detail-back:hover {
    color: var(--foreground-color);
  }

  .detail-hero-dossier {
    min-height: 26rem;
    padding: var(--space-5);
  }

  .detail-hero-dossier > .detail-back {
    position: relative;
    z-index: 2;
  }

  .dossier-layout {
    display: grid;
    grid-template-columns: minmax(11rem, 15rem) minmax(12rem, 32rem);
    gap: clamp(1.25rem, 4vw, 3.5rem);
    align-items: end;
    min-height: 20.5rem;
    padding-top: var(--space-4);
  }

  .dossier-portrait {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 34%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-color);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.42);
  }

  .dossier-portrait :global(.icon-root) {
    min-height: 20rem;
  }

  .dossier-identity {
    align-self: center;
    padding-bottom: 0.5rem;
  }

  .detail-eyebrow {
    margin-bottom: 0.45rem;
    color: var(--detail-accent);
  }

  .dossier-identity h3,
  .nameplate-bar h3,
  .compact-identity h3 {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 4vw, 2.8rem);
    font-weight: 600;
    line-height: 1.02;
    color: var(--foreground-color);
  }

  .dossier-identity h3 {
    max-width: 10ch;
    font-size: clamp(2rem, 5vw, 3.6rem);
  }

  .detail-meta-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.65rem;
    margin-top: var(--space-3);
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .detail-meta-line span:nth-child(even) {
    color: color-mix(in srgb, var(--detail-accent) 65%, transparent);
  }

  .compact-facts div {
    padding: 0.75rem;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
  }

  .compact-facts dt {
    margin-bottom: 0.3rem;
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .compact-facts dd {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .detail-hero-nameplate {
    min-height: 25rem;
    padding: var(--space-5);
  }

  .detail-hero-nameplate .detail-hero-scrim {
    background: linear-gradient(
      0deg,
      color-mix(in srgb, var(--background-color) 94%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 28%, transparent) 70%
    );
  }

  .nameplate-portrait {
    position: absolute;
    right: clamp(1rem, 7vw, 5rem);
    bottom: 0;
    width: clamp(10rem, 27vw, 16rem);
    opacity: 0.92;
  }

  .nameplate-bar {
    position: absolute;
    right: var(--space-5);
    bottom: var(--space-5);
    left: var(--space-5);
    z-index: 2;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
    padding: var(--space-4);
    border-left: 2px solid var(--detail-accent);
    background: color-mix(in srgb, var(--background-mid) 88%, transparent);
    backdrop-filter: blur(12px);
  }

  .nameplate-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem 1rem;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .detail-hero-compact {
    display: grid;
    grid-template-columns: 7rem minmax(10rem, 1fr) minmax(20rem, auto);
    align-items: center;
    gap: var(--space-4);
    min-height: auto;
    padding: var(--space-4);
    background:
      linear-gradient(
        100deg,
        color-mix(in srgb, var(--detail-accent) 7%, transparent),
        transparent 42%
      ),
      var(--background-mid);
  }

  .compact-portrait {
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--background-color);
  }

  .compact-identity {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .compact-identity .detail-back {
    margin-bottom: 0.55rem;
  }

  .compact-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(7rem, 1fr));
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-left: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
  }

  @media (max-width: 900px) {
    .dossier-layout {
      grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
    }

    .dossier-portrait :global(.icon-root) {
      min-height: 17rem;
    }

    .detail-hero-compact {
      grid-template-columns: 6rem minmax(0, 1fr);
    }

    .compact-facts {
      grid-column: 1 / -1;
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 640px) {
    .detail-concept-head {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-3);
    }

    .concept-picker {
      justify-content: flex-start;
    }

    .detail-hero-dossier {
      min-height: auto;
      padding: var(--space-4);
    }

    .dossier-layout {
      grid-template-columns: 6.5rem minmax(0, 1fr);
      align-items: center;
      min-height: auto;
      padding-top: var(--space-5);
    }

    .dossier-portrait :global(.icon-root) {
      min-height: 9rem;
    }

    .detail-meta-line {
      gap: 0.3rem 0.45rem;
      margin-top: var(--space-2);
    }

    .dossier-identity h3,
    .nameplate-bar h3,
    .compact-identity h3 {
      font-size: clamp(1.35rem, 7vw, 1.8rem);
    }

    .detail-hero-nameplate {
      min-height: 21rem;
      padding: var(--space-4);
    }

    .nameplate-portrait {
      right: 0;
      width: 12rem;
    }

    .nameplate-bar {
      right: var(--space-4);
      bottom: var(--space-4);
      left: var(--space-4);
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }

    .nameplate-meta {
      justify-content: flex-start;
    }

    .detail-hero-compact {
      grid-template-columns: 4.75rem minmax(0, 1fr);
      padding: var(--space-3);
    }

    .compact-facts {
      grid-template-columns: repeat(3, 1fr);
    }

    .compact-facts div {
      padding: 0.55rem;
    }
  }

  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }
</style>
