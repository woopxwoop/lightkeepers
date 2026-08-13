<script lang="ts">
  /**
   * Edit constellation / level / talents / equipped weapon on a roster row.
   */
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "$lib/ui/components/Button.svelte";
  import NumberSliderField from "$lib/ui/components/NumberSliderField.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import WeaponIcon from "$lib/ui/components/WeaponIcon.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import type { RosterProgress } from "$lib/definitions";
  import {
    cloneRosterProgress,
    DEFAULT_ROSTER_PROGRESS,
    MAX_CONSTELLATION,
    MAX_REFINEMENT,
  } from "$lib/roster-progress";
  import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";
  import {
    equipmentVersion,
    ensureEquipmentData,
    weaponByKey,
    weaponIconSrc,
  } from "$lib/equipment-data";
  import type { SelectOption } from "$lib/ui/components/Select.svelte";

  let {
    open = false,
    name = "Character",
    progress = null,
    onClose,
    onSave,
  }: {
    open?: boolean;
    name?: string;
    progress?: RosterProgress | null;
    onClose: () => void;
    onSave: (next: RosterProgress) => void;
  } = $props();

  let draft = $state<RosterProgress>(
    cloneRosterProgress(progress) ?? {
      ...DEFAULT_ROSTER_PROGRESS,
      talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
    },
  );
  let panelEl: HTMLDivElement | null = $state(null);
  let closeEl: HTMLButtonElement | null = $state(null);

  $effect(() => {
    if (!open) return;
    draft = cloneRosterProgress(progress) ?? {
      ...DEFAULT_ROSTER_PROGRESS,
      talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
    };
    void ensureEquipmentData();
  });

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void tick().then(() => closeEl?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (panelEl) trapTabKey(event, panelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  });

  let reduced = $derived(prefersReducedMotion.current);
  let weaponOptions = $derived.by((): SelectOption[] => {
    $equipmentVersion;
    return [...weaponByKey.entries()]
      .map(([value, weapon]) => ({
        value,
        label: `${weapon.name} (${weapon.stars}★)`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  function patch(partial: Partial<RosterProgress>) {
    draft = { ...draft, ...partial };
  }

  function patchTalents(slot: "normal" | "skill" | "burst", value: number) {
    draft = { ...draft, talents: { ...draft.talents, [slot]: value } };
  }

  function setWeaponKey(key: string) {
    const current = draft.weapon;
    draft = {
      ...draft,
      weapon: {
        key,
        level: current?.level ?? 1,
        ascension: current?.ascension ?? 0,
        refinement: current?.refinement ?? 1,
      },
    };
  }
</script>

{#if open}
  <div class="progress-root">
    <button
      type="button"
      class="progress-backdrop"
      aria-label="Close"
      onclick={onClose}
      transition:fade={{ duration: reduced ? 0 : 120 }}
    ></button>
    <div
      class="progress-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-progress-title"
      tabindex="-1"
      bind:this={panelEl}
      transition:scale={{ duration: reduced ? 0 : 160, start: 0.98 }}
    >
      <header class="progress-head">
        <h2 id="roster-progress-title" class="section-title">{name}</h2>
        <button
          type="button"
          class="progress-close"
          aria-label="Close"
          bind:this={closeEl}
          onclick={onClose}
        >
          <IconX size={16} />
        </button>
      </header>

      <div class="progress-fields">
        <NumberSliderField
          label="Constellation"
          value={draft.constellation}
          min={0}
          max={MAX_CONSTELLATION}
          onchange={(value) => patch({ constellation: value })}
        />
        <NumberSliderField
          label="Level"
          value={draft.level}
          min={1}
          max={MAX_LEVEL}
          onchange={(value) => patch({ level: value })}
        />
        <NumberSliderField
          label="Ascension"
          value={draft.ascension}
          min={0}
          max={MAX_ASCENSION}
          onchange={(value) => patch({ ascension: value })}
        />
        <NumberSliderField
          label="Normal"
          value={draft.talents.normal}
          min={1}
          max={MAX_TALENT}
          onchange={(value) => patchTalents("normal", value)}
        />
        <NumberSliderField
          label="Skill"
          value={draft.talents.skill}
          min={1}
          max={MAX_TALENT}
          onchange={(value) => patchTalents("skill", value)}
        />
        <NumberSliderField
          label="Burst"
          value={draft.talents.burst}
          min={1}
          max={MAX_TALENT}
          onchange={(value) => patchTalents("burst", value)}
        />
      </div>

      <div class="weapon-block">
        <span class="weapon-label">Weapon</span>
        <CharacterSearchSelect
          value={draft.weapon?.key ?? ""}
          options={weaponOptions}
          getIconSrc={(key) => weaponIconSrc(key)}
          placeholder="Search weapon…"
          aria-label="Equipped weapon"
          onChoose={setWeaponKey}
        />
        {#if draft.weapon}
          <div class="weapon-stats">
            <WeaponIcon weaponKey={draft.weapon.key} class="weapon-icon" />
            <NumberSliderField
              label="Level"
              value={draft.weapon.level}
              min={1}
              max={MAX_LEVEL}
              onchange={(value) =>
                patch({ weapon: { ...draft.weapon!, level: value } })}
            />
            <NumberSliderField
              label="Ascension"
              value={draft.weapon.ascension}
              min={0}
              max={MAX_ASCENSION}
              onchange={(value) =>
                patch({
                  weapon: { ...draft.weapon!, ascension: value },
                })}
            />
            <NumberSliderField
              label="Refinement"
              value={draft.weapon.refinement}
              min={1}
              max={MAX_REFINEMENT}
              onchange={(value) =>
                patch({
                  weapon: { ...draft.weapon!, refinement: value },
                })}
            />
            <Button variant="ghost" onclick={() => patch({ weapon: null })}>
              Remove weapon
            </Button>
          </div>
        {/if}
      </div>

      <div class="progress-actions">
        <Button variant="ghost" onclick={onClose}>Cancel</Button>
        <Button variant="primary" onclick={() => onSave(draft)}>Done</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .progress-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .progress-backdrop {
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

  .progress-panel {
    position: relative;
    z-index: 1;
    width: min(28rem, 100%);
    max-height: min(40rem, calc(100vh - 2rem));
    overflow: auto;
    padding: 1rem 1.1rem 1.1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.18);
    background: var(--background-mid);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .progress-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .progress-head .section-title {
    margin: 0;
  }

  .progress-close {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .progress-close:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .progress-fields {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .weapon-block {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .weapon-label {
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .weapon-stats {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .weapon-icon {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
  }

  .progress-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
