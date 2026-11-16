<script lang="ts">
  import { resolve } from "$app/paths";
  import LoadingState from "#lib/ui/components/LoadingState.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import PullsCta from "#lib/ui/components/stygian-solution-board/PullsCta.svelte";
  import type { StygianBoardStatus } from "#lib/boards/stygian-board.js";
  import type { StygianSolverMode } from "#lib/definitions.js";

  let {
    status,
    solverMode,
    onretryteams,
    onretryclears,
  }: {
    status: Exclude<StygianBoardStatus, "board">;
    solverMode: StygianSolverMode;
    onretryteams: () => void;
    onretryclears: () => void;
  } = $props();

  let videoClearsMode = $derived(solverMode === "video-c0r0");
</script>

<div class="board-status">
  {#if status === "owned-failed"}
    <EmptyState message="Could not match your roster right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={onretryteams}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else if status === "owned-pending"}
    <LoadingState variant="pulse" message="Matching your roster…" />
  {:else if status === "clears-error"}
    <EmptyState message="Could not load clears right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={onretryclears}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else if status === "clears-loading"}
    <LoadingState variant="pulse" message="Matching fastest clears…" />
  {:else if status === "clears-unavailable"}
    <EmptyState message="This boss lineup is incomplete." />
  {:else if videoClearsMode}
    <EmptyState message="No video-backed clears for this roster at baseline.">
      {#snippet action()}
        <PullsCta href={resolve("tools/pulls")}>See pull suggestions</PullsCta>
      {/snippet}
    </EmptyState>
  {:else if solverMode === "hybrid"}
    <EmptyState message="No balanced board for this roster.">
      {#snippet action()}
        <PullsCta href={resolve("tools/pulls")}>See pull suggestions</PullsCta>
      {/snippet}
    </EmptyState>
  {:else}
    <EmptyState message="No viable field clears for your roster right now.">
      {#snippet action()}
        <PullsCta href={resolve("tools/pulls")}>See pull suggestions</PullsCta>
      {/snippet}
    </EmptyState>
  {/if}
</div>

<style>
  .board-status {
    padding: var(--space-6) var(--space-4);
  }

  @media (max-width: 640px) {
    .board-status {
      padding: var(--space-5) var(--space-3);
    }
  }
</style>
