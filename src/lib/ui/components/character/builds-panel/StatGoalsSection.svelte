<script lang="ts">
  import InvestmentBuildCard from "#lib/ui/components/InvestmentBuildCard.svelte";
  import ExampleTeamPicker from "#lib/ui/components/character/builds-panel/ExampleTeamPicker.svelte";
  import {
    buildExamples,
    characterBuildFromExample,
    exampleRelevantGoodKeys,
  } from "#lib/characters/character-builds.js";
  import {
    activeBuildExample,
    alternateBuildExamples,
    exampleCardTier,
  } from "#lib/characters/character-builds-panel.js";
  import { kitIconsFromCharacterKit } from "#lib/investment/investment-build-card.js";
  import type { CharacterKit } from "#lib/types/character-kit.js";
  import type { CharacterIndex } from "#lib/types/investment.js";
  import type { CharacterOwned } from "#lib/definitions.js";

  let {
    kit,
    builds,
    goodKey,
    goodKeyMap,
  }: {
    kit: CharacterKit;
    builds: CharacterIndex;
    goodKey: string;
    goodKeyMap: Map<string, CharacterOwned>;
  } = $props();

  let exampleBuilds = $derived(buildExamples(builds));
  /** User pick among diversified examples; empty → highest-DPS default. */
  let examplePick = $state("");
  let activeExample = $derived(activeBuildExample(exampleBuilds, examplePick));
  let exampleAlts = $derived(
    alternateBuildExamples(exampleBuilds, activeExample),
  );
  let exampleCardBuild = $derived(
    activeExample
      ? characterBuildFromExample(activeExample, exampleCardTier(activeExample))
      : null,
  );
  let exampleCardRelevantKeys = $derived(
    activeExample
      ? exampleRelevantGoodKeys(activeExample, exampleCardTier(activeExample))
      : null,
  );
  let exampleCardKit = $derived(kitIconsFromCharacterKit(kit));
  let exampleCardCharacter = $derived(goodKeyMap.get(goodKey) ?? null);
</script>

{#if activeExample}
  <section class="board-section">
    <h2 class="section-title">Stat goals</h2>
    <p class="section-lede">
      DPS stat goals assume very high artifact investment. A lot of supports
      only care about ER (and Crit Rate if running a Favonius weapon)
    </p>
    <div class="example-build pt-4">
      <ExampleTeamPicker
        active={activeExample}
        alts={exampleAlts}
        {goodKey}
        {goodKeyMap}
        onselect={(stateKey) => (examplePick = stateKey)}
      />

      {#if exampleCardBuild}
        <InvestmentBuildCard
          build={exampleCardBuild}
          character={exampleCardCharacter}
          kit={exampleCardKit}
          relevantKeys={exampleCardRelevantKeys}
          class="example-build-card"
        />
      {/if}
    </div>
  </section>
{/if}

<style>
  .example-build {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    column-gap: var(--space-5);
    row-gap: var(--space-4);
    align-items: start;
  }

  .example-build :global(.example-build-card) {
    min-width: 0;
  }

  .example-build :global(.example-build-card .build-grid) {
    min-height: 16.5rem;
  }

  .example-build :global(.example-build-card .build-art--portrait) {
    width: 10rem;
  }

  .example-build :global(.example-build-card .build-art--enka) {
    width: 9.25rem;
  }

  @media (max-width: 640px) {
    .example-build :global(.example-build-card .build-grid) {
      min-height: 14rem;
    }

    .example-build :global(.example-build-card .build-art--portrait) {
      width: 7rem;
    }

    .example-build :global(.example-build-card .build-art--enka) {
      width: 6.5rem;
    }
  }

  @media (max-width: 840px) {
    .example-build {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
