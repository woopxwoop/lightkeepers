<script lang="ts">
  import SummaryTool from "$lib/ui/components/SummaryTool.svelte";

  let { data } = $props();
</script>

<SummaryTool mode="stygian" mapping={data.mapping} />
