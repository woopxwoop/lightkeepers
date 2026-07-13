<script lang="ts">
  import { onMount } from "svelte";
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import {
    buildGoodKeyMap,
    toGoodKey,
    weaponByKey,
    artifactSetByKey,
    translateStatKey,
  } from "$lib/utils";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import type { InvestmentFile, InvestmentTeam } from "$lib/types/investment";

  let { data: layoutData } = $props();

  const API_URL = "/api/investment";

  let investment: InvestmentFile | null = $state(null);
  let team: InvestmentTeam | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  onMount(() => fetchTeam());

  async function fetchTeam() {
    loading = true;
    error = null;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InvestmentFile = await res.json();
      investment = data;
      team = data.teams.find((t) => t.team_key === layoutData.slug) ?? null;
      if (!team) throw new Error(`Team "${layoutData.slug}" not found`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load team";
    } finally {
      loading = false;
    }
  }

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));

  let ownedKeys = $derived(
    new Set(
      $charactersOwned
        .filter((c) => c.isOwned)
        .map((c) => toGoodKey(c.name)),
    ),
  );

  function isOwned(key: string): boolean {
    return ownedKeys.has(key);
  }
</script>

<main
  class="w-[80%] pb-20 flex flex-col gap-6"
  style={!$animationsEnabled
    ? "--sk-animation: none; --pulse-animation: none"
    : ""}
>
  {#if loading}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">Loading…</p>
    </div>
  {:else if error}
    <div
      class="rounded-2xl p-8 text-center"
      style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
    >
      <p style="color: var(--foreground-mid);">{error}</p>
      <a
        href="/teams"
        class="inline-block mt-4 text-sm font-medium hover:underline"
        style="color: var(--accent-1);"
      >
        ← Back to teams
      </a>
    </div>
  {:else if team}
    <a
      href="/teams"
      class="text-sm hover:underline"
      style="color: var(--accent-1);"
    >
      ← Back to teams
    </a>

    <div class="flex flex-col gap-1">
      <h2
        class="tracking-widest uppercase"
        style="color: var(--foreground-color);"
      >
        {team.team_name}
      </h2>
      <p style="color: var(--foreground-mid);">
        Baseline cost: {team.baseline_cost} limited 5★ copies
      </p>
    </div>

    <!-- Character icons -->
    <div class="flex gap-3 flex-wrap">
      {#each team.characters as goodKey}
        {@const char = goodKeyMap.get(goodKey)}
        {@const owned = isOwned(goodKey)}
        <div class="flex flex-col items-center gap-1">
          <div
            class="w-16 h-16 rounded-xl overflow-hidden relative"
            class:opacity-35={!owned}
            style="background: var(--background-color); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
          >
            {#if char}
              <CharacterIcon character={char} />
            {/if}
          </div>
          <span class="text-xs" style="color: var(--foreground-mid);">
            {char?.name_id ?? goodKey}
          </span>
        </div>
      {/each}
    </div>

    <!-- Investment sims -->
    <div class="flex flex-col gap-3">
      {#each team.results as sim}
        <div
          class="rounded-xl p-4 flex flex-col gap-3"
          style="background: var(--background-mid); border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium" style="color: var(--foreground-color);">
              {sim.label || `Cost ${sim.cost}`}
            </span>
            <span class="text-xs" style="color: var(--foreground-mid);">
              {sim.cost} cost · {sim.dps.toFixed(0)} DPS
            </span>
          </div>

          <div class="flex flex-col gap-2">
            {#each sim.characters as build}
              {@const char = goodKeyMap.get(build.key)}
              {@const weapon = weaponByKey.get(build.weapon.key)}
              {@const set = artifactSetByKey.get(build.set.key)}
              <div
                class="rounded-lg p-2.5 flex flex-col gap-1.5"
                style="background: var(--background-color);"
              >
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium" style="color: var(--foreground-color);">
                    {char?.name_id ?? build.key}
                  </span>
                  <span style="color: var(--foreground-mid);">
                    Lv.{build.level} · C{build.cons}
                  </span>
                </div>

                <!-- Weapon -->
                <div class="flex items-center gap-1.5 text-xs">
                  <span style="color: var(--foreground-mid);">Weapon</span>
                  <span class="flex items-center gap-1" style="color: var(--foreground-color);">
                    {#if weapon}
                      <img
                        src="https://enka.network/ui/{weapon.icon}.png"
                        alt=""
                        class="detail-icon"
                      />
                    {/if}
                    {weapon?.name ?? build.weapon.key}
                  </span>
                  <span style="color: var(--foreground-mid);">
                    Lv.{build.weapon.level}
                    {#if build.weapon.refinement > 1}R{build.weapon.refinement}{/if}
                  </span>
                </div>

                <!-- Artifacts -->
                <div class="flex items-center gap-1.5 text-xs">
                  <span style="color: var(--foreground-mid);">Set</span>
                  <span class="flex items-center gap-1" style="color: var(--foreground-color);">
                    {#if set}
                      <img
                        src="https://enka.network/ui/{set.icon}.png"
                        alt=""
                        class="detail-icon"
                      />
                    {/if}
                    {set?.name ?? build.set.key}
                  </span>
                  <span style="color: var(--foreground-mid);">{build.set.count}pc</span>
                </div>

                <!-- Main stats -->
                <div class="flex gap-3 text-xs">
                  <span style="color: var(--foreground-mid);">
                    Sands: <span style="color: var(--foreground-color);">{translateStatKey(build.main_stats.sands)}</span>
                  </span>
                  <span style="color: var(--foreground-mid);">
                    Goblet: <span style="color: var(--foreground-color);">{translateStatKey(build.main_stats.goblet)}</span>
                  </span>
                  <span style="color: var(--foreground-mid);">
                    Circlet: <span style="color: var(--foreground-color);">{translateStatKey(build.main_stats.circlet)}</span>
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .detail-icon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    object-fit: contain;
    background: var(--background-color);
  }
</style>
