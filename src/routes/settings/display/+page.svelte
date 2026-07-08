<script lang="ts">
  import { slide } from "svelte/transition";
  import {
    displayPreferences,
    setDisplayPreferences,
    THEME_COLOR_KEYS,
    DEFAULT_DARK_COLORS,
    normalizeHexColor,
    type IconStyle,
    type ThemeColorKey,
  } from "$lib/stores";
  import {
    getCharacterCoop,
    getCharacterPortrait,
    getCharacterCard,
  } from "$lib/utils";

  let colorPickerOpen = $state(false);

  const COLOR_LABELS: Record<ThemeColorKey, string> = {
    "background-color": "Background",
    "foreground-color": "Foreground",
    "background-mid": "Background (mid)",
    "foreground-mid": "Foreground (mid)",
    "accent-1": "Accent 1",
    "accent-2": "Accent 2",
    "accent-3": "Accent 3",
  };

  const HEX_COLOR_RE =
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

  function setThemeColor(key: ThemeColorKey, value: string) {
    if (!HEX_COLOR_RE.test(value)) return;
    const normalized = normalizeHexColor(value);
    setDisplayPreferences({
      themeColors: {
        ...$displayPreferences.themeColors,
        [key]: normalized,
      } as Partial<Record<ThemeColorKey, string>>,
    });
  }

  const THEME_TEMPLATES: {
    name: string;
    colors: Record<ThemeColorKey, string>;
  }[] = [
    {
      name: "Default Dark",
      colors: DEFAULT_DARK_COLORS,
    },
    {
      name: "Enkanomiya",
      colors: {
        "background-color": "#070c12",
        "foreground-color": "#deecf5",
        "background-mid": "#0c1624",
        "foreground-mid": "#9cbbd4",
        "accent-1": "#4dd0e1",
        "accent-2": "#80deea",
        "accent-3": "#4db6ac",
      },
    },
    {
      name: "Natlan",
      colors: {
        "background-color": "#120e0c",
        "foreground-color": "#f0e6d8",
        "background-mid": "#1c1714",
        "foreground-mid": "#ccbcad",
        "accent-1": "#f5b041",
        "accent-2": "#f9d07a",
        "accent-3": "#e8973a",
      },
    },
    {
      name: "Inazuma",
      colors: {
        "background-color": "#0d0812",
        "foreground-color": "#ece4f5",
        "background-mid": "#161024",
        "foreground-mid": "#c2b0d4",
        "accent-1": "#c084fc",
        "accent-2": "#e2b0f0",
        "accent-3": "#a07cdb",
      },
    },
  ];

  function setIconStyle(iconStyle: IconStyle) {
    setDisplayPreferences({ iconStyle });
  }
</script>

