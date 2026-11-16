<script lang="ts">
  import { onMount } from "svelte";
  import {
    allTeamsAbyss,
    allTeamsStygian,
    abyssEnemiesBoard,
    stygianEnemiesBoard,
    stygianScheduleBoard,
    staticBoardsPhase,
    staticBoardsView,
    ensureStaticBoards,
  } from "#lib/stores/boards.js";
  import { charactersOwned, hasSavedRoster } from "#lib/stores/roster.js";
  import type { InfographicSlot } from "#lib/boards/infographic-teams.js";
  import {
    buildAbyssSummaryColumns,
    buildStygianSummaryColumns,
    dpsDisplayName,
    fourStarNameIds,
    prepareSummaryColumns,
    summaryDpsOptions,
    summaryHeaderMeta,
    summarySideOptions,
    type DisplayGroup,
    type PreparedSummaryColumn,
  } from "#lib/boards/summary-columns.js";
  import PageShell from "#lib/ui/components/PageShell.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";
  import CharacterTagSearch from "#lib/ui/components/CharacterTagSearch.svelte";
  import PageTrail from "#lib/ui/components/PageTrail.svelte";
  import SummaryInfographic from "#lib/ui/components/summary-tool/SummaryInfographic.svelte";
  import AltsModal from "#lib/ui/components/summary-tool/AltsModal.svelte";
  import { ownedNameIds } from "#lib/utils.js";
  import { abyssPath, settingsPath, stygianPath } from "#lib/ui/nav-links.js";
  import { authClient } from "#lib/auth-client.js";
  import { needsRosterSetup } from "#lib/roster/roster-setup.js";
  import type { Tables } from "#lib/types/database.types.js";

  type Character = Tables<"characters">;

  let {
    mode,
    mapping,
  }: {
    mode: "abyss" | "stygian";
    mapping: Map<string, Character>;
  } = $props();

  let activeSlot = $state<InfographicSlot>("top");
  let dpsTags = $state<string[]>([]);
  let rosterFilter = $state<"all" | "owned">("all");
  let altsModal = $state<DisplayGroup | null>(null);

  onMount(() => {
    ensureStaticBoards().catch(() => {});
  });

  async function retryBoards() {
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      // staticBoardsPhase already set
    }
  }

  let boards = $derived(staticBoardsView($staticBoardsPhase));
  let loading = $derived(boards.kind === "loading");

  let fourStarIds = $derived(fourStarNameIds(mapping.values()));

  let ownedIds = $derived(ownedNameIds($charactersOwned));
  const session = authClient.useSession();
  /** Same gate as the home-page “configure roster first” card. */
  let showRosterSetup = $derived(
    needsRosterSetup({
      sessionPending: $session.isPending,
      hasSavedRoster: $hasSavedRoster,
      sessionData: $session.data,
    }),
  );

  let trailItems = $derived(
    mode === "abyss"
      ? [{ label: "Abyss", href: abyssPath }, { label: "Summary" }]
      : [{ label: "Stygian", href: stygianPath }, { label: "Summary" }],
  );

  const rosterFilterOptions = [
    { value: "all" as const, label: "All" },
    { value: "owned" as const, label: "Owned" },
  ];

  /** Owned filter: the builders group only teams the roster can field. */
  let ownedFilter = $derived(rosterFilter === "owned" ? ownedIds : undefined);

  let abyssColumnsRaw = $derived(
    buildAbyssSummaryColumns(
      $allTeamsAbyss,
      $abyssEnemiesBoard,
      fourStarIds,
      ownedFilter,
    ),
  );

  let stygianColumnsRaw = $derived(
    buildStygianSummaryColumns(
      $allTeamsStygian,
      $stygianEnemiesBoard,
      fourStarIds,
      ownedFilter,
    ),
  );

  let columns: PreparedSummaryColumn[] = $derived(
    mode === "abyss"
      ? prepareSummaryColumns(abyssColumnsRaw, { dpsTags })
      : prepareSummaryColumns(stygianColumnsRaw, { dpsTags }),
  );

  /** Autocomplete pool: On-Field DPS on this mode's board (respects owned filter). */
  let dpsOptions = $derived(summaryDpsOptions(columns, dpsLabel));

  function dpsLabel(mainDps: string): string {
    return dpsDisplayName(mapping, mainDps);
  }

  let activeRawGroupCount = $derived(
    columns.find((c) => c.slot === activeSlot)?.pool.length ?? 0,
  );

  let sideOptions = $derived(summarySideOptions(mode));

  $effect(() => {
    const allowed = new Set(sideOptions.map((o) => o.value));
    if (!allowed.has(activeSlot)) activeSlot = "top";
  });

  let activeColumn = $derived(
    columns.find((c) => c.slot === activeSlot) ?? columns[0] ?? null,
  );

  let headerMeta = $derived(
    summaryHeaderMeta(mode, $abyssEnemiesBoard, $stygianScheduleBoard),
  );

  function openAltsModal(group: DisplayGroup) {
    altsModal = group;
  }

  function closeAltsModal() {
    altsModal = null;
  }

  $effect(() => {
    activeSlot;
    closeAltsModal();
  });
</script>

<PageShell class="gap-6">
  <header class="page-head">
    <PageTrail items={trailItems} />
    <div class="page-head-text">
      <h1 class="page-title">
        {mode === "abyss" ? "Abyss Summary" : "Stygian Summary"}
      </h1>
      {#if boards.kind === "board" && boards.notice}
        {#if boards.notice === "stale"}
          <p class="page-meta">Showing the previous cycle.</p>
        {/if}
        <Button variant="secondary" onclick={retryBoards}>Try again</Button>
      {/if}
    </div>
  </header>

  <div class="controls">
    <div class="controls-row">
      <SegmentedControl
        options={sideOptions}
        bind:value={activeSlot}
        aria-label={mode === "abyss" ? "Abyss half" : "Stygian field"}
      />
      <SegmentedControl
        options={rosterFilterOptions}
        bind:value={rosterFilter}
        aria-label="Roster filter"
      />
      {#if showRosterSetup}
        <a class="back-link roster-setup-link" href={settingsPath}
          >Configure roster</a
        >
      {/if}
    </div>
    <div class="filter-block">
      <CharacterTagSearch
        bind:tags={dpsTags}
        options={dpsOptions}
        getLabel={dpsLabel}
        getCharacter={(id) => mapping.get(id)}
        countLabel="{activeColumn?.groups.length ?? 0} of {activeRawGroupCount}"
        placeholder="Filter by On-Field DPS…"
        aria-label="Filter by On-Field DPS"
      />
    </div>
  </div>

  {#if loading}
    <LoadingState variant="pulse" message="Loading meta boards…" />
  {:else if boards.kind === "empty-error"}
    <EmptyState message="Could not load static boards.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryBoards}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <SummaryInfographic
      {mode}
      {headerMeta}
      {activeColumn}
      {mapping}
      onopenalts={openAltsModal}
    />
  {/if}
</PageShell>

<AltsModal group={altsModal} {mapping} onclose={closeAltsModal} />

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
  }

  .roster-setup-link {
    align-self: center;
  }

  .filter-block {
    min-width: 0;
  }
</style>
