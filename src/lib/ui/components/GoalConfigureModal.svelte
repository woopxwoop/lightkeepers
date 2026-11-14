<script lang="ts">
  /**
   * Configure start or goal for a planner goal (one side at a time).
   * Stacks above the itinerary goals picker (z-140).
   */
  import {
    patchCharacterGoalSide,
    patchWeaponGoalSide,
    retargetCharacterGoal,
    retargetWeaponGoal,
    type CharacterSidePatch,
    type PlannerPickOption,
    type WeaponSidePatch,
  } from "#lib/planner/planner-goal-edits.js";
  import { assetUrl } from "#lib/asset-urls.js";
  import type { CalculatorGoal } from "#lib/types/calculator-goals.js";
  import type { CharacterPortraitRef } from "#lib/definitions.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
  import {
    MAX_ASCENSION,
    MAX_LEVEL,
    MAX_TALENT,
  } from "#lib/planner/upgrade-costs.js";
  import Button from "#lib/ui/components/Button.svelte";
  import CharacterSearchSelect from "#lib/ui/components/CharacterSearchSelect.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import NumberSliderField from "#lib/ui/components/NumberSliderField.svelte";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";

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

  let configSide = $state<ConfigSide>("goal");
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
</script>

<ModalSheet
  open={open && !!goal && !!catalog}
  onclose={onClose}
  label="Configure goal"
  nested
  size="dialog"
>
  {#snippet head()}
    <h2 class="section-title config-title">Configure</h2>
    <SegmentedControl
      options={CONFIG_SIDE_OPTIONS}
      bind:value={configSide}
      aria-label="Edit start or goal"
    />
  {/snippet}
  {#if goal && catalog}
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
          onOriginChange={(ascension) => patchCharacter("start", { ascension })}
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
          onchange={(skill) => patchCharacter("target", { talents: { skill } })}
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
          onchange={(burst) => patchCharacter("target", { talents: { burst } })}
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
  {/if}
</ModalSheet>

<style>
  .config-title {
    margin-right: auto;
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
