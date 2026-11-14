<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import Toggle from "#lib/ui/components/Toggle.svelte";
  import Chip from "#lib/ui/components/Chip.svelte";
  import RosterBuildCard from "#lib/ui/components/RosterBuildCard.svelte";
  import type {
    CharacterOwned,
    InventoryArtifact,
    InventoryWeapon,
  } from "#lib/definitions.js";
  import { toGoodKey } from "#lib/utils.js";
  import {
    getRosterArtifactsCached,
    getRosterWeaponsCached,
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "#lib/app/roster-inventory.js";
  import {
    rosterBuildViewFromOwned,
    type RosterBuildView,
  } from "#lib/roster/roster-build-card.js";

  let rbcShowConstellations = $state(true);
  let rbcShowTalents = $state(true);
  let rbcShowWeapon = $state(true);
  let rbcShowSets = $state(true);
  let rbcShowArtifacts = $state(true);
  let rbcShowSubstats = $state(true);
  let rbcUseLive = $state(false);
  let rbcWeapons = $state<InventoryWeapon[]>([]);
  let rbcArtifacts = $state<InventoryArtifact[]>([]);
  let rbcInvLoading = $state(false);

  const RBC_FIXTURE_CHAR = {
    name_id: "Hutao",
    name: "Hu Tao",
    element: "Pyro",
    rarity: 5,
    weapon_type: "WEAPON_POLE",
    game_id: 10000046,
    released_at: "2021-03-02T00:00:00Z",
    created_at: "",
    isOwned: true,
    progress: {
      level: 90,
      ascension: 6,
      constellation: 1,
      talents: { normal: 6, skill: 9, burst: 8 },
      weapon: {
        key: "StaffOfHoma",
        level: 90,
        ascension: 6,
        refinement: 1,
      },
    },
  } as CharacterOwned;

  const RBC_FIXTURE_WEAPONS: InventoryWeapon[] = [
    {
      key: "StaffOfHoma",
      level: 90,
      ascension: 6,
      refinement: 1,
      location: "HuTao",
      lock: false,
    },
  ];

  const RBC_FIXTURE_ARTIFACTS: InventoryArtifact[] = [
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      location: "HuTao",
      lock: false,
      substats: [
        { key: "critRate_", value: 10.5 },
        { key: "critDMG_", value: 14.0 },
        { key: "atk_", value: 4.7 },
        { key: "eleMas", value: 23 },
      ],
    },
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "plume",
      level: 20,
      rarity: 5,
      mainStatKey: "atk",
      location: "HuTao",
      lock: false,
      substats: [
        { key: "critDMG_", value: 21.0 },
        { key: "hp_", value: 5.8 },
        { key: "enerRech_", value: 5.2 },
        { key: "def", value: 19 },
      ],
    },
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "sands",
      level: 20,
      rarity: 5,
      mainStatKey: "hp_",
      location: "HuTao",
      lock: false,
      substats: [
        { key: "critRate_", value: 7.8 },
        { key: "critDMG_", value: 14.8 },
        { key: "eleMas", value: 40 },
        { key: "atk", value: 18 },
      ],
    },
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "goblet",
      level: 20,
      rarity: 5,
      mainStatKey: "pyro_dmg_",
      location: "HuTao",
      lock: false,
      substats: [
        { key: "hp_", value: 9.3 },
        { key: "critRate_", value: 6.2 },
        { key: "critDMG_", value: 13.2 },
        { key: "eleMas", value: 16 },
      ],
    },
    {
      setKey: "ShimenawasReminiscence",
      slotKey: "circlet",
      level: 20,
      rarity: 5,
      mainStatKey: "critDMG_",
      location: "HuTao",
      lock: false,
      substats: [
        { key: "hp_", value: 14.0 },
        { key: "critRate_", value: 3.5 },
        { key: "eleMas", value: 37 },
        { key: "def_", value: 5.8 },
      ],
    },
  ];

  let rbcFixtureView = $derived(
    rosterBuildViewFromOwned(
      $charactersOwned.find((c) => c.name_id === "Hutao") ?? RBC_FIXTURE_CHAR,
      RBC_FIXTURE_WEAPONS,
      RBC_FIXTURE_ARTIFACTS,
    ),
  );

  let rbcLiveView = $derived.by((): RosterBuildView | null => {
    if (!rbcUseLive) return null;
    const withGear = $charactersOwned.find((c) => {
      if (!c.isOwned) return false;
      const key = toGoodKey(c.name);
      if (!key) return false;
      return (
        rbcWeapons.some((w) => w.location === key) ||
        rbcArtifacts.some((a) => a.location === key) ||
        Boolean(c.progress?.weapon)
      );
    });
    if (!withGear) return null;
    return rosterBuildViewFromOwned(withGear, rbcWeapons, rbcArtifacts);
  });

  let rbcView = $derived(rbcLiveView ?? rbcFixtureView);

  async function rbcLoadInventory() {
    rbcInvLoading = true;
    try {
      const [weapons, artifacts] = await Promise.all([
        loadRosterWeapons().catch(() => getRosterWeaponsCached() ?? []),
        loadRosterArtifacts().catch(() => getRosterArtifactsCached() ?? []),
      ]);
      rbcWeapons = weapons;
      rbcArtifacts = artifacts;
    } finally {
      rbcInvLoading = false;
    }
  }

  $effect(() => {
    if (!rbcUseLive) return;
    void rbcLoadInventory();
  });
