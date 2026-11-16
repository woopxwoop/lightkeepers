<script lang="ts">
  import type { Character, StygianTeam } from "#lib/definitions.js";
  import WishSlot from "#lib/ui/components/WishSlot.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";
  import IconEye from "#lib/ui/icons/IconEye.svelte";
  import IconEyeOff from "#lib/ui/icons/IconEyeOff.svelte";

  let {
    rowId,
    targets,
    mates,
    mateCount,
    isOpen,
    isHiding,
    direction,
    teams,
    teamIdx,
    cycleTeam,
    mapping,
    ownedIds,
    ontoggle,
    oncycle,
  }: {
    rowId: string;
    targets: { nameId: string; name: string; rarity: number }[];
    mates: string[];
    mateCount: number;
    isOpen: boolean;
    isHiding: boolean;
    direction: -1 | 0 | 1;
    teams: StygianTeam[];
    teamIdx: number;
    cycleTeam: StygianTeam | undefined;
    mapping: Map<string, Character>;
    ownedIds: Set<string>;
    ontoggle: () => void;
    oncycle: (direction: -1 | 1) => void;
  } = $props();
</script>

{#snippet teammateSlots(
  members: string[],
  count: number,
  revealed: boolean,
  direction: -1 | 0 | 1,
  hiding: boolean,
)}
  {#each Array(count) as _, i}
    {@const member = members[i]}
    {@const character = member ? mapping.get(member) : undefined}
    <div
      class="team-slot team-slot-mate"
      class:team-slot-revealed={revealed && Boolean(member)}
      class:team-slot-cycle-previous={revealed &&
        Boolean(member) &&
        direction === -1}
      class:team-slot-cycle-next={revealed &&
        Boolean(member) &&
        direction === 1}
      class:team-slot-hiding={hiding && Boolean(member)}
      style="--i: {i};"
    >
      {#if member}
        <WishSlot
          nameId={member}
          name={character?.name ?? member}
          rarity={character?.rarity ?? 4}
          dimmed={!ownedIds.has(member)}
        />
      {:else}
        <WishSlot empty name="Unrevealed teammate" />
      {/if}
    </div>
  {/each}
{/snippet}

<li class="ledger-row" id={rowId}>
  <div class="row-team">
    {#each targets as target (target.nameId)}
      <div class="team-slot">
        <WishSlot
          nameId={target.nameId}
          name={target.name}
          rarity={target.rarity}
          highlight
        />
      </div>
    {/each}

    {#if isOpen || isHiding}
      {#key teamIdx}
        {@render teammateSlots(mates, mateCount, true, direction, isHiding)}
      {/key}
    {:else}
      {@render teammateSlots([], mateCount, false, 0, false)}
    {/if}

    <div class="row-controls">
      {#if isOpen && teams.length > 1}
        <button
          type="button"
          class="row-control row-cycle row-cycle-up"
          aria-controls={rowId}
          aria-label="Previous unlocked team"
          onclick={() => oncycle(-1)}
        >
          <IconChevronDown size={18} strokeWidth={2.25} />
        </button>
      {/if}

      <button
        type="button"
        class="row-control row-toggle"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Hide team" : "Reveal team"}
        onclick={() => {
          if (isHiding) return;
          ontoggle();
        }}
      >
        <span class="row-toggle-icon" class:open={isOpen}>
          <span class="row-toggle-face row-toggle-face-closed">
            <IconEyeOff size={18} strokeWidth={2.25} />
          </span>
          <span class="row-toggle-face row-toggle-face-open">
            <IconEye size={18} strokeWidth={2.25} />
          </span>
        </span>
      </button>

      {#if isOpen && teams.length > 1}
        <button
          type="button"
          class="row-control row-cycle"
          aria-controls={rowId}
          aria-label="Next unlocked team"
          onclick={() => oncycle(1)}
        >
          <IconChevronDown size={18} strokeWidth={2.25} />
        </button>
      {/if}
    </div>
  </div>

  {#if isOpen}
    <div class="team-cycle-meta">
      <p class="team-cycle-label">
        {(cycleTeam?.avg_usage_rate ?? 0).toFixed(1)}% usage
        {#if teams.length > 1}
          <span class="team-cycle-count"
            >· team {teamIdx + 1} of {teams.length}</span
          >
        {/if}
      </p>
    </div>
  {/if}
</li>

<style>
  .ledger-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
  }

  /* Pull target + revealed teammates read as one four-slot team. */
  .row-team {
    display: flex;
    align-items: center;
    gap: var(--team-slot-gap);
    min-width: 0;
  }

  .row-controls {
    flex: 0 0 auto;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    margin-left: -0.15rem;
  }

  .row-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0.35rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .row-control:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .row-toggle {
    color: var(--accent-1);
  }

  .row-cycle {
    color: var(--foreground-mid);
  }

  .row-cycle-up :global(svg) {
    transform: rotate(180deg);
  }

  /* Stacked eye / eye-off; open state crossfades instead of rotating. */
  .row-toggle-icon {
    position: relative;
    display: block;
    width: 1.125rem;
    height: 1.125rem;
  }

  .row-toggle-face {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      opacity 180ms var(--control-ease),
      transform 180ms var(--control-ease);
  }

  .row-toggle-face-closed {
    opacity: 1;
    transform: scale(1);
  }

  .row-toggle-face-open {
    opacity: 0;
    transform: scale(0.86);
  }

  .row-toggle-icon.open .row-toggle-face-closed {
    opacity: 0;
    transform: scale(0.86);
  }

  .row-toggle-icon.open .row-toggle-face-open {
    opacity: 1;
    transform: scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .row-toggle-face {
      transition: none;
    }
  }

  /* ── Unlocked team cycle ────────────────────────────────────────── */
  /* Slots share the row evenly so a full team fits an equal-width column,
     and never grow past the standalone slot width. */
  .team-slot {
    flex: 1 1 0;
    min-width: 0;
    max-width: var(--standout-w);
  }

  /* Blanks already occupy the row — reveal is a soft materialize, not a slide. */
  .team-slot-revealed {
    animation: mate-reveal 240ms var(--control-ease) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  .team-slot-cycle-previous {
    animation-name: mate-cycle-previous;
    animation-delay: 0ms;
  }

  .team-slot-cycle-next {
    animation-name: mate-cycle-next;
    animation-delay: 0ms;
  }

  .team-slot-hiding {
    animation: mate-hide 140ms var(--control-ease) both;
    animation-delay: 0ms;
  }

  @keyframes mate-reveal {
    from {
      opacity: 0.35;
      filter: brightness(0.55);
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: scale(1);
    }
  }

  @keyframes mate-cycle-previous {
    from {
      opacity: 0.35;
      filter: brightness(0.65);
      transform: translateY(-0.45rem) scale(0.97);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mate-cycle-next {
    from {
      opacity: 0.35;
      filter: brightness(0.65);
      transform: translateY(0.45rem) scale(0.97);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: translateY(0) scale(1);
    }
  }

  @keyframes mate-hide {
    from {
      opacity: 1;
      filter: brightness(1);
      transform: scale(1);
    }
    to {
      opacity: 0;
      filter: brightness(0.6);
      transform: scale(0.96);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .team-slot-revealed,
    .team-slot-cycle-previous,
    .team-slot-cycle-next,
    .team-slot-hiding {
      animation: none;
    }
  }

  .team-cycle-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding-left: 0.1rem;
  }

  .team-cycle-label {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .team-cycle-count {
    color: color-mix(in srgb, var(--foreground-mid) 75%, transparent);
  }

  @media (max-width: 640px) {
    .row-controls {
      flex-basis: 2.75rem;
      gap: 0.2rem;
    }

    .row-control {
      width: 2.75rem;
      height: 2.75rem;
    }
  }
</style>
