<script lang="ts">
  import { CRIMSON_WITCH_FAVICON_URL, type CrimsonWitchLink } from "$lib/utils";

  let { links }: { links: CrimsonWitchLink[] } = $props();
</script>

<ul class="useful-links">
  {#each links as link (link.url)}
    <li>
      <a
        class="useful-link"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          class="useful-link-icon"
          src={CRIMSON_WITCH_FAVICON_URL}
          alt=""
          width="40"
          height="40"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <span class="useful-link-copy">
          <span class="useful-link-label">Crimson Witch</span>
          <span class="useful-link-desc">{link.label} build guide</span>
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .useful-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .useful-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0.85rem 0;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 18%, transparent);
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--accent-3) 18%, transparent);
    color: var(--foreground-color);
    text-decoration: none;
    transition: background-color 0.15s ease;
  }

  .useful-link-icon {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  .useful-link:hover {
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .useful-link:hover .useful-link-label {
    color: var(--accent-1);
  }

  .useful-link-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .useful-link-label {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .useful-link-desc {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }
</style>
