<script lang="ts">
  import { charactersOwned } from "#lib/stores/roster.js";
  import Surface from "#lib/ui/components/Surface.svelte";
  import Button from "#lib/ui/components/Button.svelte";
  import Toggle from "#lib/ui/components/Toggle.svelte";
  import SegmentedControl from "#lib/ui/components/SegmentedControl.svelte";
  import Select from "#lib/ui/components/Select.svelte";
  import CharacterSearchSelect from "#lib/ui/components/CharacterSearchSelect.svelte";
  import PickModal from "#lib/ui/components/PickModal.svelte";
  import Chip from "#lib/ui/components/Chip.svelte";
  import Badge from "#lib/ui/components/Badge.svelte";
  import CharacterPortraitCard from "#lib/ui/components/CharacterPortraitCard.svelte";
  import IconFilter from "#lib/ui/icons/IconFilter.svelte";
  import IconCog from "#lib/ui/icons/IconCog.svelte";
  import { ELEMENT_COLORS } from "#lib/element-colors.js";
  import {
    equipmentVersion,
    weaponByKey,
    weaponIconSrc,
  } from "#lib/equipment-data.js";

  let segment = $state<"roster" | "meta">("roster");
  let selectDemo = $state("stygian");
  let chipOn = $state(true);
  let toggleOn = $state(true);

  // ── PickModal demo (Planner character / weapon picker) ────────────────
  let pickDemoKind = $state<"character" | "weapon" | null>(null);
  let pickDemoQuery = $state("");
  let pickDemoChoice = $state("");
  let pickDemoCharValue = $state("");
  let pickDemoWeaponValue = $state("");

  let pickDemoCharOptions = $derived(
    $charactersOwned
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .map((c) => ({
        value: c.name_id,
        label: c.name ?? c.name_id,
      })),
  );

  let pickDemoCharById = $derived(
    new Map($charactersOwned.map((c) => [c.name_id, c])),
  );

  let pickDemoWeaponOptions = $derived.by(() => {
    void $equipmentVersion;
    return [...weaponByKey.entries()]
      .map(([key, w]) => ({
        value: key,
        label: `${w.name} (${w.stars}★)`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  function openPickDemo(kind: "character" | "weapon") {
    pickDemoKind = kind;
    pickDemoQuery = "";
  }

  function closePickDemo() {
    pickDemoKind = null;
    pickDemoQuery = "";
  }

  function choosePickDemo(value: string) {
    pickDemoChoice = value;
    closePickDemo();
  }

  const SEGMENT_OPTIONS = [
    { value: "roster" as const, label: "roster" },
    { value: "meta" as const, label: "meta" },
  ];
</script>

<section class="gallery-section" id="controls">
  <div class="section-head">
    <h2>Controls</h2>
    <p>
      Shared <code>PickModal</code>, <code>CharacterSearchSelect</code>,
      <code>SegmentedControl</code>, <code>Select</code>, <code>Chip</code>,
      <code>Toggle</code>, <code>Button</code>, <code>Badge</code>.
    </p>
  </div>

  <div class="control-stack">
    <Surface>
      <p class="surface-label">PickModal</p>
      <p class="token-meta mb-2">
        Full-viewport character / weapon picker (Planner + Character / +
        Weapon). Portrait grid for characters, square icon grid for weapons.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onclick={() => openPickDemo("character")}
          >Open character pick</Button
        >
        <Button variant="secondary" onclick={() => openPickDemo("weapon")}
          >Open weapon pick</Button
        >
        {#if pickDemoChoice}
          <span class="token-meta">Last pick: {pickDemoChoice}</span>
        {/if}
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">CharacterSearchSelect</p>
      <p class="token-meta mb-2">
        Combobox used in Planner configure — character portraits or weapon icons
        in the suggestion menu.
      </p>
      <div class="flex flex-wrap items-end gap-4">
        <label class="demo-field">
          <span class="token-meta">Character</span>
          <CharacterSearchSelect
            bind:value={pickDemoCharValue}
            options={pickDemoCharOptions}
            getCharacter={(id) => pickDemoCharById.get(id)}
            placeholder="Search character…"
            aria-label="Demo character search"
          />
        </label>
        <label class="demo-field">
          <span class="token-meta">Weapon</span>
          <CharacterSearchSelect
            bind:value={pickDemoWeaponValue}
            options={pickDemoWeaponOptions}
            getIconSrc={(key) => weaponIconSrc(key)}
            placeholder="Search weapon…"
            aria-label="Demo weapon search"
          />
        </label>
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">SegmentedControl</p>
      <SegmentedControl
        options={SEGMENT_OPTIONS}
        bind:value={segment}
        aria-label="Demo segment"
      />
    </Surface>

    <Surface>
      <p class="surface-label">Select</p>
      <p class="token-meta mb-2">
        Custom listbox dropdown (same chrome as the character filter Sort
        control). Menu anchors left/right from the trigger’s viewport side.
        Optional fixed <code>trigger</code> label.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <Select
          bind:value={selectDemo}
          aria-label="Demo select"
          options={[
            { value: "stygian", label: "Stygian" },
            { value: "abyss", label: "Abyss" },
            { value: "simulated", label: "Simulated" },
          ]}
        />
        <Select
          bind:value={selectDemo}
          trigger="Sort"
          aria-label="Demo sort"
          options={[
            { value: "stygian", label: "Stygian" },
            { value: "abyss", label: "Abyss" },
            { value: "simulated", label: "Simulated" },
          ]}
        />
      </div>
      <p class="token-meta mt-2">Value: {selectDemo}</p>
    </Surface>

    <Surface>
      <p class="surface-label">Chips</p>
      <div class="chip-row">
        <Chip active={chipOn} onclick={() => (chipOn = !chipOn)}>Owned</Chip>
        {#each Object.entries(ELEMENT_COLORS) as [el, color]}
          <Chip style="border-color: {color}; color: {color};">{el}</Chip>
        {/each}
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">Toggle + Button</p>
      <div class="flex flex-wrap items-center gap-3">
        <Toggle bind:pressed={toggleOn} aria-label="Demo toggle" />
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">
          <IconFilter size={14} />
          Filters
        </Button>
        <Button variant="icon" aria-label="Settings">
          <IconCog size={16} />
        </Button>
      </div>
    </Surface>

    <Surface>
      <p class="surface-label">Badges</p>
      <div class="chip-row">
        <Badge tone="gold">R5</Badge>
        <Badge tone="mint">4pc</Badge>
        <Badge tone="muted">NEW</Badge>
        <Badge tone="warn">missing</Badge>
      </div>
    </Surface>
  </div>
</section>

{#if pickDemoKind}
  <PickModal
    open
    title={pickDemoKind === "character" ? "Add character" : "Add weapon"}
    searchPlaceholder={pickDemoKind === "character"
      ? "Search character…"
      : "Search weapon…"}
    options={pickDemoKind === "character"
      ? pickDemoCharOptions
      : pickDemoWeaponOptions}
    art={pickDemoKind === "weapon" ? "square" : "portrait"}
    bind:query={pickDemoQuery}
    onClose={closePickDemo}
    onChoose={choosePickDemo}
  >
    {#snippet tile(opt)}
      {#if pickDemoKind === "character"}
        <CharacterPortraitCard
          character={pickDemoCharById.get(opt.value)}
          tintBackground
        />
      {:else}
        {@const src = weaponIconSrc(opt.value)}
        <div class="weapon-tile">
          {#if src}
            <img {src} alt="" loading="lazy" />
          {/if}
        </div>
      {/if}
    {/snippet}
  </PickModal>
{/if}

<style>
  .demo-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 14rem;
  }

  .weapon-tile {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--background-mid);
  }

  .section-head h2 {
    font-size: var(--h2-size);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .section-head p {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .surface-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
    margin-bottom: 0.35rem;
  }

  .token-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .control-stack {
    display: grid;
    gap: var(--space-3);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .mb-2 {
    margin-bottom: var(--space-2);
  }

  .mt-2 {
    margin-top: var(--space-2);
  }

  code {
    font-size: var(--text-sm);
    color: var(--accent-2);
  }
</style>
