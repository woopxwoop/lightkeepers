<script lang="ts">
  import InfoPopover from "./InfoPopover.svelte";

  let {
    label = "cost",
    align = "start",
  }: {
    /** Trigger word as it reads in the surrounding sentence. */
    label?: string;
    align?: "start" | "center" | "end";
  } = $props();
</script>

<InfoPopover {label} {align}>
  Every limited copy of a five star character or weapon adds 1 cost to the team.
  Standard characters are assigned 0-cost at C2, and constellation selectors get
  their C1 for free, so they are 1-cost at C1. Owned
  weapon alternatives on team pages (other signatures, standard 5★ weapons you
  already have) are also counted as +1 for comparison — they are not pull
  recommendations.
</InfoPopover>
