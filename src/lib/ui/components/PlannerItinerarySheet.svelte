<script lang="ts">
  import { resolve } from "$app/paths";
  import { plannerItineraryOpen } from "#lib/planner/planner-itinerary-open.js";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import PlannerItinerary from "#lib/ui/components/PlannerItinerary.svelte";

  const plannerPath = resolve("tools/planner");

  function close() {
    plannerItineraryOpen.set(false);
  }
</script>

<ModalSheet
  open={$plannerItineraryOpen}
  onclose={close}
  label="Farming itinerary"
  closeOnNavigate
  size="sheet"
>
  {#snippet head()}
    <a class="back-link sheet-planner" href={plannerPath}>View full planner</a>
  {/snippet}
  <div class="sheet-fill">
    <PlannerItinerary chrome="plain" showEmpty showHeading={false} />
  </div>
</ModalSheet>

<style>
  .sheet-planner {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .sheet-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sheet-fill :global(.itinerary) {
    flex: 1;
    min-height: 0;
  }
</style>
