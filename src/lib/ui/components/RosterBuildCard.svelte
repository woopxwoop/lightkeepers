<script lang="ts">
  /**
   * Enka.Network character-card layout, fed by roster + GOOD inventory.
   * Positions / section chrome mirror Enka’s Card host.
   * Optional edit mode: constellation unlock + talent levels (weapon/artifacts later).
   */
  import {
    artifactSlotIconUrl,
    getCharacterCoop,
    getCharacterGachaSplash,
    statIconUrl,
    toGoodKey,
    translateStatKey,
  } from "$lib/utils";
  import { artifactSetByKey, weaponByKey } from "$lib/equipment-data";
  import { useEquipmentData, useWeapon } from "$lib/equipment-data.svelte";
  import {
    artifactIconUrl,
    artifactPieceIconUrl,
    weaponIconUrl,
  } from "$lib/asset-urls";
  import avatarImg from "$lib/assets/default-avatar.jpg";
  import shadeImg from "$lib/assets/enka-shade.svg";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import EnkaOverlay from "$lib/ui/components/EnkaOverlay.svelte";
  import EnkaConstFrame from "$lib/ui/components/EnkaConstFrame.svelte";
  import EnkaTalentFrame from "$lib/ui/components/EnkaTalentFrame.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import "$lib/ui/enka-fonts.css";
  import {
    kitIconsFromCharacterKit,
    type InvestmentBuildKitIcons,
  } from "$lib/investment-build-card";
  import type { CharacterKit } from "$lib/types/character-kit";
  import {
    INVENTORY_ARTIFACT_SLOTS,
    formatGoodStatValue,
    type RosterBuildView,
  } from "$lib/roster-build-card";
  import type {
    InventoryArtifactSlot,
    RosterProgress,
  } from "$lib/definitions";
  import {
    MAX_ASCENSION,
    MAX_LEVEL,
    MAX_TALENT,
    levelCapForAscension,
  } from "$lib/upgrade-costs";
  import {
    ARTIFACT_MAIN_STAT_VALUE,
    WEAPON_PROP_TO_GOOD,
    computeRosterSheetStats,
    formatSheetStat,
  } from "$lib/build-stats";
  import {
    DEFAULT_ROSTER_PROGRESS,
    MAX_CONSTELLATION,
    cloneRosterProgress,
  } from "$lib/roster-progress";
  import { resolve } from "$app/paths";

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

  /** Resulting constellation if the user activates constellation `index`. */
  function constellationAfterActivate(
    current: number,
    index: number,
  ): number {
    const clamped = Math.max(0, Math.min(MAX_CONSTELLATION, index));
    const next = current >= clamped ? clamped - 1 : clamped;
    return Math.max(0, Math.min(MAX_CONSTELLATION, next));
  }

  /** Click Cn: unlock through n, or drop to n−1 if already unlocked. */
  function onConstellationActivate(index: number) {
    if (!editMode) return;
    commitProgress({
      ...progress,
      constellation: constellationAfterActivate(
        progress.constellation,
        index,
      ),
      talents: { ...progress.talents },
      weapon: progress.weapon,
    });
  }

  function bumpTalent(slot: "normal" | "skill" | "burst", delta: number) {
    if (!editMode) return;
    const cur = progress.talents[slot];
    let next = cur + delta;
    if (next > MAX_TALENT) next = 1;
    if (next < 1) next = MAX_TALENT;
    commitProgress({
      ...progress,
      talents: { ...progress.talents, [slot]: next },
      weapon: progress.weapon,
    });
  }

  function bumpConstellation(delta: number) {
    if (!editMode) return;
    commitProgress({
      ...progress,
      constellation: Math.max(
        0,
        Math.min(MAX_CONSTELLATION, progress.constellation + delta),
      ),
      talents: { ...progress.talents },
      weapon: progress.weapon,
    });
  }

  type LevelField = "level" | "cap" | null;
  let levelField = $state<LevelField>(null);
  let levelDraft = $state("");

  $effect(() => {
    if (!editMode) {
      levelField = null;
      levelDraft = "";
    }
  });

  function ascensionForCapInput(raw: number): number {
    const target = Math.round(raw);
    let best = 0;
    let bestDist = Infinity;
    for (let a = 0; a <= MAX_ASCENSION; a++) {
      const cap = levelCapForAscension(a);
      const dist = Math.abs(cap - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = a;
      }
    }
    return best;
  }

  function startLevelField(field: "level" | "cap") {
    if (!editMode) return;
    levelField = field;
    levelDraft =
      field === "level"
        ? String(progress.level)
        : String(levelCapForAscension(progress.ascension));
  }

  function commitLevelField() {
    if (levelField == null) return;
    const raw = Number(levelDraft);
    const field = levelField;
    levelField = null;
    levelDraft = "";
    if (!Number.isFinite(raw)) return;

    if (field === "level") {
      const level = Math.max(1, Math.min(MAX_LEVEL, Math.round(raw)));
      if (level === progress.level) return;
      commitProgress({
        ...progress,
        level,
        talents: { ...progress.talents },
        weapon: progress.weapon,
      });
      return;
    }

    const ascension = ascensionForCapInput(raw);
    if (ascension === progress.ascension) return;
    commitProgress({
      ...progress,
      ascension,
      talents: { ...progress.talents },
      weapon: progress.weapon,
    });
  }

  function onLevelFieldKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      levelField = null;
      levelDraft = "";
    }
  }

  const equipment = useEquipmentData();
  const weaponLookup = useWeapon(() => view.weapon?.key ?? "");

  let weapon = $derived(weaponLookup.weapon);
  let wIcon = $derived(
    weapon ? weaponIconUrl(weapon.awakenIcon) : weaponLookup.icon,
  );

  /** Enka element class names on card-host / Consts / Talents. */
  const ELEMENT_CLASS: Record<string, string> = {
    Pyro: "Fire",
    Hydro: "Water",
    Anemo: "Wind",
    Electro: "Electric",
    Dendro: "Grass",
    Geo: "Rock",
    Cryo: "Ice",
  };

  /** Fallback --accentColor until Overlay samples the texture. */
  const ELEMENT_ACCENT: Record<string, string> = {
    Fire: "linear-gradient(0deg, #68281b 0%, #4f180d 100%)",
    Ice: "linear-gradient(0deg, #154f68 0%, #08394f 100%)",
    Water: "linear-gradient(0deg, #2a4a6e 0%, #1a3048 100%)",
    Wind: "linear-gradient(0deg, #1e5c5c 0%, #0f3d3d 100%)",
    Electric: "linear-gradient(0deg, #4a2a5c 0%, #2e1840 100%)",
    Grass: "linear-gradient(0deg, #1a4a20 0%, #0d2e12 100%)",
    Rock: "linear-gradient(0deg, #6a5828 0%, #3f3414 100%)",
  };

  let elementClass = $derived(
    ELEMENT_CLASS[view.character.element ?? ""] ?? "Fire",
  );
  let accentColor = $state(ELEMENT_ACCENT.Fire);
  $effect(() => {
    accentColor = ELEMENT_ACCENT[elementClass] ?? ELEMENT_ACCENT.Fire;
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
    const ac = new AbortController();
    const url = resolve(`/api/character-kit/${encodeURIComponent(id)}`);
    void fetch(url, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`kit ${res.status}`);
        return (await res.json()) as CharacterKit;
      })
      .then((kitJson) => {
        if (!cancelled) fetchedKit = kitIconsFromCharacterKit(kitJson);
      })
      .catch(() => {
        if (!cancelled) fetchedKit = null;
      });
    return () => {
      cancelled = true;
      ac.abort();
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

  function starCount(stars: number | undefined): number {
    return Math.max(0, Math.min(5, stars ?? 0));
  }

  function setName(setKey: string): string {
    void equipment.version;
    return artifactSetByKey.get(setKey)?.name ?? setKey;
  }

  function setIcon(setKey: string): string | null {
    void equipment.version;
    const row = artifactSetByKey.get(setKey);
    return row ? artifactIconUrl(row.icon) : null;
  }

  function pieceIcon(
    setKey: string,
    slot: InventoryArtifactSlot,
  ): string | null {
    void equipment.version;
    const row = artifactSetByKey.get(setKey);
    return artifactPieceIconUrl(row?.icon, slot);
  }

  function emptySlotIcon(slot: InventoryArtifactSlot): string {
    return artifactSlotIconUrl(slot);
  }

  /** +20 main (GOOD has no stored main value). Flower/plume flats are fixed. */
  function mainStatDisplay(key: string): string {
    if (key === "hp") return "4780";
    if (key === "atk") return "311";
    const v = ARTIFACT_MAIN_STAT_VALUE[key];
    if (v == null) return translateStatKey(key);
    if (key.endsWith("_")) return `${(v * 100).toFixed(1)}%`;
    return String(Math.round(v));
  }

  type TalentRow = {
    slot: "normal" | "skill" | "burst";
    level: number;
    icon: string | null | undefined;
  };

  let talentRows = $derived<TalentRow[]>([
    {
      slot: "normal",
      level: progress.talents.normal,
      icon: kit?.talents.auto,
    },
    {
      slot: "skill",
      level: progress.talents.skill,
      icon: kit?.talents.skill,
    },
    {
      slot: "burst",
      level: progress.talents.burst,
      icon: kit?.talents.burst,
    },
  ]);

  let cons = $derived(progress.constellation);
  let consPreview = $derived(
    editMode && consHoverIndex != null
      ? constellationAfterActivate(cons, consHoverIndex)
      : null,
  );
  let displayCons = $derived(consPreview ?? cons);

  let sheet = $derived.by(() => {
    void equipment.version;
    const characterKey =
      view.locationKey || toGoodKey(view.character.name) || "";
    return computeRosterSheetStats({
      characterKey,
      level: progress.level,
      ascension: progress.ascension,
      weaponKey: view.weapon?.key ?? null,
      pieces: INVENTORY_ARTIFACT_SLOTS.map((slot) => view.piecesBySlot[slot]),
    });
  });

  type StatRow = {
    key: string;
    label: string;
    icon: string;
    value: number | null;
  };

  let statRows = $derived.by((): StatRow[] => {
    const core: StatRow[] = [
      { key: "hp", label: "HP", icon: "hp", value: sheet?.hp ?? null },
      { key: "atk", label: "ATK", icon: "atk", value: sheet?.atk ?? null },
      { key: "def", label: "DEF", icon: "def", value: sheet?.def ?? null },
      {
        key: "eleMas",
        label: "Elemental Mastery",
        icon: "eleMas",
        value: sheet?.eleMas ?? null,
      },
      {
        key: "critRate",
        label: "CRIT Rate",
        icon: "critRate_",
        value: sheet?.critRate ?? null,
      },
      {
        key: "critDMG",
        label: "CRIT DMG",
        icon: "critDMG_",
        value: sheet?.critDMG ?? null,
      },
      {
        key: "enerRech",
        label: "Energy Recharge",
        icon: "enerRech_",
        value: sheet?.enerRech ?? null,
      },
    ];
    if (!sheet) return core;
    const dmg = Object.entries(sheet.dmgBonus)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        key,
        label: translateStatKey(key),
        icon: key,
        value,
      }));
    return [...core, ...dmg];
  });

  let weaponAtk = $derived(
    weapon?.baseAtk != null ? Math.round(weapon.baseAtk) : null,
  );
  let weaponSub = $derived.by(() => {
    const s = weapon?.subStat;
    if (!s) return null;
    const goodKey = WEAPON_PROP_TO_GOOD[s.propType] ?? null;
    return {
      label: s.label,
      text: s.isPercent
        ? `${(s.value * 100).toFixed(1)}%`
        : String(Math.round(s.value)),
      iconKey: goodKey,
    };
  });

  $effect(() => {
    void equipment.version;
    void weaponByKey.size;
  });

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
        <EnkaOverlay
          element={elementClass}
          onAccent={onOverlayAccent}
        />

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

          <div class="name">
            <span class="name-text"
              >{view.character.name ?? view.character.name_id}</span
            >
            {#if showEditToggle}
              <button
                type="button"
                class="name-edit"
                class:active={editMode}
                aria-pressed={editMode}
                aria-label={editMode
                  ? "Done editing build"
                  : "Edit constellations and talents"}
                title={editMode
                  ? "Done"
                  : "Edit constellations & talents"}
                onclick={toggleEditMode}
              >
                <IconCog size={16} />
              </button>
            {/if}
          </div>
          <div class="level" class:level-edit={editMode}>
            Lv.
            {#if editMode && levelField === "level"}
              <input
                class="level-input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="3"
                bind:value={levelDraft}
                onkeydown={onLevelFieldKey}
                onblur={commitLevelField}
                aria-label="Character level"
                autofocus
              />
            {:else if editMode}
              <button
                type="button"
                class="level-num"
                aria-label="Edit level"
                onclick={() => startLevelField("level")}
                >{progress.level}</button
              >
            {:else}
              {progress.level}
            {/if}
            /
            {#if editMode && levelField === "cap"}
              <input
                class="level-input level-input-cap"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="2"
                bind:value={levelDraft}
                onkeydown={onLevelFieldKey}
                onblur={commitLevelField}
                aria-label="Ascension level cap"
                autofocus
              />
            {:else if editMode}
              <button
                type="button"
                class="level-num level-num-cap"
                aria-label="Edit ascension cap"
                title="Ascension {progress.ascension}"
                onclick={() => startLevelField("cap")}
                >{levelCapForAscension(progress.ascension)}</button
              >
            {:else}
              <span>{levelCapForAscension(progress.ascension)}</span>
            {/if}
          </div>

          {#if showConstellations}
            <div class="sep"></div>
            <div
              class="Consts {elementClass}"
              class:editable={editMode}
              aria-label="Constellations C{cons}"
            >
              {#if kit?.constellations?.length}
                {#each kit.constellations as c (c.index)}
                  {@const unlocked = c.index <= displayCons}
                  {@const truthLocked = c.index > cons}
                  {@const wouldChange =
                    consPreview != null &&
                    (c.index <= cons) !== (c.index <= consPreview)}
                  {#if editMode}
                    <button
                      type="button"
                      class="icon"
                      class:locked={!unlocked}
                      class:truth-locked={truthLocked}
                      class:pulse={wouldChange}
                      title="C{c.index}: {c.name}"
                      aria-label="{truthLocked
                        ? 'Unlock'
                        : 'Lock'} constellation {c.index}"
                      aria-pressed={!truthLocked}
                      onpointerenter={() => (consHoverIndex = c.index)}
                      onpointerleave={() => {
                        if (consHoverIndex === c.index) consHoverIndex = null;
                      }}
                      onclick={() => onConstellationActivate(c.index)}
                    >
                      <EnkaConstFrame uid="c{c.index}" />
                      {#if c.icon}
                        <img src={c.icon} alt="" loading="lazy" />
                      {/if}
                    </button>
                  {:else}
                    <div
                      class="icon"
                      class:locked={!unlocked}
                      class:truth-locked={truthLocked}
                      title="C{c.index}: {c.name}"
                    >
                      <EnkaConstFrame uid="c{c.index}" />
                      {#if c.icon}
                        <img src={c.icon} alt="" loading="lazy" />
                      {/if}
                    </div>
                  {/if}
                {/each}
              {:else if editMode}
                <div class="cons-fallback cons-stepper">
                  <button
                    type="button"
                    aria-label="Decrease constellation"
                    onclick={() => bumpConstellation(-1)}>−</button
                  >
                  <span>C{cons}</span>
                  <button
                    type="button"
                    aria-label="Increase constellation"
                    onclick={() => bumpConstellation(1)}>+</button
                  >
                </div>
              {:else}
                <div class="cons-fallback">C{cons}</div>
              {/if}
            </div>
          {/if}

          {#if showTalents}
            <div class="talent-wrap">
              <div
                class="Talents {elementClass}"
                class:editable={editMode}
                aria-label="Talent levels"
              >
                {#each talentRows as row (row.slot)}
                  <div class="icon">
                    <EnkaTalentFrame uid={row.slot} />
                    {#if row.icon}
                      <img src={row.icon} alt="" loading="lazy" />
                    {/if}
                    <div class="level-wrap">
                      {#if editMode}
                        <div class="talent-stepper">
                          <button
                            type="button"
                            class="talent-nudge"
                            aria-label="Decrease {row.slot} talent"
                            onclick={() => bumpTalent(row.slot, -1)}
                            >−</button
                          >
                          <div class="level">{row.level}</div>
                          <button
                            type="button"
                            class="talent-nudge"
                            aria-label="Increase {row.slot} talent"
                            onclick={() => bumpTalent(row.slot, 1)}
                            >+</button
                          >
                        </div>
                      {:else}
                        <div class="level">{row.level}</div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

      <div class="section middle">
        {#if showWeapon}
          <div class="Weapon">
            {#if view.weapon}
              <figure data-rank={starCount(weapon?.stars)}>
                {#if wIcon}
                  <img class="WeaponIcon" src={wIcon} alt="" loading="lazy" />
                {/if}
                <div
                  class="Stars"
                  aria-label="{starCount(weapon?.stars)} stars"
                >
                  {#each Array.from(
                    { length: starCount(weapon?.stars) },
                    (_, i) => i,
                  ) as i (i)}
                    <span>{"\u{E938}"}</span>
                  {/each}
                </div>
              </figure>
              <div class="weapon-caption">
                <div class="title">
                  <span>{weapon?.name ?? view.weapon.key}</span>
                </div>
                <div class="stats">
                  {#if weaponAtk != null}
                    <div class="Substat">
                      {#if statIconUrl("atk")}
                        <img
                          src={statIconUrl("atk")}
                          alt=""
                          class="stat-icon"
                        />
                      {/if}
                      <span>{weaponAtk}</span>
                    </div>
                  {/if}
                  {#if weaponSub}
                    <div class="Substat">
                      {#if weaponSub.iconKey && statIconUrl(weaponSub.iconKey)}
                        <img
                          src={statIconUrl(weaponSub.iconKey)}
                          alt=""
                          class="stat-icon"
                        />
                      {/if}
                      <span>{weaponSub.text}</span>
                    </div>
                  {/if}
                </div>
                <div class="sub">
                  <div class="refine">R{view.weapon.refinement}</div>
                  <div class="wlevel">
                    Lv. {view.weapon.level} /
                    {levelCapForAscension(view.weapon.ascension)}
                  </div>
                </div>
              </div>
              <WeaponTooltip
                weaponKey={view.weapon.key}
                refinement={view.weapon.refinement}
              />
            {:else}
              <p class="empty-note">No weapon equipped</p>
            {/if}
          </div>
        {/if}

        {#if showStats}
          <div class="StatsTable">
            {#each statRows as row (row.key)}
              <div class="row">
                {#if statIconUrl(row.icon)}
                  <img src={statIconUrl(row.icon)} alt="" class="stat-icon" />
                {/if}
                <p>{row.label}</p>
                <div class="mid">
                  <span class="sep"></span>
                  <span class="val"
                    >{row.value == null
                      ? "—"
                      : formatSheetStat(row.key, row.value)}</span
                  >
                </div>
              </div>
            {/each}

            {#if showSets}
              <div class="set">
                {#if view.setCounts[0] && setIcon(view.setCounts[0].setKey)}
                  <i class="set-glyph" aria-hidden="true">
                    <img
                      src={setIcon(view.setCounts[0].setKey)}
                      alt=""
                      loading="lazy"
                    />
                  </i>
                {:else}
                  <i class="set-glyph" aria-hidden="true"></i>
                {/if}
                <div class="sets">
                  {#if view.setCounts.length === 0}
                    <div>
                      <div class="desc muted">No set bonus</div>
                    </div>
                  {:else}
                    {#each view.setCounts as s (s.setKey)}
                      <div class="group">
                        <div class="desc">{setName(s.setKey)}</div>
                        <div class="count">{s.count}</div>
                        <ArtifactTooltip
                          setKey={s.setKey}
                          pieceCount={s.count}
                        />
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {:else if showSets}
          <div class="StatsTable">
            <div class="set">
              {#if view.setCounts[0] && setIcon(view.setCounts[0].setKey)}
                <i class="set-glyph" aria-hidden="true">
                  <img
                    src={setIcon(view.setCounts[0].setKey)}
                    alt=""
                    loading="lazy"
                  />
                </i>
              {:else}
                <i class="set-glyph" aria-hidden="true"></i>
              {/if}
              <div class="sets">
                {#each view.setCounts as s (s.setKey)}
                  <div class="group">
                    <div class="desc">{setName(s.setKey)}</div>
                    <div class="count">{s.count}</div>
                    <ArtifactTooltip setKey={s.setKey} pieceCount={s.count} />
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>

      {#if showArtifacts}
        <div class="section right">
          {#each INVENTORY_ARTIFACT_SLOTS as slot (slot)}
            {@const piece = view.piecesBySlot[slot]}
            {@const icon = piece
              ? pieceIcon(piece.setKey, slot)
              : emptySlotIcon(slot)}
            <div class="Artifact" class:empty={!piece}>
              {#if icon}
                <img class="ArtifactIcon" src={icon} alt="" loading="lazy" />
              {/if}
              {#if piece}
                <div class="mainstat">
                  <div>
                    {#if statIconUrl(piece.mainStatKey)}
                      <img
                        src={statIconUrl(piece.mainStatKey)}
                        alt=""
                        class="stat-icon"
                      />
                    {/if}
                  </div>
                  <div>{mainStatDisplay(piece.mainStatKey)}</div>
                  <div>
                    <span class="Stars" aria-hidden="true">
                      {#each Array.from(
                        { length: starCount(piece.rarity) },
                        (_, i) => i,
                      ) as i (i)}
                        <span>{"\u{E938}"}</span>
                      {/each}
                    </span>
                    <span class="level">+{piece.level}</span>
                  </div>
                </div>
                <hr />
                {#if showSubstats}
                  <div class="substats">
                    {#each [0, 1, 2, 3] as i (i)}
                      {@const sub = piece.substats[i]}
                      <div class="Substat">
                        {#if sub}
                          {#if statIconUrl(sub.key)}
                            <img
                              src={statIconUrl(sub.key)}
                              alt=""
                              class="stat-icon"
                            />
                          {/if}
                          <span
                            >{formatGoodStatValue(sub.key, sub.value)}</span
                          >
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              {:else}
                <div class="mainstat">
                  <div class="muted">{slot}</div>
                </div>
              {/if}
            </div>
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

  .name {
    position: relative;
    z-index: 1;
    padding: 0 0 0.5% 0;
    font-size: 130%;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .name-text {
    min-width: 0;
  }

  .name-edit {
    pointer-events: all;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.15em;
    height: 1.15em;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0.25em;
    background: transparent;
    color: #f4f1e8;
    cursor: pointer;
    opacity: 0.75;
  }

  .name-edit:hover,
  .name-edit:focus-visible {
    opacity: 1;
  }

  .name-edit.active {
    opacity: 1;
  }

  .name-edit :global(svg) {
    width: 0.72em;
    height: 0.72em;
  }

  .level {
    position: relative;
    z-index: 1;
  }

  .level span,
  .level-num-cap {
    opacity: 0.6;
  }

  .level-edit {
    pointer-events: all;
  }

  .level-num {
    margin: 0;
    padding: 0 0.05em;
    border: none;
    border-radius: 0.15em;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: rgba(255, 255, 255, 0.35);
    text-underline-offset: 0.12em;
  }

  .level-num:hover,
  .level-num:focus-visible {
    text-decoration-color: rgba(255, 255, 255, 0.85);
  }

  .level-input {
    width: 2.8em;
    margin: 0 0.1em;
    padding: 0.05em 0.15em;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 0.2em;
    background: rgba(0, 0, 0, 0.45);
    color: #f4f1e8;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
    appearance: textfield;
  }

  .level-input::-webkit-outer-spin-button,
  .level-input::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  .level-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.85);
  }

  /* Enka: flex-grow spacer pushes Consts toward the bottom of the left column.
   * Only this row shrinks — Consts must keep their natural overlapping height. */
  .sep {
    flex: 1 1 0;
    min-height: 0;
  }

  /* ── Constellations (Enka Consts / SvgIcon Const) ─────────────────── */

  .Consts {
    display: flex;
    align-self: flex-start;
    flex-direction: column;
    flex-shrink: 0;
    font-size: 1.12em;
    pointer-events: none;
    position: relative;
    z-index: 2;
  }

  .Consts.Rock {
    color: rgb(255, 198, 74);
  }
  .Consts.Wind {
    color: rgb(113, 253, 236);
  }
  .Consts.Ice {
    color: rgb(152, 239, 255);
  }
  .Consts.Water {
    color: rgb(86, 162, 255);
  }
  .Consts.Electric {
    color: rgb(255, 161, 255);
  }
  .Consts.Fire {
    color: rgb(245, 132, 83);
  }
  .Consts.Grass {
    color: rgb(165, 255, 171);
  }

  .Consts .icon {
    margin: -0.2em 0 -0.2em -0.6em;
    position: relative;
    border: none;
    background: transparent;
    padding: 0;
    color: inherit;
    font: inherit;
  }

  .Consts.editable {
    pointer-events: all;
  }

  .Consts.editable .icon {
    pointer-events: all;
    cursor: pointer;
  }

  .Consts.editable .icon:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.7);
    outline-offset: 0.1em;
  }

  .Consts.editable .icon.pulse {
    filter: drop-shadow(0 0 0.35em currentColor);
    animation: cons-pulse 1.1s ease-in-out infinite;
  }

  @keyframes cons-pulse {
    0%,
    100% {
      filter: drop-shadow(0 0 0.15em currentColor);
      opacity: 0.85;
    }
    50% {
      filter: drop-shadow(0 0 0.55em currentColor);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .Consts.editable .icon.pulse {
      animation: none;
      filter: drop-shadow(0 0 0.4em currentColor);
      opacity: 1;
    }
  }

  .Consts .icon:nth-child(1) {
    z-index: 6;
  }
  .Consts .icon:nth-child(2) {
    z-index: 5;
  }
  .Consts .icon:nth-child(3) {
    z-index: 4;
  }
  .Consts .icon:nth-child(4) {
    z-index: 3;
  }
  .Consts .icon:nth-child(5) {
    z-index: 2;
  }
  .Consts .icon:nth-child(6) {
    z-index: 1;
  }

  .Consts .icon :global(svg) {
    width: 3em;
    display: block;
  }

  .Consts .icon > img {
    width: 1.6em;
    top: 0;
    position: absolute;
    left: 0;
    margin: 0.72em 0 0 0.7em;
    pointer-events: all;
  }

  .Consts .icon.locked > img {
    opacity: 0.4;
  }

  .cons-fallback {
    font-weight: 700;
    font-size: 1.1em;
  }

  .cons-stepper {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    pointer-events: all;
  }

  .cons-stepper button {
    width: 1.4em;
    height: 1.4em;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 0.25em;
    background: rgba(0, 0, 0, 0.4);
    color: #f4f1e8;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .Card.editing .Consts {
    pointer-events: all;
  }

  /* ── Talents (Enka Talents / SvgIcon Circl) ───────────────────────── */

  .talent-wrap {
    display: flex;
    position: absolute;
    right: 5%;
    bottom: 6%;
    flex-direction: column;
    align-items: flex-end;
    width: 60%;
    z-index: 2;
  }

  .Talents {
    display: flex;
    flex-direction: column;
    align-self: flex-end;
    margin-left: auto;
    pointer-events: all;
  }

  .Talents.Rock :global(svg) {
    color: rgb(74, 58, 24) !important;
  }
  .Talents.Wind :global(svg) {
    color: rgb(29, 77, 71) !important;
  }
  .Talents.Ice :global(svg) {
    color: rgb(25, 61, 67) !important;
  }
  .Talents.Water :global(svg) {
    color: rgb(24, 41, 62) !important;
  }
  .Talents.Electric :global(svg) {
    color: rgb(52, 18, 59) !important;
  }
  .Talents.Fire :global(svg) {
    color: rgb(84, 25, 0) !important;
  }
  .Talents.Grass :global(svg) {
    color: rgb(19, 69, 23) !important;
  }

  .Talents .icon {
    margin-top: 0.3em;
    position: relative;
  }

  .Talents .icon :global(svg) {
    width: 3.6em;
    color: rgb(0, 0, 0);
    opacity: 0.8;
    display: block;
  }

  .Talents .icon > img {
    width: 2.5em;
    position: absolute;
    left: 0.15em;
    top: 0.15em;
    margin: 0.4em 0 0 0.4em;
  }

  .level-wrap {
    position: absolute;
    bottom: -0.1em;
    width: 100%;
    text-align: center;
  }

  .Talents .level {
    background: rgba(50, 50, 50, 0.7);
    line-height: 1;
    padding: 8.9% 11% 8%;
    font-size: 0.8em;
    border-radius: 1.4em;
    display: inline-block;
    text-shadow: none;
  }

  .talent-stepper {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    pointer-events: all;
  }

  .talent-nudge {
    width: 1.15em;
    height: 1.15em;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #f4f1e8;
    cursor: pointer;
    font-size: 0.75em;
    line-height: 1;
  }

  .talent-nudge:hover,
  .talent-nudge:focus-visible {
    border-color: rgba(255, 255, 255, 0.85);
  }

  .Talents.editable .talent-stepper .level {
    min-width: 1.4em;
  }

  /* ── Weapon ───────────────────────────────────────────────────────── */

  .Weapon {
    position: relative;
    display: flex;
    align-items: flex-start;
  }

  .Weapon figure {
    position: relative;
    width: 27%;
    line-height: 0;
    flex-shrink: 0;
    min-height: 5.5em;
    margin: 0;
  }

  .WeaponIcon {
    width: 100%;
  }

  .Weapon .Stars {
    font-size: 130%;
    text-align: center;
    position: absolute;
    width: 100%;
    top: 97%;
  }

  .Stars span {
    margin-left: -3%;
    font-size: 70%;
    color: rgb(255, 204, 50);
    text-shadow:
      0 1px 1px #000,
      0 1px 3px rgba(0, 0, 0, 0.5);
    display: inline-block;
    font-family: shicon !important;
  }

  .weapon-caption {
    padding: 0 5%;
    flex-grow: 1;
    color: #fff;
    align-self: center;
    min-width: 0;
  }

  .weapon-caption .title {
    font-weight: 400;
    margin: 0;
    font-size: 108%;
    line-height: 1.3;
    text-shadow:
      0 0.08em 0.1em rgba(0, 0, 0, 0.4),
      0 0.1em 0.3em rgba(0, 0, 0, 0.4);
  }

  .weapon-caption .stats {
    padding: 3% 0 2%;
  }

  .weapon-caption .Substat {
    display: inline-block;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 0.2em;
    padding: 2% 3%;
    margin-right: 0.5em;
    line-height: 1;
    font-size: 0.85em;
  }

  .weapon-caption .Substat :global(.stat-icon) {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.25em;
  }

  .Weapon .sub {
    display: flex;
    align-items: center;
    gap: 0.35em;
    margin-top: 0.25em;
  }

  .refine {
    text-shadow: 0 0.1em 0.1em rgba(0, 0, 0, 0.4);
    background: rgba(0, 0, 0, 0.5);
    display: inline-block;
    line-height: 1;
    padding: 1.5% 3%;
    border-radius: 0.2em;
    color: wheat;
  }

  .wlevel {
    background: rgba(0, 0, 0, 0.5);
    display: inline-block;
    line-height: 1;
    padding: 1.5% 3%;
    border-radius: 0.2em;
    white-space: nowrap;
    font-size: 0.9em;
  }

  .empty-note {
    margin: 0;
    opacity: 0.7;
    font-size: 0.9em;
  }

  /* ── Stats table ──────────────────────────────────────────────────── */

  .StatsTable {
    color: #fff;
    display: flex;
    flex-direction: column;
    padding: 1.5em 3% 0 0;
    justify-content: space-between;
    flex-grow: 1;
    font-size: 0.9em;
    min-height: 0;
  }

  .StatsTable .row {
    display: flex;
    align-items: center;
    white-space: nowrap;
    position: relative;
    padding: 0.15em 0;
  }

  .StatsTable .row p {
    margin: 0;
  }

  .StatsTable .row :global(.stat-icon) {
    height: 1em;
    width: 1em;
    margin-right: 0.8em;
  }

  .StatsTable .mid {
    display: flex;
    flex-grow: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35em;
  }

  .StatsTable .mid .sep {
    flex: 1;
    height: 0;
    border-bottom: none;
    margin: 0 0.5em;
  }

  .StatsTable .val {
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }

  .set {
    display: flex;
    width: 100%;
    max-width: 100%;
    padding-top: 0.5em;
    text-shadow:
      0 0.08em 0.1em rgba(0, 0, 0, 0.4),
      0 0.1em 0.3em rgba(0, 0, 0, 0.4);
  }

  /* Enka `.set i` — 2em box at 1.3em font-size beside the set list */
  .set-glyph {
    width: 2em;
    flex-shrink: 0;
    height: 2em;
    font-size: 1.3em;
    display: block;
    line-height: 2.3em;
    background: rgba(0, 0, 0, 0.14);
    border-radius: 0.2em;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .set-glyph img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    inset: 0;
  }

  .sets {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: center;
    min-width: 0;
  }

  .sets .group {
    position: relative;
    display: flex;
    padding: 0 0 0 0.5em;
    font-size: 0.8em;
    min-width: 0;
  }

  .sets .group:nth-child(1) {
    margin-bottom: 0.1em;
  }

  .sets .desc {
    flex-grow: 1;
    text-align: center;
    color: rgb(144, 238, 144);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    min-width: 0;
    padding: 0 0.3em;
  }

  .sets .desc.muted {
    color: rgba(255, 255, 255, 0.55);
  }

  .sets .count {
    background: rgba(0, 0, 0, 0.14);
    border-radius: 0.2em;
    text-align: center;
    width: 2em;
    margin-left: 0.5em;
    flex-shrink: 0;
  }

  /* ── Artifacts (Enka Artifact / mainstat / substats) ───────────────── */

  .Artifact {
    height: 18%;
    background: rgba(0, 0, 0, 0.31);
    border-radius: 0.3em;
    position: relative;
    overflow: hidden;
    color: #fff;
  }

  .Artifact.empty {
    opacity: 0.2;
  }

  .ArtifactIcon {
    position: absolute;
    top: -38%;
    width: 40%;
    bottom: -2%;
    left: -10%;
    object-fit: contain;
    /* Enka draws ArtifactIcon on canvas with a right-edge alpha fade. */
    -webkit-mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 45%,
      rgba(0, 0, 0, 0.45) 72%,
      transparent 100%
    );
    mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 45%,
      rgba(0, 0, 0, 0.45) 72%,
      transparent 100%
    );
  }

  .mainstat {
    position: absolute;
    height: 100%;
    width: 30%;
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 1;
  }

  .mainstat > div {
    flex-grow: 1;
  }

  .mainstat > div:nth-child(1) {
    max-height: 22%;
    align-self: flex-end;
    margin-left: auto;
  }

  .mainstat > div:nth-child(1) :global(.stat-icon) {
    width: 1em;
    height: 1em;
  }

  .mainstat > div:nth-child(2) {
    text-shadow: 0 0.07em 0.1em #000;
    max-height: 32%;
    font-size: 1.2em;
    padding: 2% 0;
    font-variant-numeric: tabular-nums;
  }

  .mainstat > div:nth-child(3) {
    max-height: 20%;
  }

  .Artifact .Stars {
    display: inline-block;
  }

  .Artifact .level {
    display: inline-block;
    font-size: 60%;
    background: rgba(0, 0, 0, 0.5);
    line-height: 1;
    vertical-align: middle;
    padding: 1.5% 2%;
    border-radius: 0.2em;
    margin-left: 5%;
    box-sizing: content-box;
  }

  .Artifact hr {
    position: absolute;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.3);
    left: 34%;
    height: 84%;
    margin-top: 2%;
    padding: 0;
  }

  .substats {
    position: absolute;
    inset: 0.35em 0.35em 0.35em 38%;
    display: flex;
    flex-flow: column wrap;
    z-index: 1;
  }

  .substats > .Substat {
    width: 50%;
    height: 50%;
    display: block;
    position: absolute;
    inset: 0;
    line-height: 1;
    font-size: 1em;
  }

  .substats > .Substat:nth-child(1) {
    bottom: 50%;
    right: 50%;
    top: auto;
    left: auto;
  }
  .substats > .Substat:nth-child(2) {
    top: 50%;
    right: 50%;
    bottom: auto;
    left: auto;
  }
  .substats > .Substat:nth-child(3) {
    bottom: 50%;
    left: 50%;
    top: auto;
    right: auto;
  }
  .substats > .Substat:nth-child(4) {
    top: 50%;
    left: 50%;
    bottom: auto;
    right: auto;
  }

  .substats > .Substat::after {
    content: "";
    width: 0;
    height: 100%;
    display: inline-block;
    vertical-align: middle;
  }

  .substats > .Substat > :global(*) {
    vertical-align: middle;
    display: inline-block;
  }

  .substats .Substat :global(.stat-icon) {
    height: 1em;
    width: 1em;
    margin-right: 4%;
  }

  .muted {
    opacity: 0.55;
  }
</style>
