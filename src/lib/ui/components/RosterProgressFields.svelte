<script lang="ts">
  /**
   * Compact constellation / level / ascension / talent sliders for roster config.
   * Live-updates via `onChange` (no Done/Cancel — parent owns save).
   */
  import NumberSliderField from "$lib/ui/components/NumberSliderField.svelte";
  import type { RosterProgress } from "$lib/definitions";
  import {
    cloneRosterProgress,
    DEFAULT_ROSTER_PROGRESS,
    MAX_CONSTELLATION,
  } from "$lib/roster-progress";
  import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";

  let {
    progress = null,
    onChange,
  }: {
    progress?: RosterProgress | null;
    onChange: (next: RosterProgress) => void;
  } = $props();

  let draft = $derived(
    cloneRosterProgress(progress) ?? {
      ...DEFAULT_ROSTER_PROGRESS,
      talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
    },
  );

  function patch(partial: Partial<RosterProgress>) {
    onChange({
      ...draft,
      ...partial,
      talents: { ...draft.talents, ...(partial.talents ?? {}) },
      weapon: partial.weapon !== undefined ? partial.weapon : draft.weapon,
    });
  }

  function patchTalents(slot: "normal" | "skill" | "burst", value: number) {
    patch({ talents: { ...draft.talents, [slot]: value } });
  }
</script>

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

<style>
  .progress-fields {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
</style>
