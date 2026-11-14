<script lang="ts">
  /**
   * One-shot popup for the latest patch note when the visitor hasn't
   * acknowledged it yet (first visit or a newer note after a prior dismiss).
   */
  import { browser } from "$app/env";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "#lib/ui/components/Button.svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import {
    readSeenPatchNoteSlug,
    shouldShowPatchNotesPopup,
    writeSeenPatchNoteSlug,
  } from "#lib/patch-notes/patch-notes-seen.js";

  let {
    note,
  }: {
    note: {
      slug: string;
      title: string;
      date: string;
      summary: string;
    } | null;
  } = $props();

  let open = $state(false);

  const patchNotesBase = resolve("patch-notes");

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

  function acknowledge(): void {
    if (!note) return;
    writeSeenPatchNoteSlug(note.slug);
    open = false;
  }

  function onPatchNotesRoute(): boolean {
    const path = page.url.pathname;
    return path === patchNotesBase || path.startsWith(`${patchNotesBase}/`);
  }

  onMount(() => {
    if (!browser || !note) return;
    const latestSlug = note.slug;

    // Already reading notes — mark current latest as seen, never interrupt.
    if (onPatchNotesRoute()) {
      writeSeenPatchNoteSlug(latestSlug);
      return;
    }

    if (!shouldShowPatchNotesPopup(latestSlug, readSeenPatchNoteSlug())) {
      return;
    }

    const delay = prefersReducedMotion.current ? 0 : 450;
    const timer = window.setTimeout(() => {
      if (onPatchNotesRoute()) return;
      if (!shouldShowPatchNotesPopup(latestSlug, readSeenPatchNoteSlug())) {
        return;
      }
      open = true;
    }, delay);

    return () => window.clearTimeout(timer);
  });

  $effect(() => {
    if (!note) return;
    if (!onPatchNotesRoute()) return;
    writeSeenPatchNoteSlug(note.slug);
    open = false;
  });
</script>

<ModalSheet
  open={open && !!note}
  onclose={acknowledge}
  labelledby="patch-notes-popup-title"
  size="dialog"
  initialFocus=".popup-ack"
>
  {#snippet head()}
    {#if note}
      <div>
        <p class="popup-eyebrow">Patch notes</p>
        <h2 id="patch-notes-popup-title" class="section-title popup-title">
          {note.title}
        </h2>
      </div>
    {/if}
  {/snippet}
  {#if note}
    <p class="page-meta popup-date">
      <time datetime={note.date}>{formatDate(note.date)}</time>
    </p>
    <p class="section-lede popup-summary">{note.summary}</p>
    <div class="popup-actions">
      <Button variant="ghost" class="popup-ack" onclick={acknowledge}>
        Got it
      </Button>
      <a
        class="popup-read"
        href={resolve(`patch-notes/${note.slug}`)}
        onclick={acknowledge}
      >
        Read note
      </a>
    </div>
  {/if}
</ModalSheet>

<style>
  .popup-eyebrow {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    /* Cream on black — never gold/yellow text on black. */
    color: var(--foreground-mid);
  }

  .popup-title {
    margin: 0;
    text-transform: none;
    letter-spacing: 0.02em;
    font-size: var(--text-base);
  }

  .popup-date {
    margin: 0;
  }

  .popup-summary {
    margin: 0.15rem 0 0.35rem;
  }

  .popup-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    margin-top: 0.35rem;
  }

  /* Ghost on black page base — silver/cream control border, not washed gold. */
  .popup-actions :global(.btn-ghost) {
    border-color: var(--border-control-quiet);
  }

  .popup-actions :global(.btn-ghost:hover) {
    border-color: color-mix(in srgb, var(--foreground-color) 42%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .popup-read {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-md);
    /* No gold outline on black — fill alone; gold-on-black borders read murky. */
    border: var(--border-width) solid transparent;
    background: var(--accent-1);
    color: var(--control-knob-on);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: var(--control-transition);
  }

  .popup-read:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
  }
</style>
