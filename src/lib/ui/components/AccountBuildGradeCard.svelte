<script lang="ts">
  import {
    ACCOUNT_BUILD_BUCKET_LABEL,
    type AccountBuildGrade,
  } from "$lib/account-build-grade";
  import type { CharacterOwned } from "$lib/definitions";
  import CharacterPortraitCard from "$lib/ui/components/CharacterPortraitCard.svelte";

  let {
    character,
    grade,
    pressed = false,
    standout = false,
    onclick,
  }: {
    character: CharacterOwned;
    grade: AccountBuildGrade;
    pressed?: boolean;
    /** Stygian most-used cream — cream outline to distinguish. */
    standout?: boolean;
    onclick: (e: MouseEvent) => void;
  } = $props();

  let cue = $derived(ACCOUNT_BUILD_BUCKET_LABEL[grade.bucket]);
</script>

<CharacterPortraitCard
  {character}
  {pressed}
  {onclick}
  tintBackground
  title="{character.name} · {cue}"
  class="grade-card{standout ? ' is-standout' : ''}"
>
  {#snippet meta()}
    <div class="grade-card-meta">
      <span class="grade-card-name">{character.name}</span>
      <span class="grade-card-cue">{cue}</span>
    </div>
  {/snippet}
</CharacterPortraitCard>

<style>
  :global(.grade-card.is-standout) {
    outline: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 72%, transparent);
    outline-offset: -1px;
  }

  :global(.grade-card.is-standout.is-pressed),
  :global(.grade-card.is-pressed) {
    outline-color: var(--accent-1);
  }

  .grade-card-meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .grade-card-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grade-card-cue {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 70%, transparent);
    line-height: 1.2;
  }
</style>
