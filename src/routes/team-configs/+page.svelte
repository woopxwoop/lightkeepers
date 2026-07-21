<script lang="ts">
  import { charactersOwned } from "$lib/stores";
  import { buildGoodKeyMap } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";

  let { data } = $props();
  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));
</script>

<main class="w-[85%] pb-20 flex flex-col gap-6">
  <header class="flex flex-col gap-1">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h1
        class="text-2xl font-semibold tracking-wide"
        style="color: var(--foreground-color);"
      >
        Team configs
      </h1>
      <a
        href="/teams"
        class="text-xs underline underline-offset-2"
        style="color: var(--accent-1);"
      >
        Investment teams
      </a>
    </div>
    <p class="text-xs" style="color: var(--foreground-mid);">
      Builds with equipment, sheet stats, and gcsim configs (baseline per team).
    </p>
  </header>

  {#if data.error}
    <p class="text-sm" style="color: var(--foreground-mid);">{data.error}</p>
  {:else if data.teams.length === 0}
    <p class="text-sm" style="color: var(--foreground-mid);">No teams yet.</p>
  {:else}
    <div class="flex flex-col gap-2">
      {#each data.teams as team (team.team_key)}
        <a
          href="/team-configs/{encodeURIComponent(team.config_slug!)}"
          class="team-row rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 16%, transparent);"
        >
          <div class="flex -space-x-2 shrink-0">
            {#each team.characters as key}
              {@const character = goodKeyMap.get(key)}
              {#if character}
                <div class="team-portrait">
                  <CharacterIcon {character} zoom={0.72} />
                </div>
              {/if}
            {/each}
          </div>
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-medium truncate"
              style="color: var(--foreground-color);"
            >
              {team.team_name}
            </p>
            <p class="text-[0.65rem]" style="color: var(--foreground-mid);">
              Baseline cost {team.baseline_cost}
            </p>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</main>

<style>
  .team-row {
    transition: border-color 0.15s ease;
  }
  .team-row:hover {
    border-color: color-mix(in srgb, var(--accent-1) 40%, transparent);
  }
  .team-portrait {
    width: 2.4rem;
  }
</style>
