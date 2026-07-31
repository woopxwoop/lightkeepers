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
  <path
    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
  />
  <circle cx="12" cy="12" r="3" />
</svg>
