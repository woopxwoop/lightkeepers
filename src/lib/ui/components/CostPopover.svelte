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
  Standard characters are assigned 0-cost at C2, and characters in the
  constellation selector get their C1 for free, so they are 1-cost at C1.
</InfoPopover>
