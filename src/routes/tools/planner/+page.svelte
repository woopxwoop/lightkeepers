<script lang="ts">
  import { browser } from "$app/environment";
  import { authClient } from "$lib/auth-client";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import PickModal from "$lib/ui/components/PickModal.svelte";
  import NumberSliderField from "$lib/ui/components/NumberSliderField.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import { loadCharacterSummary } from "$lib/app/character-summary";
  import { plannerTargetFromBuilds } from "$lib/planner-targets";
  import { assetUrl } from "$lib/asset-urls";
  import { getCharacterPortrait, toGoodKey } from "$lib/utils";
  import { charactersOwned } from "$lib/stores";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import {
    diffCharacterUpgrade,
    diffWeaponUpgrade,
    expItemsNeeded,
    gateCharacterConfig,
    gateWeaponConfig,
    maxLevelForAscension,
    maxTalentForAscension,
    minLevelForAscension,
  } from "$lib/upgrade-costs";
  import {
    addCharacterResult,
    addWeaponResult,
    appendGoal,
    applyCloudGoals,
    createCharacterGoal,
    createWeaponGoal,
    emptyAggregate,
    emptyGoalsState,
    findGoal,
    parseGoalsState,
    removeGoal,
    replaceGoal,
  } from "$lib/calculator-goals";
  import {
    captureGoals,
    fetchGoalsCloud,
    goalsDiffersFromSnapshot,
    persistGoalsLocal,
    postGoals,
    readGoalsLocal,
    writeGoalsLocal,
    type GoalsCapture,
  } from "$lib/calculator-goals-snapshot";
  import type {
    AggregatedUpgradeCosts,
    CalculatorGoal,
    CalculatorGoalsState,
  } from "$lib/types/calculator-goals";
  import type {
    UpgradeCostsCatalog,
    UpgradePromoteStep,
  } from "$lib/types/upgrade-costs";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";

  type CostScope = "all" | "selected";

  let catalog = $state<UpgradeCostsCatalog | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(true);
  let goalsHydrated = $state(false);

  let goalsState = $state<CalculatorGoalsState>(emptyGoalsState());
  let savedSnapshot = $state("");
  let showSaved = $state(false);
  let isSaving = $state(false);
  let saveError = $state("");
  let costScope = $state<CostScope>("selected");
  /** Configure dialog open (gear on a goal row). */
  let configuring = $state(false);
  /** Start sliders are collapsed until the user expands them. */
  let showStartConfig = $state(false);
  let configCloseEl: HTMLButtonElement | null = $state(null);
  let configFocusReturn: HTMLElement | null = $state(null);

  const session = authClient.useSession();

  /** Dirty ignores selectedId — picking a row shouldn't demand Save. */
  let parsedSavedSnapshot = $derived.by((): CalculatorGoalsState | null => {
    if (!savedSnapshot) return null;
    try {
      return parseGoalsState(JSON.parse(savedSnapshot) as unknown);
    } catch {
      return null;
    }
  });
  let hasUnsavedChanges = $derived.by(() => {
    if (!goalsHydrated || !savedSnapshot) return false;
    if (!parsedSavedSnapshot) {
      return goalsDiffersFromSnapshot(goalsState, savedSnapshot);
    }
    return (
      JSON.stringify(parseGoalsState(goalsState).goals) !==
      JSON.stringify(parsedSavedSnapshot.goals)
    );
  });
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);
  let changedCount = $derived.by(() => {
    if (!savedSnapshot) return 0;
    if (!parsedSavedSnapshot) return goalsState.goals.length;
    const current = parseGoalsState(goalsState).goals;
    const savedMap = new Map(parsedSavedSnapshot.goals.map((g) => [g.id, g]));
    let n = 0;
    const seen = new Set<string>();
    for (const g of current) {
      seen.add(g.id);
      const prev = savedMap.get(g.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(g)) n += 1;
    }
    for (const id of savedMap.keys()) {
      if (!seen.has(id)) n += 1;
    }
    return n;
  });

  $effect(() => {
    if (!browser) return;
    let cancelled = false;
    loading = true;
    loadError = null;
    loadUpgradeCosts()
      .then((data) => {
        if (cancelled) return;
        catalog = data;
      })
      .catch((err) => {
        if (cancelled) return;
        loadError = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!browser || goalsHydrated) return;
    let cancelled = false;

    async function hydrate() {
      const local = readGoalsLocal();
      let next = local;

      try {
        const { data: sess } = await authClient.getSession();
        if (cancelled) return;

        if (sess) {
          const cloud = await fetchGoalsCloud();
          if (cancelled) return;
          if (cloud) {
            // Saved cloud list wins (including intentionally empty []).
            next = applyCloudGoals(local, cloud);
            persistGoalsLocal(next);
          }
          // No cloud row: keep local guest goals; user Saves to upload.
        }
      } catch {
        if (cancelled) return;
        next = local;
      }

      if (cancelled) return;
      const pending = captureGoals(next);
      goalsState = pending.state;
      savedSnapshot = pending.json;
      goalsHydrated = true;
    }

    void hydrate().catch(() => {
      if (cancelled) return;
      const pending = captureGoals(readGoalsLocal());
      goalsState = pending.state;
      savedSnapshot = pending.json;
      goalsHydrated = true;
    });
    return () => {
      cancelled = true;
    };
  });

  function commitGoals(next: CalculatorGoalsState) {
    goalsState = next;
  }

  function restoreSavedSnapshot() {
    writeGoalsLocal(savedSnapshot);
  }

  function commitSaved(pending: GoalsCapture) {
    savedSnapshot = pending.json;
    goalsState = pending.state;
    showSaved = true;
  }

  function cancelEdits() {
    try {
      const pending = captureGoals(
        parseGoalsState(JSON.parse(savedSnapshot) as unknown),
      );
      goalsState = pending.state;
      savedSnapshot = pending.json;
      saveError = "";
    } catch {
      /* ignore */
    }
  }

  async function saveGoals() {
    if (isSaving) return;
    isSaving = true;
    saveError = "";

    const pending = captureGoals(goalsState);

    try {
      if (!writeGoalsLocal(pending.json)) {
        console.warn("localStorage unavailable — saving to memory only");
      }

      if ($session.data) {
        const result = await postGoals(pending.state);
        if (!result.ok) {
          restoreSavedSnapshot();
          saveError = result.message
            ? `Sync failed (${result.status}): ${result.message}`
            : `Sync failed (${result.status}) — goals not saved to cloud`;
          return;
        }
        commitSaved(pending);
      } else {
        commitSaved(pending);
      }
    } catch (e) {
      restoreSavedSnapshot();
      console.error("Goals save error:", e);
      saveError = `Something went wrong — your changes may not be saved (${(e as Error)?.name ?? typeof e})`;
    } finally {
      isSaving = false;
    }

    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  let selectedGoal = $derived(findGoal(goalsState, goalsState.selectedId));

  let characterOptions = $derived(
    (catalog?.characters ?? []).map((c) => ({
      value: c.name_id,
      label: c.name,
    })),
  );
  let weaponOptions = $derived(
    (catalog?.weapons ?? []).map((w) => ({
      value: String(w.id),
      label: `${w.name} (${w.rankLevel}★)`,
    })),
  );

  function goalLabel(goal: CalculatorGoal): string {
    if (!catalog) {
      return goal.kind === "character"
        ? goal.name_id
        : `Weapon ${goal.weapon_id}`;
    }
    if (goal.kind === "character") {
      return (
        catalog.characters.find((c) => c.name_id === goal.name_id)?.name ??
        goal.name_id
      );
    }
    return (
      catalog.weapons.find((w) => w.id === goal.weapon_id)?.name ??
      `Weapon ${goal.weapon_id}`
    );
  }

  function goalSummary(goal: CalculatorGoal): string {
    return `Lv ${goal.start.level} → ${goal.target.level}`;
  }

  function goalIcon(goal: CalculatorGoal): string | null {
    if (goal.kind === "character") {
      return getCharacterPortrait(goal.name_id);
    }
    const icon = catalog?.weapons.find((w) => w.id === goal.weapon_id)?.icon;
    return assetUrl(icon ?? null);
  }

  /** Drop stale Builds autofill when the user switches characters quickly. */
  let autofillSeq = 0;

  function simKeyForCatalogCharacter(nameId: string): string {
    const row = catalog?.characters.find((c) => c.name_id === nameId);
    return toGoodKey(row?.name ?? nameId);
  }

  async function targetFromBuilds(
    nameId: string,
    promotes: UpgradePromoteStep[],
  ) {
    const seq = ++autofillSeq;
    let builds;
    try {
      builds = await loadCharacterSummary(simKeyForCatalogCharacter(nameId));
    } catch {
      return null;
    }
    if (seq !== autofillSeq) return null;
    return plannerTargetFromBuilds(builds, promotes);
  }

  /** Full-screen pick modal after + Character / + Weapon. */
  let picking = $state<"character" | "weapon" | null>(null);
  let pickQuery = $state("");

  let pickOptions = $derived(
    picking === "weapon" ? weaponOptions : characterOptions,
  );

  function beginPick(kind: "character" | "weapon") {
    configuring = false;
    picking = kind;
    pickQuery = "";
  }

  function cancelPick() {
    picking = null;
    pickQuery = "";
  }

  function choosePick(value: string) {
    if (picking === "character") addCharacterWith(value);
    else if (picking === "weapon") addWeaponWith(Number(value));
  }

  function addCharacterWith(nameId: string) {
    if (!catalog) return;
    const row = catalog.characters.find((c) => c.name_id === nameId);
    if (!row) return;
    cancelPick();
    const goal = createCharacterGoal(nameId);
    commitGoals(appendGoal(goalsState, goal));
    beginConfigure();
    void (async () => {
      const target = await targetFromBuilds(nameId, row.promotes);
      if (!target) return;
      const current = findGoal(goalsState, goal.id);
      if (!current || current.kind !== "character") return;
      commitGoals(replaceGoal(goalsState, { ...current, target }));
    })();
  }

  function addWeaponWith(weaponId: number) {
    if (!catalog?.weapons.some((w) => w.id === weaponId)) return;
    cancelPick();
    const goal = createWeaponGoal(weaponId);
    commitGoals(appendGoal(goalsState, goal));
    beginConfigure();
  }

  function selectGoal(id: string) {
    if (goalsState.selectedId === id) return;
    cancelPick();
    commitGoals({ ...goalsState, selectedId: id });
  }

  function beginConfigure() {
    const active = document.activeElement;
    configFocusReturn = active instanceof HTMLElement ? active : null;
    showStartConfig = false;
    configuring = true;
  }

  function openConfigure(id: string) {
    cancelPick();
    if (goalsState.selectedId !== id) {
      commitGoals({ ...goalsState, selectedId: id });
    }
    beginConfigure();
  }

  function closeConfigure() {
    configuring = false;
    showStartConfig = false;
    const previous = configFocusReturn;
    configFocusReturn = null;
    if (previous?.isConnected) previous.focus();
  }

  function deleteGoal(id: string) {
    if (goalsState.selectedId === id) configuring = false;
    commitGoals(removeGoal(goalsState, id));
  }

  $effect(() => {
    if (!configuring || !browser) return;
    void tick().then(() => configCloseEl?.focus());
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfigure();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const configMotion = $derived(prefersReducedMotion.current ? 0 : undefined);

  function updateSelected(mutator: (goal: CalculatorGoal) => CalculatorGoal) {
    const current = selectedGoal;
    if (!current) return;
    commitGoals(replaceGoal(goalsState, mutator(current)));
  }

  function patchCharacterSide(
    side: "start" | "target",
    patch: Partial<{
      level: number;
      ascension: number;
      talents: Partial<{ normal: number; skill: number; burst: number }>;
    }>,
  ) {
    if (!catalog || !selectedGoal || selectedGoal.kind !== "character") return;
    const row = catalog.characters.find(
      (c) => c.name_id === selectedGoal.name_id,
    );
    if (!row) return;
    updateSelected((g) => {
      if (g.kind !== "character") return g;
      const prev = g[side];
      const gated = gateCharacterConfig(
        {
          level: patch.level ?? prev.level,
          ascension: patch.ascension ?? prev.ascension,
          talents: {
            normal: patch.talents?.normal ?? prev.talents.normal,
            skill: patch.talents?.skill ?? prev.talents.skill,
            burst: patch.talents?.burst ?? prev.talents.burst,
          },
        },
        row.promotes,
        {
          preferAscension:
            patch.ascension !== undefined &&
            patch.level === undefined &&
            patch.talents === undefined,
        },
      );
      return { ...g, [side]: gated };
    });
  }

  function patchWeaponSide(
    side: "start" | "target",
    patch: Partial<{ level: number; ascension: number }>,
  ) {
    if (!catalog || !selectedGoal || selectedGoal.kind !== "weapon") return;
    const row = catalog.weapons.find((w) => w.id === selectedGoal.weapon_id);
    if (!row) return;
    updateSelected((g) => {
      if (g.kind !== "weapon") return g;
      const prev = g[side];
      const gated = gateWeaponConfig(
        {
          level: patch.level ?? prev.level,
          ascension: patch.ascension ?? prev.ascension,
        },
        row.promotes,
        {
          preferAscension:
            patch.ascension !== undefined && patch.level === undefined,
        },
      );
      return { ...g, [side]: gated };
    });
  }

  let selectedPromotes = $derived.by(() => {
    if (!catalog || !selectedGoal) return [];
    if (selectedGoal.kind === "character") {
      return (
        catalog.characters.find((c) => c.name_id === selectedGoal.name_id)
          ?.promotes ?? []
      );
    }
    return (
      catalog.weapons.find((w) => w.id === selectedGoal.weapon_id)?.promotes ??
      []
    );
  });

  let startMinLevel = $derived(
    selectedGoal
      ? minLevelForAscension(selectedPromotes, selectedGoal.start.ascension)
      : 1,
  );
  let startMaxLevel = $derived(
    selectedGoal
      ? maxLevelForAscension(selectedPromotes, selectedGoal.start.ascension)
      : 90,
  );
  let targetMinLevel = $derived(
    selectedGoal
      ? minLevelForAscension(selectedPromotes, selectedGoal.target.ascension)
      : 1,
  );
  let targetMaxLevel = $derived(
    selectedGoal
      ? maxLevelForAscension(selectedPromotes, selectedGoal.target.ascension)
      : 90,
  );
  let startMaxTalent = $derived(
    selectedGoal?.kind === "character"
      ? maxTalentForAscension(selectedGoal.start.ascension)
      : 1,
  );
  let targetMaxTalent = $derived(
    selectedGoal?.kind === "character"
      ? maxTalentForAscension(selectedGoal.target.ascension)
      : 1,
  );

  function costForGoal(
    goal: CalculatorGoal,
    data: UpgradeCostsCatalog,
  ): AggregatedUpgradeCosts {
    const agg = emptyAggregate();
    if (goal.kind === "character") {
      const row = data.characters.find((c) => c.name_id === goal.name_id);
      if (!row) return agg;
      addCharacterResult(
        agg,
        diffCharacterUpgrade(row, data.curves, goal.start, goal.target),
      );
      return agg;
    }
    const row = data.weapons.find((w) => w.id === goal.weapon_id);
    if (!row) return agg;
    addWeaponResult(
      agg,
      diffWeaponUpgrade(row, data.curves, goal.start, goal.target),
    );
    return agg;
  }

  let aggregate = $derived.by((): AggregatedUpgradeCosts | null => {
    if (!catalog || !goalsHydrated) return null;
    if (costScope === "selected") {
      if (!selectedGoal) return emptyAggregate();
      return costForGoal(selectedGoal, catalog);
    }
    const agg = emptyAggregate();
    for (const goal of goalsState.goals) {
      const one = costForGoal(goal, catalog);
      agg.mora += one.mora;
      agg.characterExp += one.characterExp;
      agg.weaponExp += one.weaponExp;
      for (const [id, count] of Object.entries(one.materials)) {
        agg.materials[id] = (agg.materials[id] ?? 0) + count;
      }
    }
    return agg;
  });

  let characterExpBooks = $derived.by(() => {
    if (!catalog || !aggregate || aggregate.characterExp <= 0) return [];
    return expItemsNeeded(
      aggregate.characterExp,
      catalog.curves.avatarExpItems.map((it) => ({
        id: it.id,
        exp: it.exp,
      })),
    );
  });

  let weaponExpOres = $derived.by(() => {
    if (!catalog || !aggregate || aggregate.weaponExp <= 0) return [];
    return expItemsNeeded(
      aggregate.weaponExp,
      catalog.curves.weaponExpItems.map((it) => ({
        id: it.id,
        exp: it.exp,
      })),
    );
  });

  let materialRows = $derived.by(() => {
    const data = catalog;
    if (!data || !aggregate) return [];
    return Object.entries(aggregate.materials)
      .map(([id, count]) => {
        const meta = data.materials[id];
        return {
          id,
          count,
          name: meta?.name ?? `Material ${id}`,
          icon: meta?.icon ?? `UI_ItemIcon_${id}`,
          rankLevel: meta?.rankLevel ?? 1,
        };
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  });

  function formatCount(n: number): string {
    return n.toLocaleString("en-US");
  }

  function lookupCharacter(
    nameId: string,
  ): CharacterOwned | Character | undefined {
    return $charactersOwned.find((c) => c.name_id === nameId);
  }

  /** Roster row when owned; otherwise a minimal stub from the cost catalog. */
  function pickModalCharacter(
    nameId: string,
  ): CharacterOwned | Character | undefined {
    const owned = lookupCharacter(nameId);
    if (owned) return owned;
    const row = catalog?.characters.find((c) => c.name_id === nameId);
    if (!row) return undefined;
    return {
      name_id: row.name_id,
      name: row.name,
    } as Character;
  }
</script>

<PageShell class="gap-8 planner-page">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Planner</h1>
      <p class="page-meta">Plan for characters and weapons.</p>
    </div>
  </header>

  {#if loading || !goalsHydrated}
    <LoadingState message="Loading upgrade costs…" />
  {:else if loadError}
    <EmptyState message={loadError ?? "Couldn’t load cost data"} />
  {:else if catalog}
    {#if hasUnsavedChanges || isSaving || savedVisible || saveError}
      <div class="save-bar">
        <div class="save-status">
          <span
            class="save-dot"
            class:saving={isSaving}
            class:saved={savedVisible}
          ></span>
          <span class="save-label">
            {isSaving
              ? "Saving..."
              : savedVisible
                ? "Saved"
                : "Unsaved changes"}
          </span>
          {#if hasUnsavedChanges}
            <span class="save-changed">({changedCount} changed)</span>
          {/if}
        </div>
        {#if hasUnsavedChanges && !isSaving}
          <div class="save-actions">
            <Button variant="ghost" onclick={cancelEdits}>Cancel</Button>
            <Button variant="primary" onclick={saveGoals}>Save</Button>
            <div class="save-cue" aria-hidden="true">
              <IconChevronDown
                size={22}
                strokeWidth={2.5}
                class="save-cue-icon"
              />
            </div>
          </div>
        {/if}
        {#if saveError}
          <span class="save-error">{saveError}</span>
        {/if}
      </div>
    {/if}

    <section class="calc-layout">
      <aside class="goals-panel">
        <div class="goals-head">
          <h2 class="section-title">Goals</h2>
          <div class="goals-actions">
            <button
              type="button"
              class="ghost-btn"
              class:add-cue={!selectedGoal && picking === null}
              onclick={() => beginPick("character")}
            >
              + Character
            </button>
            <button
              type="button"
              class="ghost-btn"
              class:add-cue={!selectedGoal && picking === null}
              onclick={() => beginPick("weapon")}
            >
              + Weapon
            </button>
          </div>
        </div>

        {#if goalsState.goals.length === 0}
          <p class="section-lede">
            Add a character or weapon goal to start planning costs.
          </p>
        {:else}
          <ul class="goal-list">
            {#each goalsState.goals as goal (goal.id)}
              {@const active = goal.id === goalsState.selectedId}
              <li
                class="goal-item"
                class:is-active={active}
                aria-current={active ? "true" : undefined}
              >
                <button
                  type="button"
                  class="goal-select"
                  onclick={() => selectGoal(goal.id)}
                >
                  {#if goalIcon(goal)}
                    <img
                      class="goal-icon"
                      src={goalIcon(goal) ?? ""}
                      alt=""
                      width="32"
                      height="32"
                      loading="lazy"
                    />
                  {:else}
                    <span class="goal-icon goal-icon-fallback"></span>
                  {/if}
                  <span class="goal-text">
                    <span class="meta-name">{goalLabel(goal)}</span>
                    <span class="meta-sub">{goalSummary(goal)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  class="goal-icon-btn"
                  aria-label={`Configure ${goalLabel(goal)}`}
                  onclick={() => openConfigure(goal.id)}
                >
                  <IconCog size={16} />
                </button>
                <button
                  type="button"
                  class="goal-icon-btn"
                  aria-label={`Remove ${goalLabel(goal)}`}
                  onclick={() => deleteGoal(goal.id)}
                >
                  <IconX size={16} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <div class="results-panel">
        <div class="results-head">
          <h2 class="section-title">Required</h2>
          <div class="scope-row" role="tablist" aria-label="Cost scope">
            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "all"}
              role="tab"
              aria-selected={costScope === "all"}
              onclick={() => (costScope = "all")}
            >
              All goals
            </button>
            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "selected"}
              role="tab"
              aria-selected={costScope === "selected"}
              onclick={() => (costScope = "selected")}
            >
              Selected
            </button>
          </div>
        </div>

        {#if aggregate}
          <ul class="totals">
            <li>
              <span class="meta-sub">Mora</span>
              <span class="meta-name">{formatCount(aggregate.mora)}</span>
            </li>
            {#if aggregate.characterExp > 0}
              <li>
                <span class="meta-sub">Character EXP</span>
                <span class="meta-name"
                  >{formatCount(aggregate.characterExp)}</span
                >
              </li>
            {/if}
            {#if aggregate.weaponExp > 0}
              <li>
                <span class="meta-sub">Weapon EXP</span>
                <span class="meta-name">{formatCount(aggregate.weaponExp)}</span
                >
              </li>
            {/if}
          </ul>

          {#if characterExpBooks.length > 0}
            <h3 class="group-title">EXP books</h3>
            <ul class="mat-list">
              {#each characterExpBooks as book (book.id)}
                {@const meta = catalog.materials[String(book.id)]}
                <li class="mat-row">
                  <img
                    class="mat-icon"
                    src={assetUrl(meta?.icon ?? `UI_ItemIcon_${book.id}`) ?? ""}
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy"
                  />
                  <span class="mat-name">{meta?.name ?? `Item ${book.id}`}</span
                  >
                  <span class="mat-count">×{formatCount(book.count)}</span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if weaponExpOres.length > 0}
            <h3 class="group-title">Enhancement ores</h3>
            <ul class="mat-list">
              {#each weaponExpOres as ore (ore.id)}
                {@const meta = catalog.materials[String(ore.id)]}
                <li class="mat-row">
                  <img
                    class="mat-icon"
                    src={assetUrl(meta?.icon ?? `UI_ItemIcon_${ore.id}`) ?? ""}
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy"
                  />
                  <span class="mat-name">{meta?.name ?? `Item ${ore.id}`}</span>
                  <span class="mat-count">×{formatCount(ore.count)}</span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if materialRows.length > 0}
            <h3 class="group-title">Materials</h3>
            <ul class="mat-list">
              {#each materialRows as mat (mat.id)}
                <li class="mat-row">
                  <img
                    class="mat-icon"
                    src={assetUrl(mat.icon) ?? ""}
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy"
                  />
                  <span class="mat-name">{mat.name}</span>
                  <span class="mat-count">×{formatCount(mat.count)}</span>
                </li>
              {/each}
            </ul>
          {:else if aggregate.mora === 0 && aggregate.characterExp === 0 && aggregate.weaponExp === 0}
            <p class="section-lede">
              {goalsState.goals.length === 0
                ? "Add a goal to see costs."
                : "Nothing to farm — configs match."}
            </p>
          {/if}
        {/if}
      </div>
    </section>
  {/if}

  {#if configuring && selectedGoal}
    <div class="config-root">
      <button
        type="button"
        class="config-backdrop"
        tabindex="-1"
        aria-label="Close"
        onclick={closeConfigure}
        transition:fade={{ duration: configMotion ?? 160 }}
      ></button>
      <div
        class="config-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Configure goal"
        transition:scale={{ duration: configMotion ?? 200, start: 0.98 }}
      >
        <header class="config-head">
          <h2 class="section-title">Configure</h2>
          <button
            type="button"
            class="config-close"
            bind:this={configCloseEl}
            onclick={closeConfigure}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </header>
        <div class="picker-row">
          {#if selectedGoal.kind === "character"}
            <label class="field">
              <span class="field-label">Character</span>
              <CharacterSearchSelect
                bind:value={
                  () => selectedGoal.name_id,
                  (name_id) => {
                    if (!catalog) return;
                    const row = catalog.characters.find(
                      (c) => c.name_id === name_id,
                    );
                    updateSelected((g) => {
                      if (g.kind !== "character") return g;
                      if (!row) return { ...g, name_id };
                      return {
                        ...g,
                        name_id,
                        start: gateCharacterConfig(g.start, row.promotes),
                        target: gateCharacterConfig(g.target, row.promotes),
                      };
                    });
                    if (!row) return;
                    const goalId = selectedGoal.id;
                    void (async () => {
                      const target = await targetFromBuilds(
                        name_id,
                        row.promotes,
                      );
                      if (!target) return;
                      const current = findGoal(goalsState, goalId);
                      if (
                        !current ||
                        current.kind !== "character" ||
                        current.name_id !== name_id
                      ) {
                        return;
                      }
                      commitGoals(
                        replaceGoal(goalsState, { ...current, target }),
                      );
                    })();
                  }
                }
                options={characterOptions}
                getCharacter={lookupCharacter}
                placeholder="Search character…"
                aria-label="Search character"
              />
            </label>
          {:else}
            <label class="field">
              <span class="field-label">Weapon</span>
              <CharacterSearchSelect
                bind:value={
                  () => String(selectedGoal.weapon_id),
                  (raw) => {
                    if (!catalog) return;
                    const weapon_id = Number(raw);
                    const row = catalog.weapons.find((w) => w.id === weapon_id);
                    updateSelected((g) => {
                      if (g.kind !== "weapon") return g;
                      if (!row) return { ...g, weapon_id };
                      return {
                        ...g,
                        weapon_id,
                        start: gateWeaponConfig(g.start, row.promotes),
                        target: gateWeaponConfig(g.target, row.promotes),
                      };
                    });
                  }
                }
                options={weaponOptions}
                getIconSrc={(id) => {
                  const row = catalog?.weapons.find((w) => String(w.id) === id);
                  return row?.icon ? assetUrl(row.icon) : null;
                }}
                placeholder="Search weapon…"
                aria-label="Search weapon"
              />
            </label>
          {/if}
        </div>

        <div class="config-col">
          <h3 class="group-title">Target</h3>
          {#if selectedGoal.kind === "character"}
            <NumberSliderField
              label="Ascension"
              value={selectedGoal.target.ascension}
              min={0}
              max={6}
              onchange={(ascension) =>
                patchCharacterSide("target", { ascension })}
            />
            <NumberSliderField
              label="Level"
              value={selectedGoal.target.level}
              min={1}
              max={90}
              floor={targetMinLevel}
              cap={targetMaxLevel}
              onchange={(level) => patchCharacterSide("target", { level })}
            />
            <NumberSliderField
              label="Normal attack"
              value={selectedGoal.target.talents.normal}
              min={1}
              max={10}
              cap={targetMaxTalent}
              onchange={(normal) =>
                patchCharacterSide("target", { talents: { normal } })}
            />
            <NumberSliderField
              label="Skill"
              value={selectedGoal.target.talents.skill}
              min={1}
              max={10}
              cap={targetMaxTalent}
              onchange={(skill) =>
                patchCharacterSide("target", { talents: { skill } })}
            />
            <NumberSliderField
              label="Burst"
              value={selectedGoal.target.talents.burst}
              min={1}
              max={10}
              cap={targetMaxTalent}
              onchange={(burst) =>
                patchCharacterSide("target", { talents: { burst } })}
            />
          {:else}
            <NumberSliderField
              label="Ascension"
              value={selectedGoal.target.ascension}
              min={0}
              max={6}
              onchange={(ascension) => patchWeaponSide("target", { ascension })}
            />
            <NumberSliderField
              label="Level"
              value={selectedGoal.target.level}
              min={1}
              max={90}
              floor={targetMinLevel}
              cap={targetMaxLevel}
              onchange={(level) => patchWeaponSide("target", { level })}
            />
          {/if}
        </div>

        {#if showStartConfig}
          <div class="config-col">
            <h3 class="group-title">Starting point</h3>
            {#if selectedGoal.kind === "character"}
              <NumberSliderField
                label="Ascension"
                value={selectedGoal.start.ascension}
                min={0}
                max={6}
                onchange={(ascension) =>
                  patchCharacterSide("start", { ascension })}
              />
              <NumberSliderField
                label="Level"
                value={selectedGoal.start.level}
                min={1}
                max={90}
                floor={startMinLevel}
                cap={startMaxLevel}
                onchange={(level) => patchCharacterSide("start", { level })}
              />
              <NumberSliderField
                label="Normal attack"
                value={selectedGoal.start.talents.normal}
                min={1}
                max={10}
                cap={startMaxTalent}
                onchange={(normal) =>
                  patchCharacterSide("start", { talents: { normal } })}
              />
              <NumberSliderField
                label="Skill"
                value={selectedGoal.start.talents.skill}
                min={1}
                max={10}
                cap={startMaxTalent}
                onchange={(skill) =>
                  patchCharacterSide("start", { talents: { skill } })}
              />
              <NumberSliderField
                label="Burst"
                value={selectedGoal.start.talents.burst}
                min={1}
                max={10}
                cap={startMaxTalent}
                onchange={(burst) =>
                  patchCharacterSide("start", { talents: { burst } })}
              />
            {:else}
              <NumberSliderField
                label="Ascension"
                value={selectedGoal.start.ascension}
                min={0}
                max={6}
                onchange={(ascension) =>
                  patchWeaponSide("start", { ascension })}
              />
              <NumberSliderField
                label="Level"
                value={selectedGoal.start.level}
                min={1}
                max={90}
                floor={startMinLevel}
                cap={startMaxLevel}
                onchange={(level) => patchWeaponSide("start", { level })}
              />
            {/if}
          </div>
        {/if}

        <div class="config-actions">
          {#if !showStartConfig}
            <button
              type="button"
              class="ghost-btn"
              onclick={() => (showStartConfig = true)}
            >
              Configure starting point
            </button>
          {/if}
          <Button variant="primary" onclick={closeConfigure}>Looks good</Button>
        </div>
      </div>
    </div>
  {/if}

  {#if picking}
    <PickModal
      open
      title={picking === "character" ? "Add character" : "Add weapon"}
      searchPlaceholder={picking === "character"
        ? "Search character…"
        : "Search weapon…"}
      options={pickOptions}
      art={picking === "weapon" ? "square" : "portrait"}
      bind:query={pickQuery}
      onClose={cancelPick}
      onChoose={choosePick}
    >
      {#snippet tile(opt)}
        {#if picking === "character"}
          <CharacterPortraitCard
            character={pickModalCharacter(opt.value)}
            tintBackground
          />
        {:else}
          {@const weapon = catalog?.weapons.find(
            (w) => String(w.id) === opt.value,
          )}
          <div class="weapon-tile">
            {#if weapon?.icon}
              <img src={assetUrl(weapon.icon) ?? ""} alt="" loading="lazy" />
            {/if}
          </div>
        {/if}
      {/snippet}
    </PickModal>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  :global(.planner-page) {
    padding-bottom: 6rem;
  }

  .calc-layout {
    display: grid;
    grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr);
    gap: 1.5rem 1.75rem;
    align-items: start;
  }

  .goals-panel,
  .results-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-width: 0;
  }

  .goals-head,
  .results-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
  }

  .goals-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .ghost-btn,
  .scope-btn {
    padding: 0.3rem 0.65rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .ghost-btn:hover,
  .scope-btn:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 28%, transparent);
  }

  .ghost-btn.add-cue {
    color: var(--foreground-color);
    border-color: var(--accent-1);
    animation: add-cue-pulse 1.6s ease-in-out infinite;
  }

  @keyframes add-cue-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-1) 0%, transparent);
    }
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-1) 35%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ghost-btn.add-cue {
      animation: none;
    }
  }

  .scope-btn.active {
    background: var(--surface-selected);
    color: var(--foreground-color);
    border-color: var(--accent-1);
  }

  .scope-row {
    display: flex;
    gap: 0.35rem;
  }

  .goal-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .goal-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.1rem;
    align-items: center;
    padding: 0.3rem 0.3rem 0.3rem 0.45rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid transparent;
    background: transparent;
  }

  .goal-item:hover {
    background: color-mix(in srgb, var(--foreground-color) 7%, transparent);
  }

  .goal-item.is-active {
    background: var(--surface-selected);
    border-color: var(--accent-1);
  }

  .goal-select {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 0.55rem;
    align-items: center;
    min-width: 0;
    padding: 0.15rem 0.25rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }

  .goal-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .goal-icon-fallback {
    display: block;
  }

  .goal-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .goal-icon-btn {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .goal-icon-btn:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .config-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .config-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .config-panel {
    position: relative;
    z-index: 1;
    width: min(92vw, 28rem);
    max-height: min(88vh, 44rem);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.85rem 1rem 1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .config-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .config-close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .config-close:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 26%, transparent);
  }

  .picker-row {
    max-width: none;
  }

  .config-col {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .config-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .config-actions :global(.btn-primary) {
    margin-left: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .weapon-tile {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--background-mid);
  }

  .totals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.35rem 1.25rem;
  }

  .totals li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .group-title {
    margin: 0.5rem 0 0;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .mat-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.35rem 0.85rem;
  }

  .mat-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 0.5rem;
    align-items: center;
    min-width: 0;
  }

  .mat-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .mat-name {
    font-size: var(--text-sm);
    color: var(--foreground-color);
    min-width: 0;
  }

  .mat-count {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }

  .save-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: 0.75rem 1.5rem;
    background: color-mix(in srgb, var(--background-mid) 94%, transparent);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 28%, transparent);
    backdrop-filter: blur(12px);
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .save-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--accent-1);
    flex-shrink: 0;
  }

  .save-dot.saving {
    background: var(--accent-2);
  }

  .save-dot.saved {
    background: var(--accent-2);
    opacity: 0.45;
  }

  .save-label {
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .save-changed {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .save-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .save-cue {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.15rem;
    color: var(--foreground-mid);
    animation: save-cue-nudge 1.1s ease-in-out infinite;
    pointer-events: none;
  }

  .save-cue :global(.save-cue-icon) {
    transform: rotate(90deg);
  }

  @keyframes save-cue-nudge {
    0%,
    100% {
      transform: translateX(0.3rem);
      opacity: 0.75;
    }
    50% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-cue {
      animation: none;
      transform: none;
      opacity: 1;
    }
  }

  .save-error {
    font-size: var(--text-xs);
    color: color-mix(in srgb, #e07070 85%, var(--foreground-color));
  }

  @media (max-width: 800px) {
    .calc-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
