<script module lang="ts">
  export type TrailItem = {
    label: string;
    href?: string;
  };
</script>

<script lang="ts">
  /**
   * Compact path trail for shallow hierarchies.
   * Parent hops use BackLink so list filters survive when history allows.
   */
  import BackLink from "$lib/ui/components/BackLink.svelte";

  let {
    items,
    class: className = "",
  }: {
    items: TrailItem[];
    class?: string;
  } = $props();
</script>

{#if items.length > 0}
  <nav class="page-trail {className}" aria-label="Breadcrumb">
    <ol class="trail-list">
      {#each items as item, i (item.href ?? item.label)}
        {@const isLast = i === items.length - 1}
        <li class="trail-item">
          {#if !isLast && item.href}
            <BackLink href={item.href}>{item.label}</BackLink>
          {:else}
            <span
              class="trail-current"
              aria-current={isLast ? "page" : undefined}>{item.label}</span
            >
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  .page-trail {
    width: fit-content;
  }

  .trail-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.45rem;
    font-size: var(--text-xs);
  }

  .trail-item {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .trail-item:not(:last-child)::after {
    content: "/";
    color: color-mix(in srgb, var(--foreground-mid) 70%, transparent);
    font-weight: 400;
  }

  .trail-list :global(.back-link) {
    color: var(--foreground-mid);
  }

  .trail-list :global(.back-link:hover) {
    color: var(--accent-1);
  }

  .trail-current {
    color: var(--foreground-color);
    font-weight: 500;
  }
</style>
