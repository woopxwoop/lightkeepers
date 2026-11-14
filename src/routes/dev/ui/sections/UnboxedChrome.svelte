<script lang="ts">
  import type { CharacterOwned } from "#lib/definitions.js";
  import Surface from "#lib/ui/components/Surface.svelte";

  let {
    detailDemoChar,
    detailAccent,
    detailNamecard,
  }: {
    detailDemoChar: CharacterOwned | undefined;
    detailAccent: string;
    detailNamecard: string;
  } = $props();
</script>

<section class="gallery-section" id="unboxed-chrome">
  <div class="section-head">
    <p class="concept-kicker">Route study · drop the outer board</p>
    <h2>Unboxed character &amp; settings</h2>
    <p>
      Left = current flush <code>Surface</code> wrapping everything. Right = hero
      / page head on the page, rail + body without an outer card — Surfaces only on
      content chunks.
    </p>
  </div>

  <div class="unbox-compare">
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge">Current</span>
        <p class="nav-study-name">Boxed board</p>
      </header>
      <Surface flush class="unbox-board">
        <div
          class="unbox-hero"
          style="--detail-accent: {detailAccent}; background-image: {detailNamecard};"
        >
          <div class="unbox-hero-scrim"></div>
          <div class="unbox-hero-copy">
            <p class="detail-eyebrow">
              {detailDemoChar?.name ?? "Character"}
            </p>
            <p class="unbox-hero-title">Builds · Teams · Kit</p>
          </div>
        </div>
        <div class="unbox-split">
          <nav class="unbox-rail" aria-hidden="true">
            <span class="active">Builds</span>
            <span>Teams</span>
            <span>Analytics</span>
            <span>Kit</span>
          </nav>
          <div class="unbox-body">
            <p class="token-meta">Tab content lives inside the same card.</p>
            <div class="unbox-fake-rows">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </Surface>
    </article>

    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge unbox-badge-next">Proposed</span>
        <p class="nav-study-name">Unboxed</p>
      </header>
      <div class="unbox-open">
        <div
          class="unbox-hero unbox-hero-open"
          style="--detail-accent: {detailAccent}; background-image: {detailNamecard};"
        >
          <div class="unbox-hero-scrim"></div>
          <div class="unbox-hero-copy">
            <p class="detail-eyebrow">
              {detailDemoChar?.name ?? "Character"}
            </p>
            <p class="unbox-hero-title">Builds · Teams · Kit</p>
          </div>
        </div>
        <div class="unbox-split unbox-split-open">
          <nav class="unbox-rail" aria-hidden="true">
            <span class="active">Builds</span>
            <span>Teams</span>
            <span>Analytics</span>
            <span>Kit</span>
          </nav>
          <div class="unbox-body">
            <p class="token-meta">Page background shows through.</p>
            <Surface class="unbox-chunk">
              <p class="surface-label">Local surface</p>
              <p class="token-meta">Only content blocks get a card.</p>
            </Surface>
          </div>
        </div>
      </div>
    </article>
  </div>

  <div class="unbox-compare">
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge">Current</span>
        <p class="nav-study-name">Settings board</p>
      </header>
      <Surface flush class="unbox-board">
        <div class="unbox-split">
          <nav class="unbox-rail" aria-hidden="true">
            <span class="active">Roster</span>
            <span>Account</span>
            <span>Display</span>
          </nav>
          <div class="unbox-body">
            <p class="surface-label">Display</p>
            <div class="unbox-fake-rows">
              <span></span><span></span>
            </div>
          </div>
        </div>
      </Surface>
    </article>

    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge unbox-badge-next">Proposed</span>
        <p class="nav-study-name">Settings open</p>
      </header>
      <div class="unbox-open">
        <p class="unbox-page-title">Settings</p>
        <div class="unbox-split unbox-split-open">
          <nav class="unbox-rail" aria-hidden="true">
            <span class="active">Roster</span>
            <span>Account</span>
            <span>Display</span>
          </nav>
          <div class="unbox-body">
            <Surface class="unbox-chunk">
              <p class="surface-label">Display</p>
              <p class="token-meta">Panel content in a local surface.</p>
            </Surface>
          </div>
        </div>
      </div>
    </article>
  </div>
</section>

<style>
  /* ── Unboxed route chrome ─────────────────────────────────────────── */
  .unbox-compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .unbox-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .unbox-col-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .unbox-badge {
    flex-shrink: 0;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 20%, transparent);
    border-radius: var(--radius-pill);
    padding: 0.15rem 0.45rem;
    color: var(--foreground-mid);
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .unbox-badge-next {
    border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
    color: var(--accent-1);
  }

  :global(.unbox-board) {
    overflow: hidden;
  }

  .unbox-open {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .unbox-page-title {
    margin: 0;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  .unbox-hero {
    position: relative;
    isolation: isolate;
    min-height: 7.5rem;
    background-position: center;
    background-size: cover;
  }

  .unbox-hero-open {
    overflow: hidden;
    border-radius: var(--radius-lg);
  }

  .unbox-hero-scrim {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--background-color) 88%, transparent),
      color-mix(in srgb, var(--background-color) 35%, transparent)
    );
  }

  .unbox-hero-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: var(--space-4);
  }

  .unbox-hero-title {
    margin: 0;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .unbox-split {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    min-height: 8rem;
  }

  .unbox-split-open {
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .unbox-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .unbox-rail span {
    padding: 0.55rem 0.65rem;
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: 0.65rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .unbox-rail span.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
    box-shadow: inset 2px 0 0 var(--accent-1);
  }

  .unbox-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .unbox-fake-rows {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .unbox-fake-rows span {
    display: block;
    height: 0.55rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .unbox-fake-rows span:nth-child(1) {
    width: 88%;
  }

  .unbox-fake-rows span:nth-child(2) {
    width: 72%;
  }

  .unbox-fake-rows span:nth-child(3) {
    width: 64%;
  }

  :global(.unbox-chunk) {
    padding: var(--space-3);
  }

  @media (max-width: 720px) {
    .unbox-compare {
      grid-template-columns: 1fr;
    }
  }

  .concept-kicker,
  .detail-eyebrow {
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

  .detail-eyebrow {
    margin-bottom: 0.45rem;
    color: var(--detail-accent);
  }

  .nav-study-name {
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
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

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
