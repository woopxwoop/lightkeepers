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
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <path d="M14 2v6h6" />
  <circle cx="11.5" cy="14.5" r="2.5" />
  <path d="m13.5 16.5 2 2" />
</svg>
