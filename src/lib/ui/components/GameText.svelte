<script lang="ts">
  import { formatGameDescriptionHtml } from "$lib/utils";

  let {
    text,
    class: className = "",
    resolveLink,
  }: {
    text: string;
    class?: string;
    /** Map `{LINK#ref}` → href (e.g. `#kit-S11215`). Unknown refs stay plain text. */
    resolveLink?: (ref: string) => string | null;
  } = $props();

  let html = $derived(formatGameDescriptionHtml(text, { resolveLink }));
</script>

<div class="game-text {className}" style="color: var(--foreground-mid);">
  {@html html}
</div>

<style>
  .game-text {
    line-height: 1.45;
  }

  /* app.css sets a global span font-size clamp — keep kit colors at parent size */
  .game-text :global(span) {
    font-size: inherit;
    line-height: inherit;
  }

  .game-text :global(em) {
    opacity: 0.85;
    font-style: italic;
  }

  .game-text :global(a.game-link),
  .game-text :global(a.game-link:link),
  .game-text :global(a.game-link:visited),
  .game-text :global(a.game-link:hover),
  .game-text :global(a.game-link:active) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
    cursor: pointer;
  }

  .game-text :global(a.game-link:hover) {
    text-decoration-color: currentColor;
  }
</style>
