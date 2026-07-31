<script lang="ts">
  import { onMount } from "svelte";
  import {
    animationsEnabled,
    charactersOwned,
    allTeamsAbyss,
    allTeamsStygian,
    staticBoardsLoaded,
    staticBoardsError,
    ensureStaticBoards,
  } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import WeaponIcon from "$lib/ui/components/WeaponIcon.svelte";
  import WeaponName from "$lib/ui/components/WeaponName.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import SlidingTabs from "$lib/ui/components/SlidingTabs.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import BackLink from "$lib/ui/components/BackLink.svelte";
  import CostPopover from "$lib/ui/components/CostPopover.svelte";
  import UpgradeImpactPopover from "$lib/ui/components/UpgradeImpactPopover.svelte";
  import { elementColor } from "$lib/element-colors";
  import {
    CHARACTER_SIM_COST,
    TOP_TEAMS_LIMIT,
    topSimTeamsForCharacter,
    topTeamsForCharacter,
    handCharactersFromGoodKeys,
    handBuilds,
    dimmedKeysFromGoodKeys,
  } from "$lib/character-teams";
  import {
    loadInvestment,
    getInvestmentCached,
  } from "$lib/app/investment";
  import {
    artifactSlotIconUrl,
    associationLabel,
    buildGoodKeyMap,
    elementIconUrl,
    getNamecardUrl,
    getUiAssetUrl,
    ownedGoodKeys,
    ownedNameIds,
    statIconUrl,
    simCharacterKey,
    translateStatKey,
    weaponTypeIconUrl,
    weaponTypeLabel,
  } from "$lib/utils";
  import { artifactSetByKey, weaponByKey, equipmentVersion, ensureEquipmentData } from "$lib/equipment-data";
  import {
    MAIN_STAT_SLOTS,
    constellationImpactRows,
    levelImportanceFromBuilds,
    rankSigWeaponsByGain,
    rankWeaponsByRarityAndTeams,
    recommendedSubstatsFromBuilds,
    talentImportanceRows as buildTalentImportanceRows,
  } from "$lib/character-builds";
  import {
    artifactIconUrl,
    skillIconUrl,
    talentIconUrl,
    weaponIconUrl,
  } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";
  import type {
    CharacterIndex,
    InvestmentFile,
  } from "$lib/types/investment";
  import type { Character } from "$lib/definitions";

  let { data } = $props();
  let kit = $derived(data.kit as CharacterKit);
  let builds = $derived((data.builds ?? null) as CharacterIndex | null);
  let mapping = $derived(data.mapping as Map<string, Character>);

  type PageTab = "skills" | "builds" | "teams";
  type TeamsMode = "stygian" | "abyss" | "simulated";

  const TAB_OPTIONS = [
    { value: "builds" as const, label: "Builds" },
    { value: "teams" as const, label: "Teams" },
    { value: "skills" as const, label: "Skills" },
  ];
  const TEAMS_MODE_OPTIONS = [
    { value: "stygian" as const, label: "Stygian" },
    { value: "abyss" as const, label: "Abyss" },
    { value: "simulated" as const, label: "Simulated" },
  ];

  let activeTab = $state<PageTab>("builds");
  let teamsMode = $state<TeamsMode>("stygian");

  let investment = $state<InvestmentFile | null>(getInvestmentCached());
  let investmentError = $state<string | null>(null);
  let investmentLoading = $state(false);
  let investmentInFlight: Promise<void> | null = null;

  $effect(() => {
    if (activeTab !== "teams") return;
    if (teamsMode === "simulated") {
      void ensureInvestment();
    } else {
      ensureStaticBoards().catch(() => {});
    }
  });

  async function ensureInvestment() {
    if (investment) return;
    if (investmentInFlight) return investmentInFlight;

    investmentLoading = true;
    investmentError = null;
    const pending = (async () => {
      try {
        investment = await loadInvestment();
      } catch (e) {
        investmentError =
          e instanceof Error ? e.message : "Failed to load simulated teams";
      } finally {
        investmentLoading = false;
      }
    })();
    investmentInFlight = pending;
    try {
      await pending;
    } finally {
      if (investmentInFlight === pending) investmentInFlight = null;
    }
  }

  let popularTeams = $derived(
    teamsMode === "simulated"
      ? []
      : topTeamsForCharacter(
          teamsMode === "stygian" ? $allTeamsStygian : $allTeamsAbyss,
          kit.name_id,
          TOP_TEAMS_LIMIT,
        ),
  );

  let goodKey = $derived(simCharacterKey(kit));
  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));

  let ownedKeys = $derived(ownedGoodKeys($charactersOwned));
  let ownedNameIdsSet = $derived(ownedNameIds($charactersOwned));

  let simulatedTeams = $derived(
    investment
      ? topSimTeamsForCharacter(
          investment.teams,
          goodKey,
          CHARACTER_SIM_COST,
          TOP_TEAMS_LIMIT,
        )
      : [],
  );

  let teamsLoading = $derived(
    teamsMode === "simulated"
      ? investmentLoading && !investment
      : !$staticBoardsError && !$staticBoardsLoaded && popularTeams.length === 0,
  );

  async function retryTeams() {
    if (teamsMode === "simulated") {
      investment = null;
      await ensureInvestment();
      return;
    }
    try {
      await ensureStaticBoards();
    } catch {
      /* staticBoardsError store already set */
    }
  }

  function formatDps(dps: number): string {
    return `${(dps / 1000).toFixed(0)}K`;
  }

  function handCharactersFromMembers(members: string[]) {
    return members.map((id) => mapping.get(id));
  }

  function dimmedKeysFromMembers(members: string[]): Set<string> {
    return new Set(members.filter((id) => !ownedNameIdsSet.has(id)));
  }

  const SKILL_LABELS: Record<string, string> = {
    normal: "Normal Attack",
    skill: "Elemental Skill",
    burst: "Elemental Burst",
  };

  let character = $derived(
    $charactersOwned.find((c) => c.name_id === kit.name_id),
  );

  let elColor = $derived(elementColor(kit.element, "var(--foreground-color)"));
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
    void ensureEquipmentData();
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

  function passiveKindLabel(passive: (typeof kit.passives)[number]): string {
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

  /** Weapons: higher rarity first, then team usage (stable within ties). */
  let rankedWeapons = $derived.by(() => {
    $equipmentVersion;
    return rankWeaponsByRarityAndTeams(
      builds?.weapons,
      (key) => weaponByKey.get(key)?.stars ?? 0,
    );
  });

  let recommendedSubstats = $derived(recommendedSubstatsFromBuilds(builds));

  let constellationRows = $derived(
    constellationImpactRows(builds?.vertical_importance?.constellations),
  );

  let rankedSigWeapons = $derived(
    rankSigWeaponsByGain(builds?.vertical_importance?.sig_weapons),
  );

  /**
   * Talent priority rows for Builds tab: qualitative upgrade labels from
   * max(mean, median) % DPS drop when that talent is at 1.
   */
  let talentImportanceRows = $derived(
    buildTalentImportanceRows(builds?.talent_importance, (kitType) => {
      const skill = kit.skills.find((s) => s.type === kitType);
      if (!skill) return null;
      return iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon);
    }),
  );

  /** Character level 90 importance for Builds tab (separate from talents). */
  let levelImportance = $derived.by(() => {
    const row = levelImportanceFromBuilds(builds);
    if (!row) return null;
    return {
      ...row,
      icon: getUiAssetUrl("UI_ItemIcon_104003"),
    };
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

<PageShell class="char-detail {$animationsEnabled ? '' : 'no-page-anim'}">
  <Surface
    flush
    class="char-board"
    style="--kit-flash: {elColor}; --hero-accent: {elColor};"
  >
    <section class="hero relative overflow-hidden">
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
          <BackLink href="/characters">← All characters</BackLink>
          <p class="hero-eyebrow" style="color: {elColor};">
            {kit.title || "Character"}
          </p>
          <h1 class="hero-title">{kit.name}</h1>
          <div class="hero-meta">
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
        </div>
      </div>
    </section>

    <SlidingTabs
      options={TAB_OPTIONS}
      bind:value={activeTab}
      accent={elColor}
      aria-label="Character sections"
      class="board-tabs"
    />

    <div class="board-body">
      {#if activeTab === "skills"}
        <div role="tabpanel" id="tabpanel-skills" aria-labelledby="tab-skills">
          <section class="board-section">
            <h2 class="section-title">Talents</h2>
            <div class="kit-list">
              {#each kit.skills as skill}
                {@const icon =
                  iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon)}
                {@const skillEnhance = enhanceExtra(
                  skill.description,
                  skill.enhanceDescription,
                )}
                <article
                  id="kit-S{skill.id}"
                  class="kit-row"
                  class:kit-row-flash={flashId === `kit-S${skill.id}`}
                >
                  {#if icon}
                    <img
                      src={icon}
                      alt=""
                      class="kit-icon shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  <div class="kit-copy">
                    <div class="kit-heading">
                      <h3 class="card-title">{skill.name}</h3>
                      <span class="card-kicker">
                        {SKILL_LABELS[skill.type] ?? skill.type}
                      </span>
                    </div>
                    {@render descriptionBlock(skill.description, skillEnhance)}
                  </div>
                </article>
              {/each}
            </div>
          </section>

          <section class="board-section">
            <h2 class="section-title">Passives</h2>
            <div class="kit-list">
              {#each kit.passives as passive}
                {@const icon =
                  iconUrl(passive.icon, "talent") ??
                  getUiAssetUrl(passive.icon)}
                {@const passiveEnhance = enhanceExtra(
                  passive.description,
                  passive.enhanceDescription,
                )}
                <article
                  id="kit-P{passive.id}"
                  class="kit-row"
                  class:kit-row-flash={flashId === `kit-P${passive.id}`}
                >
                  {#if icon}
                    <img
                      src={icon}
                      alt=""
                      class="kit-icon shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  <div class="kit-copy">
                    <div class="kit-heading">
                      <h3 class="card-title">{passive.name}</h3>
                      <span class="card-kicker"
                        >{passiveKindLabel(passive)}</span
                      >
                    </div>
                    {@render descriptionBlock(
                      passive.description,
                      passiveEnhance,
                    )}
                  </div>
                </article>
              {/each}
            </div>
          </section>

          <section class="board-section">
            <h2 class="section-title">Constellations</h2>
            <div class="kit-list">
              {#each kit.constellations as c}
                {@const icon =
                  iconUrl(c.icon, "talent") ?? getUiAssetUrl(c.icon)}
                {@const constEnhance = enhanceExtra(
                  c.description,
                  c.enhanceDescription,
                )}
                <article
                  id="kit-T{c.id}"
                  class="kit-row"
                  class:kit-row-flash={flashId === `kit-T${c.id}`}
                >
                  {#if icon}
                    <img
                      src={icon}
                      alt=""
                      class="kit-icon shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  <div class="kit-copy">
                    <div class="kit-heading">
                      <span class="const-index" style="color: {elColor};">
                        C{c.index}
                      </span>
                      <h3 class="card-title">{c.name}</h3>
                    </div>
                    {@render descriptionBlock(c.description, constEnhance)}
                  </div>
                </article>
              {/each}
            </div>
          </section>
        </div>
      {:else if activeTab === "teams"}
        <div
          role="tabpanel"
          id="tabpanel-teams"
          aria-labelledby="tab-teams"
        >
          <section class="board-section">
            <div class="teams-head">
              <label class="teams-label">
                <span class="teams-label-text">Teams:</span>
                <Select
                  options={TEAMS_MODE_OPTIONS}
                  bind:value={teamsMode}
                  aria-label="Team source"
                />
              </label>
              {#if teamsMode === "simulated"}
                <span class="teams-cost"
                  >{CHARACTER_SIM_COST} <CostPopover /></span
                >
              {:else}
                <span class="teams-cost">Usage rate</span>
              {/if}
            </div>

            {#if teamsMode === "simulated"}
              {#if teamsLoading}
                <LoadingState
                  variant="pulse"
                  message="Loading simulated teams…"
                />
              {:else if investmentError && simulatedTeams.length === 0}
                <EmptyState message="Could not load simulated teams right now.">
                  {#snippet action()}
                    <Button variant="secondary" onclick={retryTeams}
                      >Try again</Button
                    >
                  {/snippet}
                </EmptyState>
              {:else if simulatedTeams.length === 0}
                <EmptyState
                  message="No {CHARACTER_SIM_COST}-cost sims featuring {kit.name} yet."
                />
              {:else}
                <ol class="team-hands">
                  {#each simulatedTeams as row, i (row.team.team_key)}
                    <li class="team-hand-row">
                      <TeamCardHand
                        characters={handCharactersFromGoodKeys(
                          row.team.characters,
                          goodKeyMap,
                        )}
                        builds={handBuilds(row.team, row.sim)}
                        dimmedKeys={dimmedKeysFromGoodKeys(
                          row.team.characters,
                          ownedKeys,
                          goodKeyMap,
                        )}
                        spread="flat"
                      />
                      <div class="team-hand-footer">
                        <span class="team-hand-meta">
                          <span class="team-hand-rank">#{i + 1}</span>
                          <span
                            >{CHARACTER_SIM_COST} cost · {formatDps(row.dps)} DPS</span
                          >
                        </span>
                        <a
                          href="/teams/{row.team.team_key}"
                          class="team-hand-link"
                        >
                          View team details →
                        </a>
                      </div>
                    </li>
                  {/each}
                </ol>
              {/if}
            {:else if teamsLoading}
              <LoadingState
                variant="pulse"
                message="Loading meta teams…"
              />
            {:else if $staticBoardsError && popularTeams.length === 0}
              <EmptyState message="Could not load teams right now.">
                {#snippet action()}
                  <Button variant="secondary" onclick={retryTeams}
                    >Try again</Button
                  >
                {/snippet}
              </EmptyState>
            {:else if popularTeams.length === 0}
              <EmptyState
                message="No {teamsMode === 'stygian'
                  ? 'Stygian'
                  : 'Abyss'} teams featuring {kit.name} yet."
              />
            {:else}
              <ol class="team-hands">
                {#each popularTeams as team, i (team.team_key ?? i)}
                  <li class="team-hand-row">
                    <TeamCardHand
                      characters={handCharactersFromMembers(team.members)}
                      dimmedKeys={dimmedKeysFromMembers(team.members)}
                      spread="flat"
                    />
                    <div class="team-hand-footer">
                      <span class="team-hand-meta">
                        <span class="team-hand-rank">#{i + 1}</span>
                        <span
                          >{(team.usage_rate ?? 0).toFixed(1)}% usage</span
                        >
                      </span>
                    </div>
                  </li>
                {/each}
              </ol>
            {/if}
          </section>
        </div>
      {:else}
        <div role="tabpanel" id="tabpanel-builds" aria-labelledby="tab-builds">
          {#if builds}
            <section class="board-section">
              <h2 class="section-title">Weapons</h2>
              {#if rankedWeapons.length === 0}
                <p class="muted-note">No weapon data yet.</p>
              {:else}
                <div class="equip-grid">
                  {#each rankedWeapons as w}
                    {@const weapon = weaponByKey.get(w.key)}
                    {@const icon = weapon
                      ? weaponIconUrl(weapon.awakenIcon)
                      : null}
                    <div class="equip-tile relative group">
                      <div class="equip-icon-wrap">
                        {#if icon}
                          <img
                            src={icon}
                            alt={weapon?.name ?? w.key}
                            class="equip-icon"
                            loading="lazy"
                          />
                        {:else}
                          <div class="equip-fallback">{w.key}</div>
                        {/if}
                      </div>
                      <WeaponTooltip {weapon} weaponKey={w.key} />
                    </div>
                  {/each}
                </div>
              {/if}
            </section>

            <section class="board-section">
              <h2 class="section-title">Artifact sets</h2>
              {#if !builds.sets?.length}
                <p class="muted-note">No set data yet.</p>
              {:else}
                {#key $equipmentVersion}
                <div class="equip-grid">
                  {#each builds.sets as s}
                    {@const set = artifactSetByKey.get(s.key)}
                    {@const icon = set ? artifactIconUrl(set.icon) : null}
                    <div class="equip-tile relative group">
                      <div class="equip-icon-wrap">
                        {#if icon}
                          <img
                            src={icon}
                            alt={set?.name ?? s.key}
                            class="equip-icon"
                            loading="lazy"
                          />
                        {:else}
                          <div class="equip-fallback">{s.key}</div>
                        {/if}
                        {#if s.count}
                          <div class="piece-badge">
                            <span style="color: {elColor};">{s.count}pc</span>
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
                {/key}
              {/if}
            </section>

            <section class="board-section">
              <h2 class="section-title">Main stats</h2>
              <div class="main-stats">
                {#each MAIN_STAT_SLOTS as slot}
                  <div class="main-stat-col">
                    <h3 class="slot-label">
                      <img
                        src={artifactSlotIconUrl(slot.key)}
                        alt=""
                        class="stat-icon main-stat-icon shrink-0"
                        loading="lazy"
                      />
                      {slot.label}
                    </h3>
                    {#if builds.main_stats[slot.key].length === 0}
                      <p class="muted-note">—</p>
                    {:else}
                      <ul class="stat-list">
                        {#each builds.main_stats[slot.key] as stat}
                          {@const icon = statIconUrl(stat.key)}
                          <li class="main-stat-item">
                            <span class="flex items-center gap-1.5 min-w-0">
                              {#if icon}
                                <img
                                  src={icon}
                                  alt=""
                                  class="stat-icon main-stat-icon shrink-0"
                                  loading="lazy"
                                />
                              {/if}
                              <span class="stat-name"
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

            <section class="board-section">
              <h2 class="section-title">Recommended substats</h2>
              {#if recommendedSubstats.length === 0}
                <p class="muted-note">No substat data yet.</p>
              {:else}
                <div class="substat-row">
                  {#each recommendedSubstats as roll}
                    {@const icon = statIconUrl(roll.key)}
                    <button
                      type="button"
                      class="stat-chip group relative flex items-center justify-center"
                      class:is-main={roll.matchesMain}
                      aria-label={translateStatKey(roll.key)}
                    >
                      {#if icon}
                        <img
                          src={icon}
                          alt=""
                          class="stat-icon"
                          loading="lazy"
                        />
                      {:else}
                        <span class="stat-chip-fallback">
                          {translateStatKey(roll.key)}
                        </span>
                      {/if}
                      <HoverTooltip
                        class="max-w-56"
                        label={translateStatKey(roll.key)}
                      >
                        <div class="tip-detail-text font-medium">
                          {translateStatKey(roll.key)}
                        </div>
                        {#if roll.matchesMain}
                          <div
                            class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
                          >
                            Also a main on {roll.mainSlots.join(" / ")}
                          </div>
                        {/if}
                        {#if roll.mean > 0}
                          <div
                            class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
                          >
                            {roll.mean.toFixed(1)} avg liquid rolls · {builds
                              .substat_rolls_liquid.teams} team{builds
                              .substat_rolls_liquid.teams === 1
                              ? ""
                              : "s"}
                          </div>
                        {/if}
                      </HoverTooltip>
                    </button>
                  {/each}
                </div>
              {/if}
            </section>

            {#if talentImportanceRows.length > 0 ||
              levelImportance ||
              builds.vertical_importance?.constellations?.length ||
              rankedSigWeapons.length}
              <div class="invest-grid">
                <div class="invest-col">
                  {#if talentImportanceRows.length > 0 && builds?.talent_importance}
                    <section class="board-section">
                      <h2 class="section-title">Talent priority</h2>
                      <ul class="talent-priority-list">
                        {#each talentImportanceRows as row, i}
                          <li
                            class="talent-priority-row"
                            data-priority={row.priority}
                          >
                            <span
                              class="talent-priority-rank"
                              style="color: {elColor};">{i + 1}</span
                            >
                            {#if row.icon}
                              <img
                                src={row.icon}
                                alt=""
                                class="kit-icon talent-priority-icon shrink-0"
                                loading="lazy"
                              />
                            {/if}
                            <div class="talent-priority-copy">
                              <div class="talent-priority-name">{row.label}</div>
                              <UpgradeImpactPopover
                                label={row.priorityLabel}
                                tier={row.priority}
                                kind="talent"
                                mean={row.mean}
                                median={row.median}
                                min={row.min}
                                max={row.max}
                                teams={row.teams}
                              />
                            </div>
                          </li>
                        {/each}
                      </ul>
                    </section>
                  {/if}

                  {#if levelImportance}
                    <section class="board-section">
                      <h2 class="section-title">Character level</h2>
                      <ul class="talent-priority-list">
                        <li
                          class="talent-priority-row"
                          data-priority={levelImportance.priority}
                        >
                          {#if levelImportance.icon}
                            <img
                              src={levelImportance.icon}
                              alt=""
                              class="kit-icon talent-priority-icon shrink-0"
                              loading="lazy"
                            />
                          {/if}
                          <div class="talent-priority-copy">
                            <div class="talent-priority-name">Level 90</div>
                            <UpgradeImpactPopover
                              label={levelImportance.priorityLabel}
                              tier={levelImportance.priority}
                              kind="level"
                              mean={levelImportance.mean}
                              median={levelImportance.median}
                              min={levelImportance.min}
                              max={levelImportance.max}
                              teams={levelImportance.teams}
                            />
                          </div>
                        </li>
                      </ul>
                    </section>
                  {/if}
                </div>

                <div class="invest-col">
                  {#if constellationRows.length}
                    <section class="board-section">
                      <h2 class="section-title">Constellation Impact</h2>
                      <ul class="talent-priority-list">
                        {#each constellationRows as row}
                          {@const constellation = kit.constellations.find(
                            (c) => c.index === row.cons,
                          )}
                          {@const icon = constellation
                            ? (iconUrl(constellation.icon, "talent") ??
                              getUiAssetUrl(constellation.icon))
                            : null}
                          <li
                            class="talent-priority-row"
                            data-priority={row.priority}
                          >
                            <span
                              class="talent-priority-rank"
                              style="color: {elColor};">C{row.cons}</span
                            >
                            {#if icon}
                              <img
                                src={icon}
                                alt=""
                                class="kit-icon talent-priority-icon shrink-0"
                                loading="lazy"
                              />
                            {/if}
                            <div class="talent-priority-copy">
                              <div class="talent-priority-name">
                                {constellation?.name ?? `C${row.cons}`}
                              </div>
                              <UpgradeImpactPopover
                                label={row.priorityLabel}
                                tier={row.priority}
                                kind="constellation"
                                mean={row.mean_pct_gain}
                                median={row.median_pct_gain}
                                min={row.min_pct_gain}
                                max={row.max_pct_gain}
                                teams={row.teams}
                              />
                            </div>
                          </li>
                        {/each}
                      </ul>
                    </section>
                  {/if}

                  {#if rankedSigWeapons.length}
                    <section class="board-section">
                      <h2 class="section-title">Signature weapon impact</h2>
                      <ul class="talent-priority-list">
                        {#each rankedSigWeapons as row}
                          <li
                            class="talent-priority-row"
                            data-priority={row.priority}
                          >
                            <span class="kit-icon talent-priority-icon shrink-0">
                              <WeaponIcon
                                weaponKey={row.key}
                                alt=""
                                class="h-full w-full object-contain"
                              />
                            </span>
                            <div class="talent-priority-copy">
                              <div class="talent-priority-name">
                                <WeaponName weaponKey={row.key} />
                              </div>
                              <UpgradeImpactPopover
                                label={row.priorityLabel}
                                tier={row.priority}
                                kind="signature"
                                mean={row.mean_pct_gain}
                                median={row.median_pct_gain}
                                min={row.min_pct_gain}
                                max={row.max_pct_gain}
                                teams={row.teams}
                              />
                            </div>
                          </li>
                        {/each}
                      </ul>
                    </section>
                  {/if}
                </div>
              </div>
            {/if}

            {#if builds.notes}
              <section class="board-section notes-section">
                <h2 class="section-title">Notes</h2>
                <p class="build-notes">{builds.notes}</p>
              </section>
            {/if}
          {:else}
            <div class="board-section">
              <EmptyState
                message={`No gcsim build summary for ${kit.name} yet.`}
              />
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </Surface>
</PageShell>

<style>
  .hero {
    border-bottom: var(--border-width) solid
      color-mix(
        in srgb,
        var(--hero-accent, var(--foreground-mid)) 35%,
        transparent
      );
  }

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
    border-radius: var(--radius-lg);
    overflow: hidden;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.4));
  }

  .hero-portrait :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-portrait :global(.icon-container-tcg img) {
    object-position: top center;
  }

  .hero-copy {
    position: relative;
    z-index: 1;
  }

  .hero-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  /* Mixed-case hero title — deliberately not the uppercase `.page-title`. */
  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 600;
    line-height: 1.15;
    color: var(--foreground-color);
  }

  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .section-title {
    margin-bottom: var(--space-3);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground-color);
  }

  .card-kicker,
  .const-index,
  .slot-label {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .const-index {
    font-weight: 600;
  }

  .slot-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .muted-note {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .teams-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .teams-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
  }

  .teams-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .teams-cost {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-hands {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  @media (min-width: 1024px) {
    .team-hands {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--space-6);
      row-gap: var(--space-5);
    }
  }

  .team-hand-row {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    min-width: 0;
  }

  .team-hand-row:hover,
  .team-hand-row:focus-within {
    z-index: 5;
  }

  .team-hand-row :global(.hand) {
    --card-width: min(7.25rem, 25%);
    width: 100%;
  }

  .team-hand-row :global(.hand-flat) {
    justify-content: flex-start;
    align-items: flex-end;
    padding: 0.35rem 0 0;
    overflow: hidden;
  }

  @media (min-width: 1024px) {
    .team-hand-row :global(.hand) {
      --card-width: min(6.5rem, 25%);
    }
  }

  .team-hand-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: var(--space-2) var(--space-3);
    min-height: 1.25rem;
    padding: 0;
  }

  .team-hand-meta {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-hand-rank {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }

  .team-hand-link {
    flex-shrink: 0;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
    cursor: pointer;
  }

  .team-hand-link:hover {
    text-decoration: underline;
  }

  .build-notes {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    line-height: 1.55;
    max-width: 42rem;
    white-space: pre-wrap;
  }

  .stat-name {
    color: var(--foreground-color);
    font-size: var(--text-xs);
  }

  .main-stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  /* One board: white hairlines, no nested Surfaces */
  :global(.char-board) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
    overflow: hidden;
  }

  :global(.char-board .board-tabs.sliding-tabs),
  :global(.char-board .sliding-tabs.board-tabs) {
    border: none;
    border-radius: 0;
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
  }

  .board-body {
    display: flex;
    flex-direction: column;
  }

  .board-section {
    padding: var(--space-4);
  }

  .invest-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .invest-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .invest-grid {
      grid-template-columns: 1fr 1fr;
    }

    .invest-col + .invest-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.1);
    }
  }

  .kit-list {
    display: flex;
    flex-direction: column;
  }

  .kit-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.85rem 0;
    scroll-margin-top: 5.5rem;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .kit-row + .kit-row {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .kit-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kit-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .equip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .equip-tile {
    width: 4.5rem;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .equip-icon-wrap {
    width: 4.5rem;
    height: 4.5rem;
    position: relative;
  }

  .equip-icon {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .equip-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0.25rem;
    text-align: center;
    font-size: 0.65rem;
    color: var(--foreground-mid);
  }

  .piece-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: flex-end;
    padding: 1rem 0.35rem 0.35rem;
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--background-color) 85%, transparent)
    );
    z-index: 10;
  }

  .piece-badge span {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }

  .main-stats {
    display: grid;
    gap: var(--space-3);
  }

  @media (min-width: 640px) {
    .main-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
    }

    .main-stat-col + .main-stat-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.14);
      padding-left: var(--space-3);
      margin-left: var(--space-3);
    }
  }

  .substat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat-chip {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0.55rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    cursor: pointer;
  }

  .stat-chip.is-main {
    border-color: rgba(255, 255, 255, 0.45);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .stat-chip-fallback {
    font-size: 0.65rem;
    padding: 0.15rem;
    text-align: center;
    line-height: 1.15;
    color: var(--foreground-mid);
  }

  .talent-priority-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .talent-priority-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0;
  }

  .talent-priority-row + .talent-priority-row {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .talent-priority-rank {
    font-size: 0.85rem;
    font-weight: 700;
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }

  .talent-priority-icon {
    width: 40px;
    height: 40px;
  }

  .talent-priority-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .talent-priority-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  /* Fills its parent chip unless a sized variant below overrides it. */
  .stat-icon {
    width: 100%;
    height: 100%;
  }

  .main-stat-icon {
    width: 0.95rem;
    height: 0.95rem;
  }

  .hero-meta-icon {
    width: 1.4rem;
    height: 1.4rem;
  }

  :global(.char-detail) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  :global(.char-detail.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }

  .kit-row-flash {
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    background: color-mix(in srgb, var(--kit-flash) 12%, transparent);
    box-shadow: inset 2px 0 0
      color-mix(in srgb, var(--kit-flash) 65%, transparent);
    animation: kit-target-flash 1.6s ease-out;
  }

  @keyframes kit-target-flash {
    0% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 0%, transparent);
    }
    35% {
      box-shadow: inset 3px 0 0
        color-mix(in srgb, var(--kit-flash) 80%, transparent);
    }
    100% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 65%, transparent);
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
