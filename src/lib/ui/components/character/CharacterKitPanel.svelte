<script lang="ts">
  import { onMount } from "svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import { elementColor } from "$lib/element-colors";
  import {
    availableTravelerElements,
    defaultTravelerElement,
  } from "$lib/traveler-kits";
  import {
    enhanceExtra,
    type EnhanceExtra,
  } from "$lib/character-kit-text";
  import { getUiAssetUrl } from "$lib/utils";
  import { skillIconUrl, talentIconUrl } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";

  let {
    kit,
    travelerKits,
    onNeedSkillsTab,
  }: {
    kit: CharacterKit;
    travelerKits: Record<string, CharacterKit>;
    onNeedSkillsTab: () => void;
  } = $props();

  const SKILL_LABELS: Record<string, string> = {
    normal: "Normal Attack",
    skill: "Elemental Skill",
    burst: "Elemental Burst",
  };

  let skillsElement = $state("");
  /** Kit card currently flashing after an in-page talent link click. */
  let flashId = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  let travelerSkillElements = $derived(availableTravelerElements(travelerKits));
  let travelerSkillOptions = $derived(
    travelerSkillElements.map((element) => ({
      value: element,
      label: element,
    })),
  );

  /** Explicit pick when it still resolves, else the kit's own default. */
  let effectiveElement = $derived.by(() => {
    if (!kit.is_traveler) return "";
    if (skillsElement && travelerKits[skillsElement]) return skillsElement;
    return defaultTravelerElement(travelerKits, kit.element);
  });

  let skillsKit = $derived.by(() => {
    if (!kit.is_traveler) return kit;
    return travelerKits[effectiveElement] ?? kit;
  });
  let skillsElColor = $derived(
    elementColor(skillsKit.element, "var(--foreground-color)"),
  );

  function flashKitTarget(hash: string) {
    if (!hash.startsWith("#kit-")) return;
    onNeedSkillsTab();
    const id = hash.slice(1);
    // Clear first so re-clicking the same link restarts the animation.
    flashId = null;
    requestAnimationFrame(() => {
      flashId = id;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 1800);
    });
  }

  onMount(() => {
    flashKitTarget(window.location.hash);

    const onHash = () => flashKitTarget(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.(
        "a.game-link",
      ) as HTMLAnchorElement | null;
      const href = a?.getAttribute("href");
      if (href?.startsWith("#kit-")) {
        queueMicrotask(() => flashKitTarget(href));
      }
    };

    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      if (flashTimer) clearTimeout(flashTimer);
    };
  });

  function passiveUnlockLabel(unlock: number): string {
    if (unlock <= 0) return "Utility";
    return `Ascension ${unlock}`;
  }

  function passiveKindLabel(
    passive: (typeof skillsKit.passives)[number],
  ): string {
    if (passive.kind === "hexerei") return "Hexerei";
    if (passive.kind === "polestar") return "Polestar Field";
    return passiveUnlockLabel(passive.unlock);
  }

  function iconUrl(icon: string, kind: "skill" | "talent"): string | null {
    return kind === "skill" ? skillIconUrl(icon) : talentIconUrl(icon);
  }

  /** In-page targets for `{LINK#S…}` / `P…` / `T…` (skills / passives / consts). */
  let kitLinkIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const s of skillsKit.skills) ids.add(`S${s.id}`);
    for (const p of skillsKit.passives) ids.add(`P${p.id}`);
    for (const c of skillsKit.constellations) ids.add(`T${c.id}`);
    return ids;
  });

  function resolveKitLink(ref: string): string | null {
    return kitLinkIds.has(ref) ? `#kit-${ref}` : null;
  }
</script>

