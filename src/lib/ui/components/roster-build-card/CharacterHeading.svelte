<script lang="ts">
  /** Card name row (edit cog) and `Lv. level / cap` with inline level / cap inputs. */
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import type { RosterProgress } from "#lib/definitions.js";
  import { levelCapForAscension } from "#lib/planner/upgrade-costs.js";
  import {
    levelFieldDraft,
    progressWithLevelInput,
    type LevelField,
  } from "#lib/roster/roster-progress-edit.js";

  let {
    name,
    progress,
    editMode,
    showEditToggle,
    onToggleEdit,
    onCommit,
  }: {
    name: string;
    progress: RosterProgress;
    editMode: boolean;
    showEditToggle: boolean;
    onToggleEdit: () => void;
    onCommit: (next: RosterProgress) => void;
  } = $props();

  let levelField = $state<LevelField | null>(null);
  let levelDraft = $state("");

  $effect(() => {
    if (!editMode) {
      levelField = null;
      levelDraft = "";
    }
  });

  function startLevelField(field: LevelField) {
    if (!editMode) return;
    levelField = field;
    levelDraft = levelFieldDraft(progress, field);
  }

  function commitLevelField() {
    if (levelField == null) return;
    const raw = Number(levelDraft);
    const field = levelField;
    levelField = null;
    levelDraft = "";
    const next = progressWithLevelInput(progress, field, raw);
    if (next) onCommit(next);
  }

  function onLevelFieldKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      levelField = null;
      levelDraft = "";
    }
  }
</script>

<div class="name">
  <span class="name-text">{name}</span>
  {#if showEditToggle}
    <button
      type="button"
      class="name-edit"
      class:active={editMode}
      aria-pressed={editMode}
      aria-label={editMode
        ? "Done editing build"
        : "Edit constellations and talents"}
      title={editMode ? "Done" : "Edit constellations & talents"}
      onclick={onToggleEdit}
    >
      <IconCog size={16} />
    </button>
  {/if}
</div>
<div class="level" class:level-edit={editMode}>
  Lv.
  {#if editMode && levelField === "level"}
    <!-- Focus follows the "Edit level" click that swapped this input in. -->
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="level-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="3"
      bind:value={levelDraft}
      onkeydown={onLevelFieldKey}
      onblur={commitLevelField}
      aria-label="Character level"
      autofocus
    />
  {:else if editMode}
    <button
      type="button"
      class="level-num"
      aria-label="Edit level"
      onclick={() => startLevelField("level")}>{progress.level}</button
    >
  {:else}
    {progress.level}
  {/if}
  /
  {#if editMode && levelField === "cap"}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="level-input level-input-cap"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="2"
      bind:value={levelDraft}
      onkeydown={onLevelFieldKey}
      onblur={commitLevelField}
      aria-label="Ascension level cap"
      autofocus
    />
  {:else if editMode}
    <button
      type="button"
      class="level-num level-num-cap"
      aria-label="Edit ascension cap"
      title="Ascension {progress.ascension}"
      onclick={() => startLevelField("cap")}
      >{levelCapForAscension(progress.ascension)}</button
    >
  {:else}
    <span>{levelCapForAscension(progress.ascension)}</span>
  {/if}
</div>

<style>
  .name {
    position: relative;
    z-index: 1;
    padding: 0 0 0.5% 0;
    font-size: 130%;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .name-text {
    min-width: 0;
  }

  .name-edit {
    pointer-events: all;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.15em;
    height: 1.15em;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0.25em;
    background: transparent;
    color: #f4f1e8;
    cursor: pointer;
    opacity: 0.75;
  }

  .name-edit:hover,
  .name-edit:focus-visible {
    opacity: 1;
  }

  .name-edit.active {
    opacity: 1;
  }

  .name-edit :global(svg) {
    width: 0.72em;
    height: 0.72em;
  }

  .level {
    position: relative;
    z-index: 1;
  }

  .level span,
  .level-num-cap {
    opacity: 0.6;
  }

  .level-edit {
    pointer-events: all;
  }

  .level-num {
    margin: 0;
    padding: 0 0.05em;
    border: none;
    border-radius: 0.15em;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: rgba(255, 255, 255, 0.35);
    text-underline-offset: 0.12em;
  }

  .level-num:hover,
  .level-num:focus-visible {
    text-decoration-color: rgba(255, 255, 255, 0.85);
  }

  .level-input {
    width: 2.8em;
    margin: 0 0.1em;
    padding: 0.05em 0.15em;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 0.2em;
    background: rgba(0, 0, 0, 0.45);
    color: #f4f1e8;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
    appearance: textfield;
  }

  .level-input::-webkit-outer-spin-button,
  .level-input::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  .level-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.85);
  }
</style>
