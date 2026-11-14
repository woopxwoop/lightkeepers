<script lang="ts">
  /**
   * Enka.Network character-card layout, fed by roster + GOOD inventory.
   * Positions / section chrome mirror Enka’s Card host.
   * Optional edit mode: constellation unlock + talent levels (weapon/artifacts later).
   */
  import { getCharacterCoop, getCharacterGachaSplash } from "#lib/utils.js";
  import avatarImg from "#lib/assets/default-avatar.jpg";
  import shadeImg from "#lib/assets/enka-shade.svg";
  import EnkaOverlay from "#lib/ui/components/EnkaOverlay.svelte";
  import CharacterHeading from "#lib/ui/components/roster-build-card/CharacterHeading.svelte";
  import Constellations from "#lib/ui/components/roster-build-card/Constellations.svelte";
  import Talents from "#lib/ui/components/roster-build-card/Talents.svelte";
  import WeaponPanel from "#lib/ui/components/roster-build-card/WeaponPanel.svelte";
  import StatsTable from "#lib/ui/components/roster-build-card/StatsTable.svelte";
  import ArtifactPiece from "#lib/ui/components/roster-build-card/ArtifactPiece.svelte";
  import "#lib/ui/enka-fonts.css";
  import type { InvestmentBuildKitIcons } from "#lib/investment/investment-build-card.js";
  import {
    getCharacterKitIconsCached,
    loadCharacterKitIcons,
  } from "#lib/app/character-kit-icons.js";
  import {
    INVENTORY_ARTIFACT_SLOTS,
    type RosterBuildView,
  } from "#lib/roster/roster-build-card.js";
  import {
    enkaElementAccent,
    enkaElementClass,
  } from "#lib/roster/roster-build-card-element.js";
  import type { RosterProgress } from "#lib/definitions.js";
  import {
    DEFAULT_ROSTER_PROGRESS,
    cloneRosterProgress,
  } from "#lib/roster/roster-progress.js";

  let {
    view,
    editing = false,
    onProgressChange,
    showConstellations = true,
    showTalents = true,
    showWeapon = true,
    showSets = true,
    showArtifacts = true,
    showSubstats = true,
    showStats = true,
    class: className = "",
  }: {
    view: RosterBuildView;
    /**
     * Edit mode:
     * - `false` — read-only (default)
     * - `true` — cog toggles edit (desktop gallery)
     * - `"always"` — Settings: editing on, no cog; one-tap cons / talent steppers
     */
    editing?: boolean | "always";
    onProgressChange?: (next: RosterProgress) => void;
    showConstellations?: boolean;
    showTalents?: boolean;
    showWeapon?: boolean;
    showSets?: boolean;
    showArtifacts?: boolean;
    showSubstats?: boolean;
    showStats?: boolean;
    class?: string;
  } = $props();

  let editToggle = $state(false);
  let progressDraft = $state<RosterProgress | null>(null);
  /** Constellation index under pointer — desktop hover preview only. */
  let consHoverIndex = $state<number | null>(null);

  let editMode = $derived(
    editing === "always" || (editing === true && editToggle),
  );
  let showEditToggle = $derived(editing === true);

  $effect(() => {
    void view.character.name_id;
    progressDraft = null;
    editToggle = false;
    consHoverIndex = null;
  });

  $effect(() => {
    if (!editMode || editing === "always") {
      if (!editMode) consHoverIndex = null;
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        editToggle = false;
        consHoverIndex = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let progress = $derived(
    progressDraft ?? view.progress ?? DEFAULT_ROSTER_PROGRESS,
  );

  function commitProgress(next: RosterProgress) {
    progressDraft = next;
    onProgressChange?.(next);
  }

  function toggleEditMode() {
    if (editing !== true) return;
    if (!editToggle) {
      progressDraft =
        cloneRosterProgress(progress) ??
        cloneRosterProgress(DEFAULT_ROSTER_PROGRESS)!;
    }
    editToggle = !editToggle;
    if (!editToggle) consHoverIndex = null;
  }

  let elementClass = $derived(enkaElementClass(view.character.element));
  let accentColor = $state(enkaElementAccent("Fire"));
  $effect(() => {
    accentColor = enkaElementAccent(elementClass);
  });

  function onOverlayAccent(next: string) {
    accentColor = next;
  }

  /** Kit from prop, or same-origin proxy (CDN kits have no browser CORS). */
  let fetchedKit = $state<InvestmentBuildKitIcons | null>(null);
  $effect(() => {
    const id = view.character.name_id;
    if (!id || view.kit) {
      fetchedKit = null;
      return;
    }
    let cancelled = false;
    fetchedKit = getCharacterKitIconsCached(id);
    void loadCharacterKitIcons(id)
      .then((icons) => {
        if (!cancelled) fetchedKit = icons;
      })
      .catch(() => {
        if (!cancelled) fetchedKit = null;
      });
    return () => {
      cancelled = true;
    };
  });
  let kit = $derived(view.kit ?? fetchedKit);

  let artStage = $state<"gacha" | "coop" | "fallback">("gacha");
  $effect(() => {
    void view.character.name_id;
    artStage = "gacha";
  });

  let artSrc = $derived.by(() => {
    const id = view.character.name_id;
    if (!id || artStage === "fallback") return avatarImg;
    if (artStage === "coop") return getCharacterCoop(id);
    return getCharacterGachaSplash(id);
  });

  function onArtError() {
    if (artStage === "gacha") artStage = "coop";
    else if (artStage === "coop") artStage = "fallback";
  }

  /** Enka: font-size ≈ cardHeight / 30 (em layout scales with it). */
  let cardEl: HTMLDivElement | undefined = $state();
  let cardFontSize = $state(15);

  $effect(() => {
    const el = cardEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) cardFontSize = h / 30;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  });
  /** Enka randomizes flake orientation; we hash name_id for stable variety. */
</script>

<div class="enka-wrap {className}">
  <div class="card-scroll">
    <div
      class="Card showSubstat"
      class:editing={editMode}
      bind:this={cardEl}
      style="font-size: {cardFontSize}px; --fontSize: {cardFontSize}px; --accentColor: {accentColor};"
    >
      <!-- Same 12×5 spacer Enka uses to lock aspect (~2.4:1). -->
      <img
        class="spacer"
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAFCAQAAADbc8WkAAAAD0lEQVR42mNkwAEY6SABAAH0AAY7BlaIAAAAAElFTkSuQmCC"
        alt=""
      />

      <div class="card-host {elementClass}">
        <EnkaOverlay element={elementClass} onAccent={onOverlayAccent} />

        <div class="DraggableCanvas" aria-hidden="true">
          <img
            src={artSrc}
            alt=""
            class="splash"
            class:splash--coop={artStage === "coop"}
            class:splash--fallback={artStage === "fallback"}
            loading="eager"
            decoding="async"
            onerror={onArtError}
          />
        </div>

        <div class="section left">
          <div class="shades" aria-hidden="true">
            <img src={shadeImg} alt="" />
          </div>

          <CharacterHeading
            name={view.character.name ?? view.character.name_id}
            {progress}
            {editMode}
            {showEditToggle}
            onToggleEdit={toggleEditMode}
            onCommit={commitProgress}
          />

          {#if showConstellations}
            <div class="sep"></div>
            <Constellations
              {kit}
              {progress}
              {editMode}
              {elementClass}
              bind:hoverIndex={consHoverIndex}
              onCommit={commitProgress}
            />
          {/if}

          {#if showTalents}
            <Talents
              {kit}
              {progress}
              {editMode}
              {elementClass}
              onCommit={commitProgress}
            />
          {/if}
        </div>

        <div class="section middle">
          {#if showWeapon}
            <WeaponPanel weapon={view.weapon} />
          {/if}

          <StatsTable {view} {progress} {showStats} {showSets} />
        </div>

        {#if showArtifacts}
          <div class="section right">
            {#each INVENTORY_ARTIFACT_SLOTS as slot (slot)}
              <ArtifactPiece
                {slot}
                piece={view.piecesBySlot[slot]}
                {showSubstats}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* ── Enka Card host (scoped; class names match their structure) ─────── */

  .enka-wrap {
    width: 100%;
    max-width: 1300px;
  }

  .card-scroll {
    overflow: auto;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    width: 100%;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
  }

  .Card {
    position: relative;
    color: #fff;
    user-select: none;
    width: 100%;
    /* Enka locks column math to ems — don’t let the card crush below this. */
    min-width: 65rem;
    overflow: hidden;
    border-radius: 0.5em;
    flex-grow: 1;
    z-index: 2;
    font-family: ShinShin, sans-serif;
    line-height: 1.5;
  }

  .Card .spacer {
    width: 100%;
    display: block;
  }

  .Card :global(*) {
    box-sizing: border-box;
  }

  /* Each roster-build-card child repeats this for its own images. */
  .Card img {
    pointer-events: none;
    display: block;
  }

  .card-host {
    pointer-events: all;
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: 0.5em;
  }

  .card-host.Rock {
    background-color: rgb(187, 159, 75);
  }
  .card-host.Wind {
    background-color: rgb(82, 176, 177);
  }
  .card-host.Ice {
    background-color: rgb(70, 168, 186);
  }
  .card-host.Water {
    background-color: rgb(132, 161, 198);
  }
  .card-host.Electric {
    background-color: rgb(152, 118, 173);
  }
  .card-host.Fire {
    background-color: rgb(117, 25, 7);
  }
  .card-host.Grass {
    background-color: rgb(45, 142, 52);
  }

  /*
   * Enka .DraggableCanvas — 39% host strip. Splash fades on the right via
   * canvas destination-in gradient (right→left); we mirror with CSS mask.
   * Opaque CDN gacha needs an earlier fade than their transparent PNG art.
   */
  .DraggableCanvas {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    font-size: 1em;
    width: 39% !important;
    overflow: hidden;
    z-index: 1;
    -webkit-mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 50%,
      rgba(0, 0, 0, 0.55) 72%,
      transparent 100%
    );
    mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 50%,
      rgba(0, 0, 0, 0.55) 72%,
      transparent 100%
    );
  }

  /* Match Enka canvas: height-locked cover; keep prior crop bias. */
  .splash {
    height: 100%;
    width: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
  }

  .splash--coop {
    object-position: center 18%;
  }

  .splash--fallback {
    opacity: 0.55;
  }

  .section {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
  }

  .section.left {
    left: 0;
    width: 27.4em;
    display: flex;
    flex-direction: column;
    text-shadow:
      0 0.08em 0.1em #000,
      0 0.1em 0.3em rgba(0, 0, 0, 0.4);
    padding: 1.4em;
    pointer-events: none;
  }

  .section.middle {
    right: 23.1em;
    width: 21.5em;
    padding: 1.4em 0.7em 0.7em;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  .section.right {
    right: 0;
    width: 23.1em;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.7em;
    gap: 0.35em;
  }

  .shades {
    pointer-events: none;
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .shades img {
    height: 100%;
    width: auto;
    line-height: 0;
    opacity: 0.4;
  }

  /* Enka: flex-grow spacer pushes Consts toward the bottom of the left column.
   * Only this row shrinks — Consts must keep their natural overlapping height. */
  .sep {
    flex: 1 1 0;
    min-height: 0;
  }
</style>
