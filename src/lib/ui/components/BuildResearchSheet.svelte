<script lang="ts">
  /**
   * Character → Build button sheet. Fetches topic=build (no personalize) and
   * mounts BuildPanel when view === "build".
   */
  import { untrack } from "svelte";
  import {
    collectOwnedResearchGearKeys,
    postResearchBuild,
    type ResearchOwnedGearKeys,
  } from "#lib/app/research.js";
  import {
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "#lib/app/roster-inventory.js";
  import type { ResearchResponse } from "#lib/research-types.js";
  import { charactersOwned } from "#lib/stores/roster.js";
  import BuildPanel from "#lib/ui/components/BuildPanel.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import ResearchTrace from "#lib/ui/components/ResearchTrace.svelte";
  import { get } from "svelte/store";

  let {
    open = $bindable(false),
    focusNameId,
    characterName = null,
  }: {
    open?: boolean;
    focusNameId: string;
    characterName?: string | null;
  } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let response = $state<ResearchResponse | null>(null);
  let ownedGear = $state<ResearchOwnedGearKeys | null>(null);
  let loadedFor = $state<string | null>(null);
  let requestGen = 0;

  function close() {
    open = false;
  }

  async function loadOwnedGear(): Promise<ResearchOwnedGearKeys> {
    let weapons = null;
    let artifacts = null;
    try {
      weapons = await loadRosterWeapons();
    } catch {
      // Soft-fail — badges just show unowned.
    }
    try {
      artifacts = await loadRosterArtifacts();
    } catch {
      // Soft-fail.
    }
    return collectOwnedResearchGearKeys({
      inventoryWeapons: weapons,
      inventoryArtifacts: artifacts,
      characters: get(charactersOwned),
    });
  }

  async function loadBuild(nameId: string, force = false) {
    if (!nameId) return;
    if (!force && loadedFor === nameId && response) return;

    const gen = ++requestGen;
    loading = true;
    error = null;
    if (force || loadedFor !== nameId) {
      response = null;
      ownedGear = null;
    }

    try {
      const [res, gear] = await Promise.all([
        postResearchBuild(nameId),
        loadOwnedGear(),
      ]);
      if (gen !== requestGen) return;
      response = res;
      ownedGear = gear;
      loadedFor = nameId;
    } catch (err) {
      if (gen !== requestGen) return;
      error = err instanceof Error ? err.message : "Build research failed";
      loadedFor = null;
      response = null;
    } finally {
      if (gen === requestGen) loading = false;
    }
  }

  $effect(() => {
    if (!open) return;
    const id = focusNameId;
    if (!id) return;
    // Do not track response/loadedFor — updating them must not re-enter load.
    untrack(() => {
      void loadBuild(id);
    });
  });

  let isBuildView = $derived(response?.view === "build");
</script>

<ModalSheet
  {open}
  onclose={close}
  labelledby="build-research-title"
  closeOnNavigate
  size="sheet"
>
  {#snippet head()}
    <h2 id="build-research-title" class="sheet-title">
      Build · {characterName ?? focusNameId}
    </h2>
  {/snippet}
  {#if loading}
    <div class="build-state" aria-busy="true" aria-label="Loading build">
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
    </div>
  {:else if error}
    <div class="build-state build-error" role="alert">
      <p class="section-title">Couldn’t load build</p>
      <p class="section-lede">{error}</p>
      <Button
        variant="secondary"
        onclick={() => void loadBuild(focusNameId, true)}
      >
        Retry
      </Button>
    </div>
  {:else if response && isBuildView}
    <BuildPanel
      focus_name_id={response.focus_name_id ?? focusNameId}
      markdown={response.answer_markdown}
      entities={response.entities ?? []}
      citations={response.citations}
      disagreements={response.disagreements ?? []}
      weapon_ranks={response.weapon_ranks ?? []}
      artifact_ranks={response.artifact_ranks ?? []}
      artifact_options={response.artifact_options ?? []}
      stat_priority={response.stat_priority ?? null}
      {ownedGear}
      characterLabel={characterName}
    />
    {#if response.trace}
      <ResearchTrace trace={response.trace} />
    {/if}
  {:else if response}
    <div class="build-state build-error" role="alert">
      <p class="section-title">Unexpected response</p>
      <p class="section-lede">
        Agent did not return a Build view. Try again from Research.
      </p>
      <Button
        variant="secondary"
        onclick={() => void loadBuild(focusNameId, true)}
      >
        Retry
      </Button>
    </div>
  {/if}
</ModalSheet>

<style>
  .sheet-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .build-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 1.25rem 0.5rem;
  }

  .build-state[aria-busy="true"] {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    min-height: 8rem;
    gap: 0.4rem;
  }

  .thinking-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground-color) 45%, transparent);
    animation: build-pulse 1s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes build-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-0.15rem);
    }
  }

  .build-error .section-title,
  .build-error .section-lede {
    margin: 0;
  }
</style>
