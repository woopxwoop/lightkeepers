<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { adviceStepIconSrc } from "$lib/account-build-grade";
  import {
    getCharacterKitIconsCached,
    loadCharacterKitIcons,
  } from "$lib/app/character-kit-icons";
  import { auditStepLabel, type AuditRow } from "$lib/audit-grades";
  import type { AuditPlannerState } from "$lib/audit-planner-goals";
  import { elementBg } from "$lib/element-colors";
  import { useWeapon } from "$lib/equipment-data.svelte";
  import type { InvestmentBuildKitIcons } from "$lib/investment-build-card";
  import Button from "$lib/ui/components/Button.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import { getUiAssetUrl } from "$lib/utils";

  let {
    row,
    rank,
    href,
    plannerState,
    busy = false,
    onAdd,
  }: {
    row: AuditRow;
    rank: number;
    href: string;
    plannerState: AuditPlannerState;
    busy?: boolean;
    onAdd: () => void;
  } = $props();

  const weapon = useWeapon(() => row.weaponKey ?? "");

  let name = $derived(row.character.name ?? row.nameId);
  let steps = $derived(row.grade.adviceSteps);

  /** Talent icons need the kit — fetch once the row nears the viewport, not per row up front. */
  let wantKit = $state(false);
  const nearViewport: Attachment<HTMLElement> = (node) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        wantKit = true;
        observer.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  let kit = $state<InvestmentBuildKitIcons | null>(null);
  $effect(() => {
    if (!wantKit) return;
    const id = row.nameId;
    const cached = getCharacterKitIconsCached(id);
    kit = cached;
    if (cached) return;
    let cancelled = false;
    void loadCharacterKitIcons(id)
      .then((icons) => {
        if (!cancelled) kit = icons;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  });
</script>

<li class="queue-row" {@attach nearViewport}>
  <span class="queue-rank" aria-hidden="true">{rank}</span>
  <a class="queue-link" {href}>
    <span
      class="queue-portrait"
      style="background: {elementBg(row.character.element)};"
    >
      <CharacterIcon character={row.character} loading="lazy" />
    </span>
    <span class="queue-name">{name}</span>
    <span class="queue-steps">
      {#if steps.length > 0}
        {#each steps as step (`${step.kind}-${step.current}-${step.target}`)}
          {@const icon = adviceStepIconSrc(
            step.kind,
            kit?.talents ?? null,
            getUiAssetUrl,
            weapon.icon,
          )}
          <span class="queue-step">
            {#if icon}
              <img class="step-icon" src={icon} alt="" loading="lazy" />
            {/if}
            {auditStepLabel(step)}
          </span>
        {/each}
      {:else}
        {#each row.grade.advice as line (line)}
          <span class="queue-step">{line}</span>
        {/each}
      {/if}
    </span>
  </a>
  {#if plannerState !== "none"}
    <div class="queue-action">
      {#if plannerState === "add"}
        <Button
          variant="secondary"
          disabled={busy}
          aria-label="Add {name} to Planner"
          onclick={onAdd}>Add to Planner</Button
        >
      {:else if plannerState === "in_planner"}
        <span class="queue-state">In Planner</span>
      {:else}
        <span class="queue-state">Planner full</span>
      {/if}
    </div>
  {/if}
</li>

<style>
  .queue-row {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.5rem 0.35rem 0.25rem;
    border-radius: var(--radius-md);
    transition: var(--control-transition);
  }

  .queue-row:hover {
    background: color-mix(in srgb, var(--foreground-color) 5%, transparent);
  }

  .queue-rank {
    text-align: center;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .queue-link {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    grid-template-areas:
      "portrait title"
      "portrait steps";
    align-items: center;
    gap: 0.35rem 0.75rem;
    min-width: 0;
    padding: 0.2rem 0.35rem;
    border-radius: var(--radius-sm);
    color: inherit;
    text-decoration: none;
  }

  .queue-portrait {
    grid-area: portrait;
    display: block;
    width: 44px;
    height: 44px;
    overflow: hidden;
    border-radius: var(--radius-md);
  }

  .queue-name {
    grid-area: title;
    align-self: end;
    min-width: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .queue-link:hover .queue-name {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .queue-steps {
    grid-area: steps;
    align-self: start;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .queue-step {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 1.4rem;
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 16%, transparent);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .step-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    object-fit: contain;
  }

  .queue-action {
    display: flex;
    justify-content: flex-end;
    min-width: 4.5rem;
  }

  .queue-state {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .queue-row {
      grid-template-columns: 1.1rem minmax(0, 1fr);
      grid-template-areas:
        "rank link"
        ". action";
      gap: 0.2rem;
    }

    .queue-rank {
      grid-area: rank;
    }

    .queue-link {
      grid-area: link;
    }

    .queue-link {
      grid-template-columns: 40px minmax(0, 1fr);
      grid-template-areas:
        "portrait title"
        "steps steps";
      gap: 0.45rem 0.55rem;
    }

    .queue-portrait {
      width: 40px;
      height: 40px;
    }

    .queue-name {
      align-self: center;
    }

    .queue-action {
      grid-area: action;
      justify-content: flex-start;
      min-width: 0;
      padding-left: 0.35rem;
    }
  }
</style>
