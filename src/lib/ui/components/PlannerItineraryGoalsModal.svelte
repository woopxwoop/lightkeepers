<script lang="ts">
  /**
   * Star, add, configure, and delete planner goals for the farming itinerary.
   * Nested above the itinerary sheet (z-130). Draft until Save.
   */
  import Button from "#lib/ui/components/Button.svelte";
  import GoalList from "#lib/ui/components/GoalList.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import type { CalculatorGoal } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";

  let {
    open = false,
    goals = [],
    catalog = null,
    dirty = false,
    saving = false,
    saveError = "",
    addError = "",
    removedIds = new Set<string>(),
    suspendKeys = false,
    closeDisabled = false,
    onClose,
    onStar,
    onReorder,
    onStarAll,
    onStarNone,
    onAddCharacter,
    onAddWeapon,
    onConfigure,
    onRemove,
    onSave,
    onCancel,
  }: {
    open?: boolean;
    goals?: CalculatorGoal[];
    catalog?: UpgradeCostsCatalog | null;
    dirty?: boolean;
    saving?: boolean;
    saveError?: string;
    addError?: string;
    removedIds?: ReadonlySet<string>;
    /** When a nested pick/configure overlay is open, skip Escape / tab trap. */
    suspendKeys?: boolean;
    /** Unsaved edits: only Cancel or Save leave, so the X shows as disabled. */
    closeDisabled?: boolean;
    onClose: () => void;
    onStar: (id: string) => void;
    onReorder: (from: number, to: number) => void;
    onStarAll: () => void;
    onStarNone: () => void;
    onAddCharacter: () => void;
    onAddWeapon: () => void;
    onConfigure: (id: string) => void;
    onRemove: (id: string) => void;
    onSave: () => void;
    onCancel: () => void;
  } = $props();
</script>

<ModalSheet
  {open}
  onclose={onClose}
  label="Goals"
  nested
  {suspendKeys}
  {closeDisabled}
  size="dialog"
>
  {#snippet head()}
    <h2 class="section-title goals-title">Goals</h2>
  {/snippet}
  <div class="goals-actions">
    <Button variant="secondary" disabled={!catalog} onclick={onAddCharacter}
      >+ Character</Button
    >
    <Button variant="secondary" disabled={!catalog} onclick={onAddWeapon}
      >+ Weapon</Button
    >
    <Button variant="secondary" onclick={onStarAll}>Star all</Button>
    <Button variant="secondary" onclick={onStarNone}>Unstar all</Button>
  </div>
  {#if addError}
    <p class="save-error" role="alert">{addError}</p>
  {/if}
  <div class="goals-list">
    {#if goals.length === 0}
      <p class="section-lede">
        Add a character or weapon goal to start planning.
      </p>
    {:else}
      <GoalList
        {goals}
        {catalog}
        {removedIds}
        {onStar}
        {onReorder}
        {onConfigure}
        {onRemove}
      />
    {/if}
  </div>
  {#if dirty || saveError}
    <div class="goals-foot">
      {#if saveError}
        <span class="save-error" role="alert">{saveError}</span>
      {/if}
      {#if dirty}
        <div class="goals-save">
          <Button variant="ghost" disabled={saving} onclick={onCancel}
            >Cancel</Button
          >
          <Button variant="primary" disabled={saving} onclick={onSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</ModalSheet>

<style>
  .goals-title {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .goals-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .goals-list {
    overflow-y: auto;
    min-height: 0;
  }

  .goals-list .section-lede {
    margin: 0;
  }

  .goals-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem 0.75rem;
    flex-shrink: 0;
    padding-top: 0.15rem;
  }

  .goals-save {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .save-error {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, #e07070 85%, var(--foreground-color));
  }
</style>
