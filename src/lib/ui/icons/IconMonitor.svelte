<script lang="ts">
  let { size = 24, class: cls = "" }: { size?: number; class?: string } =
    $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={cls}
  xmlns="http://www.w3.org/2000/svg"
>
  <rect x="3" y="4" width="18" height="12" rx="2" />
  <path d="M8 20h8" />
  <path d="M12 16v4" />
</svg>
