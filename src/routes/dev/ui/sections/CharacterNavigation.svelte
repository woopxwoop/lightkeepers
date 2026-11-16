<script lang="ts">
  type CharacterDemoSection =
    "builds" | "teams" | "kit" | "links" | "notes" | "media";

  type CharacterSectionDemo = {
    value: CharacterDemoSection;
    label: string;
    summary: string;
    future?: boolean;
  };

  const CHARACTER_SECTION_DEMOS: CharacterSectionDemo[] = [
    {
      value: "builds",
      label: "Builds",
      summary: "Equipment, stats, and investment priorities",
    },
    {
      value: "teams",
      label: "Teams",
      summary: "Popular lineups and simulated teams",
    },
    {
      value: "kit",
      label: "Kit",
      summary: "Talents, passives, and constellations",
    },
    {
      value: "links",
      label: "Useful Links",
      summary: "External guides and references",
    },
    {
      value: "notes",
      label: "Notes",
      summary: "Future section used to test navigation scale",
      future: true,
    },
    {
      value: "media",
      label: "Media",
      summary: "Future section used to test navigation scale",
      future: true,
    },
  ];

  let railDemoSection = $state<CharacterDemoSection>("builds");
  let ledgerMobileOpen = $state(false);

  function sectionDemo(value: CharacterDemoSection) {
    return (
      CHARACTER_SECTION_DEMOS.find((section) => section.value === value) ??
      CHARACTER_SECTION_DEMOS[0]
    );
  }

  let railDemoActive = $derived(sectionDemo(railDemoSection));
</script>

