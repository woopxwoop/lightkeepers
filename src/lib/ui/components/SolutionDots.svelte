<script lang="ts">
  import { handleKeyboardClick, handlePointerAction } from "$lib/ui/pointer";

  let {
    count,
    index = $bindable(0),
    class: className = "",
    "aria-label-prefix": ariaLabelPrefix = "Solution",
  }: {
    count: number;
    index?: number;
    class?: string;
    "aria-label-prefix"?: string;
  } = $props();
</script>

{#if count > 1}
  <div class="dots flex items-center justify-center gap-0.5 {className}">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
      <button
        type="button"
        onpointerdown={(event) => handlePointerAction(event, () => (index = i))}
        onclick={(event) => handleKeyboardClick(event, () => (index = i))}
        aria-label="{ariaLabelPrefix} {i + 1}"
        aria-current={index === i ? "true" : undefined}
        class="hit w-6 h-6 flex items-center justify-center"
      >
        <span class="dot rounded-full block" class:dot-active={index === i}
        ></span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .dot {
    width: 5px;
    height: 5px;
    background: var(--foreground-mid);
    opacity: 0.45;
    transition:
      width 150ms ease,
      height 150ms ease,
      opacity 150ms ease,
      background-color 150ms ease;
  }

  .dot-active {
    width: 7px;
    height: 7px;
    background: var(--accent-1);
    opacity: 1;
  }
</style>
