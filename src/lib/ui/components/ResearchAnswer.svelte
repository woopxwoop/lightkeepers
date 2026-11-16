<script lang="ts">
  /**
   * Research answer: short lede + site-native panels (comparison, teams, ranks, ER, rotation).
   * When `view === "build"`, mounts BuildPanel instead of the freeform stack.
   */
  import { page } from "$app/state";
  import {
    collectOwnedResearchGearKeys,
    type ResearchOwnedGearKeys,
  } from "#lib/app/research.js";
  import {
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "#lib/app/roster-inventory.js";
  import type { Character } from "#lib/definitions.js";
  import { useEquipmentData } from "#lib/equipment/equipment-data.svelte.js";
  import {
    RESEARCH_ENTITY_SLOT_ATTR,
    citeDisplayNumbers,
    citeSupsHtml,
    indexResearchEntities,
    isSafeCiteId,
    orderCitationsForDisplay,
    preloadEntityIconData,
    renderResearchAnswer,
    renderResearchInline,
  } from "#lib/research/research-answer.js";
  import {
    buildComparisonSides,
    buildErRows,
    buildLineupCards,
    buildRankRows,
    buildRotationView,
    researchPanelsCiteBlob,
  } from "#lib/research/research-answer-panels.js";
  import type {
    ResearchArtifactOption,
    ResearchCitation,
    ResearchComparison,
    ResearchEntity,
    ResearchErTarget,
    ResearchRankItem,
    ResearchRotation,
    ResearchStatPriority,
    ResearchTeamLineup,
    ResearchView,
  } from "#lib/research/research-types.js";
  import { charactersOwned } from "#lib/stores/roster.js";
  import BuildPanel from "#lib/ui/components/BuildPanel.svelte";
  import ResearchEntityMention from "#lib/ui/components/ResearchEntityMention.svelte";
  import ComparisonPanel from "#lib/ui/components/research-answer/ComparisonPanel.svelte";
  import ErPanel from "#lib/ui/components/research-answer/ErPanel.svelte";
  import FootnoteList from "#lib/ui/components/research-answer/FootnoteList.svelte";
  import RankSection from "#lib/ui/components/research-answer/RankSection.svelte";
  import RotationPanel from "#lib/ui/components/research-answer/RotationPanel.svelte";
  import TeamsPanel from "#lib/ui/components/research-answer/TeamsPanel.svelte";
  import { mount, tick, unmount } from "svelte";
  import "./research-answer/research-shared.css";

  let {
    markdown,
    entities = [],
    citations = [],
    disagreements = [],
    view = null,
    focus_name_id = null,
    comparison = null,
    teams = null,
    weapon_ranks = null,
    artifact_ranks = null,
    artifact_options = null,
    stat_priority = null,
    er_targets = null,
    rotation = null,
    ownedGear = null,
  }: {
    markdown: string;
    entities?: ResearchEntity[];
    citations?: ResearchCitation[];
    disagreements?: { summary: string; citation_ids?: number[] }[];
    view?: ResearchView | null;
    focus_name_id?: string | null;
    comparison?: ResearchComparison | null;
    teams?: ResearchTeamLineup[] | null;
    weapon_ranks?: ResearchRankItem[] | null;
    artifact_ranks?: ResearchRankItem[] | null;
    artifact_options?: ResearchArtifactOption[] | null;
    stat_priority?: ResearchStatPriority | null;
    er_targets?: ResearchErTarget[] | null;
    rotation?: ResearchRotation | null;
    ownedGear?: ResearchOwnedGearKeys | null;
  } = $props();

  let buildOwnedGear = $state<ResearchOwnedGearKeys | null>(null);

  $effect(() => {
    if (view !== "build") {
      buildOwnedGear = null;
      return;
    }
    if (ownedGear) {
      buildOwnedGear = ownedGear;
      return;
    }
    const characters = $charactersOwned;
    let cancelled = false;
    void (async () => {
      let weapons = null;
      let artifacts = null;
      try {
        weapons = await loadRosterWeapons();
      } catch {
        // Soft-fail.
      }
      try {
        artifacts = await loadRosterArtifacts();
      } catch {
        // Soft-fail.
      }
      if (cancelled) return;
      buildOwnedGear = collectOwnedResearchGearKeys({
        inventoryWeapons: weapons,
        inventoryArtifacts: artifacts,
        characters,
      });
    })();
    return () => {
      cancelled = true;
    };
  });

  const equipment = useEquipmentData();

  const citeInstanceId = $props.id();
  const citeAnchorPrefix = `ra-${citeInstanceId}-`;

  let answerRoot: HTMLDivElement | undefined = $state();

  $effect(() => {
    void preloadEntityIconData();
  });

  let footnotes = $derived(
    orderCitationsForDisplay(
      citations,
      markdown,
      researchPanelsCiteBlob({
        comparison,
        teams,
        weapon_ranks,
        artifact_ranks,
        er_targets,
        rotation,
      }),
    ).filter((cite) => isSafeCiteId(cite.id)),
  );

  let citeNum = $derived(citeDisplayNumbers(footnotes));

  let renderOpts = $derived({
    citeAnchorPrefix,
    citeDisplayNum: citeNum,
  });

  function inline(text: string): string {
    return renderResearchInline(text, entities, citations, renderOpts);
  }

  function citeSups(ids: number[] | undefined): string {
    return citeSupsHtml(ids, citeNum, citeAnchorPrefix);
  }

  let html = $derived.by(() => {
    void equipment.version;
    return renderResearchAnswer(markdown, entities, citations, renderOpts);
  });

  let verdictHtml = $derived.by(() => {
    void equipment.version;
    if (!comparison?.verdict) return null;
    return inline(comparison.verdict);
  });

  let sides = $derived.by(() => {
    void equipment.version;
    return buildComparisonSides(comparison, inline);
  });

  let entityIndex = $derived(indexResearchEntities(entities));

  let characterMap = $derived.by(() => {
    const mapping = page.data.mapping as Map<string, Character> | undefined;
    return mapping ?? new Map<string, Character>();
  });

  let lineupCards = $derived.by(() => {
    void equipment.version;
    return buildLineupCards(teams, entityIndex, characterMap, inline, citeSups);
  });

  let weaponRankRows = $derived.by(() => {
    void equipment.version;
    return buildRankRows(weapon_ranks, "weapon", entityIndex, inline, citeSups);
  });

  let artifactRankRows = $derived.by(() => {
    void equipment.version;
    return buildRankRows(artifact_ranks, "set", entityIndex, inline, citeSups);
  });

  let erRows = $derived.by(() => {
    void equipment.version;
    return buildErRows(er_targets, entityIndex, inline, citeSups);
  });

  let rotationView = $derived.by(() => {
    void equipment.version;
    return buildRotationView(rotation, inline, citeSups);
  });

  /** Mount ResearchEntityMention onto slot markers left by renderResearchAnswer. */
  $effect(() => {
    if (view === "build") return;
    void html;
    void verdictHtml;
    void sides;
    void lineupCards;
    void weaponRankRows;
    void artifactRankRows;
    void erRows;
    void rotationView;
    void entityIndex;
    void equipment.version;

    const root = answerRoot;
    if (!root) return;

    let cancelled = false;
    const stoppers: Array<() => void> = [];

    void tick().then(() => {
      if (cancelled || !answerRoot) return;
      const slots = answerRoot.querySelectorAll(
        `[${RESEARCH_ENTITY_SLOT_ATTR}]`,
      );
      for (const el of slots) {
        if (!(el instanceof HTMLElement)) continue;
        const key = el.getAttribute(RESEARCH_ENTITY_SLOT_ATTR);
        if (!key) continue;
        const entity = entityIndex.byKey.get(key);
        if (!entity) continue;
        const instance = mount(ResearchEntityMention, {
          target: el,
          props: { entity },
        });
        if (cancelled) {
          void unmount(instance);
          continue;
        }
        stoppers.push(() => {
          void unmount(instance);
        });
      }
    });

    return () => {
      cancelled = true;
      for (const stop of stoppers) stop();
    };
  });
</script>

{#if view === "build"}
  <BuildPanel
    {focus_name_id}
    {markdown}
    {entities}
    {citations}
    {disagreements}
    weapon_ranks={weapon_ranks ?? []}
    artifact_ranks={artifact_ranks ?? []}
    artifact_options={artifact_options ?? []}
    {stat_priority}
    ownedGear={ownedGear ?? buildOwnedGear}
  />
{:else}
  <div class="research-answer" bind:this={answerRoot}>
    {#if disagreements.length > 0}
      <aside class="research-disagreements" aria-label="Source disagreements">
        {#each disagreements as d, i (i)}
          <p class="research-disagreement">{d.summary}</p>
        {/each}
      </aside>
    {/if}

    <div class="research-body">
      {@html html}
    </div>

    {#if sides.length > 0}
      <ComparisonPanel {verdictHtml} {sides} />
    {/if}

    {#if lineupCards.length > 0}
      <TeamsPanel cards={lineupCards} />
    {/if}

    {#if weaponRankRows.length > 0}
      <RankSection
        title="Weapons"
        ariaLabel="Weapon ranking"
        rows={weaponRankRows}
      />
    {/if}
    {#if artifactRankRows.length > 0}
      <RankSection
        title="Artifacts"
        ariaLabel="Artifact ranking"
        rows={artifactRankRows}
      />
    {/if}

    {#if erRows.length > 0}
      <ErPanel rows={erRows} />
    {/if}

    {#if rotationView}
      <RotationPanel rotation={rotationView} />
    {/if}

    {#if footnotes.length > 0}
      <FootnoteList {footnotes} {citeNum} {citeAnchorPrefix} />
    {/if}
  </div>
{/if}

<style>
  .research-answer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .research-disagreements {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, #e67e22 35%, var(--border-default));
    background: color-mix(in srgb, #e67e22 8%, transparent);
  }

  .research-disagreement {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .research-body :global(p:first-child) {
    font-size: 1.02em;
    line-height: 1.5;
    color: var(--foreground-color);
  }

  .research-body :global(p) {
    margin: 0 0 0.55rem;
    line-height: 1.55;
  }

  .research-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .research-body :global(ul),
  .research-body :global(ol) {
    margin: 0 0 0.55rem;
    padding-left: 1.1rem;
    line-height: 1.5;
  }

  .research-body :global(li + li) {
    margin-top: 0.25rem;
  }

  .research-body :global(strong) {
    font-weight: 600;
  }

  .research-body :global(code) {
    font-size: 0.9em;
  }

  .research-body :global(h2),
  .research-body :global(h3) {
    margin: 0.85rem 0 0.35rem;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.35;
    color: color-mix(in srgb, var(--foreground-color) 88%, transparent);
  }

  .research-body :global(h2:first-child),
  .research-body :global(h3:first-child) {
    margin-top: 0;
  }
</style>
