<script lang="ts">
  import type { Character } from "#lib/definitions.js";
  import type { LineupCardView } from "#lib/research/research-answer-panels.js";
  import ResearchEntityMention from "#lib/ui/components/ResearchEntityMention.svelte";
  import TeamCardHand from "#lib/ui/components/TeamCardHand.svelte";

  let { cards }: { cards: LineupCardView<Character>[] } = $props();
</script>

<section class="research-teams" aria-label="Recommended teams">
  {#each cards as team (team.key)}
    <article class="research-team-card">
      <header class="research-team-header">
        <h3 class="research-team-label">{team.label}</h3>
        {#if team.citeHtml}
          <span class="research-team-cites">{@html team.citeHtml}</span>
        {/if}
      </header>
      {#if team.hasPortraits}
        <div class="research-team-hand">
          <TeamCardHand characters={team.hand} spread="flat" />
        </div>
      {:else}
        <div class="research-team-members">
          {#each team.members as m (m.id)}
            {#if m.entity}
              <ResearchEntityMention entity={m.entity} />
            {:else}
              <span class="research-team-member-plain">{m.label}</span>
            {/if}
          {/each}
        </div>
      {/if}
      {#if team.weaponEntity || team.weaponLabel || team.setEntity || team.setLabel}
        <div class="research-team-gear">
          {#if team.weaponEntity}
            <ResearchEntityMention entity={team.weaponEntity} />
          {:else if team.weaponLabel}
            <span class="research-team-gear-plain">{team.weaponLabel}</span>
          {/if}
          {#if team.setEntity}
            <ResearchEntityMention entity={team.setEntity} />
          {:else if team.setLabel}
            <span class="research-team-gear-plain">{team.setLabel}</span>
          {/if}
        </div>
      {/if}
      {#if team.notesHtml}
        <p class="research-team-notes">{@html team.notesHtml}</p>
      {/if}
    </article>
  {/each}
</section>

<style>
  .research-teams {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .research-team-card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-team-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .research-team-label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .research-team-hand {
    width: 100%;
    overflow: hidden;
  }

  .research-team-hand :global(.hand) {
    --card-width: clamp(4.2rem, 16vw, 6.5rem);
  }

  .research-team-hand :global(.hand-flat) {
    min-height: calc(var(--card-width) * 4 / 3 + 0.5rem);
  }

  .research-team-members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .research-team-member-plain,
  .research-team-gear-plain {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .research-team-gear {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  .research-team-notes {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-teams :global(.research-entity-slot) {
    display: contents;
  }

  .research-teams :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .research-teams :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .research-teams :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }
</style>
