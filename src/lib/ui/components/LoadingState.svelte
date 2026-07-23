<script lang="ts">
  let {
    message = "Loading…",
    variant = "plain",
    class: className = "",
  }: {
    message?: string;
    variant?: "plain" | "pulse";
    class?: string;
  } = $props();
</script>

{#if variant === "pulse"}
  <div class="loading loading-pulse {className}" role="status">
    <span class="pulse-dot" aria-hidden="true"></span>
    <p class="msg">{message}</p>
  </div>
{:else}
  <div class="loading {className}" role="status">
    <p class="msg">{message}</p>
  </div>
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40vh;
    gap: 0.5rem;
  }

  .loading-pulse {
    min-height: unset;
    padding: var(--space-8) var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    border: var(--border-width) solid var(--border-default);
  }

  .msg {
    color: var(--foreground-mid);
    font-size: var(--text-md);
  }

  .pulse-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--radius-pill);
    background: var(--accent-1);
    animation: loading-pulse 1s ease-in-out infinite;
  }

  @keyframes loading-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse-dot {
      animation: none;
      opacity: 1;
    }
  }
</style>
