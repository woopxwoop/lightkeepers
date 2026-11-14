<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";
  import StatRow from "#lib/ui/components/StatRow.svelte";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";
  import Team from "#lib/ui/components/Team.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import { statIconUrl } from "#lib/utils.js";

  type StatGoalDemoArchetype = {
    id: string;
    label: string;
    invest: "mid" | "high";
    weapon: string;
    set: string;
    stats: { key: string; label: string; value: string }[];
  };

  const STAT_GOAL_ARCHETYPES: StatGoalDemoArchetype[] = [
    {
      id: "freeze",
      label: "Freeze",
      invest: "mid",
      weapon: "Thrilling Tales",
      set: "Noblesse 4pc",
      stats: [{ key: "enerRech_", label: "Energy Recharge", value: "186.5%" }],
    },
    {
      id: "hyperbloom",
      label: "Hyperbloom",
      invest: "high",
      weapon: "Dragon's Bane",
      set: "Flower of Paradise Lost 4pc",
      stats: [
        { key: "eleMas", label: "Elemental Mastery", value: "812" },
        { key: "enerRech_", label: "Energy Recharge", value: "148.2%" },
      ],
    },
    {
      id: "vape",
      label: "Vape",
      invest: "high",
      weapon: "Favonius Codex",
      set: "Emblem 4pc",
      stats: [
        { key: "enerRech_", label: "Energy Recharge", value: "221.0%" },
        { key: "critRate_", label: "CRIT Rate", value: "62.4%" },
        { key: "critDMG_", label: "CRIT DMG", value: "142.8%" },
      ],
    },
  ];

  let statGoalArchetypeId = $state("hyperbloom");
  let statGoalMenuOpen = $state(false);
  let statGoalArchetype = $derived(
    STAT_GOAL_ARCHETYPES.find((a) => a.id === statGoalArchetypeId) ??
      STAT_GOAL_ARCHETYPES[1],
  );
  let statGoalTeam = $derived($charactersOwned.slice(0, 4));
  let statGoalAlts = $derived(
    STAT_GOAL_ARCHETYPES.filter((a) => a.id !== statGoalArchetypeId),
  );
</script>