<section class="gallery-section" id="character-navigation">
  <div class="section-head">
    <p class="concept-kicker">Navigation study · six-section stress test</p>
    <h2>Responsive ledger index</h2>
    <p>
      A persistent rail when space allows, collapsing into a full-width section
      disclosure on mobile. Notes and Media are marked future so the pattern can
      be tested under growth.
    </p>
  </div>

  <div class="nav-study-stack">
    <article class="nav-study">
      <header class="nav-study-head">
        <div>
          <p class="nav-study-name">Ledger rail</p>
          <p class="nav-study-note">
            Same visual language at both sizes—only its orientation changes.
          </p>
        </div>
        <span class="nav-study-fit">Responsive</span>
      </header>

      <div class="ledger-shell" class:mobile-open={ledgerMobileOpen}>
        <button
          type="button"
          class="ledger-mobile-trigger"
          aria-expanded={ledgerMobileOpen}
          aria-controls="ledger-mobile-index"
          onclick={() => (ledgerMobileOpen = !ledgerMobileOpen)}
        >
          <span>
            <small>Section</small>
            <strong>{railDemoActive.label}</strong>
          </span>
          <span class="ledger-trigger-mark" aria-hidden="true"></span>
        </button>

        <nav
          class="ledger-rail"
          id="ledger-mobile-index"
          aria-label="Character section index"
          style:--section-count={CHARACTER_SECTION_DEMOS.length}
        >
          {#each CHARACTER_SECTION_DEMOS as section (section.value)}
            <button
              type="button"
              aria-pressed={railDemoSection === section.value}
              class:active={railDemoSection === section.value}
              onclick={() => {
                railDemoSection = section.value;
                ledgerMobileOpen = false;
              }}
            >
              <span>{section.label}</span>
              {#if section.future}<small>Future</small>{/if}
            </button>
          {/each}
        </nav>
        <div class="nav-content-sample">
          <p class="nav-content-kicker">Character record</p>
          <h3>{railDemoActive.label}</h3>
          <p>{railDemoActive.summary}</p>
          {#if railDemoActive.future}
            <span class="future-notice">Scale test only</span>
          {/if}
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

  /* ── Character section navigation studies ───────────────────────── */
  .nav-study-stack {
    display: grid;
    gap: var(--space-4);
  }

  .nav-study {
    overflow: hidden;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border-radius: var(--radius-lg);
    background: var(--background-mid);
  }

  .nav-study-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .nav-study-name {
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .nav-study-note {
    max-width: 60ch;
    margin-top: 0.2rem;
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    line-height: 1.45;
  }

  .nav-study-fit,
  .future-notice {
    flex-shrink: 0;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 20%, transparent);
    border-radius: var(--radius-pill);
    padding: 0.2rem 0.5rem;
    color: var(--foreground-mid);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ledger-shell {
    display: grid;
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
  }

  .ledger-mobile-trigger {
    display: none;
  }

  .ledger-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .ledger-rail button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 2.8rem;
    padding: 0.65rem var(--space-3);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 10%, transparent);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    text-align: left;
    transition: var(--control-transition);
  }

  .ledger-rail button::before {
    position: absolute;
    inset-block: 0;
    left: 0;
    width: 2px;
    background: transparent;
    content: "";
  }

  .ledger-rail button:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .ledger-rail button.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
  }

  .ledger-rail button.active::before {
    background: var(--accent-1);
  }

  .ledger-rail small {
    color: var(--foreground-mid);
    font-size: 0.52rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .nav-content-sample {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 12rem;
    padding: clamp(1.25rem, 4vw, 2.5rem);
    background:
      linear-gradient(
        115deg,
        color-mix(in srgb, var(--foreground-color) 3%, transparent),
        transparent 60%
      ),
      var(--background-mid);
  }

  .nav-content-kicker {
    color: var(--accent-1);
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .nav-content-sample h3 {
    margin-top: 0.3rem;
    color: var(--foreground-color);
    font-family: var(--font-display);
    font-size: clamp(1.45rem, 3vw, 2rem);
    font-weight: 600;
  }

  .nav-content-sample > p:last-of-type {
    max-width: 48ch;
    margin-top: 0.35rem;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
  }

  .future-notice {
    width: fit-content;
    margin-top: var(--space-3);
  }

  @media (max-width: 640px) {
    .nav-study-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .ledger-shell {
      display: block;
    }

    .ledger-mobile-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 3.6rem;
      padding: 0.65rem var(--space-4);
      border-bottom: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 14%, transparent);
      color: var(--foreground-color);
      text-align: left;
      background: var(--surface-selected);
    }

    .ledger-mobile-trigger > span:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .ledger-mobile-trigger small {
      color: var(--foreground-mid);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ledger-mobile-trigger strong {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
    }

    .ledger-trigger-mark {
      position: relative;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 22%, transparent);
      border-radius: var(--radius-pill);
      color: var(--accent-1);
    }

    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      position: absolute;
      width: 0.65rem;
      height: 1px;
      background: currentColor;
      content: "";
      transition: transform var(--control-duration) var(--control-ease);
    }

    .ledger-trigger-mark::after {
      transform: rotate(90deg);
    }

    .ledger-shell.mobile-open .ledger-trigger-mark::after {
      transform: rotate(90deg) scaleX(0);
    }

    .ledger-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      max-height: 0;
      overflow: hidden;
      border-right: 0;
      border-bottom: var(--border-width) solid transparent;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-0.35rem);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s linear 260ms;
    }

    .ledger-shell.mobile-open .ledger-rail {
      max-height: calc(var(--section-count) * 2.8rem);
      border-bottom-color: color-mix(
        in srgb,
        var(--foreground-color) 14%,
        transparent
      );
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s;
    }

    .ledger-rail button:nth-child(even) {
      border-left: var(--border-width) solid
        color-mix(in srgb, var(--foreground-color) 10%, transparent);
    }

    .nav-content-sample {
      min-height: 9rem;
      padding: var(--space-4);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* The open state sets its own transition at higher specificity, so it has
       to be named here too. */
    .ledger-rail,
    .ledger-shell.mobile-open .ledger-rail,
    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      transition: none;
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
