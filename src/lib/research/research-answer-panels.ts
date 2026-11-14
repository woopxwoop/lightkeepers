/**
 * View rows for ResearchAnswer's structured panels (comparison, teams, ranks,
 * ER, rotation). Inline markdown rendering and cite superscripts are passed
 * in, so every panel shares the answer's cite numbering.
 */

import { handCharactersFromMembers } from "#lib/boards/character-teams.js";
import {
  citeTokens,
  rankItemsBlob,
  resolveGearEntity,
  type ResearchEntityIndex,
} from "#lib/research/research-answer.js";
import type {
  ResearchComparison,
  ResearchEntity,
  ResearchErTarget,
  ResearchRankItem,
  ResearchRotation,
  ResearchTeamLineup,
} from "#lib/research/research-types.js";

/** Inline research markdown → HTML (entity slots + cite superscripts). */
export type RenderInline = (text: string) => string;

/** A row's citation ids → superscript links HTML. */
export type RenderCiteSups = (ids: number[] | undefined) => string;

export type ResearchPanelsInput = {
  comparison?: ResearchComparison | null;
  teams?: ResearchTeamLineup[] | null;
  weapon_ranks?: ResearchRankItem[] | null;
  artifact_ranks?: ResearchRankItem[] | null;
  er_targets?: ResearchErTarget[] | null;
  rotation?: ResearchRotation | null;
};

function comparisonBlob(c: ResearchComparison): string[] {
  const parts = [
    c.verdict,
    c.option_a.label,
    c.option_a.summary,
    c.option_b.label,
    c.option_b.summary,
  ];
  for (const side of [c.option_a, c.option_b]) {
    for (const b of side.bullets ?? []) parts.push(b);
  }
  return parts;
}

function teamsBlob(list: ResearchTeamLineup[]): string[] {
  return list.flatMap((t) => [
    t.label,
    ...(t.notes ? [t.notes] : []),
    ...citeTokens(t.citation_ids),
  ]);
}

function erBlob(list: ResearchErTarget[]): string[] {
  return list.flatMap((t) => [
    ...(t.context ? [t.context] : []),
    ...citeTokens(t.citation_ids),
  ]);
}

function rotationBlob(r: ResearchRotation): string[] {
  return [
    ...r.steps,
    ...(r.notes ? [r.notes] : []),
    ...citeTokens(r.citation_ids),
  ];
}

/** Panel text in reading order, for footnote numbering after the markdown. */
export function researchPanelsCiteBlob(p: ResearchPanelsInput): string[] {
  return [
    ...(p.comparison ? comparisonBlob(p.comparison) : []),
    ...(p.teams?.length ? teamsBlob(p.teams) : []),
    ...(p.weapon_ranks?.length ? rankItemsBlob(p.weapon_ranks) : []),
    ...(p.artifact_ranks?.length ? rankItemsBlob(p.artifact_ranks) : []),
    ...(p.er_targets?.length ? erBlob(p.er_targets) : []),
    ...(p.rotation ? rotationBlob(p.rotation) : []),
  ];
}

export type ComparisonSideView = {
  key: "a" | "b";
  labelHtml: string;
  summaryHtml: string;
  bullets: string[];
};

export function buildComparisonSides(
  comparison: ResearchComparison | null | undefined,
  inline: RenderInline,
): ComparisonSideView[] {
  if (!comparison) return [];
  return [
    { key: "a" as const, side: comparison.option_a },
    { key: "b" as const, side: comparison.option_b },
  ].map(({ key, side }) => ({
    key,
    labelHtml: inline(side.label),
    summaryHtml: inline(side.summary),
    bullets: (side.bullets ?? []).map((b) => inline(b)),
  }));
}

export type LineupMemberView = {
  id: string;
  entity: ResearchEntity | null;
  label: string;
};

