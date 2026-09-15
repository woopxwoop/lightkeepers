<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { untrack } from "svelte";
  import {
    adviceStepIconSrc,
    ACCOUNT_BUILD_BUCKET_LABEL,
    ACCOUNT_BUILD_BUCKET_ORDER,
    compareGradeRows,
    formatAdviceStep,
    gradeOwnedBuild,
    type AccountBuildBucket,
    type AccountBuildGrade,
  } from "$lib/account-build-grade";
  import {
    characterSummaryFromIndex,
    loadCharacterIndex,
  } from "$lib/app/character-summary";
  import {
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import type { CharacterOwned } from "$lib/definitions";
  import { weaponByKey, artifactSetByKey } from "$lib/equipment-data";
  import { ensureEquipmentData } from "$lib/equipment-data";
  import {
    kitIconsFromCharacterKit,
    type InvestmentBuildKitIcons,
  } from "$lib/investment-build-card";
  import { rosterBuildViewFromOwned } from "$lib/roster-build-card";
  import {
    charactersOwned,
    ensureTierList,
    invalidateTierList,
    tierList,
  } from "$lib/stores";
  import { creamNameIds, creamUsageByNameId } from "$lib/tierlist";
  import type { CharacterKit } from "$lib/types/character-kit";
  import { settingsPath } from "$lib/ui/nav-links";
  import AccountBuildGradeCard from "$lib/ui/components/AccountBuildGradeCard.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import { toGoodKey, translateStatKey, getUiAssetUrl } from "$lib/utils";

  type GradedRow = {
    character: CharacterOwned;
    grade: AccountBuildGrade;
    sortName: string;
    nameId: string;
    href: string;
  };

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let tierError = $state<string | null>(null);
  let graded = $state<GradedRow[]>([]);
  let inventoryEmpty = $state(false);
  /** Session expand — once true, grades all owned until reload. */
  let gradeAll = $state(false);
  let tierRetry = $state(0);
  /** One selected card across the page. */
  let selectedNameId = $state<string | null>(null);
  /** Kit talent icons for selected characters (session cache). */
  let kitIconsByNameId = $state(
    new Map<string, InvestmentBuildKitIcons>(),
  );

  let owned = $derived($charactersOwned.filter((c) => c.isOwned));
  /** Stable effect key — ignore roster array identity churn from store rewrites. */
  let ownedFingerprint = $derived(
    owned
      .map((c) => c.name_id)
      .sort()
      .join("\0"),
  );

  /** Pulls “Most used” — limited + non-limited cream (default grade scope). */
  let creamIds = $derived(creamNameIds($tierList));
  let usageByNameId = $derived(creamUsageByNameId($tierList));
  let priorityOwnedCount = $derived(
    owned.filter((c) => creamIds.has(c.name_id)).length,
  );

  let sections = $derived.by(() => {
    const byBucket = new Map<AccountBuildBucket, GradedRow[]>();
    for (const bucket of ACCOUNT_BUILD_BUCKET_ORDER) {
      byBucket.set(bucket, []);
    }
    for (const row of graded) {
      byBucket.get(row.grade.bucket)?.push(row);
    }
    for (const bucket of ACCOUNT_BUILD_BUCKET_ORDER) {
      byBucket
        .get(bucket)
        ?.sort((a, b) => compareGradeRows(a, b, creamIds, usageByNameId));
    }
    return ACCOUNT_BUILD_BUCKET_ORDER.map((bucket) => ({
      bucket,
      label: ACCOUNT_BUILD_BUCKET_LABEL[bucket],
      rows: byBucket.get(bucket) ?? [],
    })).filter((section) => section.rows.length > 0);
  });

  let selectedRow = $derived(
    selectedNameId
      ? (graded.find((r) => r.nameId === selectedNameId) ?? null)
      : null,
  );

  let selectedKitTalents = $derived(
    selectedNameId
      ? (kitIconsByNameId.get(selectedNameId)?.talents ?? null)
      : null,
  );

  function expandToAllOwned() {
    gradeAll = true;
  }

  function retryTierList() {
    invalidateTierList();
    tierRetry += 1;
  }

  function toggleSelect(nameId: string) {
    selectedNameId = selectedNameId === nameId ? null : nameId;
  }

  function gradeFallbackSub(grade: AccountBuildGrade): string {
    if (grade.bucket === "ungraded") {
      if (grade.ungradedReason === "error") return "Couldn’t load Builds";
      if (grade.ungradedReason === "stale") return "Builds summary stale";
      return "No Builds summary";
    }
    if (grade.bucket === "built_well") {
      return "Level and talents match Builds targets";
    }
    return "Raise level or talents";
  }

  /** Lazy kit fetch for talent icons when a card is selected. */
  $effect(() => {
    if (!browser) return;
    const id = selectedNameId;
    if (!id) return;
    if (kitIconsByNameId.has(id)) return;

    let cancelled = false;
    const ac = new AbortController();
    const url = resolve(`/api/character-kit/${encodeURIComponent(id)}`);
    void fetch(url, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`kit ${res.status}`);
        return (await res.json()) as CharacterKit;
      })
      .then((kitJson) => {
        if (cancelled) return;
        const next = new Map(kitIconsByNameId);
        next.set(id, kitIconsFromCharacterKit(kitJson));
        kitIconsByNameId = next;
      })
      .catch(() => {
        /* strip still shows text without talent icons */
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  });

  $effect(() => {
    if (!browser) return;
    const fingerprint = ownedFingerprint;
    const expandAll = gradeAll;
    const retry = tierRetry;
    void fingerprint;
    void expandAll;
    void retry;

    const roster = untrack(() =>
      $charactersOwned.filter((c) => c.isOwned),
    );
    let cancelled = false;
    loading = true;
    loadError = null;
    tierError = null;

    void (async () => {
      try {
        const [weapons, artifacts] = await Promise.all([
          loadRosterWeapons(),
          loadRosterArtifacts(),
        ]);
        await ensureEquipmentData().catch(() => {});
        if (cancelled) return;

        inventoryEmpty = weapons.length === 0 && artifacts.length === 0;

        let toGrade = roster;
        if (!expandAll) {
          try {
            await ensureTierList();
          } catch (err) {
            if (cancelled) return;
            tierError =
              err instanceof Error
                ? err.message
                : "Could not load Stygian standouts";
            graded = [];
            return;
          }
          if (cancelled) return;
          const ids = creamNameIds(untrack(() => $tierList));
          toGrade = roster.filter((c) => ids.has(c.name_id));
        }

        let index = null as Awaited<ReturnType<typeof loadCharacterIndex>> | null;
        let indexError = false;
        try {
          index = await loadCharacterIndex();
        } catch {
          indexError = true;
        }
        if (cancelled) return;

        const rows: GradedRow[] = toGrade.map((character) => {
          const view = rosterBuildViewFromOwned(
            character,
            weapons,
            artifacts,
          );
          const summaryKey =
            view.locationKey || toGoodKey(character.name) || "";
          const builds = characterSummaryFromIndex(index, summaryKey);
          const grade = gradeOwnedBuild({
            view,
            builds,
            nameId: character.name_id,
            summaryError: indexError,
            getWeaponStars: (key) => weaponByKey.get(key)?.stars ?? 0,
            getWeaponName: (key) => weaponByKey.get(key)?.name ?? null,
            getSetName: (key) => artifactSetByKey.get(key)?.name ?? null,
            translateStat: translateStatKey,
          });
          return {
            character,
            grade,
            sortName: character.name ?? character.name_id,
            nameId: character.name_id,
            href: resolve(`/characters/${character.name_id}`),
          };
        });
        if (cancelled) return;
        graded = rows;
        if (
          selectedNameId &&
          !rows.some((r) => r.nameId === selectedNameId)
        ) {
          selectedNameId = null;
        }
      } catch (err) {
        if (cancelled) return;
        loadError = err instanceof Error ? err.message : String(err);
        graded = [];
      } finally {
        if (!cancelled) loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<PageShell class="gap-8 audit-page">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Audit</h1>
      <p class="page-meta">
        {#if gradeAll}
          All owned characters · {owned.length} graded.
        {:else if !loading && !tierError && owned.length > 0}
          Stygian most-used · {priorityOwnedCount} of {owned.length} owned.
        {:else}
          See which owned characters meet Builds level and talent targets.
        {/if}
      </p>
    </div>
    {#if !gradeAll && !loading && !tierError && graded.length > 0}
      <Button variant="secondary" onclick={expandToAllOwned}
        >Grade all owned</Button
      >
    {/if}
  </header>

  {#if loading}
    <LoadingState message="Grading owned builds…" />
  {:else if tierError && !gradeAll}
    <EmptyState message="Could not load Stygian standouts right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryTierList}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else if loadError}
    <EmptyState message={loadError ?? "Couldn’t load inventory"} />
  {:else if owned.length === 0}
    <EmptyState message="No owned characters yet.">
      {#snippet action()}
        <a class="back-link" href="{settingsPath}?tab=roster">Open Roster</a>
      {/snippet}
    </EmptyState>
  {:else if !gradeAll && graded.length === 0}
    <EmptyState
      message="None of your owned characters are on the Stygian most-used boards."
    >
      {#snippet action()}
        <Button variant="secondary" onclick={expandToAllOwned}
          >Grade all owned</Button
        >
      {/snippet}
    </EmptyState>
  {:else}
    {#if inventoryEmpty}
      <p class="section-lede">
        No weapons or artifacts imported yet — gear tips stay soft until then.
        <a class="inline-link" href="{settingsPath}?tab=account">Import GOOD</a>
        or browse
        <a class="inline-link" href="{settingsPath}?tab=inventory">Inventory</a>.
      </p>
    {/if}

    {#each sections as section (section.bucket)}
      <section class="grade-section">
        <div class="section-head">
          <h2 class="section-title">{section.label}</h2>
          <p class="section-lede">
            {#if section.bucket === "built_well"}
              Level and talents meet Builds targets.
            {:else if section.bucket === "needs_work"}
              Stygian most-used first, then highest avg usage — raise level,
              ascension, or talents.
            {:else}
              No usable Builds summary to grade against.
            {/if}
          </p>
        </div>

        <ul class="grade-grid">
          {#each section.rows as row (row.character.name_id)}
            <li>
              <AccountBuildGradeCard
                character={row.character}
                grade={row.grade}
                pressed={selectedNameId === row.nameId}
                standout={creamIds.has(row.nameId)}
                onclick={() => toggleSelect(row.nameId)}
              />
            </li>
          {/each}
        </ul>
        {#if selectedRow && section.rows.some((r) => r.nameId === selectedRow.nameId)}
          <div class="select-strip">
            <div class="select-strip-text">
              <span class="meta-name">{selectedRow.character.name}</span>
              {#if selectedRow.grade.adviceSteps.length > 0}
                <ul class="advice-list">
                  {#each selectedRow.grade.adviceSteps as step (`${step.kind}-${step.current}-${step.target}`)}
                    {@const iconSrc = adviceStepIconSrc(
                      step.kind,
                      selectedKitTalents,
                      getUiAssetUrl,
                    )}
                    <li class="advice-step">
                      {#if iconSrc}
                        <img
                          class="advice-icon"
                          src={iconSrc}
                          alt=""
                          loading="lazy"
                        />
                      {/if}
                      <span class="meta-sub">{formatAdviceStep(step)}</span>
                    </li>
                  {/each}
                </ul>
              {:else if selectedRow.grade.advice.length > 0}
                <ul class="advice-list">
                  {#each selectedRow.grade.advice as line (line)}
                    <li class="meta-sub">{line}</li>
                  {/each}
                </ul>
              {:else}
                <span class="meta-sub"
                  >{gradeFallbackSub(selectedRow.grade)}</span
                >
              {/if}
              {#if selectedRow.grade.aside.length > 0}
                <p class="aside-line">
                  Also · {selectedRow.grade.aside.join(" · ")}
                </p>
              {/if}
            </div>
            <a class="back-link" href={selectedRow.href}>Open character</a>
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  :global(.audit-page) {
    max-width: 64rem;
  }

  .section-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .grade-section + .grade-section {
    margin-top: var(--space-6);
  }

  .grade-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: var(--space-3);
  }

  .select-strip {
    margin-top: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .select-strip-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1 1 12rem;
  }

  .advice-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .advice-step {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .advice-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    object-fit: contain;
  }

  .aside-line {
    margin: 0.15rem 0 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
    line-height: 1.35;
  }

  .inline-link {
    color: var(--foreground-color);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .inline-link:hover {
    color: color-mix(in srgb, var(--foreground-color) 80%, white);
  }
</style>
