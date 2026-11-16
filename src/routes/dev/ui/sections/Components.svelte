<script lang="ts">
  import Surface from "#lib/ui/components/Surface.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";
  import Team from "#lib/ui/components/Team.svelte";
  import GameText from "#lib/ui/components/GameText.svelte";
  import WeaponTooltip from "#lib/ui/components/WeaponTooltip.svelte";
  import ArtifactTooltip from "#lib/ui/components/ArtifactTooltip.svelte";
  import HoverTooltip from "#lib/ui/components/HoverTooltip.svelte";
  import IconInfo from "#lib/ui/icons/IconInfo.svelte";
  import IconFilter from "#lib/ui/icons/IconFilter.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";
  import IconUser from "#lib/ui/icons/IconUser.svelte";
  import IconMonitor from "#lib/ui/icons/IconMonitor.svelte";
  import IconCloudUp from "#lib/ui/icons/IconCloudUp.svelte";
  import type { AbyssTeam, CharacterOwned } from "#lib/definitions.js";

  let {
    sampleChars,
    sampleMap,
    demoTeam,
  }: {
    sampleChars: CharacterOwned[];
    sampleMap: Map<string, CharacterOwned>;
    demoTeam: AbyssTeam | null;
  } = $props();

  const TIP_TONE_OPTIONS = [
    {
      id: "current",
      label: "Current",
      note: "cream bg · near-black text",
      bg: "var(--foreground-mid)",
      fg: "var(--background-color)",
      border: "color-mix(in srgb, var(--accent-1) 30%, transparent)",
    },
    {
      id: "ink-on-paper",
      label: "Ink on paper",
      note: "brighter cream · soft charcoal",
      bg: "var(--accent-3)",
      fg: "#1a1610",
      border: "color-mix(in srgb, var(--accent-1) 35%, transparent)",
    },
    {
      id: "raised-invert",
      label: "Raised invert",
      note: "mid surface · cream text",
      bg: "var(--background-mid)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 22%, transparent)",
    },
    {
      id: "deep-panel",
      label: "Deep panel",
      note: "near-black · cream text · hairline",
      bg: "var(--background-color)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 28%, transparent)",
    },
    {
      id: "gold-rim",
      label: "Gold rim",
      note: "deep panel · gold edge",
      bg: "color-mix(in srgb, var(--background-mid) 88%, #000)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--accent-1) 55%, transparent)",
    },
    {
      id: "warm-glass",
      label: "Warm glass",
      note: "translucent cream wash",
      bg: "color-mix(in srgb, var(--accent-3) 82%, transparent)",
      fg: "#16130e",
      border: "color-mix(in srgb, var(--accent-1) 40%, transparent)",
    },
    {
      id: "accent-wash",
      label: "Accent wash",
      note: "soft gold fill · dark text",
      bg: "color-mix(in srgb, var(--accent-1) 28%, var(--background-mid))",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--accent-1) 50%, transparent)",
    },
    {
      id: "neutral-chip",
      label: "Neutral chip",
      note: "selected surface · cream text",
      bg: "var(--surface-selected)",
      fg: "var(--foreground-color)",
      border: "color-mix(in srgb, var(--foreground-color) 18%, transparent)",
    },
  ] as const;
</script>

