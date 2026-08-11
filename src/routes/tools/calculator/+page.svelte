<script lang="ts">
  import { browser } from "$app/environment";
  import { authClient } from "$lib/auth-client";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import { assetUrl } from "$lib/asset-urls";
  import { getCharacterPortrait } from "$lib/utils";
  import { charactersOwned } from "$lib/stores";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import {
    diffCharacterUpgrade,
    diffWeaponUpgrade,
    expItemsNeeded,
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
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";

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

  const session = authClient.useSession();

  /** Dirty ignores selectedId — picking a row shouldn't demand Save. */
  let hasUnsavedChanges = $derived.by(() => {
    if (!goalsHydrated || !savedSnapshot) return false;
    try {
      const saved = parseGoalsState(JSON.parse(savedSnapshot) as unknown);
      return (
        JSON.stringify(parseGoalsState(goalsState).goals) !==
        JSON.stringify(saved.goals)
      );
    } catch {
      return goalsDiffersFromSnapshot(goalsState, savedSnapshot);
    }
  });
  let savedVisible = $derived(showSaved && !hasUnsavedChanges);
  let changedCount = $derived.by(() => {
    if (!savedSnapshot) return 0;
    try {
      const saved = parseGoalsState(JSON.parse(savedSnapshot) as unknown);
      const current = parseGoalsState(goalsState).goals;
      const savedMap = new Map(saved.goals.map((g) => [g.id, g]));
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
    } catch {
      return goalsState.goals.length;
    }
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

      const pending = captureGoals(next);
      goalsState = pending.state;
      savedSnapshot = pending.json;
      costScope = pending.state.goals.length >= 2 ? "all" : "selected";
      goalsHydrated = true;
    }

    void hydrate();
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
    if (goal.kind === "character") {
      return `Lv ${goal.start.level} → ${goal.target.level}`;
    }
    return `Lv ${goal.start.level} → ${goal.target.level}`;
  }

  function goalIcon(goal: CalculatorGoal): string | null {
    if (goal.kind === "character") {
      return getCharacterPortrait(goal.name_id);
    }
    const icon = catalog?.weapons.find((w) => w.id === goal.weapon_id)?.icon;
    return assetUrl(icon ?? null);
  }

  function addCharacter() {
    if (!catalog?.characters[0]) return;
    const goal = createCharacterGoal(catalog.characters[0].name_id);
    commitGoals(appendGoal(goalsState, goal));
  }

  function addWeapon() {
    if (!catalog?.weapons[0]) return;
    const goal = createWeaponGoal(catalog.weapons[0].id);
    commitGoals(appendGoal(goalsState, goal));
  }

  function selectGoal(id: string) {
    if (goalsState.selectedId === id) return;
    commitGoals({ ...goalsState, selectedId: id });
  }

  function deleteGoal(id: string) {
    commitGoals(removeGoal(goalsState, id));
  }

  function updateSelected(mutator: (goal: CalculatorGoal) => CalculatorGoal) {
    const current = selectedGoal;
    if (!current) return;
    commitGoals(replaceGoal(goalsState, mutator(current)));
  }

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
      .sort(
        (a, b) =>
          b.rankLevel - a.rankLevel || a.name.localeCompare(b.name),
      );
  });

  function formatCount(n: number): string {
    return n.toLocaleString("en-US");
  }

  function lookupCharacter(
    nameId: string,
  ): CharacterOwned | Character | undefined {
    return $charactersOwned.find((c) => c.name_id === nameId);
  }
</script>

