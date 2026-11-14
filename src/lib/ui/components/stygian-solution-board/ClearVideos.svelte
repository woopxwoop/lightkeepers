<script lang="ts">
  import InfoPopover from "#lib/ui/components/InfoPopover.svelte";
  import IconPlay from "#lib/ui/icons/IconPlay.svelte";
  import { clearVideoLabel } from "#lib/boards/stygian-board.js";
  import {
    youtubeThumbnailFallbackUrl,
    youtubeThumbnailUrl,
  } from "#lib/app/stygian-clear-videos.js";
  import type { StygianClearVideo } from "#lib/definitions.js";

  let {
    clears,
    limit,
    onshowmore,
  }: {
    clears: StygianClearVideo[];
    /** How many clears are listed before "Show more". */
    limit: number;
    onshowmore: () => void;
  } = $props();

  let shown = $derived(Math.min(clears.length, limit));
</script>

<div class="clear-videos">
  <InfoPopover
    label={clears.length === 1 ? "1 video" : `${clears.length} videos`}
    align="start"
    class="clear-videos-trigger"
    panelClass="clear-videos-panel"
    anchorSelector=".field-hero"
  >
    {#snippet icon()}
      <IconPlay size={12} />
    {/snippet}
    <ul class="clear-videos-panel-list">
      {#each clears.slice(0, shown) as clear (clear.clear_key)}
        {@const thumb = youtubeThumbnailUrl(clear.video_url)}
        <li>
          <a
            class="clear-video-link"
            href={clear.video_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {#if thumb}
              <img
                class="clear-video-thumb"
                src={thumb}
                alt=""
                width="320"
                height="180"
                loading="lazy"
                decoding="async"
                onerror={(event) => {
                  const img = event.currentTarget as HTMLImageElement;
                  if (img.dataset.ytFallback === "1") return;
                  const fallback = youtubeThumbnailFallbackUrl(clear.video_url);
                  if (!fallback) return;
                  img.dataset.ytFallback = "1";
                  img.src = fallback;
                }}
              />
            {/if}
            <span class="clear-video-meta">{clearVideoLabel(clear)}</span>
          </a>
        </li>
      {/each}
    </ul>
    {#if shown < clears.length}
      <button type="button" class="clear-videos-more" onclick={onshowmore}>
        Show more · {clears.length - shown} left
      </button>
    {/if}
  </InfoPopover>
</div>

<style>
  .clear-videos {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  :global(.clear-videos-trigger) {
    color: var(--foreground-mid);
    font-size: var(--text-xs);
  }

  :global(.info-panel.clear-videos-panel) {
    max-height: min(22rem, calc(100vh - 2rem));
    padding: 0.65rem 0.75rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--background-color) 32%,
        transparent
      )
      transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar) {
    width: 0.55rem;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb) {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--background-color) 32%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  :global(.info-panel.clear-videos-panel::-webkit-scrollbar-thumb:hover) {
    background: color-mix(in srgb, var(--background-color) 48%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .clear-videos-panel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .clear-video-link {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: inherit;
    text-decoration: none;
  }

  .clear-video-thumb {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 3px;
    background: color-mix(in srgb, var(--background-color) 25%, transparent);
  }

  .clear-video-meta {
    text-decoration: underline;
    text-underline-offset: 0.12em;
    line-height: 1.35;
  }

  .clear-video-link:hover .clear-video-meta {
    opacity: 0.85;
  }

  .clear-videos-more {
    margin: 0.45rem 0 0;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.12em;
    opacity: 0.75;
  }

  .clear-videos-more:hover {
    opacity: 1;
  }
</style>
