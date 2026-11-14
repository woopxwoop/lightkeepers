<script lang="ts">
  /**
   * Mount on-demand UI (layout sheets, modals) only once it is first wanted,
   * then keep it mounted so its own open/close logic and transitions run as
   * normal. `load` is a dynamic `import()`, which keeps the component — and
   * everything only it uses — out of the route's upfront JS/CSS.
   *
   *   <LoadOnFirstOpen when={$someSheetOpen}
   *     load={() => import("#lib/ui/components/SomeSheet.svelte")} />
   */
  import type { Component } from "svelte";

  let {
    when,
    load,
  }: {
    /** Becomes true when the UI is first needed (usually its open store). */
    when: boolean;
    load: () => Promise<{ default: Component }>;
  } = $props();

  let wanted = $state(false);
  $effect(() => {
    if (when) wanted = true;
  });
</script>

{#if wanted}
  {#await load() then { default: Loaded }}
    <Loaded />
  {/await}
{/if}
