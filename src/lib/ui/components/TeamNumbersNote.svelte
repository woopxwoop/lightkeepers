<details class="methodology">
  <summary>How team numbers work</summary>
  <p>
    Team damage is simulated with
    <a href="https://gcsim.app/" target="_blank" rel="noopener noreferrer"
      >gcsim</a
    >
    using
    <a
      href="https://compendium.keqingmains.com/"
      target="_blank"
      rel="noopener noreferrer">KQM artifact standards</a
    >. These rotations are not optimized to simulate the highest theoretical DPS
    but aim to replicate rotations achievable by the average player (no sweaty
    Mavuika combos... yet).
  </p>
</details>

<style>
  .methodology {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .methodology summary {
    width: fit-content;
    cursor: pointer;
    font-family: var(--font-display);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .methodology summary:hover {
    color: var(--foreground-color);
  }

  .methodology p {
    max-width: 60ch;
    margin-top: var(--space-2);
    line-height: 1.55;
  }

  .methodology a {
    color: var(--accent-2);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
