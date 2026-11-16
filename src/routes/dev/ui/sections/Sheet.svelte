<script lang="ts">
  import Surface from "#lib/ui/components/Surface.svelte";
  import StatRow from "#lib/ui/components/StatRow.svelte";
  import { statIconUrl } from "#lib/utils.js";
</script>

<section class="gallery-section" id="sheet">
  <div class="section-head">
    <h2>Sheet primitives</h2>
    <p>Build-sheet rows and the shared section label recipe.</p>
  </div>
  <div class="surface-row">
    <Surface>
      <p class="surface-label">StatRow</p>
      <p class="token-meta mb-2">
        Label/value row for build sheets (<code>/teams/configs/[slug]</code>).
        Icon optional.
      </p>
      <div class="stat-stack">
        <StatRow label="ATK" value="2,184" icon={statIconUrl("atk")} />
        <StatRow
          label="CRIT Rate"
          value="72.4%"
          icon={statIconUrl("critRate_")}
        />
        <StatRow label="Energy Recharge" value="128.5%" />
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">.eyebrow</p>
      <p class="token-meta mb-2">
        Global utility in <code>app.css</code>, not a component — pages layer
        color and spacing on top.
      </p>
      <div class="eyebrow-stack">
        <p class="eyebrow">Most used 5★</p>
        <p class="eyebrow eyebrow-accent">Solution 1 of 4</p>
      </div>
    </Surface>
  </div>
</section>

<style>
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

  .surface-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    margin-bottom: 0.35rem;
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .surface-row {
    display: grid;
    gap: var(--space-3);
  }

  .surface-row {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .stat-stack,
  .eyebrow-stack {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .eyebrow-accent {
    color: var(--accent-1);
  }

  .mb-2 {
    margin-bottom: var(--space-2);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
