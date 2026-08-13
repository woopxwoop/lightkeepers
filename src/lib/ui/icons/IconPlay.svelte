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
  aria-hidden="true"
>
  <circle cx="12" cy="12" r="10" />
  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
</svg>
