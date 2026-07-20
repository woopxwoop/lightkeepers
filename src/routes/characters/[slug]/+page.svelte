<script lang="ts">
  import { onMount } from "svelte";
  import { animationsEnabled, charactersOwned } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import {
    artifactSetByKey,
    artifactSlotIconUrl,
    associationLabel,
    elementIconUrl,
    getNamecardUrl,
    getUiAssetUrl,
    statIconUrl,
    translateStatKey,
    weaponByKey,
    weaponTypeIconUrl,
    weaponTypeLabel,
  } from "$lib/utils";
  import {
    artifactIconUrl,
    skillIconUrl,
    talentIconUrl,
    weaponIconUrl,
  } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";
  import type { CharacterIndex } from "$lib/types/investment";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";

  let { data } = $props();
  let kit = $derived(data.kit as CharacterKit);
  let builds = $derived((data.builds ?? null) as CharacterIndex | null);

  type PageTab = "skills" | "builds";
  const TABS: { id: PageTab; label: string }[] = [
    { id: "builds", label: "Builds" },
    { id: "skills", label: "Skills" },
  ];
  let activeTab = $state<PageTab>("builds");
  let activeTabIndex = $derived(TABS.findIndex((t) => t.id === activeTab));

  function setActiveTab(tab: PageTab) {
    activeTab = tab;
  }

  function handlePointerAction(event: PointerEvent, action: () => void) {
    if (event.button !== 0) return;
    action();
  }

  function handleKeyboardClick(event: MouseEvent, action: () => void) {
    if (event.detail !== 0) return;
    action();
  }

  const ELEMENT_COLORS: Record<string, string> = {
    Pyro: "#f07b4a",
    Hydro: "#5eb8f5",
    Anemo: "#6dd5a8",
    Electro: "#c48ad5",
    Dendro: "#b1d94c",
    Cryo: "#8fd5e5",
    Geo: "#f5c242",
  };

  const SKILL_LABELS: Record<string, string> = {
    normal: "Normal Attack",
    skill: "Elemental Skill",
    burst: "Elemental Burst",
  };

  let character = $derived(
    $charactersOwned.find((c) => c.name_id === kit.name_id),
  );

  let owned = $derived(character?.isOwned ?? false);

  let elColor = $derived(ELEMENT_COLORS[kit.element] ?? "var(--accent-1)");
  let namecard = $derived(getNamecardUrl(kit.name_id));
  let region = $derived(associationLabel(kit.association));
  let elementIcon = $derived(elementIconUrl(kit.element));
  let weaponIcon = $derived(weaponTypeIconUrl(kit.weapon_type));
  let weaponLabel = $derived(weaponTypeLabel(kit.weapon_type));

  /** Kit card currently flashing after an in-page talent link click. */
  let flashId = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function flashKitTarget(hash: string) {
    if (!hash.startsWith("#kit-")) return;
    activeTab = "skills";
    const id = hash.slice(1);
    // Clear first so re-clicking the same link restarts the animation.
    flashId = null;
    requestAnimationFrame(() => {
      flashId = id;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 1800);
    });
  }

  onMount(() => {
    flashKitTarget(window.location.hash);

    const onHash = () => flashKitTarget(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.(
        "a.game-link",
      ) as HTMLAnchorElement | null;
      const href = a?.getAttribute("href");
      if (href?.startsWith("#kit-")) {
        queueMicrotask(() => flashKitTarget(href));
      }
    };

    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      if (flashTimer) clearTimeout(flashTimer);
    };
  });

  function passiveUnlockLabel(unlock: number): string {
    if (unlock <= 0) return "Utility";
    return `Ascension ${unlock}`;
  }

  function passiveKindLabel(
    passive: (typeof kit.passives)[number],
  ): string {
    if (passive.kind === "hexerei") return "Hexerei";
    if (passive.kind === "polestar") return "Polestar Field";
    return passiveUnlockLabel(passive.unlock);
  }

  /**
   * Enhanced Excel text usually prepends the base desc then appends buff text.
   * Return only the new suffix when that's the case; otherwise the full rewrite.
   */
  function enhanceExtra(
    base: string,
    enhanced: string | undefined,
  ): { mode: "extra" | "replace"; text: string } | null {
    if (!enhanced) return null;
    if (enhanced.startsWith(base)) {
      const extra = enhanced.slice(base.length).replace(/^(\r\n|\n|\r)+/, "");
      return extra ? { mode: "extra", text: extra } : null;
    }
    return { mode: "replace", text: enhanced };
  }

  function iconUrl(icon: string, kind: "skill" | "talent"): string | null {
    return kind === "skill" ? skillIconUrl(icon) : talentIconUrl(icon);
  }

  /** In-page targets for `{LINK#S…}` / `P…` / `T…` (skills / passives / consts). */
  let kitLinkIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const s of kit.skills) ids.add(`S${s.id}`);
    for (const p of kit.passives) ids.add(`P${p.id}`);
    for (const c of kit.constellations) ids.add(`T${c.id}`);
    return ids;
  });

  function resolveKitLink(ref: string): string | null {
    return kitLinkIds.has(ref) ? `#kit-${ref}` : null;
  }

  const MAIN_STAT_SLOTS = [
    { key: "sands" as const, label: "Sands" },
    { key: "goblet" as const, label: "Goblet" },
    { key: "circlet" as const, label: "Circlet" },
  ];

  /** Weapons: higher rarity first, then team usage. */
  let rankedWeapons = $derived.by(() => {
    if (!builds?.weapons.length) return [];
    return [...builds.weapons].sort((a, b) => {
      const ra = weaponByKey.get(a.key)?.stars ?? 0;
      const rb = weaponByKey.get(b.key)?.stars ?? 0;
      if (ra !== rb) return rb - ra;
      if (a.teams !== b.teams) return b.teams - a.teams;
      return a.key.localeCompare(b.key);
    });
  });

  /** Substats that also appear as main stats first, then by mean rolls. */
  let recommendedSubstats = $derived.by(() => {
    if (!builds) return [];
    const mainSlots = new Map<string, string[]>();
    for (const slot of MAIN_STAT_SLOTS) {
      for (const s of builds.main_stats[slot.key]) {
        const list = mainSlots.get(s.key) ?? [];
        list.push(slot.label);
        mainSlots.set(s.key, list);
      }
    }
    return builds.substat_rolls_liquid.ranked
      .filter((r) => r.mean > 0.5)
      .map((r) => {
        const slots = mainSlots.get(r.key) ?? [];
        return {
          ...r,
          matchesMain: slots.length > 0,
          mainSlots: slots,
        };
      })
      .sort((a, b) => {
        if (a.matchesMain !== b.matchesMain) return a.matchesMain ? -1 : 1;
        return b.mean - a.mean;
      });
  });
