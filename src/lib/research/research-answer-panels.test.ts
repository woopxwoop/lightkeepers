import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indexResearchEntities } from "./research-answer.ts";
import {
  buildComparisonSides,
  buildErRows,
  buildLineupCards,
  buildRankRows,
  buildRotationView,
  formatErRange,
  researchPanelsCiteBlob,
} from "./research-answer-panels.ts";
import type { ResearchEntity } from "./research-types.ts";

const xingqiu: ResearchEntity = {
  key: "char:Xingqiu",
  type: "character",
  label: "Xingqiu",
  name_id: "Xingqiu",
};

const homa: ResearchEntity = {
  key: "weapon:StaffOfHoma",
  type: "weapon",
  label: "Staff of Homa",
  weapon_key: "StaffOfHoma",
};

const emblem: ResearchEntity = {
  key: "set:EmblemOfSeveredFate",
  type: "artifact_set",
  label: "Emblem of Severed Fate",
  set_key: "EmblemOfSeveredFate",
};

const index = indexResearchEntities([xingqiu, homa, emblem]);
const inline = (text: string) => `<i>${text}</i>`;
const citeSups = (ids: number[] | undefined) => (ids ?? []).join(",");

describe("researchPanelsCiteBlob", () => {
  it("is empty without panels", () => {
    assert.deepEqual(researchPanelsCiteBlob({}), []);
  });

  it("lists panel text and cite tokens in reading order", () => {
    const blob = researchPanelsCiteBlob({
      comparison: {
        verdict: "V",
        option_a: { label: "A", summary: "SA", bullets: ["a1"] },
        option_b: { label: "B", summary: "SB", bullets: ["b1", "b2"] },
      },
      teams: [{ label: "T", members: [], notes: "N", citation_ids: [1] }],
      weapon_ranks: [{ rank: 1, key: "W", note: "WN", citation_ids: [2] }],
      artifact_ranks: [{ rank: 1, key: "S", citation_ids: [3] }],
      er_targets: [{ name_id: "X", context: "C", citation_ids: [4] }],
      rotation: { steps: ["s1", "s2"], notes: "RN", citation_ids: [5] },
    });
    assert.deepEqual(blob, [
      "V",
      "A",
      "SA",
      "B",
      "SB",
      "a1",
      "b1",
      "b2",
      "T",
      "N",
      "[[cite:1]]",
      "WN",
      "[[cite:2]]",
      "[[cite:3]]",
      "C",
      "[[cite:4]]",
      "s1",
      "s2",
      "RN",
      "[[cite:5]]",
    ]);
  });

  it("skips empty lists and unsafe cite ids", () => {
    const blob = researchPanelsCiteBlob({
      teams: [],
      er_targets: [{ name_id: "X", citation_ids: [-1, 7] }],
    });
    assert.deepEqual(blob, ["[[cite:7]]"]);
  });
});

describe("buildComparisonSides", () => {
  it("is empty without a comparison", () => {
    assert.deepEqual(buildComparisonSides(null, inline), []);
  });

  it("renders both sides inline", () => {
    const sides = buildComparisonSides(
      {
        verdict: "V",
        option_a: { label: "A", summary: "SA", bullets: ["a1"] },
        option_b: { label: "B", summary: "SB" },
      },
      inline,
    );
    assert.deepEqual(sides, [
      {
        key: "a",
        labelHtml: "<i>A</i>",
        summaryHtml: "<i>SA</i>",
        bullets: ["<i>a1</i>"],
      },
      {
        key: "b",
        labelHtml: "<i>B</i>",
        summaryHtml: "<i>SB</i>",
        bullets: [],
      },
    ]);
  });
});

