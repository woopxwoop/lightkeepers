<script lang="ts">
  import PrioritySection from "#lib/ui/components/character/builds-panel/PrioritySection.svelte";
  import PriorityRow from "#lib/ui/components/character/builds-panel/PriorityRow.svelte";
  import { getUiAssetUrl } from "#lib/utils.js";
  import {
    ascensionPrioritySection,
    constellationPrioritySection,
    levelPrioritySection,
    sigWeaponPrioritySection,
    talentPrioritySection,
  } from "#lib/characters/character-builds.js";
  import {
    kitConstellation,
    kitSkillIcon,
  } from "#lib/characters/character-builds-panel.js";
  import type { CharacterKit } from "#lib/types/character-kit.js";
  import type { CharacterIndex } from "#lib/types/investment.js";

  let {
    kit,
    builds,
    elColor,
  }: {
    kit: CharacterKit;
    builds: CharacterIndex;
    elColor: string;
  } = $props();

  let talentSection = $derived(
    talentPrioritySection(builds, (kitType) => kitSkillIcon(kit, kitType)),
  );
  let levelSection = $derived(levelPrioritySection(builds));
  let ascensionSection = $derived(ascensionPrioritySection(builds));
  let levelIcon = $derived(getUiAssetUrl("UI_ItemIcon_104003"));
  let ascensionIcon = $derived(getUiAssetUrl("UI_ItemIcon_104104"));
  let consSection = $derived(constellationPrioritySection(builds));
  let sigSection = $derived(sigWeaponPrioritySection(builds));
</script>

{#if talentSection || levelSection || consSection || sigSection}
  <div class="invest-grid">
    <div class="invest-col">
      {#if talentSection}
        <PrioritySection
          title="Talent priority"
          simMissing={talentSection.source === "guide" &&
            talentSection.simMissing}
        >
          {#if talentSection.source === "sim"}
            {#each talentSection.rows as row, i}
              <PriorityRow
                name={row.label}
                icon={row.icon}
                rank={i + 1}
                rankColor={elColor}
                priority={row.priority}
                kind="talent"
                priorityLabel={row.priorityLabel}
                mean={row.mean}
                median={row.median}
                min={row.min}
                max={row.max}
                teams={row.teams}
              />
            {/each}
          {:else}
            {#each talentSection.rows as row, i}
              <PriorityRow
                name={row.label}
                icon={row.icon}
                rank={i + 1}
                rankColor={elColor}
              />
            {/each}
          {/if}
        </PrioritySection>
      {/if}

      {#if levelSection || ascensionSection}
        <PrioritySection
          title="Character level"
          simMissing={levelSection?.source === "guide" &&
            levelSection.simMissing &&
            !ascensionSection}
        >
          {#if levelSection}
            {#if levelSection.source === "sim"}
              <PriorityRow
                name="Level 90"
                icon={levelIcon}
                rankColor={elColor}
                priority={levelSection.row.priority}
                kind="level"
                priorityLabel={levelSection.row.priorityLabel}
                mean={levelSection.row.mean}
                median={levelSection.row.median}
                min={levelSection.row.min}
                max={levelSection.row.max}
                teams={levelSection.row.teams}
              />
            {:else}
              <PriorityRow
                name="Level 90"
                icon={levelIcon}
                rankColor={elColor}
                priority={levelSection.priority}
                kind="level"
                priorityLabel={levelSection.priorityLabel}
              />
            {/if}
          {/if}
          {#if ascensionSection?.source === "sim"}
            <PriorityRow
              name="Ascension 6"
              icon={ascensionIcon}
              rankColor={elColor}
              priority={ascensionSection.row.priority}
              kind="level"
              priorityLabel={ascensionSection.row.priorityLabel}
              mean={ascensionSection.row.mean}
              median={ascensionSection.row.median}
              min={ascensionSection.row.min}
              max={ascensionSection.row.max}
              teams={ascensionSection.row.teams}
            />
          {/if}
        </PrioritySection>
      {/if}
    </div>

    <div class="invest-col">
      {#if consSection}
        <PrioritySection
          title="Constellation Impact"
          simMissing={consSection.source === "guide" && consSection.simMissing}
        >
          {#if consSection.source === "sim"}
            {#each consSection.rows as row}
              {@const constellation = kitConstellation(kit, row.cons)}
              <PriorityRow
                name={constellation.name}
                icon={constellation.icon}
                rank="C{row.cons}"
                rankColor={elColor}
                priority={row.priority}
                kind="constellation"
                priorityLabel={row.priorityLabel}
                mean={row.mean_pct_gain}
                median={row.median_pct_gain}
                min={row.min_pct_gain}
                max={row.max_pct_gain}
                teams={row.teams}
              />
            {/each}
          {:else}
            {#each consSection.rows as row}
              {@const constellation = kitConstellation(kit, row.cons)}
              <PriorityRow
                name={constellation.name}
                icon={constellation.icon}
                rank="C{row.cons}"
                rankColor={elColor}
                priority={row.priority}
                kind="constellation"
                priorityLabel={row.priorityLabel}
              />
            {/each}
          {/if}
        </PrioritySection>
      {/if}

      {#if sigSection}
        <PrioritySection
          title="Signature weapon impact"
          simMissing={sigSection.source === "guide" && sigSection.simMissing}
        >
          {#if sigSection.source === "sim"}
            {#each sigSection.rows as row}
              <PriorityRow
                weaponKey={row.key}
                rankColor={elColor}
                priority={row.priority}
                kind="signature"
                priorityLabel={row.priorityLabel}
                mean={row.mean_pct_gain}
                median={row.median_pct_gain}
                min={row.min_pct_gain}
                max={row.max_pct_gain}
                teams={row.teams}
              />
            {/each}
          {:else}
            {#each sigSection.rows as row}
              <PriorityRow
                weaponKey={row.key}
                rankColor={elColor}
                priority={row.priority}
                kind="signature"
                priorityLabel={row.priorityLabel}
              />
            {/each}
          {/if}
        </PrioritySection>
      {/if}
    </div>
  </div>
{/if}

<style>
  .invest-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .invest-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .invest-grid {
      grid-template-columns: 1fr 1fr;
    }

    .invest-col + .invest-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.1);
    }
  }
</style>
