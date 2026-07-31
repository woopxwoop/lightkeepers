<script lang="ts">
  import InfoPopover from "./InfoPopover.svelte";

  let {
    scope,
    align = "start",
  }: {
    /** Abyss counts halves, Stygian counts fields. */
    scope: "half" | "field";
    align?: "start" | "center" | "end";
  } = $props();
</script>

<InfoPopover label="usage index" {align}>
  usage rate × rate of appearing in this {scope}
</InfoPopover>
