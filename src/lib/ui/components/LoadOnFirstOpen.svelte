<script lang="ts">
  /**
   * Mount on-demand UI (layout sheets, modals) only once it is first wanted,
   * then keep it mounted so its own open/close logic and transitions run as
   * normal. `load` is a dynamic `import()`, which keeps the component — and
   * everything only it uses — out of the route's upfront JS/CSS.
   *
   *   <LoadOnFirstOpen when={$someSheetOpen}
   *     load={() => import("#lib/ui/components/SomeSheet.svelte")}
   *     onfail={() => someSheetOpen.set(false)} />
   *
   * The loaded component mounts with its open store already true, so the
   * `{#if open}` block it renders is created along with it — Svelte 5 plays
   * local transitions only on a block's own toggle, so mark the sheet's
   * transitions `|global` to keep the first-open intro.
   *
   * A failed import (offline, CDN hiccup — stale deploy chunks are handled
   * by chunkLoadRecovery) is logged and forgotten: `onfail` should close the
   * open store so the next open request flips `when` again and retries.
   */
  import { untrack, type Component } from "svelte";

  let {
    when,
    load,
    onfail,
  }: {
    /** Becomes true when the UI is first needed (usually its open store). */
    when: boolean;
    load: () => Promise<{ default: Component }>;
    /** Called after a failed load, e.g. to reset the open store. */
    onfail?: () => void;
  } = $props();

  let loading = $state<Promise<{ default: Component }> | null>(null);
  // Depends on `when` only: after a failure, retry waits for the next open
  // request instead of looping while `when` stays true.
  $effect(() => {
    if (when && !untrack(() => loading)) {
      loading = load().catch((err: unknown) => {
        console.error("[LoadOnFirstOpen] load failed:", err);
        loading = null;
        onfail?.();
        throw err;
      });
    }
  });
</script>

{#if loading}
  {#await loading then { default: Loaded }}
    <Loaded />
  {:catch}
    <!-- Logged above; `loading` resets so the next open retries. -->
  {/await}
{/if}
