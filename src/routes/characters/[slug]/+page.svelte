<script lang="ts">
  import { onMount, untrack } from "svelte";
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
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import CostPopover from "$lib/ui/components/CostPopover.svelte";
  import UpgradeImpactPopover from "$lib/ui/components/UpgradeImpactPopover.svelte";
  import UsageSeriesChart from "$lib/ui/components/UsageSeriesChart.svelte";
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
  import { loadInvestment, getInvestmentCached } from "$lib/app/investment";
  import {
    fetchCharacterAnalytics,
    isAbortError,
    isTimeoutError,
  } from "$lib/app/character-analytics";
  import {
    artifactSlotIconUrl,
    buildGoodKeyMap,
    getUiAssetUrl,
    ownedGoodKeys,
    ownedNameIds,
    statIconUrl,
    getCrimsonWitchLinks,
    CRIMSON_WITCH_FAVICON_URL,
    simCharacterKey,
    translateStatKey,
    type CrimsonWitchLink,
  } from "$lib/utils";
  import {
    availableTravelerElements,
    defaultTravelerElement,
  } from "$lib/traveler-kits";
  import {
    artifactSetByKey,
    weaponByKey,
    equipmentVersion,
    ensureEquipmentData,
  } from "$lib/equipment-data";
  import {
    MAIN_STAT_SLOTS,
    buildExamples,
    characterBuildFromExample,
    constellationPrioritySection,
    ascensionPrioritySection,
    exampleFeaturedAndMates,
    exampleHasHighConfig,
    exampleRelevantGoodKeys,
    exampleTeamKeys,
    levelPrioritySection,
    rankWeaponsByRarityAndTeams,
    recommendedSubstatsFromBuilds,
    sigWeaponPrioritySection,
    talentPrioritySection,
  } from "$lib/character-builds";
  import { kitIconsFromCharacterKit } from "$lib/investment-build-card";
  import InvestmentBuildCard from "$lib/ui/components/InvestmentBuildCard.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconFileSearch from "$lib/ui/icons/IconFileSearch.svelte";
  import {
    artifactIconUrl,
    skillIconUrl,
    talentIconUrl,
  } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";
  import type { CharacterIndex, InvestmentFile } from "$lib/types/investment";
  import type {
    Character,
    CharacterAnalyticsMode,
    CharacterAnalyticsPayload,
  } from "$lib/definitions";
  import type { UpgradeTier } from "$lib/upgrade-priority";

  let { data } = $props();
  let kit = $derived(data.kit as CharacterKit);
  let kitChannel = $derived((data.kitChannel ?? "live") as "live" | "beta");
  let builds = $derived((data.builds ?? null) as CharacterIndex | null);
  let travelerKits = $derived(
    (data.travelerKits ?? {}) as Record<string, CharacterKit>,
  );
  let mapping = $derived(data.mapping as Map<string, Character>);

  type PageTab = "skills" | "builds" | "teams" | "analytics" | "links";
  type TeamsMode = "stygian" | "abyss" | "simulated";

  const TAB_OPTIONS = [
    { value: "builds" as const, label: "Builds" },
    { value: "teams" as const, label: "Teams" },
    { value: "analytics" as const, label: "Analytics" },
    { value: "skills" as const, label: "Kit" },
    { value: "links" as const, label: "Useful Links" },
  ];
  const TEAMS_MODE_OPTIONS = [
    { value: "stygian" as const, label: "Stygian" },
    { value: "abyss" as const, label: "Abyss" },
    { value: "simulated" as const, label: "Simulated" },
  ];
  const ANALYTICS_MODE_OPTIONS = [
    { value: "stygian" as const, label: "Stygian" },
    { value: "abyss" as const, label: "Abyss" },
  ];

  let activeTab = $state<PageTab>("builds");
  let mobileNavOpen = $state(false);
  let teamsMode = $state<TeamsMode>("stygian");
  let analyticsMode = $state<CharacterAnalyticsMode>("stygian");
  let skillsElement = $state("");
  let activeTabLabel = $derived(
    TAB_OPTIONS.find((option) => option.value === activeTab)?.label ?? "Builds",
  );

  function selectTab(tab: PageTab) {
    activeTab = tab;
    mobileNavOpen = false;
  }

  function handleTabKeydown(event: KeyboardEvent, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % TAB_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + TAB_OPTIONS.length) % TAB_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_OPTIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TAB_OPTIONS[nextIndex].value;
    // Leave the mobile rail open while arrowing so focus stays visible.
    activeTab = nextTab;
    requestAnimationFrame(() => {
      document.getElementById(`tab-${nextTab}`)?.focus();
    });
  }

  let travelerSkillElements = $derived(availableTravelerElements(travelerKits));
  let travelerSkillOptions = $derived(
    travelerSkillElements.map((element) => ({
      value: element,
      label: element,
    })),
  );

  /** Explicit pick when it still resolves, else the kit's own default. */
  let effectiveElement = $derived.by(() => {
    if (!kit.is_traveler) return "";
    if (skillsElement && travelerKits[skillsElement]) return skillsElement;
    return defaultTravelerElement(travelerKits, kit.element);
  });

  let skillsKit = $derived.by(() => {
    if (!kit.is_traveler) return kit;
    return travelerKits[effectiveElement] ?? kit;
  });
  let skillsElColor = $derived(
    elementColor(skillsKit.element, "var(--foreground-color)"),
  );

  let investment = $state<InvestmentFile | null>(getInvestmentCached());
  let investmentError = $state<string | null>(null);
  let investmentLoading = $state(false);
  let investmentInFlight: Promise<void> | null = null;

  let analyticsPayload = $state<CharacterAnalyticsPayload | null>(null);
  let analyticsError = $state<string | null>(null);
  let analyticsLoading = $state(false);
  let analyticsKey = $state<string | null>(null);
  let analyticsAbort: AbortController | null = null;

  $effect(() => {
    if (activeTab !== "teams") return;
    if (teamsMode === "simulated") {
      void ensureInvestment();
    } else {
      ensureStaticBoards().catch(() => {});
    }
  });

  $effect(() => {
    if (activeTab !== "analytics") return;
    const nameId = kit.name_id;
    const mode = analyticsMode;
    const key = `${mode}:${nameId}`;
    const cached = untrack(
      () => analyticsKey === key && analyticsPayload !== null,
    );
    if (cached) return;

    void loadAnalytics(nameId, mode, key);
    return () => {
      analyticsAbort?.abort();
    };
  });

  function loadAnalytics(
    nameId: string,
    mode: CharacterAnalyticsMode,
    key: string,
  ) {
    analyticsAbort?.abort();
    const controller = new AbortController();
    analyticsAbort = controller;

    analyticsLoading = true;
    analyticsError = null;
    analyticsPayload = null;

    return fetchCharacterAnalytics(nameId, mode, controller.signal)
      .then((payload) => {
        if (analyticsAbort !== controller) return;
        if (controller.signal.aborted) {
          analyticsLoading = false;
          return;
        }
        analyticsPayload = payload;
        analyticsKey = key;
        analyticsLoading = false;
      })
      .catch((err) => {
        if (analyticsAbort !== controller) return;
        if (controller.signal.aborted || isAbortError(err)) {
          analyticsLoading = false;
          return;
        }
        analyticsPayload = null;
        analyticsKey = null;
        analyticsLoading = false;
        analyticsError = isTimeoutError(err)
          ? "Request timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load analytics";
      });
  }

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

  let analyticsTeamsByVersion = $derived.by(() => {
    const payload = analyticsPayload;
    if (!payload) return [];
    const nameByVersion = new Map(
      payload.usage.map((p) => [p.version_number, p.version_name]),
    );
    const groups = new Map<number, typeof payload.teams>();
    for (const team of payload.teams) {
      const list = groups.get(team.version_number) ?? [];
      list.push(team);
      groups.set(team.version_number, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([version_number, teams]) => {
        const version_name =
          nameByVersion.get(version_number)?.trim() || `v${version_number}`;
        return {
          version_number,
          version_name,
          teams: teams
            .slice()
            .sort((a, b) => (b.usage_rate ?? 0) - (a.usage_rate ?? 0)),
        };
      });
  });

  let goodKey = $derived(simCharacterKey(kit));
  let crimsonWitchLinks = $derived(
    getCrimsonWitchLinks(kit.name, {
      isTraveler: kit.is_traveler,
      element: kit.element,
    }),
  );
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
      : !$staticBoardsError &&
          !$staticBoardsLoaded &&
          popularTeams.length === 0,
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

  async function retryAnalytics() {
    const nameId = kit.name_id;
    const mode = analyticsMode;
    const key = `${mode}:${nameId}`;
    await loadAnalytics(nameId, mode, key);
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
  // Kit asset stem, not name_id: an elemental Traveler kit (`PlayerBoy-Anemo`)
  // still resolves `UI_NameCardPic_PlayerBoy_P` rather than a missing suffix key.
  let namecard = $derived(getUiAssetUrl(kit.assets.namecard));

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

  function passiveKindLabel(
    passive: (typeof skillsKit.passives)[number],
  ): string {
    if (passive.kind === "hexerei") return "Hexerei";
    if (passive.kind === "polestar") return "Polestar Field";
    return passiveUnlockLabel(passive.unlock);
  }

  /**
   * Trailing Hexerei / Polestar Field section. Polar Excel rows often rewrite
   * a sentence or two before this heading, so `startsWith(base)` fails and
   * we'd otherwise replace the whole talent instead of appending.
   * Kit JSON stores Hoyoverse `\\n` as two characters, not a real newline.
   */
  const ENHANCE_TAIL = new RegExp(
    "((?:\\\\n|\\r\\n|\\n|\\r)+((?:<color=[^>]+>)?(?:Hexerei|Radiance:\\s*Stellar-Conduct|Polestar Field)\\b[\\s\\S]*))$",
    "i",
  );

  /**
   * Enhanced Excel text usually prepends the base desc then appends buff text.
   * Return only the new suffix when that's the case; otherwise the full rewrite.
   * Keep the leading `\\n` on extras — that's the linebreak between base and buff.
   */
  function enhanceExtra(
    base: string,
    enhanced: string | undefined,
  ): { mode: "extra" | "replace"; text: string } | null {
    if (!enhanced || enhanced === base) return null;
    if (enhanced.startsWith(base)) {
      const extra = enhanced.slice(base.length).replace(/^(\r\n|\n|\r)+/, "");
      return extra ? { mode: "extra", text: extra } : null;
    }
    const tail = enhanced.match(ENHANCE_TAIL);
    if (tail?.[1]) return { mode: "extra", text: tail[1] };
    return { mode: "replace", text: enhanced };
  }

  function iconUrl(icon: string, kind: "skill" | "talent"): string | null {
    return kind === "skill" ? skillIconUrl(icon) : talentIconUrl(icon);
  }

  /** In-page targets for `{LINK#S…}` / `P…` / `T…` (skills / passives / consts). */
  let kitLinkIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const s of skillsKit.skills) ids.add(`S${s.id}`);
    for (const p of skillsKit.passives) ids.add(`P${p.id}`);
    for (const c of skillsKit.constellations) ids.add(`T${c.id}`);
    return ids;
  });

  function resolveKitLink(ref: string): string | null {
    return kitLinkIds.has(ref) ? `#kit-${ref}` : null;
  }

  /** Weapons: rarity → BT strength → teams → measured sigs → name. */
  let rankedWeapons = $derived.by(() => {
    $equipmentVersion;
    return rankWeaponsByRarityAndTeams(
      builds?.weapons,
      (key) => weaponByKey.get(key)?.stars ?? 0,
      builds?.vertical_importance?.sig_weapons?.map((s) => s.key),
    );
  });

  let recommendedSubstats = $derived(recommendedSubstatsFromBuilds(builds));

  let talentSection = $derived(
    talentPrioritySection(builds, (kitType) => {
      const skill = kit.skills.find((s) => s.type === kitType);
      if (!skill) return null;
      return iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon);
    }),
  );

  let levelSection = $derived(levelPrioritySection(builds));
  let ascensionSection = $derived(ascensionPrioritySection(builds));
  let levelIcon = $derived(getUiAssetUrl("UI_ItemIcon_104003"));
  let ascensionIcon = $derived(getUiAssetUrl("UI_ItemIcon_104003"));

  let consSection = $derived(constellationPrioritySection(builds));
  let sigSection = $derived(sigWeaponPrioritySection(builds));
  let exampleBuilds = $derived(buildExamples(builds));
  /** User pick among diversified examples; empty → highest-DPS default. */
  let examplePick = $state("");
  let exampleMenuOpen = $state(false);
  let activeExample = $derived.by(() => {
    const list = exampleBuilds;
    if (!list.length) return null;
    return list.find((e) => e.state_key === examplePick) ?? list[0] ?? null;
  });
  let exampleAlts = $derived(
    exampleBuilds.filter((e) => e.state_key !== activeExample?.state_key),
  );
  let exampleCardBuild = $derived.by(() => {
    if (!activeExample) return null;
    const tier = exampleHasHighConfig(activeExample)
      ? ("high" as const)
      : ("mid" as const);
    return characterBuildFromExample(activeExample, tier);
  });
  let exampleCardRelevantKeys = $derived.by(() => {
    if (!activeExample) return null;
    const tier = exampleHasHighConfig(activeExample)
      ? ("high" as const)
      : ("mid" as const);
    return exampleRelevantGoodKeys(activeExample, tier);
  });
  let exampleCardKit = $derived(kitIconsFromCharacterKit(kit));
  let exampleCardCharacter = $derived(goodKeyMap.get(goodKey) ?? null);
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

