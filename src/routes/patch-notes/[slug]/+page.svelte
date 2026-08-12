<script lang="ts">
  import { resolve } from "$app/paths";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";

  let { data } = $props();

  const trail = $derived([
    { label: "Patch notes", href: resolve("/patch-notes") },
    { label: data.note.title },
  ]);

  function formatDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
</script>

<PageShell class="gap-8 patch-note-detail">
  <header class="page-head">
    <PageTrail items={trail} />
    <div class="page-head-text">
      <h1 class="page-title note-title">{data.note.title}</h1>
      <p class="page-meta">
        <time datetime={data.note.date}>{formatDate(data.note.date)}</time>
      </p>
    </div>
  </header>

  <article class="note-body">
    {@html data.note.html}
  </article>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Mixed case — not the uppercase .page-title look for article titles. */
  .note-title {
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .note-body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    max-width: 42rem;
    color: var(--foreground);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .note-body :global(h2) {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    margin-top: 0.75rem;
    color: var(--foreground);
  }

  .note-body :global(h3) {
    font-size: var(--text-sm);
    font-weight: 600;
    margin-top: 0.5rem;
  }

  .note-body :global(p),
  .note-body :global(ul) {
    margin: 0;
    color: var(--foreground-mid);
  }

  .note-body :global(ul) {
    padding-left: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .note-body :global(a) {
    color: var(--accent-1);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .note-body :global(code) {
    font-size: 0.92em;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    background: color-mix(in oklab, var(--foreground) 8%, transparent);
  }

  .note-body :global(strong) {
    color: var(--foreground);
    font-weight: 600;
  }
</style>
