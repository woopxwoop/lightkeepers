<script lang="ts">
  import Select from "#lib/ui/components/Select.svelte";
  import Team from "#lib/ui/components/Team.svelte";

  type TeamSourceDemo = "stygian" | "abyss" | "simulated";
  const TEAM_SOURCE_DEMOS = [
    {
      value: "stygian" as const,
      label: "Stygian",
      summary: "Current Stygian Onslaught meta teams",
    },
    {
      value: "abyss" as const,
      label: "Abyss",
      summary: "Current Spiral Abyss meta teams",
    },
    {
      value: "simulated" as const,
      label: "Simulated",
      summary: "Teams ranked from character investment simulations",
    },
  ];
  let teamSourceDemo = $state<TeamSourceDemo>("stygian");
  let activeTeamSourceDemo = $derived(
    TEAM_SOURCE_DEMOS.find((source) => source.value === teamSourceDemo) ??
      TEAM_SOURCE_DEMOS[0],
  );
</script>

<section class="gallery-section" id="team-source-control">
  <div class="section-head">
    <p class="concept-kicker">Character teams · source control</p>
    <h2>Borderless source menu</h2>
    <p>
      Keep the familiar dropdown, but reduce its trigger to selected text and a
      chevron. The menu itself retains the bordered surface.
    </p>
  </div>

  <div class="team-source-demo">
    <header class="team-source-demo-head">
      <div>
        <p class="nav-content-kicker">Teams</p>
        <h3>Popular lineups</h3>
      </div>
      <p>Choose where the rankings come from.</p>
    </header>

    <div class="source-menu-row">
      <span>Teams:</span>
      <Select
        options={TEAM_SOURCE_DEMOS}
        bind:value={teamSourceDemo}
        bare
        aria-label="Team source demo"
      />
    </div>

    <div class="team-source-result" aria-live="polite">
      <span>Showing</span>
      <p>{activeTeamSourceDemo.summary}</p>
    </div>
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

  .nav-content-kicker {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  /* ── Character team source study ─────────────────────────────────── */
  .team-source-demo {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
  }

  .team-source-demo-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .team-source-demo-head h3 {
    margin-top: 0.25rem;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 3vw, 1.65rem);
    font-weight: 600;
  }

  .team-source-demo-head > p {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  .source-menu-row {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    padding: 0.8rem var(--space-4);
    border-block: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .source-menu-row > span {
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  .team-source-result {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .team-source-result span {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .team-source-result p {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  @media (max-width: 560px) {
    .team-source-demo-head {
      align-items: start;
      flex-direction: column;
      gap: var(--space-2);
    }

    .team-source-result {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
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
</style>
