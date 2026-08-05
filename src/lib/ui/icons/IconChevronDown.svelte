<script lang="ts">
  let {
    size = 24,
    class: cls = "",
    strokeWidth = 2,
  }: { size?: number; class?: string; strokeWidth?: number } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={cls}
  xmlns="http://www.w3.org/2000/svg"
>
  <polyline points="6 9 12 15 18 9" />
</svg>