<section class="gallery-section" id="stat-goals-layout">
  <div class="section-head">
    <p class="concept-kicker">Character builds · Stat goals</p>
    <h2>Layout options</h2>
    <p>
      Current character page stacks team picker → gear list → link → sheet in a
      22rem column. Compare denser arrangements — same mock content.
    </p>
  </div>

  <div class="sg-archetype-bar">
    <span class="token-meta">Active archetype</span>
    <SegmentedControl
      options={STAT_GOAL_ARCHETYPES.map((a) => ({
        value: a.id,
        label: a.label,
      }))}
      bind:value={statGoalArchetypeId}
      aria-label="Stat goal archetype"
    />
  </div>

  <div class="sg-options">
    <!-- A · Current stack -->
    <article class="sg-option">
      <header class="sg-option-head">
        <h3>A · Current stack</h3>
        <p>
          Narrow column: party strip, then named gear rows, then stats. Gear
          names dominate; goals feel like an afterthought.
        </p>
      </header>
      <div class="sg-frame">
        <h4 class="section-title">Stat goals</h4>
        <p class="section-lede sg-lede">
          One team per reaction archetype (highest DPS).
        </p>
        <div class="sg-a">
          <div class="sg-a-picker">
            <div class="sg-party">
              {#each statGoalTeam as c, i (c.name_id ?? i)}
                <div class="sg-slot" class:featured={i === 0}>
                  <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                </div>
              {/each}
            </div>
            <button type="button" class="sg-gear-btn" aria-label="Other teams">
              <IconCog size={16} />
            </button>
          </div>
          <div class="sg-gear-list">
            <div class="sg-gear-row">
              <span class="sg-gear-box" aria-hidden="true"></span>
              <div>
                <p class="meta-name">{statGoalArchetype.weapon}</p>
                <p class="meta-sub">R5</p>
              </div>
            </div>
            <div class="sg-gear-row">
              <span class="sg-gear-box" aria-hidden="true"></span>
              <div>
                <p class="meta-name">{statGoalArchetype.set}</p>
                <p class="meta-sub">artifact</p>
              </div>
            </div>
          </div>
          <a class="sg-team-link" href="#stat-goals-layout"
            >View team details →</a
          >
          <div class="sg-stat-stack">
            {#each statGoalArchetype.stats as row (row.key)}
              <StatRow
                label={row.label}
                value={row.value}
                icon={statIconUrl(row.key)}
              />
            {/each}
          </div>
        </div>
      </div>
    </article>

    <!-- B · Split pane -->
    <article class="sg-option">
      <header class="sg-option-head">
        <h3>B · Split pane</h3>
        <p>
          Context left (party + compact gear), goals right. Stats get equal
          weight without fighting the picker for vertical space.
        </p>
      </header>
      <div class="sg-frame">
        <h4 class="section-title">Stat goals</h4>
        <div class="sg-b">
          <div class="sg-b-context">
            <div class="sg-party">
              {#each statGoalTeam as c, i (c.name_id ?? i)}
                <div class="sg-slot" class:featured={i === 0}>
                  <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                </div>
              {/each}
            </div>
            <p class="sg-fingerprint meta-sub">
              {statGoalArchetype.label}
              · {statGoalArchetype.invest === "high"
                ? "high invest"
                : "checklist"}
            </p>
            <div class="sg-gear-chips">
              <span class="sg-chip">{statGoalArchetype.weapon}</span>
              <span class="sg-chip">{statGoalArchetype.set}</span>
            </div>
            <a class="sg-team-link" href="#stat-goals-layout">Team details →</a>
          </div>
          <div class="sg-b-goals" aria-label="Target sheet">
            {#each statGoalArchetype.stats as row (row.key)}
              <StatRow
                label={row.label}
                value={row.value}
                icon={statIconUrl(row.key)}
              />
            {/each}
          </div>
        </div>
      </div>
    </article>

    <!-- C · Goals first -->
    <article class="sg-option">
      <header class="sg-option-head">
        <h3>C · Goals first</h3>
        <p>
          Sheet is the hero. Archetype tabs pick the team; gear stays a thin
          caption under the numbers.
        </p>
      </header>
      <div class="sg-frame">
        <div class="sg-c-head">
          <h4 class="section-title">Stat goals</h4>
          <div class="sg-arch-tabs" role="group" aria-label="Archetype">
            {#each STAT_GOAL_ARCHETYPES as arch (arch.id)}
              <button
                type="button"
                class="sg-arch-tab"
                class:active={statGoalArchetypeId === arch.id}
                aria-pressed={statGoalArchetypeId === arch.id}
                onclick={() => (statGoalArchetypeId = arch.id)}
              >
                {arch.label}
              </button>
            {/each}
          </div>
        </div>
        <div class="sg-c-goals">
          {#each statGoalArchetype.stats as row (row.key)}
            {@const icon = statIconUrl(row.key)}
            <div class="sg-goal-cell">
              <span class="sg-goal-label">
                {#if icon}
                  <img src={icon} alt="" />
                {/if}
                {row.label}
              </span>
              <strong class="sg-goal-value">{row.value}</strong>
            </div>
          {/each}
        </div>
        <div class="sg-c-foot">
          <div class="sg-party sg-party--sm">
            {#each statGoalTeam as c, i (c.name_id ?? i)}
              <div class="sg-slot" class:featured={i === 0}>
                <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
              </div>
            {/each}
          </div>
          <p class="meta-sub">
            {statGoalArchetype.weapon} · {statGoalArchetype.set}
            <a class="sg-inline-link" href="#stat-goals-layout"> details</a>
          </p>
        </div>
      </div>
    </article>

    <!-- D · Compact strip -->
    <article class="sg-option">
      <header class="sg-option-head">
        <h3>D · Compact strip</h3>
        <p>
          One chrome row (party + cog + gear icons), then a 2-column goal grid.
          Closest to “one card, one job.”
        </p>
      </header>
      <div class="sg-frame">
        <h4 class="section-title">Stat goals</h4>
        <div class="sg-d">
          <div class="sg-d-chrome">
            <div class="sg-party sg-party--sm">
              {#each statGoalTeam as c, i (c.name_id ?? i)}
                <div class="sg-slot" class:featured={i === 0}>
                  <CharacterIcon character={c} iconStyle="tcg" loading="lazy" />
                </div>
              {/each}
            </div>
            <div class="sg-d-gear">
              <span
                class="sg-gear-box sg-gear-box--sm"
                role="img"
                aria-label={`Weapon: ${statGoalArchetype.weapon}`}
                title={`Weapon: ${statGoalArchetype.weapon}`}
              ></span>
              <span
                class="sg-gear-box sg-gear-box--sm"
                role="img"
                aria-label={`Artifact set: ${statGoalArchetype.set}`}
                title={`Artifact set: ${statGoalArchetype.set}`}
              ></span>
            </div>
            <button
              type="button"
              class="sg-gear-btn"
              class:open={statGoalMenuOpen}
              aria-expanded={statGoalMenuOpen}
              aria-label="Other teams"
              onclick={() => (statGoalMenuOpen = !statGoalMenuOpen)}
            >
              <IconCog size={16} />
            </button>
          </div>
          {#if statGoalMenuOpen}
            <div class="sg-d-alts">
              {#each statGoalAlts as alt (alt.id)}
                <button
                  type="button"
                  class="sg-d-alt"
                  onclick={() => {
                    statGoalArchetypeId = alt.id;
                    statGoalMenuOpen = false;
                  }}
                >
                  <span class="meta-name">{alt.label}</span>
                  <span class="meta-sub">{alt.weapon}</span>
                </button>
              {/each}
            </div>
          {/if}
          <div class="sg-d-goals">
            {#each statGoalArchetype.stats as row (row.key)}
              <StatRow
                label={row.label}
                value={row.value}
                icon={statIconUrl(row.key)}
              />
            {/each}
          </div>
          <a class="sg-team-link" href="#stat-goals-layout"
            >View team details →</a
          >
        </div>
      </div>
    </article>
  </div>
</section>

<style>
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

  /* ── Stat goals layout study ─────────────────────────────────────────── */
  .sg-archetype-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .sg-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .sg-option {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .sg-option-head h3 {
    margin: 0 0 0.35rem;
    font-size: var(--text-md);
    font-family: var(--font-display);
  }

  .sg-option-head p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  .sg-frame {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    background: var(--background-mid);
  }

  .sg-lede {
    margin: 0.35rem 0 var(--space-3);
  }

  .sg-party {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .sg-party--sm {
    max-width: 11rem;
  }

  .sg-slot {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: var(--background-color);
  }

  .sg-slot.featured {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 55%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .sg-gear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .sg-gear-btn.open,
  .sg-gear-btn:hover {
    color: var(--accent-1);
  }

  .sg-team-link,
  .sg-inline-link {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    text-decoration: none;
  }

  .sg-team-link:hover,
  .sg-inline-link:hover {
    color: var(--foreground-color);
    text-decoration: underline;
  }

  .sg-stat-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sg-gear-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .sg-gear-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .sg-gear-box {
    width: 2.1rem;
    height: 2.1rem;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    background: color-mix(
      in srgb,
      var(--accent-1) 18%,
      var(--background-color)
    );
  }

  .sg-gear-box--sm {
    width: 1.55rem;
    height: 1.55rem;
  }

  /* A */
  .sg-a {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 18rem;
  }

  .sg-a-picker {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: center;
  }

  /* B */
  .sg-b {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: var(--space-3);
    align-items: start;
  }

  .sg-b-context {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .sg-fingerprint {
    margin: 0;
  }

  .sg-gear-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .sg-chip {
    font-size: 0.68rem;
    padding: 0.2rem 0.45rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid rgba(255, 255, 255, 0.12);
    color: var(--foreground-mid);
  }

  .sg-b-goals {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.1);
    background: var(--background-color);
  }

  /* C */
  .sg-c-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .sg-arch-tabs {
    display: inline-flex;
    gap: 0.15rem;
    flex-wrap: wrap;
  }

  .sg-arch-tab {
    border: none;
    background: transparent;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
    padding: 0.2rem 0.45rem;
    cursor: pointer;
    border-bottom: 1px solid transparent;
  }

  .sg-arch-tab.active {
    color: var(--foreground-color);
    border-bottom-color: var(--accent-1);
  }

  .sg-c-goals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.65rem;
    margin-bottom: var(--space-3);
  }

  .sg-goal-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.45rem 0.55rem;
    border-radius: var(--radius-md);
    background: var(--background-color);
    border: var(--border-width) solid rgba(255, 255, 255, 0.08);
  }

  .sg-goal-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.68rem;
    color: var(--foreground-mid);
  }

  .sg-goal-label img {
    width: 0.9rem;
    height: 0.9rem;
  }

  .sg-goal-value {
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    color: var(--foreground-color);
  }

  .sg-c-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .sg-c-foot .meta-sub {
    margin: 0;
  }

  /* D */
  .sg-d {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sg-d-chrome {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .sg-d-gear {
    display: flex;
    gap: 0.3rem;
    margin-left: auto;
  }

  .sg-d-alts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.1);
    background: var(--background-color);
  }

  .sg-d-alt {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    text-align: left;
    border: none;
    background: transparent;
    color: inherit;
    padding: 0.35rem 0.45rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .sg-d-alt:hover {
    background: color-mix(in srgb, var(--accent-1) 12%, transparent);
  }

  .sg-d-goals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 1rem;
  }

  @media (max-width: 900px) {
    .sg-options {
      grid-template-columns: 1fr;
    }

    .sg-b {
      grid-template-columns: 1fr;
    }

    .sg-d-goals {
      grid-template-columns: 1fr;
    }
  }
</style>
