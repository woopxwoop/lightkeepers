<script lang="ts">
  /**
   * Configure start or goal for a planner goal (one side at a time).
   * Stacks above the itinerary goals picker (z-140).
   */
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import {
    patchCharacterGoalSide,
    patchWeaponGoalSide,
    retargetCharacterGoal,
    retargetWeaponGoal,
    type CharacterSidePatch,
    type PlannerPickOption,
    type WeaponSidePatch,
  } from "$lib/planner-goal-edits";
  import { assetUrl } from "$lib/asset-urls";
  import type { CalculatorGoal } from "$lib/types/calculator-goals";
  import type { CharacterPortraitRef } from "$lib/definitions";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";
  import Button from "$lib/ui/components/Button.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import NumberSliderField from "$lib/ui/components/NumberSliderField.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";

  let {
    open = false,
    goal = null,
    catalog = null,
    characterOptions = [],
    weaponOptions = [],
    getCharacter,
    onClose,
    onChange,
    onAutofillCharacter,
  }: {
    open?: boolean;
    goal?: CalculatorGoal | null;
    catalog?: UpgradeCostsCatalog | null;
    characterOptions?: PlannerPickOption[];
    weaponOptions?: PlannerPickOption[];
    getCharacter: (nameId: string) => CharacterPortraitRef | undefined;
    onClose: () => void;
    onChange: (goal: CalculatorGoal) => void;
    onAutofillCharacter?: (nameId: string, goalId: string) => void;
  } = $props();

  type ConfigSide = "start" | "goal";
  const CONFIG_SIDE_OPTIONS = [
    { value: "start" as const, label: "Start" },
    { value: "goal" as const, label: "Goal" },
  ];

  let panelEl: HTMLDivElement | null = $state(null);
  let closeEl: HTMLButtonElement | null = $state(null);
  let configSide = $state<ConfigSide>("goal");
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let editingStart = $derived(configSide === "start");

  let characterRow = $derived(
    goal?.kind === "character"
      ? catalog?.characters.find((c) => c.name_id === goal.name_id)
      : undefined,
  );
  let weaponRow = $derived(
    goal?.kind === "weapon"
      ? catalog?.weapons.find((w) => w.id === goal.weapon_id)
      : undefined,
  );

  function patchCharacter(side: "start" | "target", patch: CharacterSidePatch) {
    if (goal?.kind !== "character" || !characterRow) return;
    onChange(patchCharacterGoalSide(goal, characterRow.promotes, side, patch));
  }

  function patchWeapon(side: "start" | "target", patch: WeaponSidePatch) {
    if (goal?.kind !== "weapon" || !weaponRow) return;
    onChange(patchWeaponGoalSide(goal, weaponRow.promotes, side, patch));
  }

  $effect(() => {
    if (open) configSide = "goal";
  });

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let active = true;
    void tick().then(() => {
      if (!active || !open) return;
      closeEl?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (panelEl) trapTabKey(event, panelEl);
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus();
    };
  });
</script>