export type LineupCardView<T> = {
  key: string;
  label: string;
  hand: (T | undefined)[];
  hasPortraits: boolean;
  members: LineupMemberView[];
  weaponEntity: ResearchEntity | null;
  weaponLabel: string | null | undefined;
  setEntity: ResearchEntity | null;
  setLabel: string | null | undefined;
  notesHtml: string | null;
  citeHtml: string;
};

export function buildLineupCards<T>(
  teams: ResearchTeamLineup[] | null | undefined,
  entityIndex: ResearchEntityIndex,
  characterMap: Map<string, T>,
  inline: RenderInline,
  citeSups: RenderCiteSups,
): LineupCardView<T>[] {
  if (!teams?.length) return [];
  return teams.map((team, idx) => {
    const hand = handCharactersFromMembers(team.members, characterMap);
    const hasPortraits = hand.some((c) => c != null);
    const members = team.members.map((id) => {
      const ent = entityIndex.byNameId.get(id);
      return {
        id,
        entity: ent ?? null,
        label: ent?.label ?? id,
      };
    });
    return {
      key: `${idx}-${team.label}`,
      label: team.label,
      hand,
      hasPortraits,
      members,
      weaponEntity: resolveGearEntity(entityIndex, "weapon", [
        team.weapon_key,
        team.weapon,
      ]),
      weaponLabel: team.weapon,
      setEntity: resolveGearEntity(entityIndex, "set", [
        team.set_key,
        team.artifact_set,
      ]),
      setLabel: team.artifact_set,
      notesHtml: team.notes ? inline(team.notes) : null,
      citeHtml: citeSups(team.citation_ids),
    };
  });
}

export type RankRowView = {
  key: string;
  rank: number;
  entity: ResearchEntity | null;
  label: string;
  noteHtml: string | null;
  citeHtml: string;
};

export function buildRankRows(
  list: ResearchRankItem[] | null | undefined,
  kind: "weapon" | "set",
  entityIndex: ResearchEntityIndex,
  inline: RenderInline,
  citeSups: RenderCiteSups,
): RankRowView[] {
  if (!list?.length) return [];
  return list.map((row, idx) => {
    const entity = resolveGearEntity(entityIndex, kind, [row.key]);
    return {
      key: `${kind}-${idx}-${row.rank}-${row.key}`,
      rank: row.rank,
      entity,
      label: row.key,
      noteHtml: row.note ? inline(row.note) : null,
      citeHtml: citeSups(row.citation_ids),
    };
  });
}

export function formatErRange(t: ResearchErTarget): string {
  const min = t.min_er;
  const max = t.max_er;
  if (min != null && max != null && min !== max) return `${min}–${max}%`;
  if (min != null) return `${min}%`;
  if (max != null) return `${max}%`;
  return "—";
}

export type ErRowView = {
  key: string;
  entity: ResearchEntity | null;
  label: string;
  range: string;
  contextHtml: string | null;
  citeHtml: string;
};

export function buildErRows(
  targets: ResearchErTarget[] | null | undefined,
  entityIndex: ResearchEntityIndex,
  inline: RenderInline,
  citeSups: RenderCiteSups,
): ErRowView[] {
  if (!targets?.length) return [];
  return targets.map((t, idx) => {
    const ent = entityIndex.byNameId.get(t.name_id);
    return {
      key: `${idx}-${t.name_id}`,
      entity: ent ?? null,
      label: ent?.label ?? t.name_id,
      range: formatErRange(t),
      contextHtml: t.context ? inline(t.context) : null,
      citeHtml: citeSups(t.citation_ids),
    };
  });
}

export type RotationViewModel = {
  steps: string[];
  notesHtml: string | null;
  citeHtml: string;
};

export function buildRotationView(
  rotation: ResearchRotation | null | undefined,
  inline: RenderInline,
  citeSups: RenderCiteSups,
): RotationViewModel | null {
  if (!rotation?.steps?.length) return null;
  return {
    steps: rotation.steps.map((s) => inline(s)),
    notesHtml: rotation.notes ? inline(rotation.notes) : null,
    citeHtml: citeSups(rotation.citation_ids),
  };
}
