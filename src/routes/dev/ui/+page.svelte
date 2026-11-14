<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import { displayPreferences } from "#lib/stores/preferences.js";
  import PageShell from "#lib/ui/components/PageShell.svelte";
  import PageHeader from "#lib/ui/components/PageHeader.svelte";
  import { elementColor } from "#lib/characters/element-colors.js";
  import type { AbyssTeam } from "#lib/definitions.js";
  import { getNamecardUrl } from "#lib/utils.js";
  import { ensureEquipmentData } from "#lib/equipment/equipment-data.js";
  import UsageSeries from "./sections/UsageSeries.svelte";
  import UnboxedChrome from "./sections/UnboxedChrome.svelte";
  import SolutionBoardChrome from "./sections/SolutionBoardChrome.svelte";
  import CharacterDetail from "./sections/CharacterDetail.svelte";
  import RosterBuildCard from "./sections/RosterBuildCard.svelte";
  import CharacterNavigation from "./sections/CharacterNavigation.svelte";
  import StatGoalsLayout from "./sections/StatGoalsLayout.svelte";
  import TeamSourceControl from "./sections/TeamSourceControl.svelte";
  import Tokens from "./sections/Tokens.svelte";
  import Surfaces from "./sections/Surfaces.svelte";
  import Controls from "./sections/Controls.svelte";
  import Patterns from "./sections/Patterns.svelte";
  import Components from "./sections/Components.svelte";
  import Sheet from "./sections/Sheet.svelte";

  void ensureEquipmentData().catch(() => {});

  let sampleChars = $derived($charactersOwned.slice(0, 8));
  let detailDemoChar = $derived(
    $charactersOwned.find((character) => character.name === "Raiden Shogun") ??
      sampleChars[0],
  );
  let detailAccent = $derived(
    elementColor(detailDemoChar?.element, "var(--accent-1)"),
  );
  // Full background-image value: an empty url("") would resolve against the
  // current document and fetch the page itself as an image.
  let detailNamecard = $derived(
    detailDemoChar?.name_id
      ? `url('${getNamecardUrl(detailDemoChar.name_id)}')`
      : "none",
  );
  let sampleMap = $derived(
    new Map(sampleChars.map((c) => [c.name_id ?? c.name, c])),
  );

  let demoTeam = $derived.by((): AbyssTeam | null => {
    if (sampleChars.length < 4) return null;
    const members = sampleChars.slice(0, 4).map((c) => c.name_id ?? c.name);
    return {
      members,
      usage_rate: 12.5,
    } as AbyssTeam;
  });

  let iconStyleNote = $derived($displayPreferences.iconStyle);
</script>

<PageShell class="ui-gallery gap-10">
  <PageHeader
    eyebrow="Dev"
    title="UI gallery"
    lede="Living surface for tokens and shared primitives. Icon style follows Display settings ({iconStyleNote})."
  />

  <UsageSeries />
  <UnboxedChrome {detailDemoChar} {detailAccent} {detailNamecard} />
  <SolutionBoardChrome {sampleMap} {demoTeam} />
  <CharacterDetail {detailDemoChar} {detailAccent} {detailNamecard} />
  <RosterBuildCard />
  <CharacterNavigation />
  <StatGoalsLayout />
  <TeamSourceControl />
  <Tokens />
  <Surfaces />
  <Controls />
  <Patterns {sampleChars} />
  <Components {sampleChars} {sampleMap} {demoTeam} />
  <Sheet />
</PageShell>

<style>
  /* :where() keeps this at single-class specificity so section modifiers
     like .detail-concepts still override it. */
  :global(:where(.ui-gallery) .gallery-section) {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
