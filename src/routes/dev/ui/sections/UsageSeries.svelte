<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import Surface from "#lib/ui/components/Surface.svelte";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";
  import CharacterSearchSelect from "#lib/ui/components/CharacterSearchSelect.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import UsageSeriesChart from "#lib/ui/components/UsageSeriesChart.svelte";
  import type {
    CharacterAnalyticsMode,
    CharacterAnalyticsPayload,
  } from "#lib/definitions.js";
  import {
    fetchCharacterAnalytics,
    isAbortError,
  } from "#lib/app/character-analytics.js";

  let analyticsNameId = $state("");
  let analyticsMode = $state<CharacterAnalyticsMode>("stygian");
  let analyticsPayload = $state<CharacterAnalyticsPayload | null>(null);
  let analyticsLoading = $state(false);
  let analyticsError = $state<string | null>(null);

  let analyticsCharOptions = $derived(
    $charactersOwned
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .map((c) => ({ value: c.name_id, label: c.name ?? c.name_id })),
  );

  let analyticsCharById = $derived(
    new Map($charactersOwned.map((c) => [c.name_id, c])),
  );

  $effect(() => {
    if (!analyticsNameId && analyticsCharOptions.length > 0) {
      const preferred =
        analyticsCharOptions.find((o) => o.value === "Mualani") ??
        analyticsCharOptions.find((o) => o.value === "Hutao") ??
        analyticsCharOptions[0];
      if (preferred) analyticsNameId = preferred.value;
    }
  });

  $effect(() => {
    const nameId = analyticsNameId;
    const mode = analyticsMode;
    if (!nameId) return;

    const controller = new AbortController();
    analyticsLoading = true;
    analyticsError = null;

    fetchCharacterAnalytics(nameId, mode, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        analyticsPayload = payload;
        analyticsLoading = false;
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        analyticsPayload = null;
        analyticsLoading = false;
        analyticsError =
          err instanceof Error ? err.message : "Failed to load analytics";
      });

    return () => {
      controller.abort();
    };
  });
</script>

<section class="gallery-section" id="usage-series">
  <div class="section-head">
    <p class="concept-kicker">Analytics · usage over versions</p>
    <h2>Usage series chart</h2>
    <p>
      Live <code>/api/character-analytics</code> → SVG line. Prototype for the character
      Analytics tab.
    </p>
  </div>

  <Surface class="analytics-demo">
    <div class="analytics-controls">
      <div class="analytics-field">
        <span class="token-meta">Character</span>
        {#if analyticsCharOptions.length}
          <CharacterSearchSelect
            options={analyticsCharOptions}
            bind:value={analyticsNameId}
            getCharacter={(id) => analyticsCharById.get(id)}
            aria-label="Analytics character"
          />
        {:else}
          <p class="token-meta">Roster not loaded yet.</p>
        {/if}
      </div>
      <div class="analytics-field">
        <span class="token-meta">Mode</span>
        <SegmentedControl
          options={[
            { value: "stygian", label: "Stygian" },
            { value: "abyss", label: "Abyss" },
          ]}
          bind:value={analyticsMode}
          aria-label="Analytics mode"
        />
      </div>
    </div>

    {#if analyticsLoading}
      <LoadingState message="Loading analytics…" class="analytics-loading" />
    {:else if analyticsError}
      <EmptyState message={analyticsError} />
    {:else if analyticsPayload}
      <UsageSeriesChart points={analyticsPayload.usage} />
      <p class="token-meta analytics-meta">
        {analyticsPayload.usage.length} versions · {analyticsPayload.teams
          .length} team rows
      </p>
    {:else}
      <EmptyState message="Pick a character to load usage history." />
    {/if}
  </Surface>
</section>

<style>
  :global(.analytics-demo) {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .analytics-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: end;
  }

  .analytics-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 10rem;
  }

  :global(.analytics-loading) {
    min-height: 12rem;
  }

  .analytics-meta {
    margin: 0;
  }

  .concept-kicker {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .concept-kicker {
    margin-bottom: 0.25rem;
    color: var(--accent-1) !important;
  }

  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
