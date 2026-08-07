<script lang="ts">
  import { resolve } from "$app/paths";
  import { animationsEnabled } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import { getEnemyAsset } from "$lib/utils";

  let { data } = $props();
  let enemies = $derived(data.enemies);
  let cycles = $derived(data.cycles);
  let query = $state("");
  let cycleFilter = $state("");

  let cycleOptions = $derived([
    { value: "", label: "All cycles" },
    ...cycles.map((c) => ({
      value: String(c.version_number),
      label: c.version_name ?? `v${c.version_number}`,
    })),
  ]);

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const cycle =
      cycleFilter === "" ? null : Number.parseInt(cycleFilter, 10);
    return enemies.filter((enemy) => {
      if (cycle !== null && !enemy.version_numbers.includes(cycle)) {
        return false;
      }
      if (!q) return true;
      const name = (enemy.enemy_name ?? `Enemy ${enemy.id}`).toLowerCase();
      return name.includes(q);
    });
  });
</script>

<PageShell class="enemies-index gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <PageTrail
      items={[
        { label: "Stygian", href: resolve("/stygian") },
        { label: "Enemies" },
      ]}
    />
    <h1 class="page-title">Stygian enemies</h1>
    <p class="page-lede">
      Bosses that have appeared in Stygian Onslaught. Open one for top teams by
      cycle.
    </p>
  </header>

  {#if enemies.length === 0}
    <EmptyState message="No Stygian boss history yet." />
  {:else}
    <div class="filters">
      <input
        type="search"
        class="search-input"
        placeholder="Search enemies…"
        aria-label="Search enemies"
        bind:value={query}
      />
      <div class="cycle-select">
        <Select
          options={cycleOptions}
          bind:value={cycleFilter}
          aria-label="Filter by cycle"
        />
      </div>
    </div>

    {#if filtered.length === 0}
      <EmptyState message="No enemies match these filters." />
    {:else}
      <ul class="enemy-grid">
        {#each filtered as enemy (enemy.id)}
          {@const name = enemy.enemy_name ?? `Enemy ${enemy.id}`}
          <li>
            <a
              class="enemy-card"
              href={resolve(`/stygian/enemies/${enemy.id}`)}
              aria-label={name}
            >
              <span class="enemy-art" aria-hidden="true">
                {#if enemy.asset}
                  <img src={getEnemyAsset(enemy.asset)} alt="" />
                {/if}
              </span>
              {#if query.trim()}
                <span class="enemy-name">{name}</span>
              {/if}
              <span class="enemy-meta" aria-hidden="true">
                {enemy.latest_version_name ?? `v${enemy.latest_version_number}`}
                · {enemy.appearance_count}
                {enemy.appearance_count === 1 ? "cycle" : "cycles"}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
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

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }

  .search-input {
    flex: 1;
    min-width: 12rem;
    max-width: 20rem;
    padding: 0.45rem 0.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: transparent;
    color: var(--foreground-color);
    font-size: var(--text-xs);
    transition: var(--control-transition);
  }

  .search-input::placeholder {
    color: var(--foreground-mid);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.32);
    background: var(--surface-quiet);
    box-shadow: var(--focus-ring);
  }

  .cycle-select {
    min-width: 9rem;
  }

  .enemy-grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: var(--space-5) var(--space-4);
    justify-items: center;
  }

  .enemy-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    max-width: 10rem;
    color: inherit;
    text-decoration: none;
    transition: opacity var(--control-transition, 0.15s ease);
  }

  .enemy-card:hover {
    opacity: 0.85;
  }

  .enemy-art {
    display: block;
    line-height: 0;
  }

  .enemy-art img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 9rem;
    object-fit: contain;
  }

  .enemy-name {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--foreground-color);
    text-align: center;
    line-height: 1.25;
  }

  .enemy-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    text-align: center;
  }
</style>
