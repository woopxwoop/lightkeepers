<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  let {
    icon,
    name,
    rarity,
  }: { icon: string | null; name: string; rarity: number | null } = $props();
</script>

<div class="relative w-full h-full">
  <img
    src={icon ?? avatarImg}
    alt={name}
    class="w-full h-full object-cover object-top"
  />
  {#if rarity !== null}
    <div
      class="absolute bottom-0 left-0 right-0 h-0.75"
      style="background: {rarity === 5
        ? 'var(--secondary-color)'
        : 'var(--quaternary-color)'};"
    ></div>
  {/if}
</div>
