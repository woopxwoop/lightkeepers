<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import Button from "$lib/ui/components/Button.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import IconGoogle from "$lib/ui/icons/IconGoogle.svelte";
  import IconDiscord from "$lib/ui/icons/IconDiscord.svelte";

  const session = authClient.useSession();

  let hasCloudRoster = $state<boolean | null>(null);
  let rosterLoading = $state(true);
  let rosterError = $state("");
  let confirmReset = $state(false);

  let cloudRosterVersion = 0;

  $effect(() => {
    if ($session.data) {
      cloudRosterVersion++;
      checkCloudRoster(cloudRosterVersion);
    } else {
      hasCloudRoster = null;
      rosterLoading = false;
    }
  });

  async function checkCloudRoster(version: number) {
    rosterLoading = true;
    try {
      const res = await fetch("/api/roster");
      if (version !== cloudRosterVersion) return;
      if (!res.ok) {
        console.error("checkCloudRoster: unexpected status", res.status);
        hasCloudRoster = null;
        return;
      }
      const { roster } = await res.json();
      if (version !== cloudRosterVersion) return;
      hasCloudRoster = roster !== null;
    } catch (err) {
      if (version !== cloudRosterVersion) return;
      console.error("checkCloudRoster: network error", err);
      hasCloudRoster = null;
    } finally {
      if (version === cloudRosterVersion) rosterLoading = false;
    }
  }

  function promptReset() {
    confirmReset = true;
  }

  function cancelReset() {
    confirmReset = false;
  }

  async function executeReset() {
    rosterError = "";
    confirmReset = false;
    try {
      const res = await fetch("/api/roster", { method: "DELETE" });
      if (res.ok) {
        hasCloudRoster = false;
      } else {
        rosterError = `Server error (${res.status}) — roster not reset`;
        console.error("resetCloudRoster: unexpected status", res.status);
      }
    } catch (err) {
      rosterError = "Network error — could not reset cloud roster";
      console.error("resetCloudRoster: network error", err);
    }
  }
</script>

<div class="account-panel">
  <header class="panel-head">
    <h2 class="section-title">Account / Sync</h2>
    <p class="lede">Log in to back up your roster and sync across devices.</p>
  </header>

  {#if $session.isPending}
    <LoadingState message="Loading…" />
  {:else if $session.data}
    <div class="panel-body">
      <div class="user-row">
        {#if $session.data.user.image}
          <img
            src={$session.data.user.image}
            alt=""
            width="36"
            height="36"
            class="user-avatar"
          />
        {/if}
        <div class="user-copy">
          <span class="user-name">{$session.data.user.name}</span>
          <span class="user-email">{$session.data.user.email}</span>
        </div>
      </div>

      {#if rosterLoading}
        <p class="status-note">Checking cloud roster…</p>
      {:else if hasCloudRoster === null}
        <p class="status-note">Could not reach sync service.</p>
      {:else if hasCloudRoster}
        <div class="sync-status">
          <span class="status-dot" aria-hidden="true"></span>
          <p class="status-note sync-label">Cloud roster backed up</p>
          {#if confirmReset}
            <div class="confirm-row">
              <span class="status-note">Delete cloud roster?</span>
              <Button variant="ghost" onclick={executeReset}>Yes</Button>
              <Button variant="secondary" onclick={cancelReset}>No</Button>
            </div>
          {:else}
            <Button variant="secondary" onclick={promptReset}>Reset</Button>
          {/if}
        </div>
      {:else}
        <p class="status-note">No cloud roster backed up</p>
      {/if}

      {#if rosterError}
        <p class="error-note">{rosterError}</p>
      {/if}

      <Button
        variant="secondary"
        class="sign-out"
        onclick={() => authClient.signOut()}
      >
        Sign out
      </Button>
    </div>
  {:else}
    <div class="oauth-stack">
      <button
        type="button"
        class="oauth-button"
        onclick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: "/settings?tab=account",
          })}
      >
        <IconGoogle size={18} />
        Continue with Google
      </button>
      <button
        type="button"
        class="oauth-button"
        onclick={() =>
          authClient.signIn.social({
            provider: "discord",
            callbackURL: "/settings?tab=account",
          })}
      >
        <IconDiscord size={18} />
        Continue with Discord
      </button>
    </div>
  {/if}
</div>

<style>
  .account-panel {
    min-height: 21rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-4);
  }

  .panel-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 42rem;
  }

  .lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-mid);
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .user-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    border-radius: 999px;
    border: var(--border-width) solid rgba(255, 255, 255, 0.28);
  }

  .user-copy {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .user-name {
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  .user-email {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .status-note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .sync-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .sync-label {
    flex: 1;
    min-width: 8rem;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.45);
  }

  .confirm-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .error-note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--foreground-color);
  }

  :global(.sign-out) {
    width: fit-content;
  }

  .oauth-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .oauth-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 20rem;
    padding: 0.65rem 1.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    background: color-mix(in srgb, var(--background-color) 55%, transparent);
    color: var(--foreground-color);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition:
      background-color var(--control-duration) var(--control-ease),
      border-color var(--control-duration) var(--control-ease);
  }

  .oauth-button:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.4);
  }
</style>
