<script lang="ts">
  import { tick } from "svelte";
  import type { CharacterPortraitRef } from "$lib/definitions";
  import type { SelectOption } from "$lib/ui/components/Select.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";

  let {
    value = $bindable(""),
    options = [] as SelectOption[],
    getCharacter,
    getIconSrc,
    placeholder = "Search character…",
    "aria-label": ariaLabel = "Search character",
    class: className = "",
    autofocus = false,
    onChoose,
    onDismiss,
  }: {
    value?: string;
    options?: SelectOption[];
    getCharacter?: (nameId: string) => CharacterPortraitRef | undefined;
    /** Optional leading icon URL (weapons, materials, …). */
    getIconSrc?: (value: string) => string | null | undefined;
    placeholder?: string;
    "aria-label"?: string;
    class?: string;
    /** Focus and open the suggestion menu on mount. */
    autofocus?: boolean;
    onChoose?: (next: string) => void;
    onDismiss?: () => void;
  } = $props();

  const GAP = 4;
  const EDGE = 8;
  const MAX_RESULTS = 12;
  const listboxId = $props.id();

  let query = $state("");
  let editing = $state(false);
  let suggestionIndex = $state(0);
  let inputEl: HTMLInputElement | null = $state(null);
  let fieldEl: HTMLDivElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);

  let selectedLabel = $derived(
    options.find((o) => o.value === value)?.label ?? value,
  );

  let displayValue = $derived(editing ? query : selectedLabel);

  let suggestions = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q),
        )
      : options;
    return pool.slice(0, MAX_RESULTS);
  });

  let showSuggestions = $derived(editing && suggestions.length > 0);

  $effect(() => {
    suggestionIndex = suggestions.length >= 0 ? 0 : 0;
  });

  function placeMenu() {
    const field = fieldEl;
    const menu = menuEl;
    if (!field || !menu) return;

    const rect = field.getBoundingClientRect();
    const vh = window.innerHeight;

    menu.style.maxHeight = "";
    const menuRect = menu.getBoundingClientRect();
    const belowTop = rect.bottom + GAP;
    const belowSpace = Math.max(0, vh - EDGE - belowTop);
    const aboveSpace = Math.max(0, rect.top - GAP - EDGE);

    let top = belowTop;
    if (menuRect.height > belowSpace) {
      if (menuRect.height <= aboveSpace) {
        top = rect.top - menuRect.height - GAP;
      } else if (aboveSpace > belowSpace) {
        top = EDGE;
        menu.style.maxHeight = `${aboveSpace}px`;
      } else {
        menu.style.maxHeight = `${belowSpace}px`;
      }
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  $effect(() => {
    if (!showSuggestions) return;
    void tick().then(placeMenu);
    requestAnimationFrame(placeMenu);

    function onReposition() {
      placeMenu();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  });

  function choose(next: string) {
    value = next;
    query = "";
    editing = false;
    onChoose?.(next);
    inputEl?.blur();
  }

  function startEditing() {
    editing = true;
    query = "";
  }

  function onBlur() {
    editing = false;
    query = "";
    // After choose(), blur follows — defer so onChoose can commit first.
    queueMicrotask(() => onDismiss?.());
  }

  $effect(() => {
    if (!autofocus) return;
    void tick().then(() => {
      inputEl?.focus();
      startEditing();
    });
  });

  function scrollActiveOptionIntoView() {
    void tick().then(() => {
      const id = inputEl?.getAttribute("aria-activedescendant");
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (!editing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      suggestionIndex = (suggestionIndex + 1) % suggestions.length;
      scrollActiveOptionIntoView();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      suggestionIndex =
        (suggestionIndex - 1 + suggestions.length) % suggestions.length;
      scrollActiveOptionIntoView();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[suggestionIndex];
      if (pick) choose(pick.value);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      editing = false;
      query = "";
      inputEl?.blur();
    }
  }
</script>

<div class="char-search {className}">
  <div
    class="char-search-field"
    class:open={showSuggestions}
    bind:this={fieldEl}
  >
    <input
      type="text"
      class="char-search-input"
      bind:this={inputEl}
      value={displayValue}
      {placeholder}
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={showSuggestions}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={showSuggestions &&
      suggestionIndex < suggestions.length
        ? `${listboxId}-${suggestions[suggestionIndex]!.value}`
        : undefined}
      onfocus={startEditing}
      onblur={onBlur}
      onkeydown={onKeydown}
      oninput={(e) => {
        editing = true;
        query = e.currentTarget.value;
      }}
    />
  </div>

  {#if showSuggestions}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      id={listboxId}
      class="char-search-menu"
      role="listbox"
      use:portal
      bind:this={menuEl}
      onpointerdown={(e) => e.preventDefault()}
    >
      {#each suggestions as opt, i (opt.value)}
        {@const char = getCharacter?.(opt.value)}
        {@const iconSrc = getIconSrc?.(opt.value)}
        <button
          type="button"
          id="{listboxId}-{opt.value}"
          tabindex="-1"
          role="option"
          aria-selected={value === opt.value}
          class="char-search-option"
          class:active={i === suggestionIndex}
          class:selected={value === opt.value}
          onclick={() => choose(opt.value)}
        >
          {#if getCharacter}
            <span class="char-search-icon">
              {#if char}
                <CharacterIcon character={char} />
              {/if}
            </span>
          {:else if iconSrc}
            <span class="char-search-icon">
              <img src={iconSrc} alt="" />
            </span>
          {/if}
          <span class="char-search-label">{opt.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .char-search {
    position: relative;
    min-width: 12rem;
  }

  .char-search-field {
    display: flex;
    align-items: center;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-mid);
    transition: var(--control-transition);
  }

  .char-search-field.open,
  .char-search-field:focus-within {
    border-color: var(--accent-1);
    background: var(--background-mid);
  }

  .char-search-field:focus-within {
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .char-search-input {
    width: 100%;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    color: var(--foreground-color);
    font-size: var(--text-sm);
  }

  .char-search-input::placeholder {
    color: var(--foreground-mid);
  }

  .char-search-menu {
    position: fixed;
    z-index: 200;
    max-height: 280px;
    overflow-y: auto;
    padding: 0.3rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 12px 32px color-mix(in oklab, black 42%, transparent);
  }

  .char-search-option {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.4rem 0.55rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
    transition: var(--control-transition);
  }

  .char-search-option:hover,
  .char-search-option.active {
    color: var(--foreground-color);
    background: var(--background-mid);
  }

  .char-search-option.selected {
    color: var(--foreground-color);
  }

  .char-search-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .char-search-icon {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    overflow: hidden;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    background: var(--background-mid);
  }

  .char-search-icon :global(.icon-root),
  .char-search-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