describe("buildLineupCards", () => {
  it("is empty without teams", () => {
    assert.deepEqual(
      buildLineupCards(null, index, new Map(), inline, citeSups),
      [],
    );
  });

  it("builds hand, members and gear from the entity index", () => {
    const characterMap = new Map([["Xingqiu", { name: "Xingqiu" }]]);
    const [card] = buildLineupCards(
      [
        {
          label: "Hyper",
          members: ["Xingqiu", "Unknown"],
          weapon: "Staff of Homa (R1)",
          artifact_set: "Emblem of Severed Fate",
          notes: "N",
          citation_ids: [3],
        },
      ],
      index,
      characterMap,
      inline,
      citeSups,
    );
    assert.equal(card.key, "0-Hyper");
    assert.deepEqual(card.hand, [{ name: "Xingqiu" }, undefined]);
    assert.equal(card.hasPortraits, true);
    assert.deepEqual(card.members, [
      { id: "Xingqiu", entity: xingqiu, label: "Xingqiu" },
      { id: "Unknown", entity: null, label: "Unknown" },
    ]);
    assert.equal(card.weaponEntity, homa);
    assert.equal(card.setEntity, emblem);
    assert.equal(card.notesHtml, "<i>N</i>");
    assert.equal(card.citeHtml, "3");
  });

  it("flags lineups with no known portraits", () => {
    const [card] = buildLineupCards(
      [{ label: "T", members: ["Nobody"] }],
      index,
      new Map(),
      inline,
      citeSups,
    );
    assert.equal(card.hasPortraits, false);
    assert.equal(card.weaponEntity, null);
    assert.equal(card.notesHtml, null);
  });
});

describe("buildRankRows", () => {
  it("resolves gear entities per kind", () => {
    const rows = buildRankRows(
      [
        { rank: 1, key: "StaffOfHoma", note: "best", citation_ids: [1] },
        { rank: 2, key: "Mystery" },
      ],
      "weapon",
      index,
      inline,
      citeSups,
    );
    assert.deepEqual(rows, [
      {
        key: "weapon-0-1-StaffOfHoma",
        rank: 1,
        entity: homa,
        label: "StaffOfHoma",
        noteHtml: "<i>best</i>",
        citeHtml: "1",
      },
      {
        key: "weapon-1-2-Mystery",
        rank: 2,
        entity: null,
        label: "Mystery",
        noteHtml: null,
        citeHtml: "",
      },
    ]);
  });

  it("is empty for null or empty lists", () => {
    assert.deepEqual(buildRankRows(null, "set", index, inline, citeSups), []);
    assert.deepEqual(buildRankRows([], "set", index, inline, citeSups), []);
  });
});

describe("formatErRange", () => {
  it("formats ranges, single bounds and unknowns", () => {
    assert.equal(
      formatErRange({ name_id: "X", min_er: 160, max_er: 200 }),
      "160–200%",
    );
    assert.equal(
      formatErRange({ name_id: "X", min_er: 180, max_er: 180 }),
      "180%",
    );
    assert.equal(formatErRange({ name_id: "X", min_er: 140 }), "140%");
    assert.equal(formatErRange({ name_id: "X", max_er: 220 }), "220%");
    assert.equal(formatErRange({ name_id: "X" }), "—");
  });
});

describe("buildErRows", () => {
  it("labels by character entity, falling back to name_id", () => {
    const rows = buildErRows(
      [
        { name_id: "Xingqiu", min_er: 180, context: "C", citation_ids: [2] },
        { name_id: "Other" },
      ],
      index,
      inline,
      citeSups,
    );
    assert.deepEqual(rows, [
      {
        key: "0-Xingqiu",
        entity: xingqiu,
        label: "Xingqiu",
        range: "180%",
        contextHtml: "<i>C</i>",
        citeHtml: "2",
      },
      {
        key: "1-Other",
        entity: null,
        label: "Other",
        range: "—",
        contextHtml: null,
        citeHtml: "",
      },
    ]);
  });
});

describe("buildRotationView", () => {
  it("is null without steps", () => {
    assert.equal(buildRotationView(null, inline, citeSups), null);
    assert.equal(buildRotationView({ steps: [] }, inline, citeSups), null);
  });

  it("renders steps, notes and cites", () => {
    assert.deepEqual(
      buildRotationView(
        { steps: ["E", "Q"], notes: "N", citation_ids: [4] },
        inline,
        citeSups,
      ),
      { steps: ["<i>E</i>", "<i>Q</i>"], notesHtml: "<i>N</i>", citeHtml: "4" },
    );
  });
});
