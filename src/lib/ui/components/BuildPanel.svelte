<script lang="ts">
  /**
   * Dedicated Build research view (`view === "build"`).
   * Panels are source of truth — do not re-parse ranks from markdown.
   */
  import {
    joinBuildInventory,
    type ResearchOwnedGearKeys,
  } from "#lib/app/research.js";
  import {
    artifactSetName,
    resolveArtifactSetKey,
    resolveWeaponKey,
    weaponName,
  } from "#lib/equipment-data.js";
  import { useEquipmentData } from "#lib/equipment-data.svelte.js";
  import {
    RESEARCH_ENTITY_SLOT_ATTR,
    citationShortLabel,
    citeDisplayNumbers,
    citeSupsHtml,
    citeTokens,
    indexResearchEntities,
    isSafeCiteId,
    orderCitationsForDisplay,
    rankItemsBlob,
    resolveGearEntity,
    preloadEntityIconData,
    renderResearchAnswer,
    renderResearchInline,
    safeExternalHref,
  } from "#lib/research-answer.js";
  import type {
    ResearchArtifactOption,
    ResearchCitation,
    ResearchEntity,
    ResearchRankItem,
    ResearchStatPriority,
  } from "#lib/research-types.js";
  import ArtifactIcon from "#lib/ui/components/ArtifactIcon.svelte";
  import ArtifactTooltip from "#lib/ui/components/ArtifactTooltip.svelte";
  import ResearchEntityMention from "#lib/ui/components/ResearchEntityMention.svelte";
  import WeaponIcon from "#lib/ui/components/WeaponIcon.svelte";
  import WeaponName from "#lib/ui/components/WeaponName.svelte";
  import WeaponTooltip from "#lib/ui/components/WeaponTooltip.svelte";
  import { getCharacterPortrait, translateStatKey } from "#lib/utils.js";
  import { mount, tick, unmount } from "svelte";

  let {
    focus_name_id = null,
    markdown,
    entities = [],
    citations = [],
    disagreements = [],
    weapon_ranks = [],
    artifact_ranks = [],
    artifact_options = [],
    stat_priority = null,
    ownedGear = null,
    characterLabel = null,
  }: {
    focus_name_id?: string | null;
    markdown: string;
    entities?: ResearchEntity[];
    citations?: ResearchCitation[];
    disagreements?: { summary: string; citation_ids?: number[] }[];
    weapon_ranks?: ResearchRankItem[];
    artifact_ranks?: ResearchRankItem[];
    artifact_options?: ResearchArtifactOption[];
    stat_priority?: ResearchStatPriority | null;
    /** Local inventory join — never sent to the agent. */
    ownedGear?: ResearchOwnedGearKeys | null;
    /** Display name override when entities lack the focus character. */
    characterLabel?: string | null;
  } = $props();

  const equipment = useEquipmentData();

  const citeInstanceId = $props.id();
  const citeAnchorPrefix = `bp-${citeInstanceId}-`;

  let answerRoot: HTMLDivElement | undefined = $state();

  $effect(() => {
    void preloadEntityIconData();
  });

  function optionsBlob(list: ResearchArtifactOption[]): string[] {
    return list.flatMap((o) => [
      ...(o.note ? [o.note] : []),
      ...citeTokens(o.citation_ids),
    ]);
  }

  function statsBlob(s: ResearchStatPriority): string[] {
    return [
      ...s.sands,
      ...s.goblet,
      ...s.circlet,
      ...s.substats,
      ...(s.notes ? [s.notes] : []),
      ...citeTokens(s.citation_ids),
    ];
  }

  let footnotes = $derived(
    orderCitationsForDisplay(citations, markdown, [
      ...rankItemsBlob(weapon_ranks),
      ...rankItemsBlob(artifact_ranks),
      ...optionsBlob(artifact_options),
      ...(stat_priority ? statsBlob(stat_priority) : []),
    ]).filter((cite) => isSafeCiteId(cite.id)),
  );

  let citeNum = $derived(citeDisplayNumbers(footnotes));

  let renderOpts = $derived({
    citeAnchorPrefix,
    citeDisplayNum: citeNum,
  });

  let ledeHtml = $derived.by(() => {
    void equipment.version;
    return renderResearchAnswer(markdown, entities, citations, renderOpts);
  });

  let entityIndex = $derived(indexResearchEntities(entities));

  let focusEntity = $derived.by(() => {
    if (!focus_name_id) return null;
    for (const e of entities) {
      if (e.type === "character" && e.name_id === focus_name_id) return e;
    }
    return null;
  });

  let focusIcon = $derived(
    focus_name_id ? getCharacterPortrait(focus_name_id) : null,
  );

  let focusLabel = $derived(
    characterLabel ?? focusEntity?.label ?? focus_name_id ?? "Character",
  );

  function citeSups(ids: number[] | undefined): string {
    return citeSupsHtml(ids, citeNum, citeAnchorPrefix);
  }

  let joined = $derived.by(() => {
    void equipment.version;
    const emptyOwned: ResearchOwnedGearKeys = {
      weapons: new Set(),
      artifactSets: new Set(),
    };
    return joinBuildInventory({
      weapon_ranks,
      artifact_ranks,
      artifact_options,
      owned: ownedGear ?? emptyOwned,
    });
  });

  type GearRow = {
    key: string;
    rank?: number;
    entity: ResearchEntity | null;
    gearKey: string;
    label: string;
    noteHtml: string | null;
    citeHtml: string;
    owned: boolean;
    bestOwned: boolean;
  };

  function mapWeaponRows(
    list: ReturnType<typeof joinBuildInventory>["weapons"],
  ): GearRow[] {
    return list.map((row, idx) => {
      const entity = resolveGearEntity(entityIndex, "weapon", [row.key]);
      const gearKey =
        entity?.weapon_key || (resolveWeaponKey(row.key) ?? row.key);
      return {
        key: `weapon-${idx}-${row.rank}-${row.key}`,
        rank: row.rank,
        entity,
        gearKey,
        label: entity?.label ?? weaponName(gearKey) ?? row.key,
        noteHtml: row.note
          ? renderResearchInline(row.note, entities, citations, renderOpts)
          : null,
        citeHtml: citeSups(row.citation_ids),
        owned: row.owned,
        bestOwned: row.bestOwned,
      };
    });
  }

  function mapSetRows(
    list:
      | ReturnType<typeof joinBuildInventory>["artifacts"]
      | ReturnType<typeof joinBuildInventory>["options"],
    prefix: string,
  ): GearRow[] {
    return list.map((row, idx) => {
      const entity = resolveGearEntity(entityIndex, "set", [row.key]);
      const gearKey =
        entity?.set_key || (resolveArtifactSetKey(row.key) ?? row.key);
      const rank = "rank" in row ? row.rank : undefined;
      return {
        key: `${prefix}-${idx}-${rank ?? "opt"}-${row.key}`,
        rank,
        entity,
        gearKey,
        label: entity?.label ?? artifactSetName(gearKey) ?? row.key,
        noteHtml: row.note
          ? renderResearchInline(row.note, entities, citations, renderOpts)
          : null,
        citeHtml: citeSups(row.citation_ids),
        owned: row.owned,
        bestOwned: row.bestOwned,
      };
    });
  }

  let weaponRows = $derived.by(() => {
    void equipment.version;
    return mapWeaponRows(joined.weapons);
  });

  let artifactRows = $derived.by(() => {
    void equipment.version;
    return mapSetRows(joined.artifacts, "artifact");
  });

  let optionRows = $derived.by(() => {
    void equipment.version;
    return mapSetRows(joined.options, "option");
  });

  let statsView = $derived.by(() => {
    void equipment.version;
    if (!stat_priority) return null;
    const s = stat_priority;
    const emptyMains =
      s.sands.length === 0 &&
      s.goblet.length === 0 &&
      s.circlet.length === 0 &&
      s.substats.length === 0 &&
      !s.notes;
    if (emptyMains) return { empty: true as const };
    return {
      empty: false as const,
      sands: s.sands.map(translateStatKey),
      goblet: s.goblet.map(translateStatKey),
      circlet: s.circlet.map(translateStatKey),
      substats: s.substats.map(translateStatKey),
      notesHtml: s.notes
        ? renderResearchInline(s.notes, entities, citations, renderOpts)
        : null,
      citeHtml: citeSups(s.citation_ids),
    };
  });

  $effect(() => {
    void ledeHtml;
    void weaponRows;
    void artifactRows;
    void optionRows;
    void statsView;
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

{#snippet ownershipBadges(row: GearRow)}
  {#if row.bestOwned}
    <span class="build-badge build-badge-best">Best owned</span>
  {:else if row.owned}
    <span class="build-badge build-badge-owned">Owned</span>
  {:else}
    <span class="build-badge build-badge-missing">Unowned</span>
  {/if}
{/snippet}

{#snippet weaponGear(row: GearRow)}
  {#if row.entity}
    <ResearchEntityMention entity={row.entity} />
  {:else}
    <span class="build-gear-fallback">
      <WeaponIcon weaponKey={row.gearKey} class="build-gear-icon" />
      <span class="meta-name"><WeaponName weaponKey={row.gearKey} /></span>
      <WeaponTooltip weaponKey={row.gearKey} />
    </span>
  {/if}
{/snippet}

{#snippet setGear(row: GearRow)}
  {#if row.entity}
    <ResearchEntityMention entity={row.entity} />
  {:else}
    <span class="build-gear-fallback">
      <ArtifactIcon setKey={row.gearKey} class="build-gear-icon" />
      <span class="meta-name">{row.label}</span>
      <ArtifactTooltip setKey={row.gearKey} />
    </span>
  {/if}
{/snippet}

{#snippet rankedList(rows: GearRow[], kind: "weapon" | "set")}
  {#if rows.length === 0}
    <p class="build-empty meta-sub">No ranked options from sources.</p>
  {:else}
    <ol class="build-rank-list" role="list">
      {#each rows as row (row.key)}
        <li class="build-rank-row" class:is-top={row.rank === 1}>
          <span class="build-rank-num">{row.rank}</span>
          <div class="build-rank-body">
            <div class="build-rank-head">
              {#if kind === "weapon"}
                {@render weaponGear(row)}
              {:else}
                {@render setGear(row)}
              {/if}
              {@render ownershipBadges(row)}
              {#if row.citeHtml}
                <span>{@html row.citeHtml}</span>
              {/if}
            </div>
            {#if row.noteHtml}
              <p class="build-rank-note">{@html row.noteHtml}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
{/snippet}

<div class="build-panel" bind:this={answerRoot}>
  <header class="build-header">
    {#if focusIcon}
      <img class="build-focus-icon" src={focusIcon} alt="" loading="lazy" />
    {/if}
    <div class="build-header-copy">
      <p class="meta-sub build-header-eyebrow">Build</p>
      <h2 class="section-title build-focus-name">{focusLabel}</h2>
    </div>
  </header>

  {#if disagreements.length > 0}
    <aside class="build-disagreements" aria-label="Source disagreements">
      {#each disagreements as d, i (i)}
        <p class="build-disagreement">{d.summary}</p>
      {/each}
    </aside>
  {/if}

  {#if markdown.trim()}
    <div class="build-lede">
      {@html ledeHtml}
    </div>
  {/if}

  <section class="build-section" aria-label="Weapon ranking">
    <h3 class="build-section-title">Weapons</h3>
    {@render rankedList(weaponRows, "weapon")}
  </section>

  <section class="build-section" aria-label="Artifact ranking">
    <h3 class="build-section-title">Artifacts</h3>
    {@render rankedList(artifactRows, "set")}
  </section>

  <section class="build-section" aria-label="Situational artifact options">
    <h3 class="build-section-title">Situational options</h3>
    {#if optionRows.length === 0}
      <p class="build-empty meta-sub">No situational sets from sources.</p>
    {:else}
      <ul class="build-option-list">
        {#each optionRows as row (row.key)}
          <li class="build-option-row">
            <div class="build-rank-head">
              {@render setGear(row)}
              {@render ownershipBadges(row)}
              {#if row.citeHtml}
                <span>{@html row.citeHtml}</span>
              {/if}
            </div>
            {#if row.noteHtml}
              <p class="build-rank-note">{@html row.noteHtml}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="build-section" aria-label="Stat priority">
    <h3 class="build-section-title">
      Stat priority
      {#if statsView && !statsView.empty && statsView.citeHtml}
        <span>{@html statsView.citeHtml}</span>
      {/if}
    </h3>
    {#if !statsView || statsView.empty}
      <p class="build-empty meta-sub">No stat guidance from sources.</p>
    {:else}
      <dl class="build-stats-grid">
        <div class="build-stat-slot">
          <dt class="meta-sub">Sands</dt>
          <dd>
            {#if statsView.sands.length}
              {statsView.sands.join(" / ")}
            {:else}
              <span class="meta-sub">—</span>
            {/if}
          </dd>
        </div>
        <div class="build-stat-slot">
          <dt class="meta-sub">Goblet</dt>
          <dd>
            {#if statsView.goblet.length}
              {statsView.goblet.join(" / ")}
            {:else}
              <span class="meta-sub">—</span>
            {/if}
          </dd>
        </div>
        <div class="build-stat-slot">
          <dt class="meta-sub">Circlet</dt>
          <dd>
            {#if statsView.circlet.length}
              {statsView.circlet.join(" / ")}
            {:else}
              <span class="meta-sub">—</span>
            {/if}
          </dd>
        </div>
        <div class="build-stat-slot build-stat-subs">
          <dt class="meta-sub">Substats</dt>
          <dd>
            {#if statsView.substats.length}
              {statsView.substats.join(" → ")}
            {:else}
              <span class="meta-sub">—</span>
            {/if}
          </dd>
        </div>
      </dl>
      {#if statsView.notesHtml}
        <p class="build-rank-note">{@html statsView.notesHtml}</p>
      {/if}
    {/if}
  </section>

  {#if footnotes.length > 0}
    <ol class="build-footnotes">
      {#each footnotes as cite (cite.id)}
        {@const num = citeNum.get(cite.id) ?? 0}
        {@const href = safeExternalHref(cite.url)}
        <li
          id="{citeAnchorPrefix}research-cite-{cite.id}"
          class="build-footnote"
        >
          <span class="build-footnote-num meta-sub" aria-hidden="true"
            >{num}</span
          >
          <div class="build-footnote-body">
            {#if href}
              <a
                class="build-footnote-link"
                {href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {citationShortLabel(cite)}
              </a>
            {:else}
              <span class="build-footnote-link">{citationShortLabel(cite)}</span
              >
            {/if}
            <p class="build-footnote-quote meta-sub">{cite.quote}</p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .build-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .build-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .build-focus-icon {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-md);
    object-fit: cover;
    flex-shrink: 0;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .build-header-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .build-header-eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--text-xs);
  }

  .build-focus-name {
    margin: 0;
  }

  .build-disagreements {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, #e67e22 35%, var(--border-default));
    background: color-mix(in srgb, #e67e22 8%, transparent);
  }

  .build-disagreement {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .build-lede :global(p) {
    margin: 0 0 0.4rem;
    line-height: 1.5;
    font-size: 1.02em;
    color: var(--foreground-color);
  }

  .build-lede :global(p:last-child) {
    margin-bottom: 0;
  }

  .build-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .build-section-title {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .build-empty {
    margin: 0;
  }

  .build-rank-list,
  .build-option-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .build-rank-row,
  .build-option-row {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
  }

  .build-rank-num {
    flex-shrink: 0;
    min-width: 1.25rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: color-mix(in srgb, var(--foreground-color) 48%, transparent);
    padding-top: 0.2rem;
  }

  .build-rank-row.is-top .build-rank-num {
    color: var(--foreground-color);
  }

  .build-rank-body,
  .build-option-row {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .build-rank-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.4rem;
  }

  .build-rank-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .build-gear-fallback {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    max-width: min(100%, 14rem);
  }

  .build-gear-fallback :global(.build-gear-icon) {
    width: 1.35rem;
    height: 1.35rem;
    flex-shrink: 0;
  }

  .build-badge {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.12rem 0.35rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .build-badge-best {
    border-color: var(--accent-1);
    color: var(--foreground-color);
  }

  .build-badge-owned {
    border-color: color-mix(in srgb, var(--foreground-color) 28%, transparent);
  }

  .build-badge-missing {
    opacity: 0.72;
  }

  .build-stats-grid {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .build-stat-slot {
    min-width: 0;
  }

  .build-stat-slot dt {
    margin: 0 0 0.2rem;
  }

  .build-stat-slot dd {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--foreground-color);
  }

  .build-stat-subs {
    grid-column: 1 / -1;
  }

  @media (max-width: 520px) {
    .build-stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .build-panel :global(.research-entity-slot) {
    display: contents;
  }

  .build-panel :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .build-panel :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .build-panel :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .build-footnotes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    padding-top: var(--space-2);
  }

  .build-footnote {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    scroll-margin-top: 5rem;
  }

  .build-footnote-num {
    flex-shrink: 0;
    min-width: 1.1rem;
    text-align: right;
    padding-top: 0.15rem;
  }

  .build-footnote-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .build-footnote-link {
    font-size: var(--text-xs);
    font-weight: 500;
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    text-decoration: none;
  }

  .build-footnote-link:hover {
    color: var(--foreground-color);
    text-decoration: underline;
  }

  .build-footnote-quote {
    margin: 0;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
