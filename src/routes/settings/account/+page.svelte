<script lang="ts">
  import { authClient } from "$lib/auth-client";
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
        <IconGoogle size={18} />
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
        <IconDiscord size={18} />
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
