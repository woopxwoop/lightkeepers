<script lang="ts">
  import { researchChatOpen } from "#lib/research/research-chat-open.js";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import ResearchChat from "#lib/ui/components/ResearchChat.svelte";

  function close() {
    researchChatOpen.set(false);
  }
</script>

<ModalSheet
  open={$researchChatOpen}
  onclose={close}
  labelledby="research-chat-title"
  closeOnNavigate
  size="sheet"
>
  {#snippet head()}
    <h2 id="research-chat-title" class="sheet-title">Research</h2>
  {/snippet}
  <div class="sheet-fill">
    <ResearchChat chrome="plain" />
  </div>
</ModalSheet>

<style>
  .sheet-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .sheet-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sheet-fill :global(.ask-plain) {
    flex: 1;
    min-height: 0;
  }
</style>
