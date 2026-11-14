<script lang="ts">
  /**
   * GOOD import — file picker or pasted JSON.
   */
  import Button from "#lib/ui/components/Button.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import { MAX_GOOD_FILE_BYTES } from "#lib/good-import.js";

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

  let fileInputEl: HTMLInputElement | null = $state(null);
  let pasteText = $state("");
  let fileError = $state("");
  let readingFile = $state(false);
  let readGeneration = 0;

  $effect(() => {
    if (open) return;
    pasteText = "";
    fileError = "";
    readGeneration += 1;
    readingFile = false;
  });

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
      if (generation === readGeneration) {
        readingFile = false;
      }
    }
  }

  function importPaste() {
    if (busy) return;
    const text = pasteText.trim();
    if (!text) {
      fileError = "Paste GOOD JSON, or choose a file.";
      return;
    }
    if (new TextEncoder().encode(text).byteLength > MAX_GOOD_FILE_BYTES) {
      fileError = "JSON is too large (max 10 MB).";
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

<ModalSheet
  {open}
  onclose={onClose}
  labelledby="good-import-title"
  nested
  size="dialog"
>
  {#snippet head()}
    <h2 id="good-import-title" class="section-title good-title">Upload GOOD</h2>
  {/snippet}

  <p class="section-lede">Choose a GOOD JSON file or paste it below.</p>

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
      onkeydown={onPasteKeydown}></textarea>
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
</ModalSheet>

<style>
  .good-title {
    margin: 0;
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
