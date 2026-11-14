<script lang="ts">
  import { resolve } from "$app/paths";
  import CharacterIcon from "#lib/ui/components/CharacterIcon.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import IconFileSearch from "#lib/ui/icons/IconFileSearch.svelte";
  import {
    exampleFeaturedAndMates,
    exampleTeamKeys,
  } from "#lib/characters/character-builds.js";
  import type { CharacterBuildExample } from "#lib/types/investment.js";
  import type { CharacterOwned } from "#lib/definitions.js";

  let {
    active,
    alts,
    goodKey,
    goodKeyMap,
    onselect,
  }: {
    active: CharacterBuildExample;
    alts: CharacterBuildExample[];
    goodKey: string;
    goodKeyMap: Map<string, CharacterOwned>;
    onselect: (stateKey: string) => void;
  } = $props();

  let menuOpen = $state(false);
  let activeSplit = $derived(
    exampleFeaturedAndMates(exampleTeamKeys(active), goodKey),
  );
</script>

<div class="example-build-context">
  <div class="example-picker-primary">
    <div class="example-picker-main">
      <div
        class="example-picker-grid example-picker-grid--selected"
        role="group"
        aria-label="Selected team"
      >
        <div class="example-picker-slot example-picker-slot--featured">
          {#if activeSplit.featured}
            {@const featured = goodKeyMap.get(activeSplit.featured)}
            {#if featured}
              <CharacterIcon
                character={featured}
                iconStyle="tcg"
                loading="lazy"
              />
            {/if}
          {/if}
        </div>
        {#each activeSplit.mates as mateKey, i (mateKey ?? `active-empty-${i}`)}
          <div class="example-picker-slot">
            {#if mateKey}
              {@const mate = goodKeyMap.get(mateKey)}
              {#if mate}
                <CharacterIcon
                  character={mate}
                  iconStyle="tcg"
                  loading="lazy"
                />
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      {#if alts.length > 0}
        <div
          class="example-picker-alts-shell"
          class:open={menuOpen}
          id="example-picker-alts"
          style="--alt-count: {alts.length}"
          aria-hidden={!menuOpen}
        >
          <div class="example-picker-alts-clip">
            <ol class="example-picker-alts">
              {#each alts as example, ti (example.state_key)}
                {@const split = exampleFeaturedAndMates(
                  exampleTeamKeys(example),
                  goodKey,
                )}
                <li class="example-picker-alt-wrap" style="--i: {ti}">
                  <button
                    type="button"
                    class="example-picker-alt"
                    aria-label={`Select ${example.team_name}`}
                    tabindex={menuOpen ? 0 : -1}
                    onclick={() => {
                      onselect(example.state_key);
                      menuOpen = false;
                    }}
                  >
                    <div class="example-picker-grid">
                      <div
                        class="example-picker-slot example-picker-slot--spacer"
                        aria-hidden="true"
                      ></div>
                      <div class="example-picker-mate-row">
                        {#each split.mates as mateKey, i (mateKey ?? `alt-${example.state_key}-${i}`)}
                          <div class="example-picker-slot">
                            {#if mateKey}
                              {@const mate = goodKeyMap.get(mateKey)}
                              {#if mate}
                                <CharacterIcon
                                  character={mate}
                                  iconStyle="tcg"
                                  loading="lazy"
                                />
                              {/if}
                            {/if}
                          </div>
                        {/each}
                      </div>
                    </div>
                  </button>
                </li>
              {/each}
            </ol>
          </div>
        </div>
      {/if}
    </div>
    <div class="example-picker-actions">
      <a
        class="example-picker-action"
        href={resolve(`teams/${active.team_key}`)}
        aria-label="View team details"
        title="View team details"
      >
        <IconFileSearch size={18} />
      </a>
      {#if alts.length > 0}
        <button
          type="button"
          class="example-picker-action"
          class:open={menuOpen}
          aria-expanded={menuOpen}
          aria-controls="example-picker-alts"
          aria-label={menuOpen
            ? "Hide other example teams"
            : "Show other example teams"}
          onclick={() => (menuOpen = !menuOpen)}><IconCog size={18} /></button
        >
      {/if}
    </div>
  </div>
</div>

<style>
  .example-build-context {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .example-picker-primary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 0.5rem;
    align-items: start;
  }

  .example-picker-main {
    display: contents;
  }

  .example-picker-grid--selected {
    grid-column: 1;
    grid-row: 1;
  }

  .example-picker-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.3rem;
    width: 100%;
  }

  .example-picker-slot {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: var(--background-mid);
  }

  .example-picker-slot--featured {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 55%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .example-picker-slot--spacer {
    visibility: hidden;
    border: none;
    background: transparent;
  }

  .example-picker-actions {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .example-picker-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    text-decoration: none;
    transition:
      color 280ms ease,
      border-color 280ms ease;
  }

  .example-picker-action :global(svg) {
    transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: center;
  }

  .example-picker-action:hover,
  .example-picker-action.open {
    color: var(--accent-1);
    border-color: color-mix(
      in srgb,
      var(--accent-1) 45%,
      rgba(255, 255, 255, 0.14)
    );
  }

  .example-picker-action.open :global(svg) {
    transform: rotate(90deg);
  }

  .example-picker-alts-shell {
    grid-column: 1;
    grid-row: 2;
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .example-picker-alts-shell.open {
    grid-template-rows: 1fr;
  }

  .example-picker-alts-clip {
    overflow: hidden;
    min-height: 0;
  }

  .example-picker-alts {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
    padding: 0.45rem 0 0.15rem;
    list-style: none;
  }

  .example-picker-alt-wrap {
    transform: translateY(-0.65rem);
    opacity: 0.25;
    transition:
      transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 420ms ease;
    transition-delay: calc((var(--alt-count, 1) - 1 - var(--i, 0)) * 45ms);
  }

  .example-picker-alts-shell.open .example-picker-alt-wrap {
    transform: translateY(0);
    opacity: 1;
    transition-delay: calc(var(--i, 0) * 55ms);
  }

  .example-picker-alt {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .example-picker-mate-row {
    grid-column: 2 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
    padding: 0.28rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.16);
    background: color-mix(in srgb, var(--background-mid) 88%, transparent);
  }

  .example-picker-alt:hover .example-picker-mate-row,
  .example-picker-alt:focus-visible .example-picker-mate-row {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      rgba(255, 255, 255, 0.2)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .example-picker-action :global(svg),
    .example-picker-alts-shell,
    .example-picker-alt-wrap {
      transition: none;
    }
  }
</style>
