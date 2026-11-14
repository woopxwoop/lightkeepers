<script lang="ts">
  import Button from "#lib/ui/components/Button.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";

  let {
    saving,
    unsent,
    hasUnsavedChanges,
    savedVisible,
    saveError,
    changedCount,
    onCancel,
    onSave,
  }: {
    saving: boolean;
    unsent: boolean;
    hasUnsavedChanges: boolean;
    savedVisible: boolean;
    saveError: string;
    changedCount: number;
    onCancel: () => void;
    onSave: () => void;
  } = $props();
</script>

<div class="save-bar">
  <div class="save-status">
    <span class="save-dot" class:saving class:saved={savedVisible}></span>
    <span
      class="save-label"
      class:save-error={!!saveError &&
        !saving &&
        !savedVisible &&
        !hasUnsavedChanges}
    >
      {saving
        ? "Saving..."
        : savedVisible
          ? "Saved"
          : hasUnsavedChanges
            ? "Unsaved changes"
            : saveError || "Saved on this device — not synced yet"}
    </span>
    {#if hasUnsavedChanges && saveError && !saving}
      <span class="save-error">{saveError}</span>
    {/if}
    {#if hasUnsavedChanges}
      <span class="save-changed">({changedCount} changed)</span>
    {/if}
  </div>
  {#if (hasUnsavedChanges || unsent) && !saving}
    <div class="save-actions">
      {#if hasUnsavedChanges}
        <Button variant="ghost" onclick={onCancel}>Cancel</Button>
      {/if}
      <Button variant="primary" onclick={onSave}>Save</Button>
      <div class="save-cue" aria-hidden="true">
        <IconChevronDown size={22} strokeWidth={2.5} class="save-cue-icon" />
      </div>
    </div>
  {/if}
</div>

<style>
  .save-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: 0.75rem 1.5rem;
    background: color-mix(in srgb, var(--background-mid) 94%, transparent);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 28%, transparent);
    backdrop-filter: blur(12px);
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .save-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--accent-1);
    flex-shrink: 0;
  }

  .save-dot.saving {
    background: var(--accent-2);
  }

  .save-dot.saved {
    background: var(--accent-2);
    opacity: 0.45;
  }

  .save-label {
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .save-changed {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .save-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .save-cue {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.15rem;
    color: var(--foreground-mid);
    animation: save-cue-nudge 1.1s ease-in-out infinite;
    pointer-events: none;
  }

  .save-cue :global(.save-cue-icon) {
    transform: rotate(90deg);
  }

  @keyframes save-cue-nudge {
    0%,
    100% {
      transform: translateX(0.3rem);
      opacity: 0.75;
    }
    50% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-cue {
      animation: none;
      transform: none;
      opacity: 1;
    }
  }

  .save-error {
    font-size: var(--text-xs);
    color: color-mix(in srgb, #e07070 85%, var(--foreground-color));
  }
</style>