<section class="gallery-section" id="components">
  <div class="section-head">
    <h2>Existing components</h2>
    <p>Shared modules under <code>#lib/ui</code>.</p>
  </div>

  <div class="control-stack">
    <Surface>
      <p class="surface-label">CharacterIcon</p>
      {#if sampleChars.length}
        <div class="icon-row">
          {#each sampleChars.slice(0, 6) as character (character.name_id)}
            <div class="icon-cell">
              <CharacterIcon {character} />
            </div>
          {/each}
        </div>
      {:else}
        <p class="token-meta">Roster not loaded yet — refresh after hydrate.</p>
      {/if}
    </Surface>

    <Surface>
      <p class="surface-label">Team</p>
      {#if demoTeam}
        <Team
          team={demoTeam}
          mapping={sampleMap}
          missingCharacters={[demoTeam.members[3]]}
        />
      {:else}
        <p class="token-meta">Need at least 4 characters in store.</p>
      {/if}
    </Surface>

    <Surface>
      <p class="surface-label">GameText</p>
      <GameText
        text={"Deals <color=#FFD780FF>Pyro DMG</color> equal to 200% of ATK. {LINK#demo}See talent{/LINK}."}
        resolveLink={() => "#components"}
      />
    </Surface>

    <Surface>
      <p class="surface-label">Tooltips</p>
      <p class="token-meta tip-palette-note">
        Hover shows a capped tip; click / tap opens a scrollable detail sheet.
        Color candidates below are always-visible mockups (current shell stays).
      </p>
      <div class="chip-row">
        <div class="group relative inline-flex">
          <Button>Weapon</Button>
          <WeaponTooltip weaponKey="EngulfingLightning" refinement={1} />
        </div>
        <div class="group relative inline-flex">
          <Button>Artifact</Button>
          <ArtifactTooltip setKey="EmblemOfSeveredFate" pieceCount={4} />
        </div>
        <div class="group relative inline-flex">
          <Button variant="ghost">
            <IconInfo size={14} />
            Current shell
          </Button>
          <HoverTooltip class="max-w-64" label="Current shell">
            <div class="tip-detail-text font-medium">Engulfing Lightning</div>
            <div
              class="tip-detail-text tip-detail-text--small mt-0.5 opacity-85"
            >
              5★ · Polearm · Base ATK 608 · ER 55.1%
            </div>
            <div
              class="tip-detail-text tip-detail-text--small mt-1.5 opacity-85"
            >
              Current: creamy --foreground-mid on near-black --background-color.
            </div>
          </HoverTooltip>
        </div>
      </div>

      <div class="tip-palette">
        {#each TIP_TONE_OPTIONS as tone (tone.id)}
          <div class="tip-candidate">
            <div class="tip-candidate-head">
              <span class="tip-candidate-label">{tone.label}</span>
              <span class="token-meta">{tone.note}</span>
            </div>
            <div
              class="tip-mock"
              style:background={tone.bg}
              style:color={tone.fg}
              style:border-color={tone.border}
            >
              <div class="tip-mock-title">Engulfing Lightning</div>
              <div class="tip-mock-meta">
                5★ · Polearm · Base ATK 608 · ER 55.1%
              </div>
              <div class="tip-mock-body">
                ATK increased by 28% of Energy Recharge over 100%. You can gain
                a maximum of 80% ATK.
              </div>
            </div>
          </div>
        {/each}
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">Animation performance</p>
      <p class="token-meta perf-note">
        Hover each card. Left column = cheap (compositor-only), right column =
        costly (triggers paint / layout). Same visual, different cost.
      </p>

      <div class="perf-grid">
        <div class="perf-pair">
          <span class="perf-pair-label good">✓ box-shadow, static</span>
          <div class="perf-card perf-shadow-good">
            <span>Cheap shadow</span>
          </div>
          <span class="token-meta">Shadow baked in; hover only moves it.</span>
        </div>

        <div class="perf-pair">
          <span class="perf-pair-label bad">✗ drop-shadow filter</span>
          <div class="perf-card perf-shadow-bad">
            <span>Costly shadow</span>
          </div>
          <span class="token-meta">
            <code>filter: drop-shadow</code> repaints on every frame.
          </span>
        </div>

        <div class="perf-pair">
          <span class="perf-pair-label good">✓ transform + opacity</span>
          <div class="perf-card perf-transform-good">
            <span>Transform</span>
          </div>
          <span class="token-meta">
            <code>translate</code>/<code>scale</code> stay on the compositor.
          </span>
        </div>

        <div class="perf-pair">
          <span class="perf-pair-label bad">✗ animating layout</span>
          <div class="perf-card perf-transform-bad">
            <span>Layout</span>
          </div>
          <span class="token-meta">
            Animating <code>top</code>/<code>width</code> forces reflow.
          </span>
        </div>

        <div class="perf-pair">
          <span class="perf-pair-label good">✓ will-change on hover</span>
          <div class="perf-card perf-willchange">
            <span>Promoted</span>
          </div>
          <span class="token-meta">
            Layer hint added on hover, not left on permanently.
          </span>
        </div>

        <div class="perf-pair">
          <span class="perf-pair-label bad">✗ transitioning filter</span>
          <div class="perf-card perf-filter-bad">
            <span>Filter tween</span>
          </div>
          <span class="token-meta">
            Transitioning <code>filter</code> repaints the whole box.
          </span>
        </div>
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">Icons</p>
      <div class="icon-strip">
        <IconInfo size={18} />
        <IconFilter size={18} />
        <IconCog size={18} />
        <IconChevronDown size={18} />
        <IconUser size={18} />
        <IconMonitor size={18} />
        <IconCloudUp size={18} />
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

  .control-stack {
    display: grid;
    gap: var(--space-3);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .tip-palette-note {
    margin-bottom: var(--space-3);
  }

  .tip-palette {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .tip-candidate {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .tip-candidate-head {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .tip-candidate-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .tip-mock {
    border-radius: var(--radius-lg);
    padding: 0.55rem 0.7rem;
    border: 0.5px solid;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    max-width: 18rem;
  }

  .tip-mock-title {
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .tip-mock-meta,
  .tip-mock-body {
    font-size: 0.65rem;
    line-height: 1.35;
    margin-top: 0.3rem;
    opacity: 0.85;
  }

  /* ── Animation performance demos ─────────────────────────────────── */
  .perf-note {
    margin-bottom: var(--space-3);
  }

  .perf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-4) var(--space-3);
  }

  .perf-pair {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .perf-pair-label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .perf-pair-label.good {
    color: var(--accent-2);
  }

  .perf-pair-label.bad {
    color: color-mix(in srgb, #ff9b9b 80%, var(--foreground-color));
  }

  .perf-card {
    display: grid;
    place-items: center;
    height: 5rem;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    font-size: var(--text-xs);
    font-weight: 600;
    position: relative;
  }

  /* ✓ Cheap: static box-shadow, hover only translates (compositor only). */
  .perf-shadow-good {
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.45);
    transition: transform 0.22s ease;
  }

  .perf-shadow-good:hover {
    transform: translateY(-6px) scale(1.04);
  }

  /* ✗ Costly: drop-shadow filter recomputed every frame while it scales. */
  .perf-shadow-bad {
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
    transition: transform 0.22s ease;
  }

  .perf-shadow-bad:hover {
    transform: translateY(-6px) scale(1.04);
  }

  /* ✓ Cheap: transform + opacity only. */
  .perf-transform-good {
    transition:
      transform 0.22s ease,
      opacity 0.22s ease;
  }

  .perf-transform-good:hover {
    transform: scale(1.06);
    opacity: 0.92;
  }

  /* ✗ Costly: animating layout box (top / width) forces reflow. */
  .perf-transform-bad {
    top: 0;
    width: 100%;
    transition:
      top 0.22s ease,
      width 0.22s ease;
  }

  .perf-transform-bad:hover {
    top: -6px;
    width: 108%;
  }

  /* ✓ Cheap: promote to its own layer only while interacting. */
  .perf-willchange {
    transition: transform 0.22s ease;
  }

  .perf-willchange:hover {
    will-change: transform;
    transform: translateY(-6px) scale(1.04);
  }

  /* ✗ Costly: transitioning the filter value repaints the box each frame. */
  .perf-filter-bad {
    filter: brightness(1);
    transition: filter 0.22s ease;
  }

  .perf-filter-bad:hover {
    filter: brightness(1.25) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .perf-card {
      transition: none;
    }
  }

  .icon-row {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 4.5rem));
    gap: var(--space-2);
  }

  .icon-cell {
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface-base);
  }

  .icon-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    color: var(--foreground-mid);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }

  @media (max-width: 640px) {
    .icon-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
