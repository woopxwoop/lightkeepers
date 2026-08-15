<script lang="ts">
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { accountSettingsOpen } from "$lib/account-settings-open";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import AccountPanel from "../../../routes/settings/panels/AccountPanel.svelte";

  let panelEl: HTMLDivElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let closedByNavigate = false;

  function close() {
    accountSettingsOpen.set(false);
  }

  afterNavigate(() => {
    if (!$accountSettingsOpen) return;
    closedByNavigate = true;
    close();
  });

  $effect(() => {
    if (!$accountSettingsOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    let active = true;
    void tick().then(() => {
      if (!active || !$accountSettingsOpen) return;
      panelEl?.querySelector<HTMLElement>(".account-close")?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (panelEl) trapTabKey(event, panelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
      const skipFocus = closedByNavigate;
      closedByNavigate = false;
      if (previous?.isConnected && !skipFocus) previous.focus();
    };
  });

  const oauthCallbackUrl = $derived(`${page.url.pathname}${page.url.search}`);
</script>

{#if $accountSettingsOpen}
  <div class="account-root">
    <button
      type="button"
      class="account-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={close}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="account-panel-wrap"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <header class="account-head">
        <h2 id="account-settings-title" class="section-title">Account</h2>
        <button
          type="button"
          class="account-close"
          onclick={close}
          aria-label="Close"
        >
          <IconX size={16} />
        </button>
      </header>
      <AccountPanel showHeading={false} embed {oauthCallbackUrl} />
    </div>
  </div>
{/if}

<style>
  .account-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .account-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .account-panel-wrap {
    position: relative;
    z-index: 1;
    width: min(32rem, 100%);
    max-height: min(40rem, calc(100vh - 2rem));
    overflow: auto;
    padding: 1rem 1.1rem 1.15rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.18);
    background: var(--background-mid);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .account-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .account-head .section-title {
    margin: 0;
  }

  .account-close {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .account-close:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }
</style>
