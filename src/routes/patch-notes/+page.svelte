<script lang="ts">
  import { resolve } from "$app/paths";
  import PageShell from "$lib/ui/components/PageShell.svelte";

  let { data } = $props();

  function formatDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
</script>

<PageShell class="gap-8 patch-notes-page">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Patch notes</h1>
      <p class="page-meta">
        Product updates — same source as GitHub Releases and Discord.
      </p>
    </div>
  </header>

  {#if data.notes.length === 0}
    <p class="section-lede">No notes yet.</p>
  {:else}
    <ul class="note-list">
      {#each data.notes as note (note.slug)}
        <li>
          <a
            class="note-row"
            href={resolve(`/patch-notes/${note.slug}`)}
          >
            <time class="note-date" datetime={note.date}
              >{formatDate(note.date)}</time
            >
            <span class="note-copy">
              <span class="meta-name">{note.title}</span>
              <span class="meta-sub">{note.summary}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .note-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    border-top: 1px solid color-mix(in oklab, var(--foreground) 12%, transparent);
  }

  .note-row {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    gap: 1rem 1.25rem;
    padding: 1rem 0;
    border-bottom: 1px solid
      color-mix(in oklab, var(--foreground) 12%, transparent);
    text-decoration: none;
    color: inherit;
    align-items: start;
  }

  .note-row:hover .meta-name {
    color: var(--accent-1);
  }

  .note-date {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    padding-top: 0.15rem;
  }

  .note-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  @media (max-width: 640px) {
    .note-row {
      grid-template-columns: 1fr;
      gap: 0.35rem;
    }
  }
</style>
