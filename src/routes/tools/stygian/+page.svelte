<script lang="ts">
  import { stygianScheduleBoard } from "$lib/stores";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import StygianSolutionBoard from "$lib/ui/components/StygianSolutionBoard.svelte";
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
      <p class="page-meta">
        {#each metaParts as part, index (part)}
          {#if index > 0}
            <span class="page-meta-sep" aria-hidden="true">·</span>
          {/if}
          <span>{part}</span>
        {/each}
        {#if metaParts.length > 0}
          <span class="page-meta-sep" aria-hidden="true">·</span>
        {/if}
        <a class="back-link" href={resolve("/tools/stygian/summary")}>Summary</a>
        <span class="page-meta-sep" aria-hidden="true">·</span>
        <a class="back-link" href={resolve("/tools/stygian/enemies")}
          >Enemy Database</a
        >
      </p>
    </div>
  </header>

  <StygianSolutionBoard {mapping} />
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
</style>
