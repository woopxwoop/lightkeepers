<script lang="ts">
  import type { Snippet } from "svelte";

  type Tone = "gold" | "mint" | "muted" | "warn";

  let {
    tone = "muted",
    class: className = "",
    children,
  }: {
    tone?: Tone;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<span class="badge badge-{tone} {className}">
  {@render children?.()}
</span>

<style>
  .badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: var(--radius-sm);
  }

  .badge-gold {
    color: #1a1208;
    background: color-mix(in srgb, var(--accent-1) 85%, #f0c060);
  }

  .badge-mint {
    color: #0a120e;
    background: color-mix(in srgb, #6dd5a8 75%, var(--accent-1));
  }

  .badge-muted {
    color: var(--foreground-mid);
    border: var(--border-width) solid
      color-mix(in srgb, var(--accent-1) 25%, transparent);
  }

  .badge-warn {
    color: var(--accent-1);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
