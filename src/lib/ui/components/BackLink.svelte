<script lang="ts">
  /**
   * In-page back control: real `href` for new tabs / direct entry, but
   * `history.back()` when the previous app page was that same path so list
   * filters in the query string survive.
   */
  import type { Snippet } from "svelte";
  import { canPopTo } from "$lib/nav-history";

  let {
    href,
    class: className = "",
    children,
  }: {
    href: string;
    class?: string;
    children: Snippet;
  } = $props();

  function onclick(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (!canPopTo(href)) return;
    event.preventDefault();
    history.back();
  }
</script>

<a {href} {onclick} class="back-link {className}">
  {@render children()}
</a>

<style>
  .back-link {
    width: fit-content;
    font-size: var(--text-xs);
    color: var(--accent-1);
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
  }
</style>
