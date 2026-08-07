<script lang="ts">
  import { resolve } from "$app/paths";
  import { animationsEnabled } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import BackLink from "$lib/ui/components/BackLink.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import { getEnemyAsset } from "$lib/utils";

  let { data } = $props();
  let enemies = $derived(data.enemies);
</script>

<PageShell class="enemies-index gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <BackLink href={resolve("/stygian")}>Stygian</BackLink>
    <h1 class="page-title">Stygian enemies</h1>
    <p class="page-lede">
      Bosses that have appeared in Stygian Onslaught. Open one for top teams by
      cycle.
    </p>
  </header>

  {#if enemies.length === 0}
    <EmptyState message="No Stygian boss history yet." />
  {:else}
    <ul class="enemy-grid">
      {#each enemies as enemy (enemy.id)}
        <li>
          <a class="enemy-card" href={resolve(`/enemies/${enemy.id}`)}>
            <span class="enemy-art" aria-hidden="true">
              {#if enemy.asset}
                <img src={getEnemyAsset(enemy.asset)} alt="" />
              {/if}
            </span>
            <span class="enemy-copy">
              <span class="enemy-name"
                >{enemy.enemy_name ?? `Enemy ${enemy.id}`}</span
              >
              <span class="enemy-meta">
                {enemy.latest_version_name ??
                  `v${enemy.latest_version_number}`}
                · {enemy.appearance_count}
                {enemy.appearance_count === 1 ? "cycle" : "cycles"}
              </span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 3vw, 2rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--foreground-color);
  }

  .page-lede {
    margin: 0;
    max-width: 36rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .enemy-grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-3);
  }

  .enemy-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 4.5rem;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 18%, transparent);
    color: inherit;
    text-decoration: none;
    transition: var(--control-transition);
  }

  .enemy-card:hover {
    border-color: color-mix(in srgb, var(--accent-3) 32%, transparent);
    background: var(--surface-quiet);
  }

  .enemy-art {
    flex-shrink: 0;
    width: 3rem;
    height: 3rem;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
  }

  .enemy-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .enemy-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .enemy-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .enemy-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }
</style>