</script>

<section class="gallery-section" id="roster-build-card">
  <div class="section-head detail-concept-head">
    <div>
      <p class="concept-kicker">Prototype · build showcase</p>
      <h2>Roster build card</h2>
      <p>
        Near-1:1 Enka card host. Settings will pass
        <code>editing=&quot;always&quot;</code> (one-tap cons, level / ascension,
        talent steppers; hover preview on desktop). Layout stays scrollable on narrow
        viewports.
      </p>
    </div>
    <div class="concept-picker" role="group" aria-label="Build card sections">
      <Chip
        active={rbcShowConstellations}
        onclick={() => (rbcShowConstellations = !rbcShowConstellations)}
        >Cons</Chip
      >
      <Chip
        active={rbcShowTalents}
        onclick={() => (rbcShowTalents = !rbcShowTalents)}>Talents</Chip
      >
      <Chip
        active={rbcShowWeapon}
        onclick={() => (rbcShowWeapon = !rbcShowWeapon)}>Weapon</Chip
      >
      <Chip active={rbcShowSets} onclick={() => (rbcShowSets = !rbcShowSets)}
        >Sets</Chip
      >
      <Chip
        active={rbcShowArtifacts}
        onclick={() => (rbcShowArtifacts = !rbcShowArtifacts)}>Artifacts</Chip
      >
      <Chip
        active={rbcShowSubstats}
        onclick={() => (rbcShowSubstats = !rbcShowSubstats)}>Substats</Chip
      >
    </div>
  </div>

  <p class="concept-note">
    Fixture uses Hu Tao + Crimson Witch / Shim 4+1. Toggle “Live inventory” to
    bind the first owned character that has gear in the GOOD bag (after import).
    Narrow viewports keep Enka column math via horizontal scroll.
  </p>

  <div class="rbc-toolbar">
    <label class="rbc-live">
      <Toggle bind:pressed={rbcUseLive} aria-label="Use live inventory" />
      <span
        >Live inventory{#if rbcInvLoading}…{/if}</span
      >
    </label>
    {#if rbcUseLive && !rbcLiveView}
      <span class="token-meta"
        >No owned character with equipped gear in cache — showing fixture.</span
      >
    {/if}
  </div>

  <div class="rbc-stage">
    <RosterBuildCard
      view={rbcView}
      editing="always"
      showConstellations={rbcShowConstellations}
      showTalents={rbcShowTalents}
      showWeapon={rbcShowWeapon}
      showSets={rbcShowSets}
      showArtifacts={rbcShowArtifacts}
      showSubstats={rbcShowSubstats}
    />
  </div>
</section>

<style>
  .detail-concept-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .concept-kicker {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
  }

  .concept-kicker {
    margin-bottom: 0.25rem;
    color: var(--accent-1) !important;
  }

  .concept-picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .concept-note {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .rbc-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
  }

  .rbc-live {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .rbc-stage {
    max-width: min(100%, 1300px);
  }

  @media (max-width: 640px) {
    .detail-concept-head {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-3);
    }

    .concept-picker {
      justify-content: flex-start;
    }
  }

  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
