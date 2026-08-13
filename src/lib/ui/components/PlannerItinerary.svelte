<script lang="ts">
  /**
   * Farming itinerary — pick saved planner goals, see domains / bosses.
   * Home mounts the card; the nav sheet mounts the plain layout.
   */
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import { aggregateGoalCosts } from "$lib/calculator-goals";
  import { readGoalsLocal } from "$lib/calculator-goals-snapshot";
  import {
    farmPlacesFromMaterials,
    groupFarmPlaces,
    readItineraryFocusIds,
    resolveItineraryFocus,
    todayWeekday,
    writeItineraryFocusIds,
  } from "$lib/planner-itinerary";
  import { assetUrl } from "$lib/asset-urls";
  import { collapseCraftRanks } from "$lib/upgrade-costs";
  import type { CalculatorGoal } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import PlannerItineraryGoalsModal from "$lib/ui/components/PlannerItineraryGoalsModal.svelte";

  let {
    chrome = "card",
    showEmpty = false,
    showHeading = true,
  }: {
    chrome?: "card" | "plain";
    /** When no goals, render a planner CTA instead of nothing. */
    showEmpty?: boolean;
    showHeading?: boolean;
  } = $props();

  const plannerPath = resolve("/tools/planner");

  let goals = $state<CalculatorGoal[]>([]);
  let hydrated = $state(false);
  let catalog = $state<UpgradeCostsCatalog | null>(null);
  let catalogError = $state("");
  let focusIds = $state<Set<string>>(new Set());
  let pickingGoals = $state(false);

  onMount(() => {
    goals = readGoalsLocal().goals;
    focusIds = resolveItineraryFocus(goals, readItineraryFocusIds());
    hydrated = true;
    if (goals.length === 0) return;
    void loadUpgradeCosts()
      .then((data) => {
        catalog = data;
      })
      .catch((e) => {
        catalogError =
          (e as Error)?.message ?? "Couldn’t load upgrade costs";
      });
  });

  let focusedGoals = $derived(goals.filter((g) => focusIds.has(g.id)));

  let places = $derived.by(() => {
    if (!catalog || focusedGoals.length === 0) return [];
    return farmPlacesFromMaterials(
      collapseCraftRanks(
        aggregateGoalCosts(focusedGoals, catalog).materials,
        catalog,
      ),
      catalog,
    );
  });

  let sections = $derived(groupFarmPlaces(places, todayWeekday()));

  let focusSummary = $derived.by(() => {
    if (goals.length === 0) return "Goals";
    if (focusedGoals.length === 0) return "No goals";
    if (focusedGoals.length === goals.length) return "All goals";
    return `${focusedGoals.length} of ${goals.length} goals`;
  });

  function persistFocus(next: Set<string>) {
    focusIds = next;
    writeItineraryFocusIds([...next]);
  }

  function toggleGoal(id: string) {
    const next = new Set(focusIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistFocus(next);
  }

  function selectAllGoals() {
    persistFocus(new Set(goals.map((g) => g.id)));
  }

  function selectNoGoals() {
    persistFocus(new Set());
  }

  function wikiHref(name: string): string {
    return `https://genshin-impact.fandom.com/wiki/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
  }
</script>

{#if hydrated && (goals.length > 0 || showEmpty)}
  <section class="itinerary" class:itinerary-card={chrome === "card"}>
    {#if showHeading}
      <div class="itinerary-head">
        <h2 class="section-title">Farming</h2>
        <a class="back-link itinerary-edit" href={plannerPath}>Edit in planner</a>
      </div>
    {/if}

    {#if goals.length === 0}
      <p class="section-lede">
        Set character and weapon goals in the planner to see which domains and
        bosses to run.
      </p>
    {:else}
      <button
        type="button"
        class="goal-trigger"
        aria-haspopup="dialog"
        aria-expanded={pickingGoals}
        onclick={() => (pickingGoals = true)}
      >
        {focusSummary}
      </button>

      {#if !catalog && !catalogError}
        <LoadingState message="Loading upgrade costs…" />
      {:else if catalogError}
        <p class="section-lede">{catalogError}</p>
      {:else if focusedGoals.length === 0}
        <p class="section-lede">Select a goal to see where to farm.</p>
      {:else if places.length === 0}
        <p class="section-lede">Nothing to farm for these goals.</p>
      {:else}
        <div class="farm-sections">
          {#each sections as section (section.kind)}
            <section class="farm-section">
              <h3 class="farm-group-label">{section.label}</h3>
              {#each section.groups as group (`${section.kind}:${group.daysKey}`)}
                <div class="farm-day-group">
                  {#if group.daysLabel}
                    <p class="farm-day-label">
                      {group.daysLabel}
                      {#if group.openToday}
                        <span class="farm-today">today</span>
                      {/if}
                    </p>
                  {/if}
                  <ul class="place-list">
                    {#each group.places as place (`${place.kind}:${place.name}`)}
                      <li class="place-row">
                        {#if place.icon && assetUrl(place.icon)}
                          <img
                            class="place-icon"
                            src={assetUrl(place.icon) ?? ""}
                            alt=""
                            width="28"
                            height="28"
                            loading="lazy"
                            onerror={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        {/if}
                        <div class="place-text">
                          <a
                            class="meta-name place-name"
                            href={wikiHref(place.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {place.name}
                          </a>
                          <span class="meta-sub place-mats">
                            {place.materials.map((m) => m.name).join(", ")}
                          </span>
                        </div>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </section>
          {/each}
        </div>
      {/if}
    {/if}
  </section>
{/if}

<PlannerItineraryGoalsModal
  open={pickingGoals}
  {goals}
  {focusIds}
  {catalog}
  onClose={() => (pickingGoals = false)}
  onToggle={toggleGoal}
  onSelectAll={selectAllGoals}
  onSelectNone={selectNoGoals}
/>

<style>
  .itinerary {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .itinerary-card {
    padding: 1rem 1.1rem 1.15rem;
    border-radius: var(--radius-lg);
    background: var(--background-mid);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .itinerary-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.35rem 0.85rem;
  }

  .itinerary-edit {
    margin: 0;
  }

  .goal-trigger {
    width: fit-content;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .goal-trigger:hover,
  .goal-trigger[aria-expanded="true"] {
    color: var(--foreground-color);
  }

  .farm-sections {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .farm-section {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-width: 0;
  }

  .farm-section + .farm-section {
    padding-top: 0.75rem;
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.12);
  }

  .farm-group-label {
    margin: 0;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .farm-day-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .farm-day-label {
    margin: 0.15rem 0 0;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: var(--text-xs);
    color: var(--foreground-color);
  }

  .farm-today {
    font-size: 0.6rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .place-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .place-row {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    min-width: 0;
  }

  .place-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .place-text {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
  }

  .place-name {
    text-decoration: none;
  }

  .place-name:hover {
    text-decoration: underline;
  }

  .place-mats {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
