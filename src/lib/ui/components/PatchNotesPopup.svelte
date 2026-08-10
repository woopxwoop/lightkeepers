<script lang="ts">
  /**
   * One-shot popup for the latest patch note when the visitor hasn't
   * acknowledged it yet (first visit or a newer note after a prior dismiss).
   */
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import Button from "$lib/ui/components/Button.svelte";
  import {
    readSeenPatchNoteSlug,
    shouldShowPatchNotesPopup,
    writeSeenPatchNoteSlug,
  } from "$lib/patch-notes-seen";

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
  let dialogEl: HTMLElement | null = $state(null);

  const patchNotesBase = resolve("/patch-notes");

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
    return page.url.pathname.startsWith(patchNotesBase);
  }

  onMount(() => {
    if (!browser || !note) return;

    // Already reading notes — mark current latest as seen, never interrupt.
    if (onPatchNotesRoute()) {
      writeSeenPatchNoteSlug(note.slug);
      return;
    }

    if (!shouldShowPatchNotesPopup(note.slug, readSeenPatchNoteSlug())) {
      return;
    }

    const delay = prefersReducedMotion.current ? 0 : 450;
    const timer = window.setTimeout(() => {
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

  $effect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        acknowledge();
      }
    };
    window.addEventListener("keydown", onKey);

    let prevOverflow = "";
    if (browser) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    void tick().then(() => dialogEl?.querySelector<HTMLElement>("button")?.focus());

    return () => {
      window.removeEventListener("keydown", onKey);
      if (browser) document.body.style.overflow = prevOverflow;
    };
  });
</script>

{#if open && note}
  <div class="popup-root">
    <button
      type="button"
      class="popup-backdrop"
      tabindex="-1"
      aria-label="Dismiss patch notes"
      onclick={acknowledge}
      transition:fade={{ duration: prefersReducedMotion.current ? 0 : 180 }}
    ></button>
    <div
      bind:this={dialogEl}
      class="popup-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patch-notes-popup-title"
      transition:scale={{
        duration: prefersReducedMotion.current ? 0 : 220,
        start: 0.96,
      }}
    >
      <p class="popup-eyebrow">Patch notes</p>
      <h2 id="patch-notes-popup-title" class="section-title popup-title">
        {note.title}
      </h2>
      <p class="page-meta popup-date">
        <time datetime={note.date}>{formatDate(note.date)}</time>
      </p>
      <p class="section-lede popup-summary">{note.summary}</p>
      <div class="popup-actions">
        <Button variant="ghost" onclick={acknowledge}>Got it</Button>
        <a
          class="popup-read"
          href={resolve(`/patch-notes/${note.slug}`)}
          onclick={acknowledge}
        >
          Read note
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .popup-root {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    pointer-events: none;
  }

  .popup-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 55%, transparent);
    backdrop-filter: blur(2px);
    pointer-events: auto;
  }

  .popup-panel {
    position: relative;
    z-index: 1;
    width: min(100%, 24rem);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 1.15rem 1.2rem 1.1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid var(--border-default);
    background: var(--surface-raised);
    box-shadow: 0 18px 48px color-mix(in oklab, black 45%, transparent);
    pointer-events: auto;
  }

  .popup-eyebrow {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-1);
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

  .popup-read {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--accent-1);
    background: var(--accent-1);
    color: var(--control-knob-on);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: var(--control-transition);
  }

  .popup-read:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }
</style>
