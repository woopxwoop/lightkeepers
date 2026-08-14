<script lang="ts">
  let {
    size = 24,
    class: cls = "",
  }: { size?: number; class?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="currentColor"
  class={cls}
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <circle cx="5" cy="5" r="1.75" />
  <circle cx="12" cy="5" r="1.75" />
  <circle cx="19" cy="5" r="1.75" />
  <circle cx="5" cy="12" r="1.75" />
  <circle cx="12" cy="12" r="1.75" />
  <circle cx="19" cy="12" r="1.75" />
  <circle cx="5" cy="19" r="1.75" />
  <circle cx="12" cy="19" r="1.75" />
  <circle cx="19" cy="19" r="1.75" />
</svg>