{#snippet guideLinkList(links: CrimsonWitchLink[])}
  <ul class="useful-links">
    {#each links as link (link.url)}
      <li>
        <a
          class="useful-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            class="useful-link-icon"
            src={CRIMSON_WITCH_FAVICON_URL}
            alt=""
            width="40"
            height="40"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span class="useful-link-copy">
            <span class="useful-link-label">Crimson Witch</span>
            <span class="useful-link-desc">{link.label} build guide</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet talentRow(row: {
  name: string;
  icon: string | null;
  rank?: number;
  priority?: UpgradeTier;
  kind?: "talent" | "level";
  priorityLabel?: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  <li class="talent-priority-row" data-priority={row.priority}>
    {#if row.rank != null}
      <span class="talent-priority-rank" style="color: {elColor};"
        >{row.rank}</span
      >
    {/if}
    {#if row.icon}
      <img
        src={row.icon}
        alt=""
        class="kit-icon talent-priority-icon shrink-0"
        loading="lazy"
      />
    {/if}
    <div class="talent-priority-copy">
      <div class="talent-priority-name">{row.name}</div>
      {#if row.kind != null && row.priority != null && row.priorityLabel != null}
        <UpgradeImpactPopover
          label={row.priorityLabel}
          tier={row.priority}
          kind={row.kind}
          mean={row.mean}
          median={row.median}
          min={row.min}
          max={row.max}
          teams={row.teams}
        />
      {/if}
    </div>
  </li>
{/snippet}

{#snippet consRow(row: {
  cons: number;
  priority: UpgradeTier;
  priorityLabel: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  {@const constellation = kit.constellations.find((c) => c.index === row.cons)}
  {@const icon = constellation
    ? (iconUrl(constellation.icon, "talent") ??
      getUiAssetUrl(constellation.icon))
    : null}
  <li class="talent-priority-row" data-priority={row.priority}>
    <span class="talent-priority-rank" style="color: {elColor};"
      >C{row.cons}</span
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
        mean={row.mean}
        median={row.median}
        min={row.min}
        max={row.max}
        teams={row.teams}
      />
    </div>
  </li>
{/snippet}

{#snippet sigRow(row: {
  key: string;
  priority: UpgradeTier;
  priorityLabel: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  <li class="talent-priority-row" data-priority={row.priority}>
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
        mean={row.mean}
        median={row.median}
        min={row.min}
        max={row.max}
        teams={row.teams}
      />
    </div>
  </li>
{/snippet}

<PageShell class="char-detail {$animationsEnabled ? '' : 'no-page-anim'}">
  <div
    class="char-page"
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
          <div class="hero-name-block">
            <PageTrail
              class="hero-trail"
              items={[
                { label: "Characters", href: "/characters" },
                { label: kit.name },
              ]}
            />
            <div class="hero-title-row">
              <h1 class="hero-title">{kit.name}</h1>
              {#if kitChannel === "beta"}
                <span class="hero-beta-badge">BETA</span>
              {/if}
            </div>
          </div>
          <p class="hero-eyebrow" style="color: {elColor};">
            {kit.title || "Character"}
          </p>
        </div>
      </div>
    </section>

    <div class="character-content-shell" class:mobile-open={mobileNavOpen}>
      <button
        type="button"
        class="ledger-mobile-trigger"
        aria-expanded={mobileNavOpen}
        aria-controls="character-section-index"
        onclick={() => (mobileNavOpen = !mobileNavOpen)}
      >
        <span>
          <small>Section</small>
          <strong>{activeTabLabel}</strong>
        </span>
        <span class="ledger-trigger-mark" aria-hidden="true"></span>
      </button>

      <div
        class="ledger-rail"
        id="character-section-index"
        role="tablist"
        aria-label="Character sections"
        style:--section-count={TAB_OPTIONS.length}
        style:--section-rows={Math.ceil(TAB_OPTIONS.length / 2)}
      >
        {#each TAB_OPTIONS as option, index (option.value)}
          <button
            type="button"
            role="tab"
            id="tab-{option.value}"
            aria-selected={activeTab === option.value}
            aria-controls={activeTab === option.value
              ? `tabpanel-${option.value}`
              : undefined}
            tabindex={activeTab === option.value ? 0 : -1}
            class:active={activeTab === option.value}
            onclick={() => selectTab(option.value)}
            onkeydown={(event) => handleTabKeydown(event, index)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <div class="board-body">
        {#if activeTab === "skills"}
          <div
            role="tabpanel"
            id="tabpanel-skills"
            aria-labelledby="tab-skills"
            tabindex="0"
          >
            {#if kit.is_traveler && travelerSkillOptions.length > 0}
              <section class="board-section">
                <div class="skills-head">
                  <div class="skills-label">
                    <span class="skills-label-text" id="skills-element-label"
                      >Element:</span
                    >
                    <Select
                      id="skills-element-trigger"
                      options={travelerSkillOptions}
                      bind:value={
                        () => effectiveElement, (next) => (skillsElement = next)
                      }
                      bare
                      aria-labelledby="skills-element-label skills-element-trigger"
                    />
                  </div>
                </div>
              </section>
            {/if}
            <section class="board-section">
              <h2 class="section-title">Talents</h2>
              <div class="kit-list">
                {#each skillsKit.skills as skill (skill.id)}
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
                      {@render descriptionBlock(
                        skill.description,
                        skillEnhance,
                      )}
                    </div>
                  </article>
                {/each}
              </div>
            </section>

            <section class="board-section">
              <h2 class="section-title">Passives</h2>
              <div class="kit-list">
                {#each skillsKit.passives as passive (passive.id)}
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
                {#each skillsKit.constellations as c (c.id)}
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
                        <span
                          class="const-index"
                          style="color: {skillsElColor};"
                        >
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
            tabindex="0"
          >
            <section class="board-section">
              <div class="teams-head">
                <div class="teams-label">
                  <span class="teams-label-text" id="teams-source-label"
                    >Teams:</span
                  >
                  <Select
                    id="teams-source-trigger"
                    options={TEAMS_MODE_OPTIONS}
                    bind:value={teamsMode}
                    bare
                    aria-labelledby="teams-source-label teams-source-trigger"
                  />
                </div>
                {#if teamsMode === "simulated"}
                  <span class="teams-cost"
                    >{CHARACTER_SIM_COST} <CostPopover /></span
                  >
                {/if}
              </div>

              {#if teamsMode === "simulated"}
                {#if teamsLoading}
                  <LoadingState
                    variant="pulse"
                    message="Loading simulated teams…"
                  />
                {:else if investmentError && simulatedTeams.length === 0}
                  <EmptyState
                    message="Could not load simulated teams right now."
                  >
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
                <LoadingState variant="pulse" message="Loading meta teams…" />
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
                          <span>{(team.usage_rate ?? 0).toFixed(1)}% usage</span
                          >
                        </span>
                      </div>
                    </li>
                  {/each}
                </ol>
              {/if}
            </section>
          </div>
        {:else if activeTab === "analytics"}
          <div
            role="tabpanel"
            id="tabpanel-analytics"
            aria-labelledby="tab-analytics"
            tabindex="0"
          >
            <section class="board-section">
              <div class="teams-head">
                <div class="teams-label">
                  <span class="teams-label-text" id="analytics-mode-label"
                    >Usage:</span
                  >
                  <Select
                    id="analytics-mode-trigger"
                    options={ANALYTICS_MODE_OPTIONS}
                    bind:value={analyticsMode}
                    bare
                    aria-labelledby="analytics-mode-label analytics-mode-trigger"
                  />
                </div>
              </div>

              {#if analyticsError && !analyticsPayload}
                <EmptyState message="Could not load usage history right now.">
                  {#snippet action()}
                    <Button variant="secondary" onclick={retryAnalytics}
                      >Try again</Button
                    >
                  {/snippet}
                </EmptyState>
              {:else if analyticsPayload && analyticsKey === `${analyticsMode}:${kit.name_id}`}
                {#if analyticsPayload.usage.length === 0}
                  <EmptyState message="No usage history for {kit.name} yet." />
                {:else}
                  <div class="analytics-chart">
                    <UsageSeriesChart points={analyticsPayload.usage} />
                  </div>
                  {#if analyticsTeamsByVersion.length > 0}
                    <div class="analytics-teams">
                      <h2 class="section-title">Top teams by version</h2>
                      {#each analyticsTeamsByVersion as group (group.version_number)}
                        <section class="analytics-version">
                          <h3 class="meta-name">{group.version_name}</h3>
                          <ol class="team-hands">
                            {#each group.teams as team, i (team.team_key ?? `${group.version_number}-${i}`)}
                              <li class="team-hand-row">
                                <TeamCardHand
                                  characters={handCharactersFromMembers(
                                    team.members ?? [],
                                  )}
                                  dimmedKeys={dimmedKeysFromMembers(
                                    team.members ?? [],
                                  )}
                                  spread="flat"
                                />
                                <div class="team-hand-footer">
                                  <span class="team-hand-meta">
                                    <span class="team-hand-rank">#{i + 1}</span>
                                    <span
                                      >{(team.usage_rate ?? 0).toFixed(1)}%
                                      usage</span
                                    >
                                  </span>
                                </div>
                              </li>
                            {/each}
                          </ol>
                        </section>
                      {/each}
                    </div>
                  {/if}
                {/if}
              {:else}
                <LoadingState
                  variant="pulse"
                  message="Loading usage history…"
                />
              {/if}
            </section>
          </div>
        {:else if activeTab === "links"}
          <div
            role="tabpanel"
            id="tabpanel-links"
            aria-labelledby="tab-links"
            tabindex="0"
          >
            <section class="board-section">
              <h2 class="section-title">Useful links</h2>
              {#if crimsonWitchLinks.length === 0}
                <p class="muted-note">No external guides yet.</p>
              {:else}
                {@render guideLinkList(crimsonWitchLinks)}
              {/if}
            </section>
          </div>
        {:else}
          <div
            role="tabpanel"
            id="tabpanel-builds"
            aria-labelledby="tab-builds"
            tabindex="0"
          >
            {#if builds}
              <section class="board-section">
                <h2 class="section-title">Weapons</h2>
                {#if rankedWeapons.length === 0}
                  <p class="muted-note">No weapon data yet.</p>
                {:else}
                  <div class="equip-grid">
                    {#each rankedWeapons as w (w.key)}
                      <div class="equip-tile relative group">
                        <div class="equip-icon-wrap">
                          <WeaponIcon weaponKey={w.key} class="equip-icon" />
                        </div>
                        <WeaponTooltip weaponKey={w.key} />
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
                                <span style="color: {elColor};"
                                  >{s.count}pc</span
                                >
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
                        style={roll.matchesMain
                          ? `border-color: ${elColor}`
                          : undefined}
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

              {#if talentSection || levelSection || consSection || sigSection}
                <div class="invest-grid">
                  <div class="invest-col">
                    {#if talentSection}
                      <section class="board-section">
                        <h2 class="section-title">
                          Talent priority
                          {#if talentSection.source === "guide" && talentSection.simMissing}
                            <span class="meta-sub"
                              >(no simulation data yet)</span
                            >
                          {/if}
                        </h2>
                        <ul class="talent-priority-list">
                          {#if talentSection.source === "sim"}
                            {#each talentSection.rows as row, i}
                              {@render talentRow({
                                name: row.label,
                                icon: row.icon,
                                rank: i + 1,
                                priority: row.priority,
                                kind: "talent",
                                priorityLabel: row.priorityLabel,
                                mean: row.mean,
                                median: row.median,
                                min: row.min,
                                max: row.max,
                                teams: row.teams,
                              })}
                            {/each}
                          {:else}
                            {#each talentSection.rows as row, i}
                              {@render talentRow({
                                name: row.label,
                                icon: row.icon,
                                rank: i + 1,
                              })}
                            {/each}
                          {/if}
                        </ul>
                      </section>
                    {/if}

                    {#if levelSection || ascensionSection}
                      <section class="board-section">
                        <h2 class="section-title">
                          Character level
                          {#if levelSection?.source === "guide" && levelSection.simMissing && !ascensionSection}
                            <span class="meta-sub"
                              >(no simulation data yet)</span
                            >
                          {/if}
                        </h2>
                        <ul class="talent-priority-list">
                          {#if levelSection}
                            {#if levelSection.source === "sim"}
                              {@render talentRow({
                                name: "Level 90",
                                icon: levelIcon,
                                priority: levelSection.row.priority,
                                kind: "level",
                                priorityLabel: levelSection.row.priorityLabel,
                                mean: levelSection.row.mean,
                                median: levelSection.row.median,
                                min: levelSection.row.min,
                                max: levelSection.row.max,
                                teams: levelSection.row.teams,
                              })}
                            {:else}
                              {@render talentRow({
                                name: "Level 90",
                                icon: levelIcon,
                                priority: levelSection.priority,
                                kind: "level",
                                priorityLabel: levelSection.priorityLabel,
                              })}
                            {/if}
                          {/if}
                          {#if ascensionSection?.source === "sim"}
                            {@render talentRow({
                              name: "Ascension 6",
                              icon: ascensionIcon,
                              priority: ascensionSection.row.priority,
                              kind: "level",
                              priorityLabel: ascensionSection.row.priorityLabel,
                              mean: ascensionSection.row.mean,
                              median: ascensionSection.row.median,
                              min: ascensionSection.row.min,
                              max: ascensionSection.row.max,
                              teams: ascensionSection.row.teams,
                            })}
                          {/if}
                        </ul>
                      </section>
                    {/if}
                  </div>

                  <div class="invest-col">
                    {#if consSection}
                      <section class="board-section">
                        <h2 class="section-title">
                          Constellation Impact
                          {#if consSection.source === "guide" && consSection.simMissing}
                            <span class="meta-sub"
                              >(no simulation data yet)</span
                            >
                          {/if}
                        </h2>
                        <ul class="talent-priority-list">
                          {#if consSection.source === "sim"}
                            {#each consSection.rows as row}
                              {@render consRow({
                                cons: row.cons,
                                priority: row.priority,
                                priorityLabel: row.priorityLabel,
                                mean: row.mean_pct_gain,
                                median: row.median_pct_gain,
                                min: row.min_pct_gain,
                                max: row.max_pct_gain,
                                teams: row.teams,
                              })}
                            {/each}
                          {:else}
                            {#each consSection.rows as row}
                              {@render consRow(row)}
                            {/each}
                          {/if}
                        </ul>
                      </section>
                    {/if}

                    {#if sigSection}
                      <section class="board-section">
                        <h2 class="section-title">
                          Signature weapon impact
                          {#if sigSection.source === "guide" && sigSection.simMissing}
                            <span class="meta-sub"
                              >(no simulation data yet)</span
                            >
                          {/if}
                        </h2>
                        <ul class="talent-priority-list">
                          {#if sigSection.source === "sim"}
                            {#each sigSection.rows as row}
                              {@render sigRow({
                                key: row.key,
                                priority: row.priority,
                                priorityLabel: row.priorityLabel,
                                mean: row.mean_pct_gain,
                                median: row.median_pct_gain,
                                min: row.min_pct_gain,
                                max: row.max_pct_gain,
                                teams: row.teams,
                              })}
                            {/each}
                          {:else}
                            {#each sigSection.rows as row}
                              {@render sigRow(row)}
                            {/each}
                          {/if}
                        </ul>
                      </section>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if activeExample}
                {@const activeSplit = exampleFeaturedAndMates(
                  exampleTeamKeys(activeExample),
                  goodKey,
                )}
                <section class="board-section">
                  <h2 class="section-title">Stat goals</h2>
                  <p class="section-lede">
                    DPS stat goals assume very high artifact investment. A lot
                    of supports only care about ER (and Crit Rate if running a
                    Favonius weapon)
                  </p>
                  <div class="example-build pt-4">
                    <div class="example-build-context">
                      <div class="example-picker-primary">
                        <div class="example-picker-main">
                          <div
                            class="example-picker-grid example-picker-grid--selected"
                            role="group"
                            aria-label="Selected team"
                          >
                            <div
                              class="example-picker-slot example-picker-slot--featured"
                            >
                              {#if activeSplit.featured}
                                {@const featured = goodKeyMap.get(
                                  activeSplit.featured,
                                )}
                                {#if featured}
                                  <CharacterIcon
                                    character={featured}
                                    iconStyle="tcg"
                                    loading="lazy"
                                  />
                                {/if}
                              {/if}
                            </div>
                            {#each activeSplit.mates as mateKey, i (mateKey ?? `active-empty-${i}`)}
                              <div class="example-picker-slot">
                                {#if mateKey}
                                  {@const mate = goodKeyMap.get(mateKey)}
                                  {#if mate}
                                    <CharacterIcon
                                      character={mate}
                                      iconStyle="tcg"
                                      loading="lazy"
                                    />
                                  {/if}
                                {/if}
                              </div>
                            {/each}
                          </div>

                          {#if exampleAlts.length > 0}
                            <div
                              class="example-picker-alts-shell"
                              class:open={exampleMenuOpen}
                              id="example-picker-alts"
                              style="--alt-count: {exampleAlts.length}"
                              aria-hidden={!exampleMenuOpen}
                            >
                              <div class="example-picker-alts-clip">
                                <ol class="example-picker-alts">
                                  {#each exampleAlts as example, ti (example.state_key)}
                                    {@const split = exampleFeaturedAndMates(
                                      exampleTeamKeys(example),
                                      goodKey,
                                    )}
                                    <li
                                      class="example-picker-alt-wrap"
                                      style="--i: {ti}"
                                    >
                                      <button
                                        type="button"
                                        class="example-picker-alt"
                                        aria-label={`Select ${example.team_name}`}
                                        tabindex={exampleMenuOpen ? 0 : -1}
                                        onclick={() => {
                                          examplePick = example.state_key;
                                          exampleMenuOpen = false;
                                        }}
                                      >
                                        <div class="example-picker-grid">
                                          <div
                                            class="example-picker-slot example-picker-slot--spacer"
                                            aria-hidden="true"
                                          ></div>
                                          <div class="example-picker-mate-row">
                                            {#each split.mates as mateKey, i (mateKey ?? `alt-${example.state_key}-${i}`)}
                                              <div class="example-picker-slot">
                                                {#if mateKey}
                                                  {@const mate =
                                                    goodKeyMap.get(mateKey)}
                                                  {#if mate}
                                                    <CharacterIcon
                                                      character={mate}
                                                      iconStyle="tcg"
                                                      loading="lazy"
                                                    />
                                                  {/if}
                                                {/if}
                                              </div>
                                            {/each}
                                          </div>
                                        </div>
                                      </button>
                                    </li>
                                  {/each}
                                </ol>
                              </div>
                            </div>
                          {/if}
                        </div>
                        <div class="example-picker-actions">
                          <a
                            class="example-picker-action"
                            href="/teams/{activeExample.team_key}"
                            aria-label="View team details"
                            title="View team details"
                          >
                            <IconFileSearch size={18} />
                          </a>
                          {#if exampleAlts.length > 0}
                            <button
                              type="button"
                              class="example-picker-action"
                              class:open={exampleMenuOpen}
                              aria-expanded={exampleMenuOpen}
                              aria-controls="example-picker-alts"
                              aria-label={exampleMenuOpen
                                ? "Hide other example teams"
                                : "Show other example teams"}
                              onclick={() =>
                                (exampleMenuOpen = !exampleMenuOpen)}
                            >
                              <IconCog size={18} />
                            </button>
                          {/if}
                        </div>
                      </div>
                    </div>

                    {#if exampleCardBuild}
                      <InvestmentBuildCard
                        build={exampleCardBuild}
                        character={exampleCardCharacter}
                        kit={exampleCardKit}
                        relevantKeys={exampleCardRelevantKeys}
                        class="example-build-card"
                      />
                    {/if}
                  </div>
                </section>
              {/if}

              {#if builds.notes}
                <section class="board-section notes-section">
                  <h2 class="section-title">Notes</h2>
                  <p class="build-notes">{builds.notes}</p>
                </section>
              {/if}
            {:else}
              <section class="board-section">
                <p class="muted-note builds-empty-msg">
                  No Lightkeepers build summary for {kit.name} yet.
                </p>
                {#if crimsonWitchLinks.length === 1 && crimsonWitchLinks[0]}
                  <a
                    class="useful-link-cta"
                    href={crimsonWitchLinks[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      class="useful-link-icon"
                      src={CRIMSON_WITCH_FAVICON_URL}
                      alt=""
                      width="32"
                      height="32"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                    />
                    Crimson Witch build guide
                  </a>
                {:else if crimsonWitchLinks.length > 1}
                  {@render guideLinkList(crimsonWitchLinks)}
                {/if}
              </section>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</PageShell>

<style>
  .char-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hero {
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
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

  .hero-name-block {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .hero-copy :global(.hero-trail .back-link) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .hero-copy :global(.hero-trail .back-link:hover) {
    color: var(--accent-1);
  }

  .hero-copy :global(.hero-trail .trail-current) {
    color: var(--foreground-color);
  }

  .hero-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  /* Mixed-case hero title — deliberately not the uppercase `.page-title`. */
  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 600;
    line-height: 1.05;
    color: var(--foreground-color);
  }

  .hero-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem 0.75rem;
  }

  .hero-beta-badge {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 14%, transparent);
    color: var(--foreground-color);
    border: 1px solid
      color-mix(in srgb, var(--foreground-color) 32%, transparent);
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

  .skills-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skills-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .skills-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .useful-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .builds-empty-msg {
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }

  .useful-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0.85rem 0;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 18%, transparent);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 18%, transparent);
    color: var(--foreground-color);
    text-decoration: none;
    transition: background-color 0.15s ease;
  }

  .useful-link-icon {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  .useful-link:hover {
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .useful-link:hover .useful-link-label {
    color: var(--accent-1);
  }

  .useful-link-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .useful-link-label {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .useful-link-desc {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .useful-link-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent-1);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .useful-link-cta .useful-link-icon {
    width: 2rem;
    height: 2rem;
  }

  .useful-link-cta:hover {
    color: color-mix(in srgb, var(--accent-1) 85%, white);
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

  .analytics-chart {
    margin-top: var(--space-2);
  }

  .analytics-teams {
    margin-top: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .analytics-version {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .example-build {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    column-gap: var(--space-5);
    row-gap: var(--space-4);
    align-items: start;
  }

  .example-build-context {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .example-build :global(.example-build-card) {
    min-width: 0;
  }

  .example-build :global(.example-build-card .build-grid) {
    min-height: 16.5rem;
  }

  .example-build :global(.example-build-card .build-art--portrait) {
    width: 10rem;
  }

  .example-build :global(.example-build-card .build-art--enka) {
    width: 9.25rem;
  }

  @media (max-width: 640px) {
    .example-build :global(.example-build-card .build-grid) {
      min-height: 14rem;
    }

    .example-build :global(.example-build-card .build-art--portrait) {
      width: 7rem;
    }

    .example-build :global(.example-build-card .build-art--enka) {
      width: 6.5rem;
    }
  }

  .example-picker-primary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 0.5rem;
    align-items: start;
  }

  @media (max-width: 840px) {
    .example-build {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .example-picker-main {
    display: contents;
  }

  .example-picker-grid--selected {
    grid-column: 1;
    grid-row: 1;
  }

  .example-picker-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.3rem;
    width: 100%;
  }

  .example-picker-slot {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: var(--background-mid);
  }

  .example-picker-slot--featured {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 55%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .example-picker-slot--spacer {
    visibility: hidden;
    border: none;
    background: transparent;
  }

  .example-picker-actions {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .example-picker-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    text-decoration: none;
    transition:
      color 280ms ease,
      border-color 280ms ease;
  }

  .example-picker-action :global(svg) {
    transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: center;
  }

  .example-picker-action:hover,
  .example-picker-action.open {
    color: var(--accent-1);
    border-color: color-mix(
      in srgb,
      var(--accent-1) 45%,
      rgba(255, 255, 255, 0.14)
    );
  }

  .example-picker-action.open :global(svg) {
    transform: rotate(90deg);
  }

  .example-picker-alts-shell {
    grid-column: 1;
    grid-row: 2;
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .example-picker-alts-shell.open {
    grid-template-rows: 1fr;
  }

  .example-picker-alts-clip {
    overflow: hidden;
    min-height: 0;
  }

  .example-picker-alts {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
    padding: 0.45rem 0 0.15rem;
    list-style: none;
  }

  .example-picker-alt-wrap {
    transform: translateY(-0.65rem);
    opacity: 0.25;
    transition:
      transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 420ms ease;
    transition-delay: calc((var(--alt-count, 1) - 1 - var(--i, 0)) * 45ms);
  }

  .example-picker-alts-shell.open .example-picker-alt-wrap {
    transform: translateY(0);
    opacity: 1;
    transition-delay: calc(var(--i, 0) * 55ms);
  }

  .example-picker-alt {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .example-picker-mate-row {
    grid-column: 2 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
    padding: 0.28rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.16);
    background: color-mix(in srgb, var(--background-mid) 88%, transparent);
  }

  .example-picker-alt:hover .example-picker-mate-row,
  .example-picker-alt:focus-visible .example-picker-mate-row {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      rgba(255, 255, 255, 0.2)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .example-picker-action :global(svg),
    .example-picker-alts-shell,
    .example-picker-alt-wrap {
      transition: none;
    }
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

  /* Outlined open frame — hairlines imply a board; complete it without a fill. */
  .character-content-shell {
    display: grid;
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
    overflow: hidden;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-lg);
  }

  .ledger-mobile-trigger {
    display: none;
  }

  .ledger-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .ledger-rail button {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 2.8rem;
    padding: 0.65rem var(--space-3);
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.1);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    text-align: left;
    transition: var(--control-transition);
  }

  .ledger-rail button::before {
    position: absolute;
    inset-block: 0;
    left: 0;
    width: 2px;
    background: transparent;
    content: "";
  }

  .ledger-rail button:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .ledger-rail button.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
  }

  .ledger-rail button.active::before {
    background: var(--hero-accent, var(--accent-1));
  }

  .board-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Panels are focus targets (tabindex="0"), and the global ring only covers
     buttons and links. */
  .board-body [role="tabpanel"]:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
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

  @media (max-width: 640px) {
    .character-content-shell {
      display: block;
    }

    .ledger-mobile-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 3.6rem;
      padding: 0.65rem var(--space-4);
      border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
      color: var(--foreground-color);
      text-align: left;
      background: var(--surface-selected);
    }

    .ledger-mobile-trigger > span:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .ledger-mobile-trigger small {
      color: var(--foreground-mid);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ledger-mobile-trigger strong {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
    }

    .ledger-trigger-mark {
      position: relative;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border: var(--border-width) solid rgba(255, 255, 255, 0.22);
      border-radius: var(--radius-pill);
      color: var(--hero-accent, var(--accent-1));
    }

    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      position: absolute;
      width: 0.65rem;
      height: 1px;
      background: currentColor;
      content: "";
      transition: transform var(--control-duration) var(--control-ease);
    }

    .ledger-trigger-mark::after {
      transform: rotate(90deg);
    }

    .character-content-shell.mobile-open .ledger-trigger-mark::after {
      transform: rotate(90deg) scaleX(0);
    }

    .ledger-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      max-height: 0;
      overflow: hidden;
      border-right: 0;
      border-bottom: var(--border-width) solid transparent;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-0.35rem);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s linear 260ms;
    }

    .character-content-shell.mobile-open .ledger-rail {
      /* Two-column grid on mobile, so height follows rows, not section count. */
      max-height: calc(var(--section-rows) * 2.8rem);
      border-bottom-color: rgba(255, 255, 255, 0.14);
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s;
    }

    .ledger-rail button:nth-child(even) {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.1);
    }
  }

  /* Both overrides must out-specify `.character-content-shell.mobile-open
     .ledger-rail`, which sets its own transition shorthand. */
  :global(.char-detail.no-page-anim) .character-content-shell .ledger-rail,
  :global(.char-detail.no-page-anim)
    .character-content-shell.mobile-open
    .ledger-rail,
  :global(.char-detail.no-page-anim) .ledger-trigger-mark::before,
  :global(.char-detail.no-page-anim) .ledger-trigger-mark::after {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .character-content-shell .ledger-rail,
    .character-content-shell.mobile-open .ledger-rail,
    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      transition: none;
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
