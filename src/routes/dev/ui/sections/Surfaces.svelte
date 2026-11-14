<script lang="ts">
  import Surface from "#lib/ui/components/Surface.svelte";
</script>

<section class="gallery-section" id="surfaces">
  <div class="section-head">
    <h2>Surface</h2>
    <p>
      Shared <code>Surface</code> primitive — default / interactive / inset / empty.
    </p>
  </div>
  <div class="surface-row">
    <Surface>
      <p class="surface-label">Default</p>
      <p class="token-meta">surface-raised + border-default</p>
    </Surface>
    <Surface variant="interactive">
      <p class="surface-label">Interactive</p>
      <p class="token-meta">Hover strengthens border</p>
    </Surface>
    <Surface variant="inset">
      <p class="surface-label">Inset</p>
      <p class="token-meta">Neutral wash for nested blocks</p>
    </Surface>
    <Surface variant="empty">
      <p class="surface-label">Empty / loading</p>
      <p class="token-meta">Quiet mid text, dashed border</p>
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

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