{#snippet descriptionBlock(base: string, enhance: EnhanceExtra | null)}
  {#if enhance?.mode === "replace"}
    <GameText
      text={enhance.text}
      class="text-xs"
      resolveLink={resolveKitLink}
    />
  {:else}
    <GameText text={base} class="text-xs" resolveLink={resolveKitLink} />
    {#if enhance}
      <GameText
        text={enhance.text}
        class="text-xs mt-1.5"
        resolveLink={resolveKitLink}
      />
    {/if}
  {/if}
{/snippet}

<div
  role="tabpanel"
  id="tabpanel-skills"
  aria-labelledby="tab-skills"
  tabindex="0"
  style="--kit-flash: {skillsElColor};"
>
  {#if kit.is_traveler && travelerSkillOptions.length > 0}
    <section class="board-section">
      <div class="skills-head">
        <div class="skills-label">
          <span class="skills-label-text" id="skills-element-label"
            >Element:</span
          >
          <Select
            id="skills-element-trigger"
            options={travelerSkillOptions}
            bind:value={
              () => effectiveElement, (next) => (skillsElement = next)
            }
            bare
            aria-labelledby="skills-element-label skills-element-trigger"
          />
        </div>
      </div>
    </section>
  {/if}
  <section class="board-section">
    <h2 class="section-title">Talents</h2>
    <div class="kit-list">
      {#each skillsKit.skills as skill (skill.id)}
        {@const icon =
          iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon)}
        {@const skillEnhance = enhanceExtra(
          skill.description,
          skill.enhanceDescription,
        )}
        <article
          id="kit-S{skill.id}"
          class="kit-row"
          class:kit-row-flash={flashId === `kit-S${skill.id}`}
        >
          {#if icon}
            <img
              src={icon}
              alt=""
              class="kit-icon shrink-0"
              loading="lazy"
            />
          {/if}
          <div class="kit-copy">
            <div class="kit-heading">
              <h3 class="card-title">{skill.name}</h3>
              <span class="card-kicker">
                {SKILL_LABELS[skill.type] ?? skill.type}
              </span>
            </div>
            {@render descriptionBlock(skill.description, skillEnhance)}
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="board-section">
    <h2 class="section-title">Passives</h2>
    <div class="kit-list">
      {#each skillsKit.passives as passive (passive.id)}
        {@const icon =
          iconUrl(passive.icon, "talent") ?? getUiAssetUrl(passive.icon)}
        {@const passiveEnhance = enhanceExtra(
          passive.description,
          passive.enhanceDescription,
        )}
        <article
          id="kit-P{passive.id}"
          class="kit-row"
          class:kit-row-flash={flashId === `kit-P${passive.id}`}
        >
          {#if icon}
            <img
              src={icon}
              alt=""
              class="kit-icon shrink-0"
              loading="lazy"
            />
          {/if}
          <div class="kit-copy">
            <div class="kit-heading">
              <h3 class="card-title">{passive.name}</h3>
              <span class="card-kicker">{passiveKindLabel(passive)}</span>
            </div>
            {@render descriptionBlock(passive.description, passiveEnhance)}
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="board-section">
    <h2 class="section-title">Constellations</h2>
    <div class="kit-list">
      {#each skillsKit.constellations as c (c.id)}
        {@const icon = iconUrl(c.icon, "talent") ?? getUiAssetUrl(c.icon)}
        {@const constEnhance = enhanceExtra(
          c.description,
          c.enhanceDescription,
        )}
        <article
          id="kit-T{c.id}"
          class="kit-row"
          class:kit-row-flash={flashId === `kit-T${c.id}`}
        >
          {#if icon}
            <img
              src={icon}
              alt=""
              class="kit-icon shrink-0"
              loading="lazy"
            />
          {/if}
          <div class="kit-copy">
            <div class="kit-heading">
              <span class="const-index" style="color: {skillsElColor};">
                C{c.index}
              </span>
              <h3 class="card-title">{c.name}</h3>
            </div>
            {@render descriptionBlock(c.description, constEnhance)}
          </div>
        </article>
      {/each}
    </div>
  </section>
</div>

<style>
  .section-title {
    margin-bottom: var(--space-3);
  }

  .board-section {
    padding: var(--space-4);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground-color);
  }

  .card-kicker,
  .const-index {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .const-index {
    font-weight: 600;
  }

  .skills-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skills-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .skills-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .kit-list {
    display: flex;
    flex-direction: column;
  }

  .kit-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.85rem 0;
    scroll-margin-top: 5.5rem;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .kit-row + .kit-row {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .kit-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kit-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .kit-row-flash {
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    background: color-mix(in srgb, var(--kit-flash) 12%, transparent);
    box-shadow: inset 2px 0 0
      color-mix(in srgb, var(--kit-flash) 65%, transparent);
    animation: kit-target-flash 1.6s ease-out;
  }

  @keyframes kit-target-flash {
    0% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 0%, transparent);
    }
    35% {
      box-shadow: inset 3px 0 0
        color-mix(in srgb, var(--kit-flash) 80%, transparent);
    }
    100% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 65%, transparent);
    }
  }
</style>
