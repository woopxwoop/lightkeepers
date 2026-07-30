<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    children,
    class: className = "",
    align = "center",
  }: {
    /** Inline trigger text — underlined to signal it explains itself. */
    label: string;
    children: Snippet;
    class?: string;
    /** Horizontal anchor of the panel relative to the trigger. */
    align?: "start" | "center" | "end";
  } = $props();

  const panelId = $props.id();

  let open = $state(false);
  let rootEl: HTMLSpanElement | undefined = $state();

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  $effect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootEl?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (target && rootEl?.contains(target)) return;
      close();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
    };
  });
</script>

<span class="info-popover {className}" bind:this={rootEl}>
  <button
    type="button"
    class="info-trigger"
    aria-expanded={open}
    aria-controls={panelId}
    aria-describedby={open ? panelId : undefined}
    onclick={toggle}
  >
    {label}
  </button>

  {#if open}
    <span
      id={panelId}
      class="info-panel info-panel-{align}"
      role="tooltip"
      data-open="true"
    >
      {@render children()}
    </span>
  {/if}
</span>

<style>
  .info-popover {
    position: relative;
    display: inline-flex;
  }

  .info-trigger {
    font: inherit;
    color: inherit;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 0.15em;
    transition: var(--control-transition);
  }

  .info-trigger:hover,
  .info-trigger[aria-expanded="true"] {
    color: var(--foreground-color);
  }

  .info-panel {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    z-index: 20;
    display: block;
    width: max-content;
    max-width: min(16rem, calc(100vw - 2rem));
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius-md);
    /* Fixed px so the panel keeps its own scale inside small meta text. */
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: normal;
    text-transform: none;
    text-align: left;
    background: var(--foreground-mid);
    color: var(--background-color);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .info-panel-center {
    left: 50%;
    transform: translateX(-50%);
  }

  .info-panel-start {
    left: 0;
  }

  .info-panel-end {
    right: 0;
  }
</style>
