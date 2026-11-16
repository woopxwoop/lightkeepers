<script lang="ts">
  import Surface from "#lib/ui/components/Surface.svelte";
  import Team from "#lib/ui/components/Team.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";
  import type { AbyssTeam, CharacterOwned } from "#lib/definitions.js";
  import { siteAssetUrl } from "#lib/utils.js";

  let {
    sampleMap,
    demoTeam,
  }: {
    sampleMap: Map<string, CharacterOwned>;
    demoTeam: AbyssTeam | null;
  } = $props();

  const sbcStygianBanner = siteAssetUrl("stygian_banner");
</script>

<section class="gallery-section" id="solution-board-chrome">
  <!-- ── Solution board chrome study ──────────────────────────────────── -->
  {#snippet sbcPager()}
    <div class="sbc-pager">
      <button
        type="button"
        class="sbc-pager-btn"
        aria-label="Previous"
        disabled
      >
        <IconChevronDown size={16} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        class="sbc-pager-btn sbc-pager-btn-next"
        aria-label="Next"
        disabled
      >
        <IconChevronDown size={16} strokeWidth={2.25} />
      </button>
    </div>
  {/snippet}

  {#snippet abyssBoard(proposed: boolean)}
    <Surface
      flush
      class="solution-board sbc-board{proposed ? ' sbc-proposed' : ''}"
    >
      <div class="sbc-head">
        <div class="sbc-head-left">
          <span class="eyebrow sbc-eyebrow">
            Solution 1 <span class="sbc-eyebrow-total">of 4</span>
          </span>
        </div>
        <div class="sbc-actions">
          <span class="sbc-enemy-toggle" aria-hidden="true">
            <span>Enemies</span>
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
          {@render sbcPager()}
        </div>
      </div>
      <div class="sbc-abyss-body">
        {#each ["Top Half", "Bottom Half"] as halfLabel (halfLabel)}
          <div class="sbc-abyss-cell">
            <h3 class="sbc-half-heading">{halfLabel}</h3>
            <div class="sbc-chamber-strip">
              <div class="sbc-chambers">
                {#each [0, 1, 2] as chamber (chamber)}
                  <div class="sbc-chamber">
                    <div class="sbc-chamber-enemies">
                      <span class="sbc-enemy-stub"></span>
                      <span class="sbc-enemy-stub"></span>
                      <span class="sbc-enemy-stub"></span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
            {#if demoTeam}
              <Team
                team={demoTeam}
                mapping={sampleMap}
                missingCharacters={[demoTeam.members[3]]}
              />
            {/if}
            <p class="sbc-rate meta-sub">12% usage</p>
          </div>
        {/each}
      </div>
    </Surface>
  {/snippet}

  {#snippet stygianBoard(proposed: boolean)}
    <Surface
      flush
      class="solution-board sbc-board{proposed ? ' sbc-proposed' : ''}"
    >
      <div class="sbc-head">
        <div class="sbc-head-left sbc-head-left-stack">
          <span class="eyebrow sbc-eyebrow">
            Solution 1 <span class="sbc-eyebrow-total">of 4</span>
          </span>
          <p class="sbc-mode-hint">Balanced · ownership-aware clears</p>
        </div>
        <div class="sbc-actions">
          <span class="sbc-mode-label">Balanced</span>
          {@render sbcPager()}
        </div>
      </div>
      <div class="sbc-stygian-body">
        {#each [1, 2, 3] as field (field)}
          <div class="sbc-stygian-cell">
            <div
              class="sbc-field-hero"
              style="background-image: url('{sbcStygianBanner}');"
            >
              <div class="sbc-field-scrim" aria-hidden="true"></div>
              <h3 class="sbc-field-title">Field {field}</h3>
              <div class="sbc-hero-body">
                {#if demoTeam}
                  <Team
                    team={demoTeam}
                    mapping={sampleMap}
                    missingCharacters={[demoTeam.members[3]]}
                  />
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </Surface>
  {/snippet}

  {#snippet abyssBoardUnboxed()}
    <div class="sbc-open sbc-open-abyss">
      <div class="sbc-open-head">
        <div class="sbc-head-left">
          <span class="eyebrow sbc-eyebrow">
            Solution 1 <span class="sbc-eyebrow-total">of 4</span>
          </span>
        </div>
        <div class="sbc-actions">
          <span class="sbc-enemy-toggle" aria-hidden="true">
            <span>Enemies</span>
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
          {@render sbcPager()}
        </div>
      </div>
      <div class="sbc-open-abyss-body">
        {#each ["Top Half", "Bottom Half"] as halfLabel (halfLabel)}
          <div class="sbc-open-abyss-cell">
            <h3 class="sbc-half-heading">{halfLabel}</h3>
            <div class="sbc-chamber-strip">
              <div class="sbc-chambers">
                {#each [0, 1, 2] as chamber (chamber)}
                  <div class="sbc-chamber">
                    <div class="sbc-chamber-enemies">
                      <span class="sbc-enemy-stub"></span>
                      <span class="sbc-enemy-stub"></span>
                      <span class="sbc-enemy-stub"></span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
            {#if demoTeam}
              <Team
                team={demoTeam}
                mapping={sampleMap}
                missingCharacters={[demoTeam.members[3]]}
              />
            {/if}
            <p class="sbc-rate meta-sub">12% usage</p>
          </div>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet stygianBoardUnboxed()}
    <div class="sbc-open sbc-open-stygian">
      <div class="sbc-open-head">
        <div class="sbc-head-left sbc-head-left-stack">
          <span class="eyebrow sbc-eyebrow">
            Solution 1 <span class="sbc-eyebrow-total">of 4</span>
          </span>
          <p class="sbc-mode-hint">Balanced · ownership-aware clears</p>
        </div>
        <div class="sbc-actions">
          <span class="sbc-mode-label">Balanced</span>
          {@render sbcPager()}
        </div>
      </div>
      <div
        class="sbc-stage"
        style="background-image: url('{sbcStygianBanner}');"
      >
        <div class="sbc-stage-scrim" aria-hidden="true"></div>
        <div class="sbc-stage-seats">
          {#each [1, 2, 3] as field (field)}
            <div class="sbc-stage-seat">
              <h3 class="sbc-stage-field-title">Field {field}</h3>
              <div class="sbc-stage-seat-body">
                {#if demoTeam}
                  <Team
                    team={demoTeam}
                    mapping={sampleMap}
                    missingCharacters={[demoTeam.members[3]]}
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  <div class="section-head">
    <p class="concept-kicker">Route study · Abyss / Stygian boards</p>
    <h2>Solution board chrome</h2>
    <p>
      Three steps: Current (white widget) → Proposed (cream box) → Unboxed (no
      card / one composition). Chamber and field art stay in spirit.
    </p>
  </div>

  <div class="unbox-compare">
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge">Current</span>
        <p class="nav-study-name">Abyss · white + inset</p>
      </header>
      {@render abyssBoard(false)}
    </article>
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge unbox-badge-next">Proposed</span>
        <p class="nav-study-name">Abyss · cream + quiet</p>
      </header>
      {@render abyssBoard(true)}
    </article>
  </div>

  <article class="sbc-beyond">
    <header class="unbox-col-head">
      <span class="unbox-badge sbc-badge-beyond">Unboxed</span>
      <p class="nav-study-name">Abyss · unboxed ledger</p>
    </header>
    {@render abyssBoardUnboxed()}
  </article>

  <div class="unbox-compare">
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge">Current</span>
        <p class="nav-study-name">Stygian · white + inset</p>
      </header>
      {@render stygianBoard(false)}
    </article>
    <article class="unbox-col">
      <header class="unbox-col-head">
        <span class="unbox-badge unbox-badge-next">Proposed</span>
        <p class="nav-study-name">Stygian · cream + quiet</p>
      </header>
      {@render stygianBoard(true)}
    </article>
  </div>

  <article class="sbc-beyond">
    <header class="unbox-col-head">
      <span class="unbox-badge sbc-badge-beyond">Unboxed</span>
      <p class="nav-study-name">Stygian · one-plane stage</p>
    </header>
    {@render stygianBoardUnboxed()}
  </article>
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

  @media (max-width: 720px) {
    .unbox-compare {
      grid-template-columns: 1fr;
    }
  }

  /* ── Solution board chrome study ──────────────────────────────────── */
  /* Board hairlines: Current mirrors production white RGBA overrides;
     Proposed maps Surface borders to cream --board-border-* tokens. */
  :global(.sbc-board) {
    overflow: hidden;
  }

  :global(.sbc-board:not(.sbc-proposed)) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  :global(.sbc-board.sbc-proposed) {
    --border-subtle: var(--board-border-subtle);
    --border-default: var(--board-border-default);
    --border-strong: var(--board-border-strong);
  }

  .sbc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-subtle);
    background: var(--surface-inset);
  }

  :global(.sbc-board.sbc-proposed) .sbc-head {
    background: transparent;
  }

  .sbc-head-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
    min-width: 0;
  }

  .sbc-head-left-stack {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .sbc-eyebrow {
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .sbc-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .sbc-mode-hint {
    margin: 0;
    max-width: 18rem;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--foreground-mid);
  }

  .sbc-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .sbc-enemy-toggle,
  .sbc-mode-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    background: var(--surface-raised);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .sbc-pager {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .sbc-pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    background: var(--surface-raised);
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* Chevron points down by default — rotate to make left / right */
  .sbc-pager-btn :global(svg) {
    transform: rotate(90deg);
  }

  .sbc-pager-btn-next :global(svg) {
    transform: rotate(-90deg);
  }

  .sbc-abyss-body,
  .sbc-stygian-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .sbc-abyss-cell {
    min-width: 0;
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sbc-abyss-cell + .sbc-abyss-cell {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .sbc-half-heading {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .sbc-chamber-strip {
    padding-bottom: var(--space-2);
    border-bottom: var(--border-width) solid var(--border-default);
  }

  .sbc-chambers {
    display: flex;
  }

  .sbc-chamber {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
    padding: 0 0.35rem;
  }

  .sbc-chamber-enemies {
    display: flex;
    gap: 0.2rem;
  }

  .sbc-enemy-stub {
    display: block;
    width: 1.35rem;
    height: 2.1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .sbc-rate {
    margin: 0;
  }

  .sbc-stygian-cell {
    min-width: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .sbc-stygian-cell + .sbc-stygian-cell {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .sbc-field-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
    aspect-ratio: 5 / 4;
    max-height: 14rem;
    overflow: hidden;
    background: var(--background-color);
    background-size: cover;
    background-position: 50% 0;
  }

  .sbc-field-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--background-color) 25%, transparent) 0%,
      transparent 28%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 58%,
      color-mix(in srgb, var(--background-color) 92%, transparent) 82%,
      var(--background-color) 100%
    );
    pointer-events: none;
  }

  .sbc-field-title {
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    z-index: 2;
    margin: 0;
    padding: var(--space-2) 0;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
  }

  .sbc-hero-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 80%;
    margin-top: auto;
    margin-inline: auto;
    padding: var(--space-3) 0 var(--space-2);
  }

  @media (min-width: 1024px) {
    .sbc-abyss-body {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sbc-abyss-cell + .sbc-abyss-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }

    .sbc-stygian-body {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .sbc-stygian-cell + .sbc-stygian-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }
  }

  /* Unboxed: no Surface card — editorial head + cream board hairlines /
     one continuous Stygian stage with three seats. */
  .sbc-beyond {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    width: 100%;
  }

  .sbc-badge-beyond {
    border-color: color-mix(in srgb, var(--foreground-color) 35%, transparent);
    color: var(--foreground-color);
  }

  .sbc-open {
    --border-subtle: var(--board-border-subtle);
    --border-default: var(--board-border-default);
    --border-strong: var(--board-border-strong);
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .sbc-open-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-3);
    border-bottom: var(--border-width) solid var(--board-border-subtle);
    background: transparent;
  }

  .sbc-open-abyss-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .sbc-open-abyss-cell {
    min-width: 0;
    padding: var(--space-3) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sbc-open-abyss-cell + .sbc-open-abyss-cell {
    border-top: var(--border-width) solid var(--board-border-subtle);
  }

  .sbc-stage {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    aspect-ratio: 16 / 9;
    min-height: 14rem;
    max-height: 18rem;
    background-color: var(--background-color);
    background-size: cover;
    background-position: 50% 30%;
  }

  .sbc-stage-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--background-color) 25%, transparent) 0%,
      transparent 28%,
      color-mix(in srgb, var(--background-color) 55%, transparent) 58%,
      color-mix(in srgb, var(--background-color) 92%, transparent) 82%,
      var(--background-color) 100%
    );
    pointer-events: none;
  }

  .sbc-stage-seats {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr;
    align-content: end;
    padding: var(--space-3) var(--space-3) var(--space-2);
    gap: var(--space-3);
  }

  .sbc-stage-seat {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sbc-stage-field-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 92%, white);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
  }

  .sbc-stage-seat-body {
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .sbc-open-abyss-body {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
    }

    .sbc-open-abyss-cell {
      padding: var(--space-3) var(--space-4);
    }

    .sbc-open-abyss-cell:first-child {
      padding-left: 0;
    }

    .sbc-open-abyss-cell:last-child {
      padding-right: 0;
    }

    .sbc-open-abyss-cell + .sbc-open-abyss-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--board-border-subtle);
    }

    .sbc-stage-seats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      padding: var(--space-4) var(--space-3) var(--space-3);
    }

    .sbc-stage-seat {
      padding: 0 var(--space-3);
    }

    .sbc-stage-seat + .sbc-stage-seat {
      border-left: var(--border-width) solid var(--board-border-subtle);
    }
  }

  @media (max-width: 1023px) {
    .sbc-stage {
      aspect-ratio: auto;
      min-height: 22rem;
      max-height: none;
    }
  }

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
</style>
