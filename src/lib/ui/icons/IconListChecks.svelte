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
  aria-hidden="true"
>
  <path d="m3 5 2 2 4-4" />
  <path d="m3 12 2 2 4-4" />
  <path d="m3 19 2 2 4-4" />
  <path d="M13 6h8" />
  <path d="M13 13h8" />
  <path d="M13 20h8" />
</svg>
