<script lang="ts">
  import { page } from "$app/state";
  import { accountSettingsOpen } from "#lib/account-settings-open.js";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import AccountPanel from "#lib/ui/components/settings/AccountPanel.svelte";

  function close() {
    accountSettingsOpen.set(false);
  }

  const oauthCallbackUrl = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<ModalSheet
  open={$accountSettingsOpen}
  onclose={close}
  labelledby="account-settings-title"
  closeOnNavigate
  size="dialog"
>
  {#snippet head()}
    <h2 id="account-settings-title" class="section-title account-title">
      Account
    </h2>
  {/snippet}
  <AccountPanel showHeading={false} embed {oauthCallbackUrl} />
</ModalSheet>

<style>
  .account-title {
    margin: 0;
  }
</style>
