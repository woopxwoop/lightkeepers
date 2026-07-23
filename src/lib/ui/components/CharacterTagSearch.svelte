<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";

  let {
    tags = $bindable([] as string[]),
    options = [] as string[],
    getLabel = (key: string) => key,
    getCharacter,
    placeholder = "Filter by character…",
    countLabel,
    "aria-label": ariaLabel = "Filter by character",
    leading,
    class: className = "",
  }: {
    tags?: string[];
    /** Keys available for suggestions (e.g. GOOD keys). */
    options?: string[];
    getLabel?: (key: string) => string;
    getCharacter?: (
      key: string,
    ) => CharacterOwned | Character | undefined;
    placeholder?: string;
    /** Trailing count text, e.g. "12 of 35". */
    countLabel?: string;
    "aria-label"?: string;
    /** Optional leading control (e.g. settings gear). */
    leading?: Snippet;
    class?: string;
  } = $props();

  let inputText = $state("");
  let suggestionIndex = $state(0);
  let focused = $state(false);
  let inputEl: HTMLInputElement | null = $state(null);

  let suggestions = $derived.by(() => {
    const q = inputText.trim().toLowerCase();
    if (!q) return [] as string[];
    return options.filter(
      (k) => !tags.includes(k) && k.toLowerCase().includes(q),
    );
  });

  let showSuggestions = $derived(focused && suggestions.length > 0);

  $effect(() => {
    suggestions;
    suggestionIndex = 0;
  });

  function addTag(key: string) {
    if (!tags.includes(key)) {
      tags = [...tags, key];
    }
    inputText = "";
    suggestionIndex = 0;
    inputEl?.focus();
  }

  function removeTag(key: string) {
    tags = tags.filter((t) => t !== key);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && suggestionIndex < suggestions.length) {
        addTag(suggestions[suggestionIndex]);
      }
    } else if (e.key === "Backspace" && inputText === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestionIndex = Math.min(suggestionIndex + 1, suggestions.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestionIndex = Math.max(suggestionIndex - 1, 0);
    } else if (e.key === "Escape") {
      inputText = "";
      suggestionIndex = 0;
      inputEl?.blur();
    }
  }
</script>

<div class="tag-search-root relative {className}">
  <div class="tag-search" class:tag-search-focus={focused}>
    {#if leading}
      {@render leading()}
    {/if}

    {#each tags as tag (tag)}
      <span class="tag-chip">
        <span class="tag-chip-text">{getLabel(tag)}</span>
        <button
          type="button"
          class="tag-chip-x"
          onclick={() => removeTag(tag)}
          aria-label="Remove {getLabel(tag)}"
        >
          ×
        </button>
      </span>
    {/each}

    <input
      type="text"
      bind:value={inputText}
      bind:this={inputEl}
      onkeydown={onKeydown}
      onfocus={() => (focused = true)}
      onblur={() => setTimeout(() => (focused = false), 150)}
      placeholder={tags.length === 0 ? placeholder : ""}
      class="tag-search-input"
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={showSuggestions}
      aria-controls="character-tag-listbox"
      aria-activedescendant={showSuggestions &&
      suggestionIndex < suggestions.length
        ? `character-tag-${suggestions[suggestionIndex]}`
        : undefined}
    />

    {#if countLabel}
      <span class="tag-count">{countLabel}</span>
    {/if}
  </div>

  {#if showSuggestions}
    <div
      id="character-tag-listbox"
      role="listbox"
      class="suggestions-dropdown absolute left-0 right-0 top-full mt-1 z-20"
    >
      {#each suggestions as key, i (key)}
        {@const char = getCharacter?.(key)}
        <button
          type="button"
          id="character-tag-{key}"
          role="option"
          aria-selected={i === suggestionIndex}
          class="suggestion-item"
          class:suggestion-active={i === suggestionIndex}
          onclick={() => addTag(key)}
        >
          <span class="suggestion-icon">
            {#if char}
              <CharacterIcon character={char} />
            {/if}
          </span>
          <span>{getLabel(key)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tag-search {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    transition: border-color var(--control-duration) var(--control-ease);
  }

  .tag-search-focus {
    border-color: rgba(255, 255, 255, 0.32);
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.15rem 0.4rem 0.15rem 0.55rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    color: var(--foreground-color);
  }

  .tag-chip-x {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 0.15rem;
    font-size: 1rem;
    line-height: 1;
    color: var(--foreground-mid);
    border-radius: 3px;
  }

  .tag-chip-x:hover {
    color: var(--foreground-color);
  }

  .tag-search-input {
    flex: 1;
    min-width: 80px;
    background: none;
    border: none;
    outline: none;
    color: var(--foreground-color);
    font-size: var(--text-sm);
    padding: 0.15rem 0;
  }

  .tag-search-input::placeholder {
    color: var(--foreground-mid);
  }

  .tag-count {
    margin-left: auto;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
    white-space: nowrap;
  }

  .suggestions-dropdown {
    max-height: 240px;
    overflow-y: auto;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    backdrop-filter: blur(8px);
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: var(--text-sm);
    color: var(--foreground-color);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--control-duration) var(--control-ease);
  }

  .suggestion-item:hover,
  .suggestion-active {
    background: var(--surface-quiet);
  }

  .suggestion-icon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--background-color);
  }
</style>
