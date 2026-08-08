<script lang="ts">
  import { slide } from "svelte/transition";
  import {
    displayPreferences,
    setDisplayPreferences,
    setBackgroundVisible,
    setBackgroundApplyToHome,
    THEME_COLOR_KEYS,
    DEFAULT_DARK_COLORS,
    normalizeHexColor,
    type IconStyle,
    type ThemeColorKey,
  } from "$lib/stores";
  import Button from "$lib/ui/components/Button.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import IconInfo from "$lib/ui/icons/IconInfo.svelte";
  import {
    getCharacterCoop,
    getCharacterPortrait,
    getCharacterCard,
  } from "$lib/utils";
  import { page } from "$app/state";

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
  ];

  function setIconStyle(iconStyle: IconStyle) {
    setDisplayPreferences({ iconStyle });
  }
</script>

<div class="display-panel">
  <header class="panel-head">
    <h2 class="section-title">Display</h2>
    <p class="lede">Adjust animation and character portrait preferences.</p>
  </header>

  <div class="preference-list">
    <div class="preference-row picker-row">
      <div>
        <span class="row-label">Character Icons</span>
        <p class="row-desc">
          Choose between portrait, headshot, or TCG card art.
        </p>
      </div>
      <div class="picker portrait-picker">
        <button
          type="button"
          class="choice-card"
          class:is-selected={$displayPreferences.iconStyle === "coop"}
          aria-pressed={$displayPreferences.iconStyle === "coop"}
          onclick={() => setIconStyle("coop")}
        >
          <div
            class="char-preview char-preview--portrait"
            style="background-image: url({getCharacterCoop('Wriothesley')});"
          ></div>
          <span>Portrait</span>
        </button>
        <button
          type="button"
          class="choice-card"
          class:is-selected={$displayPreferences.iconStyle === "enka"}
          aria-pressed={$displayPreferences.iconStyle === "enka"}
          onclick={() => setIconStyle("enka")}
        >
          <div
            class="char-preview char-preview--headshot"
            style="background-image: url({getCharacterPortrait(
              'Wriothesley',
            )});"
          ></div>
          <span>Headshot</span>
        </button>
        <button
          type="button"
          class="choice-card"
          class:is-selected={$displayPreferences.iconStyle === "tcg"}
          aria-pressed={$displayPreferences.iconStyle === "tcg"}
          onclick={() => setIconStyle("tcg")}
        >
          <div
            class="char-preview char-preview--tcg"
            style="background-image: url({getCharacterCard('Wriothesley')});"
          ></div>
          <span>TCG Card</span>
        </button>
      </div>
      {#if $displayPreferences.iconStyle === "tcg"}
        <p class="tcg-info">
          <IconInfo size={13} />
          Not all characters have a TCG card yet — in that case, their portrait will
          be shown instead.
        </p>
      {/if}
    </div>

    <div class="preference-row picker-row">
      <div>
        <span class="row-label">Background</span>
        <p class="row-desc">
          Lighthouse image or solid color. The nav mark toggles this too.
        </p>
      </div>
      <div class="picker">
        <button
          type="button"
          class="choice-card"
          class:is-selected={$displayPreferences.backgroundEnabled}
          aria-pressed={$displayPreferences.backgroundEnabled}
          onclick={() => setBackgroundVisible(true, page.url.pathname)}
        >
          <div
            class="bg-preview bg-preview--image"
            style="background-image: url('https://images.lightkeepers.moe/site/lightkeepers_dark.webp');"
          >
            <div class="bg-preview-overlay"></div>
          </div>
          <span>Lighthouse</span>
        </button>
        <button
          type="button"
          class="choice-card"
          class:is-selected={!$displayPreferences.backgroundEnabled}
          aria-pressed={!$displayPreferences.backgroundEnabled}
          onclick={() => setBackgroundVisible(false, page.url.pathname)}
        >
          <div
            class="bg-preview bg-preview--solid"
            style="background: var(--background-color);"
          ></div>
          <span>Solid</span>
        </button>
      </div>
      <div class="bg-home-row">
        <div>
          <span class="row-label">Apply to home page</span>
          <p class="row-desc">When off, home always shows the lighthouse.</p>
        </div>
        <Toggle
          pressed={$displayPreferences.backgroundApplyToHome}
          aria-label="Apply background choice to home page"
          onclick={() =>
            setBackgroundApplyToHome(
              !$displayPreferences.backgroundApplyToHome,
              page.url.pathname,
            )}
        />
      </div>
    </div>

    <div class="preference-row">
      <div>
        <span class="row-label">Animations</span>
        <p class="row-desc">Enable card flip and motion effects.</p>
      </div>
      <Toggle
        pressed={$displayPreferences.animationsEnabled}
        aria-label="Toggle animations"
        onclick={() =>
          setDisplayPreferences({
            animationsEnabled: !$displayPreferences.animationsEnabled,
          })}
      />
    </div>

    <div class="preference-row">
      <div class="row-with-toggle">
        <span class="row-label">Custom Colors</span>
        <Toggle
          bind:pressed={colorPickerOpen}
          aria-label="Toggle color picker"
        />
      </div>
    </div>

    {#if colorPickerOpen}
      <div class="color-panel" transition:slide={{ duration: 200 }}>
        <div class="theme-templates">
          <span class="theme-templates-label">Theme templates</span>
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
            $displayPreferences.themeColors?.[key] ?? DEFAULT_DARK_COLORS[key]}
          <div class="color-row">
            <button
              type="button"
              class="color-swatch"
              style="background: {currentColor};"
              aria-label="Pick color for {COLOR_LABELS[key]}"
              onclick={() => document.getElementById(`color-${key}`)?.click()}
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
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        {/each}
        <div class="color-actions">
          <Button
            variant="secondary"
            onclick={() => setDisplayPreferences({ themeColors: null })}
          >
            Reset to defaults
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .display-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-4);
  }

  .panel-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 42rem;
  }

  .lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-mid);
  }

  .preference-list {
    display: flex;
    flex-direction: column;
  }

  .preference-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .picker-row {
    flex-direction: column;
    align-items: stretch;
  }

  .row-label {
    color: var(--foreground-color);
    font-size: var(--text-sm);
  }

  .row-desc {
    margin: 0.25rem 0 0;
    max-width: 42rem;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .row-with-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .picker {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.65rem;
  }

  .bg-home-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.08);
  }

  .portrait-picker {
    max-width: 34rem;
  }

  .choice-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    cursor: pointer;
    font: inherit;
    transition:
      border-color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease),
      box-shadow var(--control-duration) var(--control-ease);
  }

  .choice-card:hover {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.04);
  }

  .choice-card.is-selected {
    border-color: rgba(255, 255, 255, 0.45);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    background: var(--surface-selected);
  }

  .choice-card span {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .choice-card.is-selected span {
    color: var(--foreground-color);
  }

  .bg-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .bg-preview--image {
    background-size: cover;
    background-position: center;
    position: relative;
  }

  .bg-preview--solid {
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .bg-preview-overlay {
    position: absolute;
    inset: 0;
    background-color: color-mix(in oklab, black 80%, transparent);
  }

  .char-preview {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-sm);
    overflow: hidden;
    position: relative;
  }

  .char-preview--portrait {
    background-size: 220%;
    background-position: center 22%;
  }

  .char-preview--tcg {
    background-size: cover;
    background-position: top center;
  }

  .char-preview--headshot {
    background-size: cover;
    background-position: center;
  }

  .tcg-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0.5rem 0 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .color-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.25rem 0 0.5rem;
  }

  .theme-templates {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 0;
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
    margin-bottom: 0.5rem;
  }

  .theme-templates-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--foreground-mid);
  }

  .theme-templates-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .theme-template {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    cursor: pointer;
    font: inherit;
    transition:
      border-color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
  }

  .theme-template:hover {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.04);
  }

  .theme-template span {
    font-size: var(--text-xs);
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
    border: var(--border-width) solid rgba(255, 255, 255, 0.2);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .color-swatch {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: transform var(--control-duration) var(--control-ease);
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .color-label {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    width: 7rem;
    flex-shrink: 0;
  }

  .color-hex-input {
    width: 7.5rem;
    padding: 0.3rem 0.5rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    color: var(--foreground-color);
    font-size: var(--text-xs);
    font-family: ui-monospace, monospace;
    outline: none;
  }

  .color-hex-input:focus {
    border-color: rgba(255, 255, 255, 0.45);
  }

  .color-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.35rem;
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
</style>
