<script lang="ts">
  let { size = 24, class: cls = "" }: { size?: number; class?: string } = $props();
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
  <path d="M17.5 19H8a6 6 0 1 1 5.4-8.6A4.5 4.5 0 1 1 17.5 19Z" />
  <path d="M12 12v6" />
  <path d="m9 15 3-3 3 3" />
</svg>