{#if open && goal && catalog}
  <div class="config-root">
    <button
      type="button"
      class="config-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={onClose}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="config-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-label="Configure goal"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <header class="config-head">
        <h2 class="section-title">Configure</h2>
        <SegmentedControl
          class="config-side"
          options={CONFIG_SIDE_OPTIONS}
          bind:value={configSide}
          aria-label="Edit start or goal"
        />
        <button
          type="button"
          class="config-close"
          bind:this={closeEl}
          onclick={onClose}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </header>
      <div class="picker-row">
        {#if goal.kind === "character"}
          <label class="field">
            <span class="field-label">Character</span>
            <CharacterSearchSelect
              bind:value={
                () => goal.name_id,
                (name_id) => {
                  if (goal.kind !== "character") return;
                  const row = catalog.characters.find(
                    (c) => c.name_id === name_id,
                  );
                  onChange(retargetCharacterGoal(goal, name_id, row?.promotes));
                  if (row) onAutofillCharacter?.(name_id, goal.id);
                }
              }
              options={characterOptions}
              {getCharacter}
              placeholder="Search character…"
              aria-label="Search character"
            />
          </label>
        {:else}
          <label class="field">
            <span class="field-label">Weapon</span>
            <CharacterSearchSelect
              bind:value={
                () => String(goal.weapon_id),
                (raw) => {
                  if (goal.kind !== "weapon") return;
                  const weapon_id = Number(raw);
                  const row = catalog.weapons.find((w) => w.id === weapon_id);
                  onChange(retargetWeaponGoal(goal, weapon_id, row?.promotes));
                }
              }
              options={weaponOptions}
              getIconSrc={(id) => {
                const row = catalog.weapons.find((w) => String(w.id) === id);
                return row?.icon ? assetUrl(row.icon) : null;
              }}
              placeholder="Search weapon…"
              aria-label="Search weapon"
            />
          </label>
        {/if}
      </div>

      <div class="config-col">
        {#if goal.kind === "character"}
          {@const characterGoal = goal}
          <NumberSliderField
            label="Ascension"
            value={characterGoal.target.ascension}
            min={0}
            max={MAX_ASCENSION}
            floor={characterGoal.start.ascension}
            origin={characterGoal.start.ascension}
            editSide={editingStart ? "origin" : "value"}
            onchange={(ascension) => patchCharacter("target", { ascension })}
            onOriginChange={(ascension) =>
              patchCharacter("start", { ascension })}
          />
          <NumberSliderField
            label="Level"
            value={characterGoal.target.level}
            min={1}
            max={MAX_LEVEL}
            floor={characterGoal.start.level}
            origin={characterGoal.start.level}
            editSide={editingStart ? "origin" : "value"}
            onchange={(level) => patchCharacter("target", { level })}
            onOriginChange={(level) => patchCharacter("start", { level })}
          />
          <NumberSliderField
            label="Normal attack"
            value={characterGoal.target.talents.normal}
            min={1}
            max={MAX_TALENT}
            floor={characterGoal.start.talents.normal}
            origin={characterGoal.start.talents.normal}
            editSide={editingStart ? "origin" : "value"}
            onchange={(normal) =>
              patchCharacter("target", { talents: { normal } })}
            onOriginChange={(normal) =>
              patchCharacter("start", { talents: { normal } })}
          />
          <NumberSliderField
            label="Skill"
            value={characterGoal.target.talents.skill}
            min={1}
            max={MAX_TALENT}
            floor={characterGoal.start.talents.skill}
            origin={characterGoal.start.talents.skill}
            editSide={editingStart ? "origin" : "value"}
            onchange={(skill) =>
              patchCharacter("target", { talents: { skill } })}
            onOriginChange={(skill) =>
              patchCharacter("start", { talents: { skill } })}
          />
          <NumberSliderField
            label="Burst"
            value={characterGoal.target.talents.burst}
            min={1}
            max={MAX_TALENT}
            floor={characterGoal.start.talents.burst}
            origin={characterGoal.start.talents.burst}
            editSide={editingStart ? "origin" : "value"}
            onchange={(burst) =>
              patchCharacter("target", { talents: { burst } })}
            onOriginChange={(burst) =>
              patchCharacter("start", { talents: { burst } })}
          />
        {:else}
          {@const weaponGoal = goal}
          <NumberSliderField
            label="Ascension"
            value={weaponGoal.target.ascension}
            min={0}
            max={MAX_ASCENSION}
            floor={weaponGoal.start.ascension}
            origin={weaponGoal.start.ascension}
            editSide={editingStart ? "origin" : "value"}
            onchange={(ascension) => patchWeapon("target", { ascension })}
            onOriginChange={(ascension) => patchWeapon("start", { ascension })}
          />
          <NumberSliderField
            label="Level"
            value={weaponGoal.target.level}
            min={1}
            max={MAX_LEVEL}
            floor={weaponGoal.start.level}
            origin={weaponGoal.start.level}
            editSide={editingStart ? "origin" : "value"}
            onchange={(level) => patchWeapon("target", { level })}
            onOriginChange={(level) => patchWeapon("start", { level })}
          />
        {/if}
      </div>

      <div class="config-actions">
        <Button variant="primary" onclick={onClose}>Looks good</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .config-root {
    position: fixed;
    inset: 0;
    z-index: 140;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .config-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .config-panel {
    position: relative;
    z-index: 1;
    width: min(92vw, 28rem);
    max-height: min(88vh, 44rem);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.85rem 1rem 1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .config-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .config-head :global(.config-side) {
    margin-left: auto;
  }

  .config-close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .config-close:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 26%, transparent);
  }

  .picker-row {
    max-width: none;
  }

  .config-col {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .config-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }
</style>
