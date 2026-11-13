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
  import { assetUrl } from "#lib/asset-urls.js";
  import { ownedNameIds } from "#lib/utils.js";
  import { charactersOwned } from "#lib/stores.js";
  import {
    expItemsNeeded,
    formatMaterialSourceLine,
    collapseCraftRanks,
    craftRanksCanExpand,
  } from "#lib/upgrade-costs.js";
  import {
    aggregateGoalCosts,
    costsForGoal,
    emptyAggregate,
    findGoal,
    moveGoal,
    parseGoalsState,
    replaceGoal,
    starredGoals,
    toggleGoalStarred,
  } from "#lib/calculator-goals.js";
  import {
    appendCatalogCharacterGoal,
    appendCatalogWeaponGoal,
    pickModalCharacter,
    plannerCharacterOptions,
    plannerWeaponOptions,
    resolveCatalogCharacterId,
  } from "#lib/planner-goal-edits.js";
  import { autofillCharacterGoalState } from "#lib/calculator-goals-lifecycle.js";
  import { useGoalsDraft } from "#lib/app/goals-draft.svelte.js";
  import { addressUrl, nextSearchPath } from "#lib/query-state.js";
  import { auditPath } from "#lib/ui/nav-links.js";
  import type {
    AggregatedUpgradeCosts,
    CalculatorGoalsState,
  } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
  import Button from "#lib/ui/components/Button.svelte";
  import GoalConfigureModal from "#lib/ui/components/GoalConfigureModal.svelte";
  import GoalList from "#lib/ui/components/GoalList.svelte";
  import GoalPickModal from "#lib/ui/components/GoalPickModal.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";

  type CostScope = "all" | "selected" | "starred";

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
  let parsedSavedSnapshot = $derived.by((): CalculatorGoalsState | null => {
    if (!goals.savedJson) return null;
    try {
      return parseGoalsState(JSON.parse(goals.savedJson) as unknown);
    } catch {
      return null;
    }
  });
  let changedCount = $derived.by(() => {
    if (!goals.savedJson) return 0;
    if (!parsedSavedSnapshot) return goals.state.goals.length;
    const current = parseGoalsState(goals.state).goals;
    const savedMap = new Map(parsedSavedSnapshot.goals.map((g) => [g.id, g]));
    let n = 0;
    const seen = new Set<string>();
    for (const g of current) {
      seen.add(g.id);
      if (goals.pendingRemoveIds.has(g.id)) {
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
    if (await goals.save()) flashSaved();
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
    const activeGoals = goals.state.goals.filter(
      (g) => !goals.pendingRemoveIds.has(g.id),
    );
    if (costScope === "selected") {
      if (!selectedGoal || goals.pendingRemoveIds.has(selectedGoal.id)) {
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

  {#if loading || !goals.hydrated}
    <LoadingState message="Loading upgrade costs…" />
  {:else if loadError}
    <EmptyState message={loadError ?? "Couldn’t load cost data"} />
  {:else if catalog}
    {#if hasUnsavedChanges || goals.unsent || goals.saving || savedVisible || saveError}
      <div class="save-bar">
        <div class="save-status">
          <span
            class="save-dot"
            class:saving={goals.saving}
            class:saved={savedVisible}
          ></span>
          <span
            class="save-label"
            class:save-error={!!saveError &&
              !goals.saving &&
              !savedVisible &&
              !hasUnsavedChanges}
          >
            {goals.saving
              ? "Saving..."
              : savedVisible
                ? "Saved"
                : hasUnsavedChanges
                  ? "Unsaved changes"
                  : saveError || "Saved on this device — not synced yet"}
          </span>
          {#if hasUnsavedChanges && saveError && !goals.saving}
            <span class="save-error">{saveError}</span>
          {/if}
          {#if hasUnsavedChanges}
            <span class="save-changed">({changedCount} changed)</span>
          {/if}
        </div>
        {#if (hasUnsavedChanges || goals.unsent) && !goals.saving}
          <div class="save-actions">
            {#if hasUnsavedChanges}
              <Button variant="ghost" onclick={cancelEdits}>Cancel</Button>
            {/if}
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

        {#if goals.state.goals.length === 0}
          <p class="section-lede">
            Add a character or weapon goal to start planning costs, or
            <a class="lede-link" href={auditPath}
              >get suggestions from Build Audit</a
            >.
          </p>
        {:else}
          <GoalList
            goals={goals.state.goals}
            {catalog}
            selectedId={goals.state.selectedId}
            removedIds={goals.pendingRemoveIds}
            onSelect={selectGoal}
            onStar={toggleStar}
            onReorder={(from, to) =>
              commitGoals(moveGoal(goals.state, from, to))}
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
              onclick={() => (costScope = "all")}>All goals</button
            >

            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "selected"}
              aria-pressed={costScope === "selected"}
              onclick={() => (costScope = "selected")}>Selected</button
            >

            <button
              type="button"
              class="scope-btn"
              class:active={costScope === "starred"}
              aria-pressed={costScope === "starred"}
              onclick={() => (costScope = "starred")}>Starred</button
            >
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
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
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
              {#if goals.state.goals.length === 0}
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

  .lede-link {
    color: var(--foreground-color);
    text-decoration: underline;
    text-underline-offset: 0.15em;
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
