<script lang="ts">
  import {
    teamsOwnedStygian,
    allTeamsStygian,
    stygianEnemiesBoard,
    stygianScheduleBoard,
    staticBoardsLoaded,
    staticBoardsError,
    charactersOwned,
    charactersHydrated,
    teamsOwnedLoaded,
    ensureTeamsOwned,
    ensureStaticBoards,
  } from "$lib/stores";
  import { stygianSlotLabel } from "$lib/slotLabels";
  import { solveStygianWithFallback, SOLVER_REVISION } from "$lib/solver";
  import {
    SOLUTIONS_COUNT,
    boardSlotRate,
    filterDisplaySolutions,
    clampSolutionIndex,
    stepSolutionIndex,
    assignmentKeyFor,
  } from "$lib/board-solutions";
  import { ownedNameIds } from "$lib/utils";
  import Team from "$lib/ui/components/Team.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconDatabase from "$lib/ui/icons/IconDatabase.svelte";
  import InfoPopover from "$lib/ui/components/InfoPopover.svelte";
  import IconPlay from "$lib/ui/icons/IconPlay.svelte";
  import { handleKeyboardClick, handlePointerAction } from "$lib/ui/pointer";
  import type { StygianTeam, StygianClearVideo } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";
  import { resolve } from "$app/paths";
  import {
    ensureClearVideos,
    getClearVideosCached,
    youtubeThumbnailFallbackUrl,
    youtubeThumbnailUrl,
  } from "$lib/app/stygian-clear-videos";

  const SLOTS = ["top", "middle", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  /** Initial / incremental page size for the per-field clear-video list. */
  const CLEAR_VIDEOS_PAGE = 5;

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let enemies = $derived($stygianEnemiesBoard);
  let schedule = $derived($stygianScheduleBoard);

  // Meta boards + owned subset — warmed from bootstrap when possible.
  $effect(() => {
    ensureStaticBoards().catch(() => {});
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  async function retryStaticBoards() {
    try {
      await ensureStaticBoards();
    } catch {
      // staticBoardsError already set
    }
  }

  let selectedIndex = $state(0);
  /** Bumped when clear-video cache fills for the visible solution. */
  let clearVideosRevision = $state(0);
  /** Per-field how many clears are listed in the popover (Show more bumps this). */
  let clearVideosShown = $state<Partial<Record<Slot, number>>>({});

  let hasOwnedCharacters = $derived(
    $charactersOwned.some((character) => character.isOwned),
  );

  let solutions = $derived.by(() => {
    // Avoid a flash of allTeams/min-missing results before owned teams arrive —
    // that path explores a usage-sorted meta list, then gets replaced by the
    // owned RPC order and looks like the floor "regressed."
    if (hasOwnedCharacters && !$teamsOwnedLoaded) return [];
    // Touch revision so policy changes always recompute (no stale memo boards).
    void SOLVER_REVISION;
    return solveStygianWithFallback(
      $teamsOwnedStygian,
      $allTeamsStygian,
      ownedNameIds($charactersOwned),
      SOLUTIONS_COUNT,
    );
  });

  let displaySolutions = $derived(filterDisplaySolutions(solutions));

  let safeIndex = $derived(
    clampSolutionIndex(selectedIndex, displaySolutions.length),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  $effect(() => {
    void solution;
    clearVideosShown = {};
  });

  // After solver: fetch clear videos for the three visible team×boss pairs.
  $effect(() => {
    const sol = solution;
    const board = enemies;
    if (!sol || !board) return;

    const pairs = SLOTS.flatMap((slot) => {
      const assignment = sol.assignments.find((a) => a.slot === slot);
      const enemy = board[slot];
      const teamKey = assignment?.team?.team_key;
      if (!teamKey || enemy?.id == null) return [];
      return [{ team_key: teamKey, enemy_id: enemy.id }];
    });
    if (pairs.length === 0) return;

    const ac = new AbortController();
    ensureClearVideos(pairs, ac.signal)
      .then(() => {
        clearVideosRevision += 1;
      })
      .catch(() => {
        /* leave cache empty; UI stays quiet */
      });

    return () => ac.abort();
  });

  let loading = $derived(
    !$charactersHydrated ||
      (!$staticBoardsError &&
        !$staticBoardsLoaded &&
        $allTeamsStygian.length === 0),
  );

  let waitingForOwned = $derived(hasOwnedCharacters && !$teamsOwnedLoaded);

  let updatedLabel = $derived.by(() => {
    if (!schedule?.openTime) return "";
    return new Date(schedule.openTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  let metaParts = $derived(
    [
      schedule?.challengeName,
      updatedLabel ? `Updated ${updatedLabel}` : "",
    ].filter((part): part is string => Boolean(part)),
  );

  function slotRate(team: StygianTeam, slot: Slot): number {
    return boardSlotRate(team, slot);
  }

  function assignmentKey(slot: Slot): string {
    return assignmentKeyFor(solution, slot);
  }

  function stepSolution(delta: number) {
    const next = stepSolutionIndex(safeIndex, delta, displaySolutions.length);
    if (next == null) return;
    selectedIndex = next;
  }

  function clearsForSlot(slot: Slot): StygianClearVideo[] {
    void clearVideosRevision;
    const assignment = solution?.assignments.find((a) => a.slot === slot);
    const enemy = enemies?.[slot];
    const teamKey = assignment?.team?.team_key;
    if (!teamKey || enemy?.id == null) return [];
    return getClearVideosCached(teamKey, enemy.id) ?? [];
  }

  function videoHostLabel(url: string): string {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host.includes("youtu")) return "YouTube";
      if (host.includes("bilibili")) return "Bilibili";
      return "Video";
    } catch {
      return "Video";
    }
  }

  function clearVideoLabel(clear: StygianClearVideo): string {
    const host = videoHostLabel(clear.video_url);
    const cost = clear.cost != null ? `cost ${clear.cost}` : null;
    const time = clear.time_s != null ? `${clear.time_s}s` : null;
    const bits = [clear.difficulty, cost, time].filter(Boolean);
    return bits.length ? `${host} · ${bits.join(" · ")}` : host;
  }

  function clearsShownLimit(slot: Slot): number {
    return clearVideosShown[slot] ?? CLEAR_VIDEOS_PAGE;
  }

  function showMoreClears(slot: Slot) {
    clearVideosShown[slot] = clearsShownLimit(slot) + CLEAR_VIDEOS_PAGE;
  }
</script>

{#snippet enemyLabel(slot: Slot, linkClass: string)}
  {@const enemy = enemies?.[slot]}
  {#if enemy}
    <a class={linkClass} href={resolve(`/tools/stygian/enemies/${enemy.id}`)}
      >{enemy.enemy_name ?? stygianSlotLabel[slot]}</a
    >
  {:else}
    {stygianSlotLabel[slot]}
  {/if}
{/snippet}

{#snippet fieldColumn(slot: Slot)}
  {@const enemy = enemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}

  <section class="field-hero">
    {#if enemy?.asset}
      <img
        src={getEnemyAsset(enemy.asset)}
        alt=""
        class="hero-img"
        aria-hidden="true"
      />
    {/if}
    <div class="hero-scrim" aria-hidden="true"></div>

    <h2 class="field-heading">
      {@render enemyLabel(slot, "field-heading-link")}
    </h2>

    <div class="hero-body">
      {#if assignment}
        {@const clears = clearsForSlot(slot)}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="rate-row">
          <span>{(assignment.team.usage_rate ?? 0).toFixed(1)}% usage</span>
          <span class="rate-slot"
            >{slotRate(assignment.team, slot).toFixed(0)}% in this field</span
          >
        </div>

        {#if clears.length > 0}
          {@const shown = Math.min(clears.length, clearsShownLimit(slot))}
          <div class="clear-videos">
            <InfoPopover
              label={clears.length === 1 ? "1 video" : `${clears.length} videos`}
              align="start"
              class="clear-videos-trigger"
              panelClass="clear-videos-panel"
              anchorSelector=".field-hero"
            >
              {#snippet icon()}
                <IconPlay size={12} />
              {/snippet}
              <ul class="clear-videos-panel-list">
                {#each clears.slice(0, shown) as clear (clear.clear_key)}
                  {@const thumb = youtubeThumbnailUrl(clear.video_url)}
                  <li>
                    <a
                      class="clear-video-link"
                      href={clear.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {#if thumb}
                        <img
                          class="clear-video-thumb"
                          src={thumb}
                          alt=""
                          width="320"
                          height="180"
                          loading="lazy"
                          decoding="async"
                          onerror={(event) => {
                            const img = event.currentTarget;
                            if (img.dataset.ytFallback === "1") return;
                            const fallback = youtubeThumbnailFallbackUrl(
                              clear.video_url,
                            );
                            if (!fallback) return;
                            img.dataset.ytFallback = "1";
                            img.src = fallback;
                          }}
                        />
                      {/if}
                      <span class="clear-video-meta"
                        >{clearVideoLabel(clear)}</span
                      >
                    </a>
                  </li>
                {/each}
              </ul>
              {#if shown < clears.length}
                <button
                  type="button"
                  class="clear-videos-more"
                  onclick={() => showMoreClears(slot)}
                >
                  Show more · {clears.length - shown} left
                </button>
              {/if}
            </InfoPopover>
          </div>
        {/if}
      {:else if solution}
        <div class="panel-empty">
          <p>No team available for this field</p>
        </div>
      {:else}
        <div class="panel-empty">
          <p>Set up your roster in Settings</p>
        </div>
      {/if}
    </div>
  </section>
{/snippet}

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Stygian Onslaught</h1>
      {#if metaParts.length > 0}
        <p class="page-meta">
          {#each metaParts as part, index (part)}
            {#if index > 0}
              <span class="page-meta-sep" aria-hidden="true">·</span>
            {/if}
            <span>{part}</span>
          {/each}
        </p>
      {/if}
    </div>
    <a class="enemies-index-link" href={resolve("/tools/stygian/enemies")}>
      <IconDatabase size={14} />
      Enemy Database
    </a>
  </header>

  {#if loading}
    <LoadingState />
  {:else if $staticBoardsError && $allTeamsStygian.length === 0}
    <EmptyState message="Could not load Stygian teams right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryStaticBoards}
          >Try again</Button
        >
      {/snippet}
    </EmptyState>
  {:else if waitingForOwned}
    <LoadingState variant="pulse" message="Matching your roster…" />
  {:else if displaySolutions.length === 0}
    <EmptyState
      message="No viable field clears for your roster. Pull for characters that unlock better teams."
    >
      {#snippet action()}
        <a class="pulls-cta" href={resolve("/tools/pulls")}
          >See pull suggestions</a
        >
      {/snippet}
    </EmptyState>
  {:else}
    <Surface flush class="solution-board">
      <div class="board-head">
        <div class="board-head-left">
          <span class="eyebrow board-eyebrow">
            Solution {safeIndex + 1}
            <span class="board-eyebrow-total">of {displaySolutions.length}</span
            >
          </span>
        </div>

        <div class="board-actions">
          {#if displaySolutions.length > 1}
            <div class="pager">
              <button
                type="button"
                class="pager-btn"
                aria-label="Previous solution"
                disabled={safeIndex === 0}
                onpointerdown={(event) =>
                  handlePointerAction(event, () => stepSolution(-1))}
                onclick={(event) =>
                  handleKeyboardClick(event, () => stepSolution(-1))}
              >
                <IconChevronDown size={16} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                class="pager-btn pager-btn-next"
                aria-label="Next solution"
                disabled={safeIndex === displaySolutions.length - 1}
                onpointerdown={(event) =>
                  handlePointerAction(event, () => stepSolution(1))}
                onclick={(event) =>
                  handleKeyboardClick(event, () => stepSolution(1))}
              >
                <IconChevronDown size={16} strokeWidth={2.25} />
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="board-body">
        {#each SLOTS as slot (slot)}
          <div class="board-cell" data-panel-slot={slot}>
            {#key assignmentKey(slot)}
              {@render fieldColumn(slot)}
            {/key}
          </div>
        {/each}
      </div>
    </Surface>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="fallback-note">
        Unable to find fearless mode clears with your roster — try teams similar
        to those suggested on hard or menacing.
      </p>
    {/if}
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .enemies-index-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    width: fit-content;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
    text-decoration: none;
  }

  .enemies-index-link:hover {
    text-decoration: underline;
  }

  /* ── Solution board ─────────────────────────────────────────────── */
  /* Board hairlines are pure white — warm tones over blue mid mix to mud. */
  :global(.solution-board) {
    overflow: hidden;
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  .board-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-subtle);
    background: var(--surface-inset);
  }

  .board-head-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
    min-width: 0;
  }

  .board-eyebrow {
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .board-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .board-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    background: var(--surface-raised);
    transition: var(--control-transition);
  }

  .pager-btn :global(svg) {
    transform: rotate(90deg);
  }

  .pager-btn-next :global(svg) {
    transform: rotate(-90deg);
  }

  .pager-btn:hover:not(:disabled) {
    color: var(--accent-1);
    border-color: var(--border-strong);
  }

  .pager-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .board-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .board-cell {
    min-width: 0;
    padding: var(--space-4);
  }

  .board-cell + .board-cell {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  @media (min-width: 1024px) {
    .board-body {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .board-cell + .board-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }
  }

  /* ── Field hero: boss art as backdrop, team composited on top ───── */
  .field-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: color-mix(
      in srgb,
      var(--foreground-color) 4%,
      var(--background-color)
    );
  }

  .hero-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: contain;
    transform: scale(1.35);
    transform-origin: 50% 25%;
    pointer-events: none;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--background-color) 35%, transparent) 0%,
      transparent 22%,
      transparent 40%,
      color-mix(in srgb, var(--background-color) 88%, transparent) 72%,
      var(--background-color) 100%
    );
    pointer-events: none;
  }

  .field-heading {
    position: relative;
    z-index: 1;
    /* Bottom padding is width-relative — it reserves the boss-art area
       between the heading and the composited team. */
    padding: var(--space-3) var(--space-3) 34%;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
  }

  .field-heading-link {
    color: inherit;
    text-decoration: none;
  }

  .field-heading-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .hero-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: auto;
    padding: var(--space-5) var(--space-3) var(--space-3);
  }

  .rate-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .rate-slot {
    color: var(--accent-1);
  }

  .clear-videos {
    display: flex;
    align-items: baseline;
  }

  /* Inherit mid cream so the dotted trigger matches rate-row, not gold-on-black. */
  :global(.clear-videos-trigger) {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  /* Width/left are set in JS to match `.field-hero` (column / stacked cell). */
  :global(.info-panel.clear-videos-panel) {
    max-height: min(22rem, calc(100vh - 2rem));
    padding: 0.65rem 0.75rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--background-color) 32%, transparent)
      transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar) {
    width: 0.55rem;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb) {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--background-color) 32%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb:hover) {
    background: color-mix(in srgb, var(--background-color) 48%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .clear-videos-panel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .clear-video-link {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: inherit;
    text-decoration: none;
  }

  .clear-video-thumb {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 3px;
    background: color-mix(in srgb, var(--background-color) 25%, transparent);
  }

  .clear-video-meta {
    text-decoration: underline;
    text-underline-offset: 0.12em;
    line-height: 1.35;
  }

  .clear-video-link:hover .clear-video-meta {
    opacity: 0.85;
  }

  .clear-videos-more {
    margin: 0.45rem 0 0;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.12em;
    opacity: 0.75;
  }

  .clear-videos-more:hover {
    opacity: 1;
  }

  .panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .fallback-note {
    font-size: var(--text-xs);
    text-align: center;
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  .pulls-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--accent-1);
    background: var(--accent-1);
    color: var(--control-knob-on);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
  }

  .pulls-cta:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }
</style>
