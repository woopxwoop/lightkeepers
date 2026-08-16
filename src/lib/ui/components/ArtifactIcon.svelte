<script lang="ts">
  /**
   * Artifact set icon from a GOOD key. Empty until equipment JSON loads, then
   * updates without a parent {#key $equipmentVersion}.
   */
  import { useArtifactSet } from "$lib/equipment-data.svelte";

  let {
    setKey,
    class: className = "",
    alt,
  }: {
    setKey: string;
    class?: string;
    /** Defaults to the resolved set name (or key while loading). */
    alt?: string;
  } = $props();

  const lookup = useArtifactSet(() => setKey);

  let src = $derived(lookup.icon);
  let resolvedAlt = $derived(alt ?? lookup.set?.name ?? setKey);
</script>

{#if src}
  <img {src} alt={resolvedAlt} class={className} loading="lazy" />
{/if}