<PageShell class="gap-8 calculator-page">
  <header class="page-head">
    <PageTrail items={[{ label: "Calculator" }]} />
    <div class="page-head-text">
      <h1 class="page-title">Calculator</h1>
      <p class="page-meta">
        Build upgrade goals for characters and weapons. Save to keep them
        locally{#if $session.data}
          and on your account{/if}.
      </p>
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
            <button type="button" class="ghost-btn" onclick={addCharacter}>
              + Character
            </button>
            <button type="button" class="ghost-btn" onclick={addWeapon}>
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
              <li>
                <button
                  type="button"
                  class="goal-row"
                  class:is-active={active}
                  aria-current={active ? "true" : undefined}
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
                  class="goal-remove"
                  aria-label={`Remove ${goalLabel(goal)}`}
                  onclick={() => deleteGoal(goal.id)}
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <div class="config-panel">
        {#if selectedGoal}
          <h2 class="section-title">Configure</h2>
          <div class="picker-row">
            {#if selectedGoal.kind === "character"}
              <label class="field">
                <span class="field-label">Character</span>
                <CharacterSearchSelect
                  bind:value={
                    () => selectedGoal.name_id,
                    (name_id) =>
                      updateSelected((g) =>
                        g.kind === "character" ? { ...g, name_id } : g,
                      )
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
                      const weapon_id = Number(raw);
                      updateSelected((g) =>
                        g.kind === "weapon" ? { ...g, weapon_id } : g,
                      );
                    }
                  }
                  options={weaponOptions}
                  placeholder="Search weapon…"
                  aria-label="Search weapon"
                />
              </label>
            {/if}
          </div>

          <div class="config-columns">
            <div class="config-col">
              <h3 class="group-title">Start</h3>
              {#if selectedGoal.kind === "character"}
                <label class="field">
                  <span class="field-label">Level</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="90"
                    value={selectedGoal.start.level}
                    oninput={(e) => {
                      const level = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? { ...g, start: { ...g.start, level } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Ascension</span>
                  <input
                    class="num-input"
                    type="number"
                    min="0"
                    max="6"
                    value={selectedGoal.start.ascension}
                    oninput={(e) => {
                      const ascension = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? { ...g, start: { ...g.start, ascension } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Normal attack</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.start.talents.normal}
                    oninput={(e) => {
                      const normal = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              start: {
                                ...g.start,
                                talents: { ...g.start.talents, normal },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Skill</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.start.talents.skill}
                    oninput={(e) => {
                      const skill = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              start: {
                                ...g.start,
                                talents: { ...g.start.talents, skill },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Burst</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.start.talents.burst}
                    oninput={(e) => {
                      const burst = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              start: {
                                ...g.start,
                                talents: { ...g.start.talents, burst },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
              {:else}
                <label class="field">
                  <span class="field-label">Level</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="90"
                    value={selectedGoal.start.level}
                    oninput={(e) => {
                      const level = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "weapon"
                          ? { ...g, start: { ...g.start, level } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Ascension</span>
                  <input
                    class="num-input"
                    type="number"
                    min="0"
                    max="6"
                    value={selectedGoal.start.ascension}
                    oninput={(e) => {
                      const ascension = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "weapon"
                          ? { ...g, start: { ...g.start, ascension } }
                          : g,
                      );
                    }}
                  />
                </label>
              {/if}
            </div>

            <div class="config-col">
              <h3 class="group-title">Target</h3>
              {#if selectedGoal.kind === "character"}
                <label class="field">
                  <span class="field-label">Level</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="90"
                    value={selectedGoal.target.level}
                    oninput={(e) => {
                      const level = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? { ...g, target: { ...g.target, level } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Ascension</span>
                  <input
                    class="num-input"
                    type="number"
                    min="0"
                    max="6"
                    value={selectedGoal.target.ascension}
                    oninput={(e) => {
                      const ascension = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? { ...g, target: { ...g.target, ascension } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Normal attack</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.target.talents.normal}
                    oninput={(e) => {
                      const normal = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              target: {
                                ...g.target,
                                talents: { ...g.target.talents, normal },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Skill</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.target.talents.skill}
                    oninput={(e) => {
                      const skill = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              target: {
                                ...g.target,
                                talents: { ...g.target.talents, skill },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Burst</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedGoal.target.talents.burst}
                    oninput={(e) => {
                      const burst = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "character"
                          ? {
                              ...g,
                              target: {
                                ...g.target,
                                talents: { ...g.target.talents, burst },
                              },
                            }
                          : g,
                      );
                    }}
                  />
                </label>
              {:else}
                <label class="field">
                  <span class="field-label">Level</span>
                  <input
                    class="num-input"
                    type="number"
                    min="1"
                    max="90"
                    value={selectedGoal.target.level}
                    oninput={(e) => {
                      const level = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "weapon"
                          ? { ...g, target: { ...g.target, level } }
                          : g,
                      );
                    }}
                  />
                </label>
                <label class="field">
                  <span class="field-label">Ascension</span>
                  <input
                    class="num-input"
                    type="number"
                    min="0"
                    max="6"
                    value={selectedGoal.target.ascension}
                    oninput={(e) => {
                      const ascension = Number(e.currentTarget.value);
                      updateSelected((g) =>
                        g.kind === "weapon"
                          ? { ...g, target: { ...g.target, ascension } }
                          : g,
                      );
                    }}
                  />
                </label>
              {/if}
            </div>
          </div>
        {:else}
          <EmptyState message="Select or add a goal to configure" />
        {/if}
      </div>

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
                <span class="meta-name">{formatCount(aggregate.weaponExp)}</span>
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
                    width="36"
                    height="36"
                    loading="lazy"
                  />
                  <span class="mat-name"
                    >{meta?.name ?? `Item ${book.id}`}</span
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
                    width="36"
                    height="36"
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
                    width="36"
                    height="36"
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
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  :global(.calculator-page) {
    padding-bottom: 6rem;
  }

  .calc-layout {
    display: grid;
    grid-template-columns: minmax(12rem, 0.85fr) minmax(0, 1.15fr) minmax(
        0,
        0.95fr
      );
    gap: 1.5rem 1.75rem;
    align-items: start;
  }

  .goals-panel,
  .config-panel,
  .results-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
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

  .scope-btn.active {
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 28%, transparent);
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

  .goal-list > li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.25rem;
    align-items: stretch;
  }

  .goal-row {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 0.55rem;
    align-items: center;
    width: 100%;
    padding: 0.45rem 0.55rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid transparent;
    background: transparent;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }

  .goal-row:hover {
    background: color-mix(in srgb, var(--foreground-color) 7%, transparent);
  }

  .goal-row.is-active {
    background: var(--surface-selected);
    border-color: color-mix(in srgb, var(--accent-3) 22%, transparent);
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

  .goal-remove {
    width: 2rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
  }

  .goal-remove:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .picker-row {
    max-width: 22rem;
  }

  .config-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem 1.25rem;
  }

  .config-col {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
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

  .num-input {
    width: 100%;
    max-width: 8rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    background: var(--background-color);
    color: var(--foreground-color);
    font-size: var(--text-sm);
  }

  .totals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .totals li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
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
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .mat-row {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 0.65rem;
    align-items: center;
  }

  .mat-icon {
    width: 36px;
    height: 36px;
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
      color-mix(in srgb, var(--accent-3) 22%, transparent);
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
    background: color-mix(in srgb, var(--accent-1) 40%, transparent);
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
    color: var(--accent-1);
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

  @media (max-width: 1100px) {
    .calc-layout {
      grid-template-columns: 1fr 1fr;
    }

    .goals-panel {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 800px) {
    .calc-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
