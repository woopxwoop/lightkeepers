<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { teamsOwned, teamsOwnedStygian, charactersOwned } from "$lib/stores";
  import {
    solveAbyssWithFallback,
    solveStygianWithFallback,
    slotAffinityRate,
  } from "$lib/solver";
  import { allTeamsAbyss, allTeamsStygian } from "$lib/stores";
  import { abyssSlotLabel, stygianSlotLabel } from "$lib/slotLabels";
  import Team from "$lib/components/Team.svelte";
  import favicon from "$lib/assets/favicon.svg";

  let { data } = $props();
  let mapping = $derived(data.mapping);

  // null = still reading localStorage (prevents onboarding flash)
  let hasRoster = $state<boolean | null>(null);
  let loadingTimedOut = $state(false);

  onMount(() => {
    const cached = localStorage.getItem("charactersOwned");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        hasRoster =
          Array.isArray(parsed) &&
          parsed.some((c: { isOwned: boolean }) => c.isOwned);
      } catch {
        hasRoster = false;
      }
    } else {
      hasRoster = false;
    }

    // If teams haven't loaded after 8 seconds, stop showing the spinner
    // so the user can at least see the onboarding prompt or an empty state
    setTimeout(() => {
      loadingTimedOut = true;
    }, 8000);
  });

  // replace the two $derived solver calls with:
  let ownedNames = $derived(
    new Set($charactersOwned.filter((c) => c.isOwned).map((c) => c.name)),
  );

  let abyssSolution = $derived(
    solveAbyssWithFallback($teamsOwned, $allTeamsAbyss, ownedNames, 1)[0] ??
      null,
  );
  let stygianSolution = $derived(
    solveStygianWithFallback(
      $teamsOwnedStygian,
      $allTeamsStygian,
      ownedNames,
      1,
    )[0] ?? null,
  );

  let ownedCount = $derived($charactersOwned.filter((c) => c.isOwned).length);
  let loading = $derived(
    !loadingTimedOut &&
      hasRoster &&
      ($teamsOwned.length === 0 || $teamsOwnedStygian.length === 0) &&
      ($allTeamsAbyss.length === 0 || $allTeamsStygian.length === 0),
  );

  const settingsPath = resolve("/settings");
  const recommendationsPath = "/recommendations";

  // Maps internal slot keys to badge CSS classes defined in app.css
  const abyssSlotClass: Record<string, string> = {
    top: "slot-badge-1",
    bottom: "slot-badge-3",
  };
  const stygianSlotClass: Record<string, string> = {
    top: "slot-badge-1",
    middle: "slot-badge-2",
    bottom: "slot-badge-3",
  };
</script>

<main class="w-[92%] md:w-[80%] pb-20">
  {#if hasRoster === null}
    <!-- Intentionally empty — waiting for localStorage read to avoid flash -->
  {:else if !hasRoster}
    <!-- ── Onboarding ──────────────────────────────────────────────────── -->
    <div
      class="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center"
    >
      <img src={favicon} alt="Lightkeepers" class="w-14 h-14" />

      <div class="flex flex-col gap-2">
        <h1>Welcome to Lightkeepers</h1>
        <p class="text-(--intermediate-color) max-w-sm leading-relaxed mx-auto">
          Pick which characters you own and we'll find the best non-overlapping
          teams for Spiral Abyss and Stygian Onslaught.
        </p>
      </div>

      <a
        href={settingsPath}
        class="mt-2 px-6 py-2.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
        style="background: color-mix(in srgb, var(--secondary-color) 10%, transparent);
               border: 0.5px solid color-mix(in srgb, var(--secondary-color) 35%, transparent);
               color: var(--secondary-color);"
      >
        Set up your roster →
      </a>

      <p class="text-(--faint-color)">Saved locally · no account needed</p>
    </div>
  {:else if loading}
    <div class="flex items-center justify-center min-h-[60vh]">
      <p class="text-(--intermediate-color)">Loading teams…</p>
    </div>
  {:else}
    <!-- ── Dashboard ──────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-8">
      <p class="text-xs tracking-widest uppercase text-(--intermediate-color)">
        Best teams for your
        <span class="text-(--foreground-color)">{ownedCount} characters</span>
      </p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Abyss -->
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <h2 class="tracking-widest uppercase text-(--intermediate-color)">
              Spiral Abyss
            </h2>
          </div>

          {#if !abyssSolution}
            <p class="text-(--intermediate-color)">
              No valid teams found for your roster.
            </p>
          {:else}
            {#if abyssSolution.isFallback}
              {@const needed = abyssSolution.neededCharacters}
              <p class="text-xs text-(--intermediate-color) mb-1">
                Needs {needed.length > 0 ? needed.join(", ") : "characters"} to fill
                all slots.
              </p>
            {/if}
            <div
              class="rounded-2xl p-4 flex flex-col gap-4"
              style="border: 0.5px solid var(--surface-border); background: var(--surface-color);"
            >
              {#each abyssSolution.assignments as { team, slot, missingCharacters }}
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <span class="slot-badge {abyssSlotClass[slot]}"
                      >{abyssSlotLabel[slot]}</span
                    >
                    <span class="text-xs text-(--faint-color)"
                      >{(
                        (team.usage_total ?? 0) * slotAffinityRate(team, slot)
                      ).toFixed(2)}% usage</span
                    >
                  </div>
                  <Team {team} {mapping} {missingCharacters} />
                </div>
              {/each}

              {#if abyssSolution.unfilled.length > 0}
                <p class="text-xs text-red-400">
                  ⚠ Couldn't fill: {abyssSolution.unfilled
                    .map((s) => abyssSlotLabel[s])
                    .join(", ")}
                </p>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Stygian -->
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <h2 class="tracking-widest uppercase text-(--intermediate-color)">
              Stygian Onslaught
            </h2>
          </div>

          {#if !stygianSolution}
            <p class="text-(--intermediate-color)">
              No valid teams found for your roster.
            </p>
          {:else}
            {#if stygianSolution.isFallback}
              {@const needed = stygianSolution.neededCharacters}
              <p class="text-xs text-(--intermediate-color) mb-1">
                Needs {needed.length > 0 ? needed.join(", ") : "characters"} to fill
                all slots.
              </p>
            {/if}
            <div
              class="rounded-2xl p-4 flex flex-col gap-4"
              style="border: 0.5px solid var(--surface-border); background: var(--surface-color);"
            >
              {#each stygianSolution.assignments as { team, slot, missingCharacters }}
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <span class="slot-badge {stygianSlotClass[slot]}"
                      >{stygianSlotLabel[slot]}</span
                    >
                    <span class="text-xs text-(--faint-color)"
                      >{(
                        (team.usage_total ?? 0) * slotAffinityRate(team, slot)
                      ).toFixed(2)}% usage</span
                    >
                  </div>
                  <Team {team} {mapping} {missingCharacters} />
                </div>
              {/each}

              {#if stygianSolution.unfilled.length > 0}
                <p class="text-xs text-red-400">
                  ⚠ Couldn't fill: {stygianSolution.unfilled
                    .map((s) => stygianSlotLabel[s])
                    .join(", ")}
                </p>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <p class="text-xs text-(--faint-color) text-center">
        adjust your roster in
        <a
          href={settingsPath}
          class="text-(--intermediate-color) hover:text-(--secondary-color) transition-colors"
        >
          settings
        </a>
      </p>
    </div>
  {/if}
</main>
