<script lang="ts">
  import { goalRowIcon, goalRowSummary } from "$lib/goal-row";
  import { itineraryGoalLabel } from "$lib/planner-itinerary";
  import type { CalculatorGoal } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconGripVertical from "$lib/ui/icons/IconGripVertical.svelte";
  import IconStar from "$lib/ui/icons/IconStar.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";

  let {
    goals,
    catalog = null,
    selectedId = null,
    removedIds = new Set<string>(),
    onSelect,
    onStar,
    onReorder,
    onConfigure,
    onRemove,
  }: {
    goals: CalculatorGoal[];
    catalog?: UpgradeCostsCatalog | null;
    selectedId?: string | null;
    /** Soft-deleted rows stay visible with a strike until Save. */
    removedIds?: ReadonlySet<string>;
    onSelect?: (id: string) => void;
    onStar: (id: string) => void;
    onReorder: (from: number, to: number) => void;
    onConfigure?: (id: string) => void;
    onRemove?: (id: string) => void;
  } = $props();

  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);

  function startReorder(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    if (goals.length < 2) return;
    if (removedIds.has(goals[index]?.id ?? "")) return;
    e.preventDefault();
    const target = e.currentTarget;
    if (target instanceof HTMLElement) target.setPointerCapture(e.pointerId);
    dragFrom = index;
    dragOver = index;
  }

  function moveReorder(e: PointerEvent) {
    if (dragFrom == null) return;
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-goal-index]");
    if (!(hit instanceof HTMLElement)) return;
    const next = Number(hit.dataset.goalIndex);
    if (Number.isInteger(next)) dragOver = next;
  }

  function endReorder() {
    if (dragFrom != null && dragOver != null && dragFrom !== dragOver) {
      onReorder(dragFrom, dragOver);
    }
    dragFrom = null;
    dragOver = null;
  }

  function onReorderKey(e: KeyboardEvent, index: number) {
    if (removedIds.has(goals[index]?.id ?? "")) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onReorder(index, index - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onReorder(index, index + 1);
    }
  }
</script>

<ul class="goal-list">
  {#each goals as goal, i (goal.id)}
    {@const active = goal.id === selectedId}
    {@const removed = removedIds.has(goal.id)}
    {@const label = itineraryGoalLabel(goal, catalog)}
    {@const icon = goalRowIcon(goal, catalog)}
    {@const summary = goalRowSummary(goal, catalog)}
    {#snippet face()}
      {#if icon}
        <img
          class="goal-icon"
          src={icon}
          alt=""
          width="32"
          height="32"
          loading="lazy"
        />
      {:else}
        <span class="goal-icon goal-icon-fallback"></span>
      {/if}
      <span class="goal-text">
        <span class="meta-name">{label}</span>
        <span class="meta-sub">{summary}</span>
      </span>
    {/snippet}
    <li
      class="goal-item"
      class:is-active={active && !removed}
      class:is-removed={removed}
      class:is-dragging={dragFrom === i}
      class:is-drop={dragOver === i && dragFrom !== null && dragFrom !== i}
      data-goal-index={i}
      aria-current={active && !removed ? "true" : undefined}
    >
      <button
        type="button"
        class="goal-drag"
        aria-label={`Reorder ${label}`}
        disabled={goals.length < 2 || removed}
        onpointerdown={(e) => startReorder(e, i)}
        onpointermove={moveReorder}
        onpointerup={endReorder}
        onpointercancel={endReorder}
        onkeydown={(e) => onReorderKey(e, i)}
      >
        <IconGripVertical size={16} />
      </button>
      {#if onSelect && !removed}
        <button
          type="button"
          class="goal-select"
          onclick={() => onSelect(goal.id)}
        >
          {@render face()}
        </button>
      {:else}
        <div class="goal-select">
          {@render face()}
        </div>
      {/if}
      <button
        type="button"
        class="goal-icon-btn goal-star"
        class:is-on={!!goal.starred && !removed}
        aria-pressed={!!goal.starred}
        aria-label={goal.starred
          ? `Unstar ${label}`
          : `Star ${label} for the farming itinerary`}
        disabled={removed}
        onclick={() => onStar(goal.id)}
      >
        <IconStar size={16} filled={!!goal.starred && !removed} />
      </button>
      {#if onConfigure}
        <button
          type="button"
          class="goal-icon-btn"
          aria-label={`Configure ${label}`}
          disabled={removed}
          onclick={() => onConfigure(goal.id)}
        >
          <IconCog size={16} />
        </button>
      {/if}
      {#if onRemove}
        <button
          type="button"
          class="goal-icon-btn"
          class:is-undo={removed}
          aria-label={removed ? `Keep ${label}` : `Remove ${label}`}
          onclick={() => onRemove(goal.id)}
        >
          <IconX size={16} />
        </button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .goal-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .goal-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-auto-flow: column;
    gap: 0.1rem;
    align-items: center;
    padding: 0.3rem 0.3rem 0.3rem 0.2rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid transparent;
    background: transparent;
  }

  .goal-item.is-dragging {
    opacity: 0.55;
  }

  .goal-item.is-drop {
    border-color: var(--accent-1);
  }

  .goal-item.is-removed {
    opacity: 0.55;
  }

  .goal-item.is-removed .goal-select {
    position: relative;
  }

  .goal-item.is-removed .goal-select::after {
    content: "";
    position: absolute;
    left: 0.25rem;
    right: 0.25rem;
    top: 50%;
    height: 1.5px;
    background: color-mix(in srgb, var(--foreground-color) 55%, transparent);
    pointer-events: none;
  }

  .goal-drag {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: grab;
    touch-action: none;
  }

  .goal-drag:hover:not(:disabled) {
    color: var(--foreground-color);
  }

  .goal-drag:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .goal-item.is-dragging .goal-drag {
    cursor: grabbing;
  }

  .goal-item:hover {
    background: color-mix(in srgb, var(--foreground-color) 7%, transparent);
  }

  .goal-item.is-active {
    background: var(--surface-selected);
    border-color: var(--accent-1);
  }

  .goal-select {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 0.55rem;
    align-items: center;
    min-width: 0;
    padding: 0.15rem 0.25rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }

  div.goal-select {
    cursor: default;
  }

  .goal-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .goal-icon-fallback {
    display: block;
  }

  .goal-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .goal-text .meta-name,
  .goal-text .meta-sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .goal-icon-btn {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .goal-icon-btn:hover:not(:disabled) {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .goal-icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .goal-icon-btn.is-undo {
    color: var(--foreground-color);
  }

  .goal-star.is-on,
  .goal-star.is-on:hover {
    color: var(--accent-1);
  }
</style>
