<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import {
    getRosterWeaponsCached,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import { assetUrl } from "$lib/asset-urls";
  import { ownedNameIds } from "$lib/utils";
  import { charactersOwned } from "$lib/stores";
  import {
    expItemsNeeded,
    formatMaterialSourceLine,
    collapseCraftRanks,
    craftRanksCanExpand,
  } from "$lib/upgrade-costs";
  import {
    aggregateGoalCosts,
    costsForGoal,
    emptyAggregate,
    emptyGoalsState,
    findGoal,
    moveGoal,
    parseGoalsState,
    replaceGoal,
    starredGoals,
    toggleGoalStarred,
  } from "$lib/calculator-goals";
  import {
    appendCatalogCharacterGoal,
    appendCatalogWeaponGoal,
    pickModalCharacter,
    plannerCharacterOptions,
    plannerWeaponOptions,
    resolveCatalogCharacterId,
  } from "$lib/planner-goal-edits";
  import {
    autofillCharacterGoalState,
    goalsHaveUnsavedChanges,
    hydrateGoalsState,
    readGoalsIfChanged,
    saveGoalsState,
  } from "$lib/calculator-goals-lifecycle";
  import {
    captureGoals,
    goalsLocalRevision,
    readGoalsLocal,
    type GoalsCapture,
  } from "$lib/calculator-goals-snapshot";
  import { nextSearchPath } from "$lib/query-state";
  import type {
    AggregatedUpgradeCosts,
    CalculatorGoalsState,
  } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import Button from "$lib/ui/components/Button.svelte";
  import GoalConfigureModal from "$lib/ui/components/GoalConfigureModal.svelte";
  import GoalList from "$lib/ui/components/GoalList.svelte";
  import GoalPickModal from "$lib/ui/components/GoalPickModal.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";

  type CostScope = "all" | "selected" | "starred";

  let catalog = $state<UpgradeCostsCatalog | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(true);
  let goalsHydrated = $state(false);

  let goalsState = $state<CalculatorGoalsState>(emptyGoalsState());
  let savedSnapshot = $state("");
  let showSaved = $state(false);
  let isSaving = $state(false);
  let saveError = $state("");
  let addError = $state("");
  /** Character name_id from `?add=` — consumed after catalog + goals hydrate. */
  let pendingPlannerAdd = $state<string | null>(null);
  let costScope = $state<CostScope>("selected");
  /** Character pick lists put roster-owned names first. */
  let sortOwnedFirst = $state(true);
  /** Configure dialog open (gear on a goal row). */
  let configuring = $state(false);
  /** Soft-deleted rows; applied on Save. */
  let pendingRemoveIds = $state(new Set<string>());

  const session = authClient.useSession();

  /** Dirty ignores selectedId — picking a row shouldn't demand Save. */
  let hasUnsavedChanges = $derived(
    goalsHaveUnsavedChanges({
      hydrated: goalsHydrated,
      state: goalsState,
      savedSnapshot,
      pendingRemoveIds,
    }),
  );
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);
  let parsedSavedSnapshot = $derived.by((): CalculatorGoalsState | null => {
    if (!savedSnapshot) return null;
    try {
      return parseGoalsState(JSON.parse(savedSnapshot) as unknown);
    } catch {
      return null;
    }
  });
  let changedCount = $derived.by(() => {
    if (!savedSnapshot) return 0;
    if (!parsedSavedSnapshot) return goalsState.goals.length;
    const current = parseGoalsState(goalsState).goals;
    const savedMap = new Map(parsedSavedSnapshot.goals.map((g) => [g.id, g]));
    let n = 0;
    const seen = new Set<string>();
    for (const g of current) {
      seen.add(g.id);
      if (pendingRemoveIds.has(g.id)) {
        n += 1;
        continue;
      }
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
    if (!browser || goalsHydrated) return;
    let cancelled = false;

    async function hydrate() {
      const { data: sess } = await authClient.getSession();
      if (cancelled) return;
      const pending = await hydrateGoalsState(Boolean(sess));
      if (cancelled) return;
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

  /** Same-tab sync when itinerary (or another surface) persists goals. */
  $effect(() => {
    void $goalsLocalRevision;
    if (!browser || !goalsHydrated || hasUnsavedChanges) return;
    const pending = readGoalsIfChanged(savedSnapshot);
    if (!pending) return;
    goalsState = pending.state;
    savedSnapshot = pending.json;
  });

  $effect(() => {
    if (!browser) return;
    const nameId = page.url.searchParams.get("add")?.trim();
    if (!nameId) return;
    const next = nextSearchPath(page.url, { add: null });
    if (next) replaceState(next, page.state);
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
    if (!catalog || !goalsHydrated) return;
    pendingPlannerAdd = null;
    addOrSelectCharacter(nameId);
  });

  function commitGoals(next: CalculatorGoalsState) {
    goalsState = next;
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
      pendingRemoveIds = new Set();
      saveError = "";
    } catch {
      /* ignore */
    }
  }

  async function saveGoals() {
    if (isSaving) return;
    isSaving = true;
    saveError = "";

    const result = await saveGoalsState({
      state: goalsState,
      pendingRemoveIds,
      savedSnapshot,
      cloud: Boolean($session.data),
    });

    if (!result.ok) {
      saveError = result.message;
      isSaving = false;
      return;
    }

    pendingRemoveIds = new Set();
    commitSaved(result.capture);
    isSaving = false;

    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  let selectedGoal = $derived(findGoal(goalsState, goalsState.selectedId));

  let ownedIds = $derived(ownedNameIds($charactersOwned));

  let characterOptions = $derived(
    plannerCharacterOptions(catalog, ownedIds, sortOwnedFirst),
  );
  let weaponOptions = $derived(plannerWeaponOptions(catalog));

  let autofillSeq = 0;

  async function autofillCharacterTarget(nameId: string, goalId: string) {
    if (!catalog) return;
    const seq = ++autofillSeq;
    const next = await autofillCharacterGoalState({
      state: goalsState,
      catalog,
      nameId,
      goalId,
    });
    if (seq !== autofillSeq || !next) return;
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
    const existing = goalsState.goals.find(
      (g) => g.kind === "character" && g.name_id === resolved,
    );
    if (existing) {
      cancelPick();
      addError = "";
      if (goalsState.selectedId !== existing.id) {
        commitGoals({ ...goalsState, selectedId: existing.id });
      }
      beginConfigure();
      return;
    }
    addCharacterWith(resolved);
  }

  function addCharacterWith(nameId: string) {
    if (!catalog) return;
    cancelPick();
    const result = appendCatalogCharacterGoal(
      goalsState,
      catalog,
      nameId,
      {
        owned: $charactersOwned,
        weapons: getRosterWeaponsCached(),
      },
    );
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
    const result = appendCatalogWeaponGoal(goalsState, catalog, weaponId, {
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
    if (goalsState.selectedId === id) return;
    cancelPick();
    commitGoals({ ...goalsState, selectedId: id });
  }

  function beginConfigure() {
    configuring = true;
  }

  function openConfigure(id: string) {
    if (pendingRemoveIds.has(id)) return;
    cancelPick();
    if (goalsState.selectedId !== id) {
      commitGoals({ ...goalsState, selectedId: id });
    }
    beginConfigure();
  }

  function closeConfigure() {
    configuring = false;
  }

  function deleteGoal(id: string) {
    if (goalsState.selectedId === id) closeConfigure();
    addError = "";
    const next = new Set(pendingRemoveIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    pendingRemoveIds = next;
  }

  function toggleStar(id: string) {
    const current = findGoal(goalsState, id);
    if (!current) return;
    commitGoals(replaceGoal(goalsState, toggleGoalStarred(current)));
  }

  function portraitFor(nameId: string) {
    return pickModalCharacter(nameId, catalog, $charactersOwned);
  }

  let starredGoalList = $derived(
    starredGoals(
      goalsState.goals.filter((g) => !pendingRemoveIds.has(g.id)),
    ),
  );

  let aggregate = $derived.by((): AggregatedUpgradeCosts | null => {
    if (!catalog || !goalsHydrated) return null;
    const activeGoals = goalsState.goals.filter(
      (g) => !pendingRemoveIds.has(g.id),
    );
    if (costScope === "selected") {
      if (!selectedGoal || pendingRemoveIds.has(selectedGoal.id)) {
        return emptyAggregate();
      }
      return costsForGoal(selectedGoal, catalog);
    }
    if (costScope === "starred") {
      return aggregateGoalCosts(starredGoalList, catalog);
    }
    return aggregateGoalCosts(activeGoals, catalog);
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

  let ranksExpanded = $state(true);

  let materialRows = $derived.by(() => {
    const data = catalog;
    if (!data || !aggregate) return [];
    const bag =
      ranksExpanded || !craftRanksCanExpand(aggregate.materials, data)
        ? aggregate.materials
        : collapseCraftRanks(aggregate.materials, data);
    return Object.entries(bag)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const meta = data.materials[id];
        return {
          id,
          count,
          name: meta?.name ?? `Material ${id}`,
          icon: meta?.icon ?? `UI_ItemIcon_${id}`,
          rankLevel: meta?.rankLevel ?? 1,
          sources: meta?.sources ?? [],
        };
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  });

  let ranksCanExpand = $derived.by(() => {
    if (!catalog || !aggregate) return false;
    return craftRanksCanExpand(aggregate.materials, catalog);
  });

  function formatCount(n: number): string {
    return n.toLocaleString("en-US");
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

        {#if addError}
          <p class="save-error">{addError}</p>
        {/if}

        {#if goalsState.goals.length === 0}
          <p class="section-lede">
            Add a character or weapon goal to start planning costs.
          </p>
        {:else}
          <GoalList
            goals={goalsState.goals}
            {catalog}
            selectedId={goalsState.selectedId}
            removedIds={pendingRemoveIds}
            onSelect={selectGoal}
            onStar={toggleStar}
            onReorder={(from, to) =>
              commitGoals(moveGoal(goalsState, from, to))}
            onConfigure={openConfigure}
            onRemove={deleteGoal}
          />
        {/if}
      </aside>

      <div class="results-panel">
        <div class="results-head">
          <h2 class="section-title">Required</h2>
          <div class="scope-row" role="group" aria-label="Cost scope">
            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "all"}
              aria-pressed={costScope === "all"}
              onclick={() => (costScope = "all")}
            >
              All goals
            </button>
            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "selected"}
              aria-pressed={costScope === "selected"}
              onclick={() => (costScope = "selected")}
            >
              Selected
            </button>
            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "starred"}
              aria-pressed={costScope === "starred"}
              onclick={() => (costScope = "starred")}
            >
              Starred
            </button>
          </div>
        </div>

        {#if costScope === "starred" && starredGoalList.length > 0}
          <p class="section-lede">
            Starred goals appear here and on the farming itinerary.
          </p>
        {/if}

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
            <div class="group-head">
              <h3 class="group-title">Materials</h3>
              {#if ranksCanExpand}
                <button
                  type="button"
                  class="eyebrow ranks-toggle"
                  aria-expanded={ranksExpanded}
                  onclick={() => (ranksExpanded = !ranksExpanded)}
                >
                  {ranksExpanded ? "Collapse" : "Expand"}
                  <IconChevronDown size={14} strokeWidth={2.25} />
                </button>
              {/if}
            </div>
            <ul class="mat-list">
              {#each materialRows as mat (mat.id)}
                {@const source = mat.sources[0]}
                <li class="mat-row">
                  <img
                    class="mat-icon"
                    src={assetUrl(mat.icon) ?? ""}
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy"
                  />
                  <span class="mat-text">
                    <span class="mat-name">{mat.name}</span>
                    {#if source}
                      <span class="meta-sub mat-source">
                        {#if source.icon && assetUrl(source.icon)}
                          <img
                            class="mat-source-icon"
                            src={assetUrl(source.icon) ?? ""}
                            alt=""
                            width="16"
                            height="16"
                            loading="lazy"
                            onerror={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        {/if}
                        {formatMaterialSourceLine(source)}
                      </span>
                    {/if}
                  </span>
                  <span class="mat-count">×{formatCount(mat.count)}</span>
                </li>
              {/each}
            </ul>
          {:else if aggregate.mora === 0 && aggregate.characterExp === 0 && aggregate.weaponExp === 0}
            <p class="section-lede">
              {#if goalsState.goals.length === 0}
                Add a goal to see costs.
              {:else if costScope === "starred" && starredGoalList.length === 0}
                Star a goal to include it here and on the farming itinerary.
              {:else}
                Nothing to farm — configs match.
              {/if}
            </p>
          {/if}
        {/if}
      </div>
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
    onChange={(next) => commitGoals(replaceGoal(goalsState, next))}
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
    align-items: center;
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

  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .group-head .group-title {
    margin: 0;
  }

  .ranks-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .ranks-toggle:hover {
    color: var(--foreground-color);
  }

  .ranks-toggle :global(svg) {
    transition: transform 160ms ease;
  }

  .ranks-toggle[aria-expanded="true"] :global(svg) {
    transform: rotate(180deg);
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

  .mat-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
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

  .mat-source {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .mat-source-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    flex-shrink: 0;
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
