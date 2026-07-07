<script lang="ts">
  import { authClient } from "$lib/auth-client";

  const session = authClient.useSession();

  let hasCloudRoster = $state<boolean | null>(null);
  let rosterLoading = $state(true);
  let rosterError = $state("");
  let confirmReset = $state(false);

  $effect(() => {
    if ($session.data) {
      checkCloudRoster();
    } else {
      hasCloudRoster = null;
      rosterLoading = false;
    }
  });

  async function checkCloudRoster() {
    rosterLoading = true;
    try {
      const res = await fetch("/api/roster");
      if (!res.ok) {
        console.error("checkCloudRoster: unexpected status", res.status);
        hasCloudRoster = null;
        return;
      }
      const { roster } = await res.json();
      hasCloudRoster = roster !== null;
    } catch (err) {
      console.error("checkCloudRoster: network error", err);
      hasCloudRoster = null;
    } finally {
      rosterLoading = false;
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

<div class="settings-panel settings-sync-panel p-6 flex flex-col gap-6">
  <div class="flex flex-col gap-3 max-w-xl">
    <h3>Account / Sync</h3>
    <p>Log in to back up your roster and sync across devices.</p>
  </div>

  {#if $session.isPending}
    <div class="flex items-center justify-center min-h-[120px]">
      <p style="color: var(--foreground-mid);">Loading...</p>
    </div>
  {:else if $session.data}
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        {#if $session.data.user.image}
          <img
            src={$session.data.user.image}
            alt=""
            width="36"
            height="36"
            class="rounded-full"
            style="border: 0.5px solid color-mix(in srgb, var(--accent-1) 30%, transparent);"
          />
        {/if}
        <div class="flex flex-col">
          <span style="color: var(--foreground-color); font-size: 0.9rem;">
            {$session.data.user.name}
          </span>
          <span style="color: var(--foreground-mid); font-size: 0.8rem;">
            {$session.data.user.email}
          </span>
        </div>
      </div>

      {#if rosterLoading}
        <p style="color: var(--foreground-mid); font-size: 0.85rem;">
          Checking cloud roster...
        </p>
      {:else if hasCloudRoster === null}
        <p style="color: var(--foreground-mid); font-size: 0.85rem;">
          Could not reach sync service.
        </p>
      {:else if hasCloudRoster}
        <div
          class="flex items-center gap-3 p-3 rounded-lg"
          style="background: color-mix(in srgb, var(--background-color) 60%, transparent); border: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent);"
        >
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style="background: color-mix(in srgb, var(--accent-1) 40%, transparent);"
          ></span>
          <p
            style="color: var(--foreground-mid); font-size: 0.85rem; margin: 0; flex: 1;"
          >
            Cloud roster backed up
          </p>
          {#if confirmReset}
            <div class="flex items-center gap-2">
              <span style="color: var(--foreground-mid); font-size: 0.85rem;">
                Delete cloud roster?
              </span>
              <button
                type="button"
                class="secondary-action"
                style="color: var(--accent-1);"
                onclick={executeReset}>Yes</button
              >
              <button type="button" class="secondary-action" onclick={cancelReset}
                >No</button
              >
            </div>
          {:else}
            <button type="button" class="secondary-action" onclick={promptReset}
              >Reset</button
            >
          {/if}
        </div>
      {:else}
        <p style="color: var(--foreground-mid); font-size: 0.85rem;">
          No cloud roster backed up
        </p>
      {/if}

      {#if rosterError}
        <p style="color: var(--accent-1); font-size: 0.85rem;">
          {rosterError}
        </p>
      {/if}

      <button
        type="button"
        class="secondary-action"
        style="width: fit-content;"
        onclick={() => authClient.signOut()}
      >
        Sign out
      </button>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      <button
        type="button"
        class="oauth-button"
        onclick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: "/settings/account",
          })}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>
      <button
        type="button"
        class="oauth-button"
        onclick={() =>
          authClient.signIn.social({
            provider: "discord",
            callbackURL: "/settings/account",
          })}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="#5865F2"
          aria-hidden="true"
        >
          <path
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"
          />
        </svg>
        Continue with Discord
      </button>
    </div>
  {/if}
</div>

<style>
  .settings-panel {
    border-radius: 8px;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--background-mid) 96%, transparent),
        color-mix(in srgb, var(--background-mid) 88%, transparent)
      ),
      color-mix(in srgb, var(--background-mid) 92%, transparent);
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 34%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--accent-1) 14%, transparent),
      inset 0 -1px 0 color-mix(in srgb, black 18%, transparent);
  }

  .settings-sync-panel {
    min-height: 340px;
  }

  h3 {
    font-size: 1rem;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--foreground-color);
  }

  p {
    margin-top: 0.35rem;
    max-width: 42rem;
    font-size: 0.9rem;
    color: var(--foreground-mid);
  }

  .secondary-action {
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 22%, transparent);
    background: var(--background-mid);
    color: var(--foreground-mid);
    font-size: 0.75rem;
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
    transition:
      border-color 0.15s,
      color 0.15s,
      background-color 0.15s,
      opacity 0.15s;
  }

  .oauth-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 320px;
    padding: 0.65rem 1.25rem;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--accent-1) 28%, transparent);
    background: color-mix(in srgb, var(--background-color) 60%, transparent);
    color: var(--foreground-color);
    font-size: 0.9rem;
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  .oauth-button:hover {
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
    border-color: color-mix(in srgb, var(--accent-1) 44%, transparent);
  }
</style>
