<script lang="ts">
  import { page } from "$app/state";
  import RosterPanel from "./panels/RosterPanel.svelte";
  import InventoryPanel from "./panels/InventoryPanel.svelte";
  import AccountPanel from "./panels/AccountPanel.svelte";
  import DisplayPanel from "./panels/DisplayPanel.svelte";

  const TABS = ["roster", "inventory", "account", "display"] as const;
  type Tab = (typeof TABS)[number];

  let tab = $derived.by((): Tab => {
    const raw = page.url.searchParams.get("tab");
    if (raw && (TABS as readonly string[]).includes(raw)) return raw as Tab;
    return "roster";
  });
</script>

{#if tab === "account"}
  <AccountPanel />
{:else if tab === "inventory"}
  <InventoryPanel />
{:else if tab === "display"}
  <DisplayPanel />
{:else}
  <RosterPanel />
{/if}
