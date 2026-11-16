<script lang="ts">
  import { onMount } from "svelte";
  import CharacterUsefulLinks from "#lib/ui/components/character/CharacterUsefulLinks.svelte";
  import EquipmentSections from "#lib/ui/components/character/builds-panel/EquipmentSections.svelte";
  import StatsSections from "#lib/ui/components/character/builds-panel/StatsSections.svelte";
  import UpgradePriorities from "#lib/ui/components/character/builds-panel/UpgradePriorities.svelte";
  import StatGoalsSection from "#lib/ui/components/character/builds-panel/StatGoalsSection.svelte";
  import { loadRosterArtifacts } from "#lib/app/roster-inventory.js";
  import {
    CRIMSON_WITCH_FAVICON_URL,
    type CrimsonWitchLink,
  } from "#lib/utils.js";
  import type { CharacterKit } from "#lib/types/character-kit.js";
  import type { CharacterIndex } from "#lib/types/investment.js";
  import type { CharacterOwned } from "#lib/definitions.js";

  let {
    kit,
    builds,
    summaryStale,
    buildsUnavailable = false,
    elColor,
    goodKey,
    goodKeyMap,
    crimsonWitchLinks,
  }: {
    kit: CharacterKit;
    builds: CharacterIndex | null;
    summaryStale: boolean;
    buildsUnavailable?: boolean;
    elColor: string;
    goodKey: string;
    goodKeyMap: Map<string, CharacterOwned>;
    crimsonWitchLinks: CrimsonWitchLink[];
  } = $props();

  onMount(() => {
    void loadRosterArtifacts().catch(() => {});
  });
</script>

<div
  role="tabpanel"
  id="tabpanel-builds"
  aria-labelledby="tab-builds"
  tabindex="0"
>
  {#if builds}
    <EquipmentSections {builds} {elColor} />
    <StatsSections {builds} {elColor} />
    <UpgradePriorities {kit} {builds} {elColor} />
    <StatGoalsSection {kit} {builds} {goodKey} {goodKeyMap} />

    {#if builds.notes}
      <section class="board-section notes-section">
        <h2 class="section-title">Notes</h2>
        <p class="build-notes">{builds.notes}</p>
      </section>
    {/if}
  {:else}
    <section class="board-section">
      <p class="muted-note builds-empty-msg">
        {#if buildsUnavailable}
          Could not load builds right now.
        {:else if summaryStale}
          {kit.name}'s Lightkeepers build numbers are outdated after a recent
          kit change.
        {:else}
          No Lightkeepers build summary for {kit.name} yet.
        {/if}
      </p>
      {#if crimsonWitchLinks.length === 1 && crimsonWitchLinks[0]}
        <p class="builds-try">
          <span>Try:</span>
          <a
            class="useful-link-cta"
            href={crimsonWitchLinks[0].url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="useful-link-icon"
              src={CRIMSON_WITCH_FAVICON_URL}
              alt=""
              width="32"
              height="32"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            Crimson Witch build guide
          </a>
        </p>
      {:else if crimsonWitchLinks.length > 1}
        <p class="builds-try">Try:</p>
        <CharacterUsefulLinks links={crimsonWitchLinks} />
      {/if}
    </section>
  {/if}
</div>

<style>
  .muted-note {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .builds-empty-msg {
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }

  .builds-try {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.65rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .useful-link-icon {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  .useful-link-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent-1);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .useful-link-cta .useful-link-icon {
    width: 2rem;
    height: 2rem;
  }

  .useful-link-cta:hover {
    color: color-mix(in srgb, var(--accent-1) 85%, white);
  }

  .build-notes {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    line-height: 1.55;
    max-width: 42rem;
    white-space: pre-wrap;
  }
</style>
