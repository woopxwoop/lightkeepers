<script lang="ts">
  /**
   * GOOD import — file picker or pasted JSON.
   */
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "$lib/ui/components/Button.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { MAX_GOOD_FILE_BYTES } from "$lib/good-import";

  let {
    open = false,
    importing = false,
    error = "",
    disabled = false,
    onClose,
    onImport,
  }: {
    open?: boolean;
    importing?: boolean;
    error?: string;
    disabled?: boolean;
    onClose: () => void;
    onImport: (text: string) => void;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);
  let closeEl: HTMLButtonElement | null = $state(null);
  let fileInputEl: HTMLInputElement | null = $state(null);
  let pasteText = $state("");
  let fileError = $state("");
  let readingFile = $state(false);
  let readGeneration = 0;

  $effect(() => {
    if (!open) {
      pasteText = "";
      fileError = "";
      readGeneration += 1;
      return;
    }
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

  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let busy = $derived(importing || disabled || readingFile);
  let shownError = $derived(fileError || error);

  function openFilePicker() {
    if (busy) return;
    fileError = "";
    fileInputEl?.click();
  }

  async function handleFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    if (file.size > MAX_GOOD_FILE_BYTES) {
      fileError = "JSON is too large (max 10 MB).";
      return;
    }
    readingFile = true;
    const generation = readGeneration;
    try {
      const text = await file.text();
      if (generation !== readGeneration || !open) return;
      onImport(text);
    } catch {
      if (generation === readGeneration) {
        fileError = "Couldn't read that file.";
      }
    } finally {
      readingFile = false;
    }
  }

  function importPaste() {
    if (busy) return;
    const text = pasteText.trim();
    if (!text) {
      fileError = "Paste GOOD JSON, or choose a file.";
      return;
    }
    fileError = "";
    onImport(text);
  }

  function onPasteKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    importPaste();
  }
</script>

{#if open}
  <div class="good-root">
    <button
      type="button"
      class="good-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={onClose}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="good-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="good-import-title"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <header class="good-head">
        <h2 id="good-import-title" class="section-title">Upload GOOD</h2>
        <button
          type="button"
          class="good-close"
          bind:this={closeEl}
          onclick={onClose}
          aria-label="Close"
        >
          <IconX size={16} />
        </button>
      </header>

      <p class="section-lede">
        Choose a GOOD JSON file or paste it below.
      </p>

      <input
        bind:this={fileInputEl}
        type="file"
        accept=".json,application/json"
        class="file-input"
        disabled={busy}
        tabindex="-1"
        onchange={handleFile}
      />

      <Button variant="secondary" disabled={busy} onclick={openFilePicker}>
        {importing ? "Importing…" : "Choose file"}
      </Button>

      <label class="paste-field">
        <span class="paste-label">Paste JSON</span>
        <textarea
          class="paste-input"
          bind:value={pasteText}
          placeholder="Paste GOOD JSON…"
          spellcheck="false"
          aria-label="GOOD JSON"
          disabled={busy}
          onkeydown={onPasteKeydown}
        ></textarea>
      </label>

      <div class="good-actions">
        <Button variant="ghost" onclick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !pasteText.trim()}
          onclick={importPaste}
        >
          {importing ? "Importing…" : "Import"}
        </Button>
      </div>

      {#if shownError}
        <p class="error-note">{shownError}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .good-root {
    position: fixed;
    inset: 0;
    z-index: 130;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .good-backdrop {
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

  .good-panel {
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
    gap: 0.65rem;
  }

  .good-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .good-head .section-title {
    margin: 0;
  }

  .good-close {
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

  .good-close:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .paste-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .paste-label {
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .paste-input {
    width: 100%;
    min-height: 8.5rem;
    resize: vertical;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-family: ui-monospace, monospace;
    line-height: 1.4;
    outline: none;
  }

  .paste-input::placeholder {
    color: var(--foreground-mid);
  }

  .paste-input:focus {
    border-color: rgba(255, 255, 255, 0.32);
  }

  .paste-input:disabled {
    opacity: 0.5;
  }

  .good-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .error-note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }
</style>
