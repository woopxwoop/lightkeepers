<script lang="ts">
  import {
    dpsDisplayName,
    type DisplayGroup,
  } from "#lib/boards/summary-columns.js";
  import type { Tables } from "#lib/types/database.types.js";
  import { handleKeyboardClick, handlePointerAction } from "#lib/ui/pointer.js";
  import FeaturedTeam from "#lib/ui/components/summary-tool/FeaturedTeam.svelte";

  let {
    group,
    mapping,
    onopenalts,
  }: {
    group: DisplayGroup;
    mapping: Map<string, Tables<"characters">>;
    onopenalts: (group: DisplayGroup) => void;
  } = $props();
</script>

<li class="dps-group">
  <div class="team-body">
    {#if group.alternates.length > 0}
      <div class="dps-tools">
        <button
          type="button"
          class="expand-btn"
          aria-haspopup="dialog"
          aria-label={`Show ${group.alternates.length} alternate ${dpsDisplayName(mapping, group.mainDps)} teams`}
          onpointerdown={(e) => handlePointerAction(e, () => onopenalts(group))}
          onclick={(e) => handleKeyboardClick(e, () => onopenalts(group))}
        >
          <span
            >{group.alternates.length} alt{group.alternates.length === 1
              ? ""
              : "s"}</span
          >
        </button>
      </div>
    {/if}
    <FeaturedTeam team={group.primary} {mapping} />
  </div>
</li>

<style>
  .dps-group {
    min-width: 0;
  }

  .team-body {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  .dps-tools {
    position: absolute;
    top: 0.15rem;
    right: 0.15rem;
    z-index: 2;
  }

  .expand-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    flex-shrink: 0;
    padding: 0.08rem 0.25rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    background: color-mix(in srgb, var(--background-color) 82%, transparent);
    color: var(--foreground-mid);
    font: inherit;
    font-size: 0.6rem;
    cursor: pointer;
  }
</style>
