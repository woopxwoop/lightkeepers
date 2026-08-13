<script lang="ts">
  import { stygianScheduleBoard } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import StygianSolutionBoard from "$lib/ui/components/StygianSolutionBoard.svelte";
  import IconDatabase from "$lib/ui/icons/IconDatabase.svelte";
  import { resolve } from "$app/paths";

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let schedule = $derived($stygianScheduleBoard);

  let updatedLabel = $derived.by(() => {
    if (!schedule?.openTime) return "";
    return new Date(schedule.openTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  let metaParts = $derived(
    [
      schedule?.challengeName,
      updatedLabel ? `Updated ${updatedLabel}` : "",
    ].filter((part): part is string => Boolean(part)),
  );
</script>

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Stygian Onslaught</h1>
      {#if metaParts.length > 0}
        <p class="page-meta">
          {#each metaParts as part, index (part)}
            {#if index > 0}
              <span class="page-meta-sep" aria-hidden="true">·</span>
            {/if}
            <span>{part}</span>
          {/each}
        </p>
      {/if}
    </div>
    <a class="enemies-index-link" href={resolve("/tools/stygian/enemies")}>
      <IconDatabase size={14} />
      Enemy Database
    </a>
  </header>

  <StygianSolutionBoard {mapping} />
</PageShell>

<style>
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .enemies-index-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    width: fit-content;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent-1);
    text-decoration: none;
  }

  .enemies-index-link:hover {
    text-decoration: underline;
  }
</style>
