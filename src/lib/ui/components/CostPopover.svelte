<script lang="ts">
  import InfoPopover from "./InfoPopover.svelte";

  let {
    label = "cost",
    align = "start",
  }: {
    /** Trigger word as it reads in the surrounding sentence. */
    label?: string;
    align?: "start" | "center" | "end";
  } = $props();

  const COSTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

  /** Constellation rungs that land on each integer cost (character copies only). */
  const ROWS: { label: string; hint?: string; cells: string[] }[] = [
    {
      label: "Limited",
      cells: ["-", "C0", "C1", "C2", "C3", "C4", "C5", "C6"],
    },
    {
      label: "Limited",
      hint: "in the constellation selector",
      cells: ["-", "C0, C1", "C2", "C3", "C4", "C5", "C6", "-"],
    },
    {
      label: "Standard",
      cells: ["C0–C2", "C3", "C4", "C5", "C6", "-", "-", "-"],
    },
  ];
</script>

<InfoPopover {label} {align} panelClass="cost-popover-panel">
  <div class="cost-body">
    <p class="cost-lede">
      Cost is a standardized way of measuring team investment level.
    </p>
    <div class="cost-table-wrap">
      <table class="cost-table">
        <thead>
          <tr>
            <th scope="col">Cost (Characters)</th>
            {#each COSTS as n (n)}
              <th scope="col">{n}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each ROWS as row, r (`${row.label}-${row.hint ?? r}`)}
            <tr>
              <th scope="row">
                {row.label}
                {#if row.hint}
                  <span class="cost-hint">{row.hint}</span>
                {/if}
              </th>
              {#each row.cells as cell, i (`${r}-${i}`)}
                <td>{cell}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="cost-note">*Each 5★ weapon adds 1 cost.</p>
  </div>
</InfoPopover>

<style>
  :global(.info-panel.cost-popover-panel) {
    max-width: min(26rem, calc(100vw - 1.5rem));
  }

  .cost-body {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .cost-lede,
  .cost-note {
    margin: 0;
  }

  .cost-note {
    opacity: 0.82;
  }

  .cost-table-wrap {
    overflow-x: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  .cost-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  .cost-table th,
  .cost-table td {
    padding: 0.2rem 0.28rem;
    border-bottom: 0.5px solid
      color-mix(in srgb, var(--background-color) 18%, transparent);
    border-left: 0.5px solid
      color-mix(in srgb, var(--background-color) 18%, transparent);
    vertical-align: middle;
  }

  .cost-table th:first-child,
  .cost-table td:first-child {
    border-left: none;
  }

  .cost-table thead th {
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }

  .cost-table thead th:first-child {
    text-align: left;
    padding-left: 0;
  }

  .cost-table tbody th {
    font-weight: 500;
    text-align: left;
    max-width: 7.25rem;
    padding-left: 0;
  }

  .cost-hint {
    display: block;
    font-weight: 400;
    opacity: 0.75;
  }

  .cost-table td {
    text-align: center;
    white-space: nowrap;
  }
</style>