</script>

{#snippet descriptionBlock(
  base: string,
  enhance: { mode: "extra" | "replace"; text: string } | null,
)}
  {#if enhance?.mode === "replace"}
    <GameText
      text={enhance.text}
      class="text-xs"
      resolveLink={resolveKitLink}
    />
  {:else}
    <GameText text={base} class="text-xs" resolveLink={resolveKitLink} />
    {#if enhance}
      <GameText
        text={enhance.text}
        class="text-xs mt-1.5"
        resolveLink={resolveKitLink}
      />
    {/if}
  {/if}
{/snippet}

<main
  class="w-[80%] pb-20 flex flex-col gap-8"
  style="--kit-flash: {elColor};{!$animationsEnabled
    ? ' --sk-animation: none; --pulse-animation: none'
    : ''}"
>
  <!-- Hero -->
  <section
    class="hero relative overflow-hidden rounded-2xl"
    style="border: 0.5px solid color-mix(in srgb, {elColor} 35%, transparent);"
  >
    <div
      class="hero-bg absolute inset-0"
      style="background-image: url('{namecard}');"
    ></div>
    <div class="hero-shade absolute inset-0"></div>
    <div
      class="hero-body relative z-10 flex flex-row items-center gap-3 sm:gap-4 md:gap-5"
    >
      {#if character}
        <div class="hero-portrait">
          <CharacterIcon {character} />
        </div>
      {/if}
      <div
        class="hero-copy flex flex-col gap-1.5 min-w-0 flex-1 pb-3 sm:pb-4 md:pb-5"
      >
        <p class="text-xs tracking-widest uppercase" style="color: {elColor};">
          {kit.title || "Character"}
        </p>
        <h1
          class="text-3xl md:text-4xl font-semibold leading-tight"
          style="color: var(--foreground-color);"
        >
          {kit.name}
        </h1>
        <div
          class="flex flex-wrap items-center gap-2 text-sm"
          style="color: var(--foreground-mid);"
        >
          {#if elementIcon}
            <img
              src={elementIcon}
              alt={kit.element}
              title={kit.element}
              class="stat-icon hero-meta-icon"
              loading="lazy"
            />
          {:else}
            <span style="color: {elColor};">{kit.element}</span>
          {/if}
          <span aria-hidden="true">·</span>
          {#if weaponIcon}
            <img
              src={weaponIcon}
              alt={weaponLabel}
              title={weaponLabel}
              class="stat-icon hero-meta-icon"
              loading="lazy"
            />
          {:else}
            <span>{weaponLabel}</span>
          {/if}
          <span aria-hidden="true">·</span>
          <span>{kit.rarity}★</span>
          {#if region}
            <span aria-hidden="true">·</span>
            <span>{region}</span>
          {/if}
          {#if kit.birthday}
            <span aria-hidden="true">·</span>
            <span>{kit.birthday.month}/{kit.birthday.day}</span>
          {/if}
        </div>
        <a
          href="/characters"
          class="text-xs mt-2 w-fit no-underline"
          style="color: var(--foreground-mid);"
        >
          ← All characters
        </a>
      </div>
    </div>
  </section>

  <!-- Tabs -->
  <div
    role="tablist"
    aria-label="Character sections"
    class="relative flex rounded-xl overflow-hidden"
    style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
  >
    <span
      class="absolute inset-y-0 pointer-events-none transition-[left,background-color] duration-150"
      style="left: calc({activeTabIndex} * 100% / {TABS.length}); width: calc(100% / {TABS.length}); background: color-mix(in srgb, {elColor} 10%, var(--background-mid));"
    ></span>
    <span
      class="absolute bottom-0 h-[1.5px] pointer-events-none transition-[left,background-color] duration-150"
      style="left: calc({activeTabIndex} * 100% / {TABS.length}); width: calc(100% / {TABS.length}); background: {elColor};"
    ></span>
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        onpointerdown={(event) =>
          handlePointerAction(event, () => setActiveTab(tab.id))}
        onclick={(event) =>
          handleKeyboardClick(event, () => setActiveTab(tab.id))}
        class="page-tab relative z-1 flex-1 py-2.5 text-xs font-medium transition-colors pointer-events-auto touch-manipulation"
        class:page-tab-active={activeTab === tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === "skills"}
    <!-- Talents -->
    <section class="flex flex-col gap-3">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        Talents
      </h2>
      <div class="flex flex-col gap-2">
        {#each kit.skills as skill}
          {@const icon =
            iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon)}
          {@const skillEnhance = enhanceExtra(
            skill.description,
            skill.enhanceDescription,
          )}
          <article
            id="kit-S{skill.id}"
            class="kit-card rounded-xl p-4 flex gap-3"
            class:kit-card-flash={flashId === `kit-S${skill.id}`}
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="min-w-0 flex-1 flex flex-col gap-1">
              <div class="flex flex-wrap items-baseline gap-2">
                <h3
                  class="text-sm font-medium"
                  style="color: var(--foreground-color);"
                >
                  {skill.name}
                </h3>
                <span
                  class="text-[0.65rem] uppercase tracking-wider"
                  style="color: var(--foreground-mid);"
                >
                  {SKILL_LABELS[skill.type] ?? skill.type}
                </span>
              </div>
              {@render descriptionBlock(skill.description, skillEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <!-- Passives -->
    <section class="flex flex-col gap-3">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        Passives
      </h2>
      <div class="flex flex-col gap-2">
        {#each kit.passives as passive}
          {@const icon =
            iconUrl(passive.icon, "talent") ?? getUiAssetUrl(passive.icon)}
          {@const passiveEnhance = enhanceExtra(
            passive.description,
            passive.enhanceDescription,
          )}
          <article
            id="kit-P{passive.id}"
            class="kit-card rounded-xl p-4 flex gap-3"
            class:kit-card-flash={flashId === `kit-P${passive.id}`}
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="min-w-0 flex-1 flex flex-col gap-1">
              <div class="flex flex-wrap items-baseline gap-2">
                <h3
                  class="text-sm font-medium"
                  style="color: var(--foreground-color);"
                >
                  {passive.name}
                </h3>
                <span
                  class="text-[0.65rem] uppercase tracking-wider"
                  style="color: var(--foreground-mid);"
                >
                  {passiveKindLabel(passive)}
                </span>
              </div>
              {@render descriptionBlock(passive.description, passiveEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <!-- Constellations -->
    <section class="flex flex-col gap-3">
      <h2 class="tracking-widest" style="color: var(--foreground-color);">
        Constellations
      </h2>
      <div class="flex flex-col gap-2">
        {#each kit.constellations as c}
          {@const icon = iconUrl(c.icon, "talent") ?? getUiAssetUrl(c.icon)}
          {@const constEnhance = enhanceExtra(
            c.description,
            c.enhanceDescription,
          )}
          <article
            id="kit-T{c.id}"
            class="kit-card rounded-xl p-4 flex gap-3"
            class:kit-card-flash={flashId === `kit-T${c.id}`}
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="min-w-0 flex-1 flex flex-col gap-1">
              <div class="flex flex-wrap items-baseline gap-2">
                <span
                  class="text-[0.65rem] font-semibold tracking-wider"
                  style="color: {elColor};"
                >
                  C{c.index}
                </span>
                <h3
                  class="text-sm font-medium"
                  style="color: var(--foreground-color);"
                >
                  {c.name}
                </h3>
              </div>
              {@render descriptionBlock(c.description, constEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>
  {:else if builds}
    <!-- Weapons -->
    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest" style="color: var(--foreground-color);">
          Weapons
        </h2>
      </div>
      {#if rankedWeapons.length === 0}
        <p class="text-xs" style="color: var(--foreground-mid);">
          No weapon data yet.
        </p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each rankedWeapons as w}
            {@const weapon = weaponByKey.get(w.key)}
            {@const icon = weapon ? weaponIconUrl(weapon.awakenIcon) : null}
            <div
              class="weapon-card relative group rounded-xl overflow-hidden"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
            >
              <div class="weapon-icon-wrap">
                {#if icon}
                  <img
                    src={icon}
                    alt={weapon?.name ?? w.key}
                    class="weapon-icon"
                    loading="lazy"
                  />
                {:else}
                  <div
                    class="weapon-icon flex items-center justify-center text-[0.65rem] px-1 text-center"
                    style="color: var(--foreground-mid);"
                  >
                    {w.key}
                  </div>
                {/if}
              </div>
              <WeaponTooltip {weapon} weaponKey={w.key} />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Artifact sets -->
    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest" style="color: var(--foreground-color);">
          Artifact sets
        </h2>
      </div>
      {#if !builds.sets?.length}
        <p class="text-xs" style="color: var(--foreground-mid);">
          No set data yet.
        </p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each builds.sets as s}
            {@const set = artifactSetByKey.get(s.key)}
            {@const icon = set ? artifactIconUrl(set.icon) : null}
            <div
              class="weapon-card relative group rounded-xl overflow-hidden"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
            >
              <div class="weapon-icon-wrap">
                {#if icon}
                  <img
                    src={icon}
                    alt={set?.name ?? s.key}
                    class="weapon-icon"
                    loading="lazy"
                  />
                {:else}
                  <div
                    class="weapon-icon flex items-center justify-center text-[0.65rem] px-1 text-center"
                    style="color: var(--foreground-mid);"
                  >
                    {s.key}
                  </div>
                {/if}
                {#if s.count}
                  <div
                    class="absolute bottom-0 left-0 right-0 flex justify-end px-1.5 pb-1.5 pt-4 z-10"
                    style="background: linear-gradient(transparent, color-mix(in srgb, var(--background-color) 85%, transparent));"
                  >
                    <span
                      class="text-[0.65rem] font-semibold leading-tight tracking-wider"
                      style="color: {elColor};"
                    >
                      {s.count}pc
                    </span>
                  </div>
                {/if}
              </div>
              <ArtifactTooltip
                {set}
                setKey={s.key}
                pieceCount={s.count ?? null}
              />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Main stats -->
    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest" style="color: var(--foreground-color);">
          Main stats
        </h2>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        {#each MAIN_STAT_SLOTS as slot}
          <div
            class="rounded-xl p-3 flex flex-col gap-2"
            style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);"
          >
            <h3
              class="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider"
              style="color: var(--foreground-mid);"
            >
              <img
                src={artifactSlotIconUrl(slot.key)}
                alt=""
                class="stat-icon main-stat-icon shrink-0"
                loading="lazy"
              />
              {slot.label}
            </h3>
            {#if builds.main_stats[slot.key].length === 0}
              <p class="text-xs" style="color: var(--foreground-mid);">—</p>
            {:else}
              <ul class="flex flex-col gap-1.5">
                {#each builds.main_stats[slot.key] as stat}
                  {@const icon = statIconUrl(stat.key)}
                  <li class="flex items-center justify-between gap-2 text-xs">
                    <span class="flex items-center gap-1.5 min-w-0">
                      {#if icon}
                        <img
                          src={icon}
                          alt=""
                          class="stat-icon main-stat-icon shrink-0"
                          loading="lazy"
                        />
                      {/if}
                      <span style="color: var(--foreground-color);"
                        >{translateStatKey(stat.key)}</span
                      >
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <!-- Recommended substats -->
    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="tracking-widest" style="color: var(--foreground-color);">
          Recommended substats
        </h2>
      </div>
      {#if recommendedSubstats.length === 0}
        <p class="text-xs" style="color: var(--foreground-mid);">
          No substat data yet.
        </p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each recommendedSubstats as roll}
            {@const icon = statIconUrl(roll.key)}
            <button
              type="button"
              class="stat-chip group relative flex items-center justify-center rounded-xl"
              style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, {roll.matchesMain
                ? elColor
                : 'var(--accent-1)'} {roll.matchesMain
                ? 40
                : 18}%, transparent);"
              aria-label={translateStatKey(roll.key)}
            >
              {#if icon}
                <img src={icon} alt="" class="stat-icon" loading="lazy" />
              {:else}
                <span
                  class="text-[0.65rem] px-1 text-center leading-tight"
                  style="color: var(--foreground-mid);"
                >
                  {translateStatKey(roll.key)}
                </span>
              {/if}
              <HoverTooltip class="max-w-56">
                <div class="text-xs font-medium leading-tight">
                  {translateStatKey(roll.key)}
                </div>
                {#if roll.matchesMain}
                  <div class="text-[0.65rem] leading-snug mt-1 opacity-85">
                    Also a main on {roll.mainSlots.join(" / ")}
                  </div>
                {/if}
                <div class="text-[0.65rem] leading-snug mt-1 opacity-85">
                  {roll.mean.toFixed(1)} avg liquid rolls · {builds
                    .substat_rolls_liquid.teams} team{builds
                    .substat_rolls_liquid.teams === 1
                    ? ""
                    : "s"}
                </div>
              </HoverTooltip>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {:else}
    <p class="text-sm" style="color: var(--foreground-mid);">
      No gcsim build summary for {kit.name} yet.
    </p>
  {/if}
</main>

<style>
  .hero-bg {
    background-size: cover;
    background-position: center;
    filter: saturate(0.9);
    opacity: 0.55;
  }

  .hero-shade {
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--background-color) 88%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 45%, transparent) 50%,
      color-mix(in srgb, var(--background-color) 20%, transparent) 100%
    );
  }

  .hero-body {
    padding: 1rem 0.75rem 1rem 1rem;
  }

  .hero-portrait {
    width: clamp(5.5rem, 28vw, 9rem);
    flex-shrink: 0;
    border-radius: 0.75rem;
    overflow: hidden;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.4));
  }

  .hero-portrait :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-copy {
    position: relative;
    z-index: 1;
  }

  .page-tab {
    color: var(--foreground-mid);
  }

  .page-tab-active {
    color: var(--accent-1);
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .weapon-card {
    width: 4.5rem;
  }

  .weapon-icon-wrap {
    width: 4.5rem;
    height: 4.5rem;
  }

  .weapon-icon {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .stat-chip {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0.55rem;
  }

  .stat-icon {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Lunaris icons are dark glyphs — force light on dark theme */
    filter: brightness(0) invert(1);
    opacity: 0.7;
  }

  .main-stat-icon {
    width: 0.95rem;
    height: 0.95rem;
  }

  .hero-meta-icon {
    width: 1.4rem;
    height: 1.4rem;
  }

  :global([data-theme="light"]) .stat-icon {
    filter: brightness(0);
    opacity: 0.65;
  }

  .kit-card {
    scroll-margin-top: 5.5rem;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .kit-card-flash {
    border-color: color-mix(
      in srgb,
      var(--kit-flash) 65%,
      transparent
    ) !important;
    background: color-mix(
      in srgb,
      var(--kit-flash) 14%,
      var(--background-mid)
    ) !important;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--kit-flash) 40%, transparent),
      0 0 24px color-mix(in srgb, var(--kit-flash) 22%, transparent);
    animation: kit-target-flash 1.6s ease-out;
  }

  @keyframes kit-target-flash {
    0% {
      box-shadow:
        0 0 0 0 color-mix(in srgb, var(--kit-flash) 55%, transparent),
        0 0 0 transparent;
    }
    35% {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--kit-flash) 45%, transparent),
        0 0 28px color-mix(in srgb, var(--kit-flash) 30%, transparent);
    }
    100% {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--kit-flash) 40%, transparent),
        0 0 24px color-mix(in srgb, var(--kit-flash) 22%, transparent);
    }
  }

  @media (min-width: 640px) {
    .hero-body {
      padding: 1.25rem;
    }

    .hero-portrait {
      width: clamp(7rem, 22vw, 10rem);
    }
  }

  @media (min-width: 768px) {
    .hero-body {
      padding: 1.5rem 1.75rem;
    }

    .hero-portrait {
      width: 10.5rem;
    }
  }
</style>
