<script lang="ts">
  import { browser } from "$app/env";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import PageShell from "#lib/ui/components/PageShell.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import { loadUpgradeCosts } from "#lib/app/upgrade-costs.js";
  import {
    getRosterWeaponsCached,
    loadRosterWeapons,
  } from "#lib/app/roster-inventory.js";
  import { ownedNameIds } from "#lib/utils.js";
  import { charactersOwned } from "#lib/stores/roster.js";
  import {
    findGoal,
    moveGoal,
    replaceGoal,
    starredGoals,
    toggleGoalStarred,
  } from "#lib/planner/calculator-goals.js";
  import {
    appendCatalogCharacterGoal,
    appendCatalogWeaponGoal,
    pickModalCharacter,
    plannerCharacterOptions,
    plannerWeaponOptions,
    resolveCatalogCharacterId,
  } from "#lib/planner/planner-goal-edits.js";
  import { autofillCharacterGoalState } from "#lib/planner/calculator-goals-lifecycle.js";
  import {
    countChangedGoals,
    parseSavedGoalsJson,
  } from "#lib/planner/planner-draft-changes.js";
  import {
    scopedGoalCosts,
    type CostScope,
  } from "#lib/planner/planner-cost-view.js";
  import { useGoalsDraft } from "#lib/app/goals-draft.svelte.js";
  import { isSaved } from "#lib/sync/synced-doc.js";
  import { addressUrl, nextSearchPath } from "#lib/query-state.js";
  import type {
    AggregatedUpgradeCosts,
    CalculatorGoalsState,
  } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
  import GoalConfigureModal from "#lib/ui/components/GoalConfigureModal.svelte";
  import GoalPickModal from "#lib/ui/components/GoalPickModal.svelte";
  import PlannerSaveBar from "./PlannerSaveBar.svelte";
  import PlannerGoalsPanel from "./PlannerGoalsPanel.svelte";
  import PlannerResultsPanel from "./PlannerResultsPanel.svelte";

  let catalog = $state<UpgradeCostsCatalog | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(true);
  /** The editable goals: follows storage, merges on Save (`goals-draft`). */
  const goals = useGoalsDraft();
  let showSaved = $state(false);
  let savedGeneration = 0;
  let addError = $state("");
  /** Character name_id from `?add=` — consumed after catalog + goals hydrate. */
  let pendingPlannerAdd = $state<string | null>(null);
  let costScope = $state<CostScope>("selected");
  /** Character pick lists put roster-owned names first. */
  let sortOwnedFirst = $state(true);
  /** Configure dialog open (gear on a goal row). */
  let configuring = $state(false);

  /** Dirty ignores selectedId — picking a row shouldn't demand Save. */
  let hasUnsavedChanges = $derived(goals.unsaved);
  /** Why the last read or send failed. */
  let saveError = $derived(goals.error ?? "");
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);
  let parsedSavedSnapshot = $derived(parseSavedGoalsJson(goals.savedJson));
  let changedCount = $derived(
    countChangedGoals({
      state: goals.state,
      savedJson: goals.savedJson,
      saved: parsedSavedSnapshot,
      pendingRemoveIds: goals.pendingRemoveIds,
    }),
  );

  $effect(() => {
    if (!browser) return;
    let cancelled = false;
    loading = true;
    loadError = null;
    void loadRosterWeapons().catch(() => {});
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
    if (!browser) return;
    const url = addressUrl(page);
    const nameId = url.searchParams.get("add")?.trim();
    if (!nameId) return;
    const next = nextSearchPath(url, { add: null });
    if (next) goto(next, { shallow: true, replace: true, state: page.state });
    pendingPlannerAdd = nameId;
  });

  $effect(() => {
    const nameId = pendingPlannerAdd;
    if (!nameId) return;
    if (loadError) {
      pendingPlannerAdd = null;
      addError = "Couldn't load planner data.";
      return;
    }
    if (!catalog || !goals.hydrated) return;
    pendingPlannerAdd = null;
    addOrSelectCharacter(nameId);
  });

  function commitGoals(next: CalculatorGoalsState) {
    goals.state = next;
  }

  function flashSaved() {
    const generation = ++savedGeneration;
    showSaved = true;
    setTimeout(() => {
      if (generation === savedGeneration) showSaved = false;
    }, 2000);
  }

  function cancelEdits() {
    goals.cancel();
  }

  async function saveGoals() {
    const result = await goals.save();
    // A guest save storage refused is not saved; `goals.error` explains.
    if (isSaved(result)) flashSaved();
  }

  let selectedGoal = $derived(findGoal(goals.state, goals.state.selectedId));

  let ownedIds = $derived(ownedNameIds($charactersOwned));

  let characterOptions = $derived(
    plannerCharacterOptions(catalog, ownedIds, sortOwnedFirst),
  );
  let weaponOptions = $derived(plannerWeaponOptions(catalog));

  let autofillSeq = 0;

  async function autofillCharacterTarget(nameId: string, goalId: string) {
    if (!catalog) return;
    const seq = ++autofillSeq;
    // Edits assign a new state object, so identity means the draft moved.
    const base = goals.state;
    const next = await autofillCharacterGoalState({
      state: base,
      catalog,
      nameId,
      goalId,
    });
    if (seq !== autofillSeq || !next || goals.state !== base) return;
    commitGoals(next);
  }

  /** Pick modal after + Character / + Weapon. */
  let picking = $state<"character" | "weapon" | null>(null);
  let pickQuery = $state("");

  let pickOptions = $derived(
    picking === "weapon" ? weaponOptions : characterOptions,
  );

  function beginPick(kind: "character" | "weapon") {
    addError = "";
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

  function addOrSelectCharacter(nameId: string) {
    if (!catalog) return;
    const resolved = resolveCatalogCharacterId(catalog, nameId) ?? nameId;
    const existing = goals.state.goals.find(
      (g) => g.kind === "character" && g.name_id === resolved,
    );
    if (existing) {
      cancelPick();
      addError = "";
      if (goals.state.selectedId !== existing.id) {
        commitGoals({ ...goals.state, selectedId: existing.id });
      }
      beginConfigure();
      return;
    }
    addCharacterWith(resolved);
  }

  function addCharacterWith(nameId: string) {
    if (!catalog) return;
    cancelPick();
    const result = appendCatalogCharacterGoal(goals.state, catalog, nameId, {
      owned: $charactersOwned,
      weapons: getRosterWeaponsCached(),
    });
    if (!result.ok) {
      addError = result.error;
      return;
    }
    addError = "";
    commitGoals(result.state);
    beginConfigure();
    void autofillCharacterTarget(
      result.goal.kind === "character" ? result.goal.name_id : nameId,
      result.goal.id,
    );
  }

  function addWeaponWith(weaponId: number) {
    if (!catalog) return;
    cancelPick();
    const result = appendCatalogWeaponGoal(goals.state, catalog, weaponId, {
      owned: $charactersOwned,
      weapons: getRosterWeaponsCached(),
    });
    if (!result.ok) {
      addError = result.error;
      return;
    }
    addError = "";
    commitGoals(result.state);
    beginConfigure();
  }

  function selectGoal(id: string) {
    if (goals.state.selectedId === id) return;
    cancelPick();
    commitGoals({ ...goals.state, selectedId: id });
  }

  function beginConfigure() {
    configuring = true;
  }

  function openConfigure(id: string) {
    if (goals.pendingRemoveIds.has(id)) return;
    cancelPick();
    if (goals.state.selectedId !== id) {
      commitGoals({ ...goals.state, selectedId: id });
    }
    beginConfigure();
  }

  function closeConfigure() {
    configuring = false;
  }

  function deleteGoal(id: string) {
    if (goals.state.selectedId === id) closeConfigure();
    addError = "";
    const next = new Set(goals.pendingRemoveIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    goals.pendingRemoveIds = next;
  }

  function toggleStar(id: string) {
    const current = findGoal(goals.state, id);
    if (!current) return;
    commitGoals(replaceGoal(goals.state, toggleGoalStarred(current)));
  }

  function portraitFor(nameId: string) {
    return pickModalCharacter(nameId, catalog, $charactersOwned);
  }

  let starredGoalList = $derived(
    starredGoals(
      goals.state.goals.filter((g) => !goals.pendingRemoveIds.has(g.id)),
    ),
  );

  let aggregate = $derived.by((): AggregatedUpgradeCosts | null => {
    if (!catalog || !goals.hydrated) return null;
    return scopedGoalCosts({
      scope: costScope,
      goals: goals.state.goals,
      selectedGoal,
      starred: starredGoalList,
      pendingRemoveIds: goals.pendingRemoveIds,
      catalog,
    });
  });

  let ranksExpanded = $state(true);
</script>

<PageShell class="gap-8 planner-page">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Planner</h1>
      <p class="page-meta">Plan for characters and weapons.</p>
    </div>
  </header>

  {#if loading || !goals.hydrated}
    <LoadingState message="Loading upgrade costs…" />
  {:else if loadError}
    <EmptyState message={loadError ?? "Couldn’t load cost data"} />
  {:else if catalog}
    {#if hasUnsavedChanges || goals.unsent || goals.saving || savedVisible || saveError}
      <PlannerSaveBar
        saving={goals.saving}
        unsent={goals.unsent}
        {hasUnsavedChanges}
        {savedVisible}
        {saveError}
        {changedCount}
        onCancel={cancelEdits}
        onSave={saveGoals}
      />
    {/if}

    <section class="calc-layout">
      <PlannerGoalsPanel
        goals={goals.state.goals}
        {catalog}
        selectedId={goals.state.selectedId}
        removedIds={goals.pendingRemoveIds}
        {addError}
        addCue={!selectedGoal && picking === null}
        onPick={beginPick}
        onSelect={selectGoal}
        onStar={toggleStar}
        onReorder={(from, to) => commitGoals(moveGoal(goals.state, from, to))}
        onConfigure={openConfigure}
        onRemove={deleteGoal}
      />

      <PlannerResultsPanel
        {catalog}
        {aggregate}
        bind:costScope
        bind:ranksExpanded
        goalCount={goals.state.goals.length}
        starredCount={starredGoalList.length}
      />
    </section>
  {/if}

  <GoalConfigureModal
    open={configuring && !!selectedGoal}
    goal={selectedGoal}
    {catalog}
    {characterOptions}
    {weaponOptions}
    getCharacter={portraitFor}
    onClose={closeConfigure}
    onChange={(next) => commitGoals(replaceGoal(goals.state, next))}
    onAutofillCharacter={(nameId, goalId) =>
      void autofillCharacterTarget(nameId, goalId)}
  />
  <GoalPickModal
    open={picking !== null}
    kind={picking ?? "character"}
    {catalog}
    options={pickOptions}
    bind:query={pickQuery}
    bind:sortOwnedFirst
    {ownedIds}
    roster={$charactersOwned}
    getCharacter={portraitFor}
    onClose={cancelPick}
    onChoose={choosePick}
  />
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

  @media (max-width: 800px) {
    .calc-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