<div class="settings-panel p-6">
  <div class="flex flex-col gap-1 mb-6">
    <h3>Display</h3>
    <p>Adjust animation and character portrait preferences.</p>
  </div>

  <div class="preference-list">
    <div class="preference-row bg-picker-row">
      <div>
        <span>Character Icons</span>
        <p>Choose between portrait, headshot, or TCG card art.</p>
      </div>
      <div class="bg-picker portrait-picker">
        <button
          type="button"
          class="bg-card"
          class:is-selected={$displayPreferences.iconStyle === "coop"}
          aria-pressed={$displayPreferences.iconStyle === "coop"}
          onclick={() => setIconStyle("coop")}
        >
          <div
            class="char-card-preview char-card-preview--portrait"
            style="background-image: url({getCharacterCoop('Wriothesley')});"
          ></div>
          <span>Portrait</span>
        </button>
        <button
          type="button"
          class="bg-card"
          class:is-selected={$displayPreferences.iconStyle === "enka"}
          aria-pressed={$displayPreferences.iconStyle === "enka"}
          onclick={() => setIconStyle("enka")}
        >
          <div
            class="char-card-preview char-card-preview--headshot"
            style="background-image: url({getCharacterPortrait('Wriothesley')});"
          ></div>
          <span>Headshot</span>
        </button>
        <button
          type="button"
          class="bg-card"
          class:is-selected={$displayPreferences.iconStyle === "tcg"}
          aria-pressed={$displayPreferences.iconStyle === "tcg"}
          onclick={() => setIconStyle("tcg")}
        >
          <div
            class="char-card-preview char-card-preview--tcg"
            style="background-image: url({getCharacterCard('Wriothesley')});"
          ></div>
          <span>TCG Card</span>
        </button>
      </div>
      {#if $displayPreferences.iconStyle === "tcg"}
        <p
          class="tcg-info"
          style="color: var(--foreground-mid); font-size: 0.78rem; display: flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Not all characters have a TCG card yet &mdash; in that case, their
          portrait will be shown instead.
        </p>
      {/if}
    </div>

    <div class="preference-row bg-picker-row">
      <div>
        <span>Background</span>
        <p>
          Choose between the lighthouse image or a clean solid background.
        </p>
      </div>
      <div class="bg-picker">
        <button
          type="button"
          class="bg-card"
          class:is-selected={$displayPreferences.backgroundEnabled}
          aria-pressed={$displayPreferences.backgroundEnabled}
          onclick={() => setDisplayPreferences({ backgroundEnabled: true })}
        >
          <div
            class="bg-card-preview bg-card-preview--image"
            style="background-image: url('https://images.lightkeepers.moe/site/lightkeepers_dark.webp');"
          >
            <div class="bg-card-overlay"></div>
          </div>
          <span>Lighthouse</span>
        </button>
        <button
          type="button"
          class="bg-card"
          class:is-selected={!$displayPreferences.backgroundEnabled}
          aria-pressed={!$displayPreferences.backgroundEnabled}
          onclick={() => setDisplayPreferences({ backgroundEnabled: false })}
        >
          <div
            class="bg-card-preview bg-card-preview--solid"
            style="background: var(--background-color);"
          ></div>
          <span>Solid</span>
        </button>
      </div>
    </div>

    <div class="preference-row">
      <div>
        <span>Animations</span>
        <p>Enable card flip and motion effects.</p>
      </div>
      <button
        type="button"
        class="toggle"
        class:is-on={$displayPreferences.animationsEnabled}
        aria-label="Toggle animations"
        aria-pressed={$displayPreferences.animationsEnabled}
        onclick={() =>
          setDisplayPreferences({
            animationsEnabled: !$displayPreferences.animationsEnabled,
          })}
      >
        <span></span>
      </button>
    </div>

    <div class="preference-row">
      <div class="flex items-center gap-3">
        <span>Custom Colors</span>
        <button
          type="button"
          class="toggle"
          class:is-on={colorPickerOpen}
          aria-label="Toggle color picker"
          aria-pressed={colorPickerOpen}
          onclick={() => (colorPickerOpen = !colorPickerOpen)}
        >
          <span></span>
        </button>
      </div>
    </div>

    {#if colorPickerOpen}
      <div class="flex flex-col gap-2 px-1 py-3" transition:slide={{ duration: 200 }}>
        <div class="theme-templates">
          <span class="theme-templates-label">Theme Templates</span>
          <div class="theme-templates-list">
            {#each THEME_TEMPLATES as tmpl}
              <button
                type="button"
                class="theme-template"
                onclick={() =>
                  setDisplayPreferences({ themeColors: { ...tmpl.colors } })}
              >
                <div class="theme-template-swatches">
                  {#each THEME_COLOR_KEYS as key}
                    <span
                      style="background: {tmpl.colors[key]}"
                      title={COLOR_LABELS[key]}
                    ></span>
                  {/each}
                </div>
                <span>{tmpl.name}</span>
              </button>
            {/each}
          </div>
        </div>
        {#each THEME_COLOR_KEYS as key}
          {@const currentColor =
            $displayPreferences.themeColors?.[key] ??
            DEFAULT_DARK_COLORS[key]}
          <div class="color-row">
            <button
              type="button"
              class="color-swatch"
              style="background: {currentColor};"
              aria-label="Pick color for {COLOR_LABELS[key]}"
              onclick={() =>
                document.getElementById(`color-${key}`)?.click()}
            ></button>
            <input
              id="color-{key}"
              type="color"
              value={currentColor}
              class="sr-only"
              tabindex="-1"
              aria-label="Pick color for {COLOR_LABELS[key]}"
              oninput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setThemeColor(key, val);
              }}
            />
            <span class="color-label">{COLOR_LABELS[key]}</span>
            <input
              type="text"
              value={currentColor}
              class="color-hex-input"
              spellcheck="false"
              onblur={(e) => {
                const val = (e.target as HTMLInputElement).value;
                const normalized = val.startsWith("#") ? val : `#${val}`;
                setThemeColor(key, normalized);
                if (!HEX_COLOR_RE.test(normalized)) {
                  (e.target as HTMLInputElement).value = currentColor;
                }
              }}
              onkeydown={(e) => {
                if (e.key === "Enter")
                  (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        {/each}
        <div class="flex justify-end pt-1">
          <button
            type="button"
            class="secondary-action"
            onclick={() => setDisplayPreferences({ themeColors: null })}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-panel {
    border-radius: 8px;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--background-mid) 96%, transparent),
        color-mix(in srgb, var(--background-mid) 88%, transparent)
      ),
      color-mix(in srgb, var(--background-mid) 92%, transparent);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 34%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--accent-1) 14%, transparent),
      inset 0 -1px 0 color-mix(in srgb, black 18%, transparent);
  }

  h3 {
    font-size: 1rem;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--foreground-color);
  }

  p {
    margin-top: 0.35rem;
    max-width: 42rem;
    font-size: 0.9rem;
    color: var(--foreground-mid);
  }

  .preference-list {
    display: flex;
    flex-direction: column;
    border-top: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .preference-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 0.5px solid
      color-mix(in srgb, var(--accent-1) 22%, transparent);
  }

  .preference-row span {
    color: var(--foreground-color);
    font-size: 0.95rem;
  }

  .preference-row p {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--foreground-mid);
  }

  .toggle {
    width: 44px;
    height: 24px;
    border-radius: 999px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-color);
    padding: 2px;
    flex: 0 0 auto;
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  .toggle span {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--foreground-mid);
    transition:
      transform 0.15s,
      background-color 0.15s;
  }

  .toggle.is-on {
    border-color: color-mix(in srgb, var(--accent-1) 50%, transparent);
    background: color-mix(in srgb, var(--accent-1) 24%, transparent);
  }

  .toggle.is-on span {
    transform: translateX(20px);
    background: var(--accent-1);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  .color-swatch:hover {
    transform: scale(1.15);
  }

  .color-label {
    font-size: 0.75rem;
    color: var(--foreground-mid);
    width: 7rem;
    flex-shrink: 0;
  }

  .color-hex-input {
    width: 7.5rem;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: color-mix(in srgb, var(--background-color) 60%, transparent);
    color: var(--foreground-color);
    font-size: 0.8rem;
    font-family: monospace;
    outline: none;
    transition: border-color 0.15s;
  }

  .color-hex-input:focus {
    border-color: color-mix(in srgb, var(--accent-1) 50%, transparent);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .secondary-action {
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s,
      opacity 0.15s;
  }

  .bg-picker-row {
    flex-direction: column;
    align-items: stretch;
  }

  .bg-picker {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }

  .bg-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    border: 2px solid color-mix(in srgb, var(--accent-1) 14%, transparent);
    background: color-mix(in srgb, var(--background-color) 50%, transparent);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background-color 0.15s;
  }

  .bg-card:hover {
    border-color: color-mix(in srgb, var(--accent-1) 30%, transparent);
    background: color-mix(in srgb, var(--background-color) 40%, transparent);
  }

  .bg-card.is-selected {
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  }

  .bg-card span {
    font-size: 0.8rem;
    color: var(--foreground-mid);
    transition: color 0.15s;
  }

  .bg-card.is-selected span {
    color: var(--accent-1);
  }

  .bg-card-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 5px;
    overflow: hidden;
  }

  .bg-card-preview--image {
    background-size: cover;
    background-position: center;
    position: relative;
  }

  .bg-card-preview--solid {
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);
  }

  .bg-card-overlay {
    position: absolute;
    inset: 0;
    background-color: color-mix(in oklab, black 80%, transparent);
  }

  .theme-templates {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 0.5px solid
      color-mix(in srgb, var(--accent-1) 22%, transparent);
    margin-bottom: 8px;
  }

  .theme-templates-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent-1);
  }

  .theme-templates-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .theme-template {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: color-mix(in srgb, var(--background-color) 50%, transparent);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background-color 0.15s;
  }

  .theme-template:hover {
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
    background: color-mix(in srgb, var(--background-color) 40%, transparent);
  }

  .theme-template span {
    font-size: 0.75rem;
    color: var(--foreground-mid);
  }

  .theme-template-swatches {
    display: flex;
    gap: 3px;
  }

  .theme-template-swatches span {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 18%, transparent);
  }

  .portrait-picker {
    max-width: 550px;
  }

  .char-card-preview {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 5px;
    overflow: hidden;
    position: relative;
  }

  .char-card-preview--portrait {
    background-size: 220%;
    background-position: center 22%;
  }

  .char-card-preview--tcg {
    background-size: 100%;
    background-position: center 12%;
  }

  .char-card-preview--headshot {
    background-size: cover;
    background-position: center;
  }
</style>
