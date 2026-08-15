<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import {
    buildGoodKeyMap,
    humanizeTeamName,
    namesFromGoodKeyMap,
    ownedGoodKeys,
  } from "$lib/utils";
  import {
    humanizeInvestmentLabel,
    ensureEquipmentData,
  } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";
  import WeaponBadge from "$lib/ui/components/WeaponBadge.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import BackLink from "$lib/ui/components/BackLink.svelte";
  import CostPopover from "$lib/ui/components/CostPopover.svelte";
  import TeamNumbersNote from "$lib/ui/components/TeamNumbersNote.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import { loadInvestment, getInvestmentCached } from "$lib/app/investment";
  import {
    baselineSim as findBaselineSim,
    baselineVariants,
    ownedVariants,
    findInvestmentTeam,
    groupVerticalSimsByCost,
  } from "$lib/investment-teams";
  import type {
    InvestmentFile,
    InvestmentSim,
    CharacterBuild,
  } from "$lib/types/investment";

  let { data: layoutData } = $props();
  const equipment = useEquipmentData();

  let investment = $state<InvestmentFile | null>(getInvestmentCached());
  let loading = $derived(investment === null);
  let error = $state<string | null>(null);
  let team = $derived(findInvestmentTeam(investment, layoutData.slug));
  let pageError = $derived(
    error ??
      (investment && !team ? `Team "${layoutData.slug}" not found` : null),
  );

  onMount(() => {
    void ensureEquipmentData();
    fetchData();
  });

  /** Use shared session cache (loaded on this route, not global bootstrap). */
  async function fetchData() {
    if (investment) {
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      investment = await loadInvestment();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load team";
    } finally {
      loading = false;
    }
  }

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));
  let characterNames = $derived(namesFromGoodKeyMap(goodKeyMap));
  let teamTitle = $derived(
    team ? humanizeTeamName(team.characters, characterNames) : "",
  );
  let ownedKeys = $derived(ownedGoodKeys($charactersOwned));
  let baselineSim = $derived(team ? findBaselineSim(team) : null);
  let baselineVariantsList = $derived(
    team ? baselineVariants(team) : ([] as InvestmentSim[]),
  );
  let ownedVariantsList = $derived(
    team ? ownedVariants(team) : ([] as InvestmentSim[]),
  );
  let costGroups = $derived(team ? groupVerticalSimsByCost(team) : []);
  let openCosts = $state<Set<number>>(new Set());

  function toggleCost(cost: number) {
    const next = new Set(openCosts);
    if (next.has(cost)) next.delete(cost);
    else next.add(cost);
    openCosts = next;
  }

  let simDiffLabel = $derived.by(() => {
    void equipment.version;
    const names = characterNames;
    return (sim: InvestmentSim): string => {
      if (sim.kind === "baseline") return "Baseline";
      // Vertical 5★ weapons are signatures → R1. Owned alts keep full names.
      return humanizeInvestmentLabel(sim.label?.trim() || "variant", names, {
        fiveStarWeaponsAs: sim.kind === "owned" ? "name" : "R1",
      });
    };
  });

  function pctVsBaseline(dps: number): string {
    if (!baselineSim || baselineSim.dps <= 0) return "";
    const pct = ((dps - baselineSim.dps) / baselineSim.dps) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  function pctDelta(from: number, to: number): string {
    if (from <= 0) return "";
    const pct = ((to - from) / from) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  /** Small dips (≤ 2.5pp) get a variance tip; larger ones get a warning tip. */
  const NEG_PCT_CLAMP = 2.5;

  const NEG_PCT_TIP_VARIANCE =
    "Probably just Monte Carlo variance in the simulation — these upgrades likely yield no theoretical DPS increase in this instance.";

  const NEG_PCT_TIP_UNEXPECTED =
    "Something unexpected occurred in this simulation — best to ignore these results.";

  type NegPctInfo = { label: string; tip: string; tipLabel: string };

  /** When `to` is below `from`, return display + tip; else null. */
  function negPctInfo(
    from: number | null | undefined,
    to: number,
  ): NegPctInfo | null {
    if (from == null || from <= 0 || to >= from) return null;
    const pct = ((to - from) / from) * 100;
    const label = `${pct.toFixed(1)}%`;
    if (Math.abs(pct) <= NEG_PCT_CLAMP) {
      return {
        label,
        tip: NEG_PCT_TIP_VARIANCE,
        tipLabel: "About near-zero percentages",
      };
    }
    return {
      label,
      tip: NEG_PCT_TIP_UNEXPECTED,
      tipLabel: "About unexpected simulation results",
    };
  }

  /** Within 2.5% of peak DPS at that cost: dps >= peak × 0.975 (relative, not ±2.5pp). */
  const NEAR_BEST_RATIO = 0.975;

  function isNearBest(dps: number, peakDps: number): boolean {
    return peakDps > 0 && dps >= peakDps * NEAR_BEST_RATIO;
  }

  function baselineBuild(goodKey: string): CharacterBuild | undefined {
    return baselineSim?.characters.find((c) => c.key === goodKey);
  }
</script>

{#snippet negPctTip(info: NegPctInfo)}
  <button
    type="button"
    class="pct-tip group tip-detail-text tip-detail-text--small"
  >
    {info.label}
    <HoverTooltip class="max-w-72" label={info.tipLabel}>
      <p class="tip-detail-text tip-detail-text--small">{info.tip}</p>
    </HoverTooltip>
  </button>
{/snippet}

{#snippet variantBoard(
  variants: InvestmentSim[],
  title: string,
  lede: string,
  rowTag: string | null = null,
)}
  <section class="section">
    <h2 class="section-title">{title}</h2>
    <p class="section-lede">{lede}</p>
    <Surface flush class="board">
      <div class="board-head" aria-hidden="true">
        <span>Build</span>
        <span>DPS</span>
        <span>vs base</span>
      </div>
      {#each variants as sim, vi (sim.state_key)}
        {@const peakDps = variants[0].dps}
        <a
          href="/teams/configs/{encodeURIComponent(sim.state_key)}"
          class="board-row"
          class:board-divider={vi > 0}
          class:is-baseline={sim.kind === "baseline"}
          class:is-near-best={isNearBest(sim.dps, peakDps)}
        >
          <span class="row-label" title={simDiffLabel(sim)}>
            {simDiffLabel(sim)}
            {#if sim.kind === "baseline"}
              <span class="row-tag">base</span>
            {:else if rowTag}
              <span class="row-tag">{rowTag}</span>
            {/if}
          </span>
          <span class="row-dps">{(sim.dps / 1000).toFixed(1)}K</span>
          <span class="row-pct">
            {sim.kind === "baseline" ? "—" : pctVsBaseline(sim.dps)}
          </span>
        </a>
      {/each}
    </Surface>
  </section>
{/snippet}

<PageShell class="gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  {#if loading}
    <LoadingState variant="pulse" message="Loading team…" />
  {:else if pageError && !team}
    <EmptyState message={pageError}>
      {#snippet action()}
        <div class="empty-actions">
          <Button variant="secondary" onclick={fetchData}>Try again</Button>
          <BackLink href="/teams">← Back to teams</BackLink>
        </div>
      {/snippet}
    </EmptyState>
  {:else if team}
    <header class="page-head">
      <PageTrail
        items={[
          { label: "Teams", href: "/teams" },
          { label: teamTitle || layoutData.slug },
        ]}
      />
      <div class="page-head-text">
        <h1 class="page-title">{teamTitle}</h1>
        <p class="page-meta">
          {#if baselineSim}
            Baseline · {team.baseline_cost}
            <CostPopover /> · {(baselineSim.dps / 1000).toFixed(0)}K DPS
          {:else}
            gcsim investment path
          {/if}
        </p>
      </div>
      {#if baselineSim}
        <a
          href="/teams/configs/{encodeURIComponent(baselineSim.state_key)}"
          class="config-link"
        >
          View build config →
        </a>
      {/if}
    </header>

    <!-- Hero: flat 4-up baseline roster -->
    <div class="roster">
      {#each team.characters as goodKey (goodKey)}
        {@const char = goodKeyMap.get(goodKey)}
        {@const build = baselineBuild(goodKey)}
        <CharacterPortraitCard
          character={char}
          tintBackground
          dimmed={!ownedKeys.has(goodKey)}
          href={char?.name_id ? `/characters/${char.name_id}` : undefined}
          class="roster-card"
        >
          {#snippet badge()}
            {#if build}
              <WeaponBadge
                weaponKey={build.weapon.key}
                refinement={build.weapon.refinement}
              />
            {/if}
          {/snippet}
          {#snippet meta()}
            <div class="meta-name">{char?.name ?? goodKey}</div>
            {#if build}
              <div class="meta-build">C{build.cons}</div>
            {/if}
          {/snippet}
          {#if !char}
            <span class="fallback-key">{goodKey.slice(0, 4)}</span>
          {/if}
        </CharacterPortraitCard>
      {/each}
    </div>

    {#if baselineVariantsList.length > 0}
      {@render variantBoard(
        baselineVariantsList,
        "Baseline variants",
        "Floor-cost options, ranked by DPS vs baseline. Highlighted rows are within 2.5% DPS of the best variant in this list.",
      )}
    {/if}

    {#if ownedVariantsList.length > 0}
      {@render variantBoard(
        ownedVariantsList,
        "Owned weapon options",
        "Already-owned 5★ weapon alternatives compared to this team baseline. Highlighted rows are within 2.5% DPS of the best option in this list.",
      )}
    {/if}

    {#if costGroups.length > 0}
      <section class="section">
        <h2 class="section-title">Investment by cost</h2>
        <p class="section-lede">
          Best upgrades at each pull cost. Expand a row for alternatives.
          Highlighted configs are within 2.5% DPS of the best config at that
          cost.
        </p>
        <Surface flush class="board ladder">
          <div class="ladder-head" aria-hidden="true">
            <span>Cost</span>
            <span>Best upgrade</span>
            <span>DPS</span>
            <span>Δ prev</span>
            <span>vs base</span>
            <span></span>
          </div>
          {#each costGroups as group, gi (group.cost)}
            {@const peakSim = group.sims[0]}
            {@const prevPeak =
              gi > 0 ? costGroups[gi - 1].sims[0] : baselineSim}
            {@const deltaNeg = prevPeak
              ? negPctInfo(prevPeak.dps, peakSim.dps)
              : null}
            {@const deltaLabel = prevPeak
              ? pctDelta(prevPeak.dps, peakSim.dps)
              : "—"}
            {@const vsBaseNeg = negPctInfo(baselineSim?.dps, peakSim.dps)}
            {@const vsBaseLabel = pctVsBaseline(peakSim.dps)}
            {@const hasAlts = group.sims.length > 1}
            {@const open = openCosts.has(group.cost)}
            <div
              class="ladder-block"
              class:ladder-divider={gi > 0}
              class:card-enter={$animationsEnabled}
              style={$animationsEnabled
                ? `animation-delay: ${gi * 40}ms`
                : undefined}
            >
              <div class="ladder-row">
                <a
                  href="/teams/configs/{encodeURIComponent(peakSim.state_key)}"
                  class="ladder-link is-near-best"
                >
                  <span class="col-cost">{group.cost}</span>
                  <span class="col-label" title={simDiffLabel(peakSim)}>
                    {simDiffLabel(peakSim)}
                  </span>
                  <span class="col-dps">{(peakSim.dps / 1000).toFixed(1)}K</span
                  >
                </a>
                <span class="col-delta">
                  {#if deltaNeg}
                    {@render negPctTip(deltaNeg)}
                  {:else}
                    {deltaLabel}
                  {/if}
                </span>
                <span class="col-base">
                  {#if vsBaseNeg}
                    {@render negPctTip(vsBaseNeg)}
                  {:else}
                    {vsBaseLabel}
                  {/if}
                </span>
                {#if hasAlts}
                  <button
                    type="button"
                    class="alts-toggle"
                    class:rotated={open}
                    onclick={() => toggleCost(group.cost)}
                    aria-expanded={open}
                    aria-controls="cost-alts-{group.cost}"
                    aria-label="{open
                      ? 'Hide'
                      : 'Show'} alternatives at cost {group.cost}"
                  >
                    <IconChevronDown size={14} />
                  </button>
                {:else}
                  <span class="alts-spacer" aria-hidden="true"></span>
                {/if}
              </div>

              {#if hasAlts && open}
                <div
                  id="cost-alts-{group.cost}"
                  class="ladder-alts"
                  transition:slide={{ duration: 180 }}
                >
                  {#each group.sims.slice(1) as sim (sim.state_key)}
                    {@const altVsBaseNeg = negPctInfo(
                      baselineSim?.dps,
                      sim.dps,
                    )}
                    <div class="ladder-row">
                      <a
                        href="/teams/configs/{encodeURIComponent(
                          sim.state_key,
                        )}"
                        class="ladder-link"
                        class:is-near-best={isNearBest(sim.dps, peakSim.dps)}
                      >
                        <span class="col-cost"></span>
                        <span class="col-label" title={simDiffLabel(sim)}>
                          {simDiffLabel(sim)}
                        </span>
                        <span class="col-dps"
                          >{(sim.dps / 1000).toFixed(1)}K</span
                        >
                      </a>
                      <span class="col-delta"></span>
                      <span class="col-base">
                        {#if altVsBaseNeg}
                          {@render negPctTip(altVsBaseNeg)}
                        {:else}
                          {pctVsBaseline(sim.dps)}
                        {/if}
                      </span>
                      <span class="alts-spacer" aria-hidden="true"></span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </Surface>
      </section>
    {/if}
  {/if}

  <TeamNumbersNote />
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .config-link {
    width: fit-content;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
  }

  .config-link:hover {
    text-decoration: underline;
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }

  .roster {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    max-width: 36rem;
  }

  .roster :global(.roster-card) {
    min-width: 0;
  }

  .roster :global(.roster-card:active) {
    transform: scale(0.97);
  }

  .fallback-key {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Board hairlines are pure white — warm tones over blue mid mix to mud.
     :global so tokens reach Surface's root (child-component scope). */
  :global(.board) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  .board-head,
  .board-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3.5rem 3.25rem;
    gap: 0.5rem;
    align-items: center;
    padding: 0.55rem 0.75rem;
    font-size: var(--text-xs);
  }

  .board-head {
    color: var(--foreground-mid);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    font-size: 0.65rem;
    border-bottom: var(--border-width) solid var(--border-subtle);
  }

  .board-head span:nth-child(2),
  .board-head span:nth-child(3) {
    text-align: right;
  }

  .board-row {
    text-decoration: none;
    color: inherit;
  }

  .board-row:hover {
    background: var(--surface-quiet);
  }

  .board-row.is-baseline .row-label {
    font-weight: 600;
  }

  .board-row.is-near-best {
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
    box-shadow: inset 2px 0 0 rgba(255, 255, 255, 0.45);
  }

  .board-row.is-near-best:hover {
    background: color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .ladder-row:has(.is-near-best) {
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
    box-shadow: inset 2px 0 0 rgba(255, 255, 255, 0.45);
  }

  .ladder-row:has(.is-near-best):hover {
    background: color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .board-divider {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .row-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground-color);
  }

  .row-tag {
    flex-shrink: 0;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent-3);
    border: var(--border-width) solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-sm);
    padding: 0.05rem 0.3rem;
  }

  .row-dps,
  .col-dps {
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--accent-1);
  }

  .row-pct,
  .col-delta,
  .col-base {
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--foreground-mid);
  }

  .pct-tip {
    position: relative;
    display: inline-block;
    margin: 0;
    padding: 0;
    border: none;
    border-bottom: var(--border-width) dashed rgba(255, 255, 255, 0.35);
    background: none;
    font: inherit;
    color: inherit;
    cursor: help;
    text-align: inherit;
  }

  .pct-tip:focus-visible {
    outline: 2px solid var(--accent-1);
    outline-offset: 2px;
  }

  .ladder-head,
  .ladder-row {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) 3.5rem 3.25rem 3.25rem 1.5rem;
    column-gap: 0.5rem;
    align-items: center;
    padding: 0.55rem 0.75rem;
  }

  .ladder-head {
    font-size: 0.65rem;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
    border-bottom: var(--border-width) solid var(--border-subtle);
  }

  .ladder-head span:nth-child(n + 3) {
    text-align: right;
  }

  .ladder-divider {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .ladder-link {
    grid-column: 1 / 4;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    min-width: 0;
    padding: 0.1rem 0;
    text-decoration: none;
    color: inherit;
    font-size: var(--text-xs);
  }

  .col-delta,
  .col-base {
    font-size: var(--text-xs);
  }

  .ladder-row:hover:not(:has(.is-near-best)) {
    background: var(--surface-quiet);
  }

  .col-cost {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--foreground-color);
  }

  .col-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground-color);
  }

  .col-delta {
    color: var(--accent-1);
  }

  .alts-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    transition: transform var(--control-duration) var(--control-ease);
  }

  .alts-toggle:hover {
    color: var(--accent-1);
  }

  .alts-toggle.rotated {
    transform: rotate(180deg);
  }

  .alts-spacer {
    width: 1.5rem;
    height: 1rem;
  }

  .ladder-alts {
    background: color-mix(in srgb, var(--foreground-color) 3%, transparent);
  }

  .ladder-alts .ladder-link {
    opacity: 0.9;
  }

  .card-enter {
    animation: slide-up 0.3s ease-out both;
  }

  :global(.page-shell.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-enter {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .ladder-head {
      display: none;
    }

    .ladder-head,
    .ladder-row {
      grid-template-columns: 2.25rem minmax(0, 1fr) 3.25rem 1.5rem;
      column-gap: 0.35rem;
    }

    .ladder-link {
      grid-column: 1 / 4;
    }

    .col-delta,
    .col-base {
      display: none;
    }
  }
</style>
