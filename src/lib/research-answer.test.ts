import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  citationShortLabel,
  entityHref,
  orderCitationsForDisplay,
  renderEntityChip,
  renderResearchAnswer,
} from "./research-answer.ts";
import type { ResearchCitation, ResearchEntity } from "./research-types.ts";

const xqC6: ResearchEntity = {
  key: "c:Xingqiu:6",
  type: "constellation",
  label: "Xingqiu C6",
  name_id: "Xingqiu",
  index: 6,
  kit_ref: "T256",
  icon: "UI_Talent_S_Xingqiu_04",
  description: "Energy related.",
};

const homa: ResearchEntity = {
  key: "weapon:StaffOfHoma",
  type: "weapon",
  label: "Staff of Homa",
  weapon_key: "StaffOfHoma",
  icon: "UI_EquipIcon_Pole_Homa",
};

const cite2297: ResearchCitation = {
  id: 2297,
  title: "Hu Tao Guide",
  url: "https://keqingmains.com/hu-tao/",
  source_tier: "guide",
  publisher: "KeqingMains",
  heading_path: "FAQ > C1",
  quote: "C0 with R1 Homa has a similar damage ceiling…",
};

describe("research answer embeddings", () => {
  it("entityHref deep-links kit refs", () => {
    assert.equal(entityHref(xqC6), "/characters/Xingqiu#kit-T256");
    assert.equal(entityHref(homa), null);
  });

  it("renderEntityChip includes icon and label", () => {
    const html = renderEntityChip(xqC6);
    assert.match(html, /research-entity-constellation/);
    assert.match(html, /Xingqiu C6/);
    assert.match(html, /UI_Talent_S_Xingqiu_04/);
    assert.match(html, /#kit-T256/);
  });

  it("renderResearchAnswer hydrates entity tokens and strips unknowns", () => {
    const html = renderResearchAnswer(
      "Take [[c:Xingqiu:6]] with [[weapon:NotReal]] and **bold**.",
      [xqC6],
      [],
    );
    assert.match(html, /research-entity-constellation/);
    assert.match(html, /Xingqiu C6/);
    assert.match(html, /NotReal/);
    assert.doesNotMatch(html, /\[\[/);
    assert.match(html, /<strong>bold<\/strong>/);
  });

  it("renderResearchAnswer hydrates cite superscripts", () => {
    const html = renderResearchAnswer(
      "Combo DPS gain ~20% [[cite:2297]].",
      [],
      [cite2297],
    );
    assert.match(html, /research-cite/);
    assert.match(html, /#research-cite-2297/);
    assert.match(html, />1</);
    assert.doesNotMatch(html, /\[\[cite:/);
  });

  it("renderEntityChip escapes label and description HTML", () => {
    const nasty: ResearchEntity = {
      key: "char:X",
      type: "character",
      label: `Foo<"bar">`,
      name_id: "Xingqiu",
      description: `desc <script>alert(1)</script> "x"`,
    };
    const html = renderEntityChip(nasty);
    assert.doesNotMatch(html, /<script/);
    assert.match(html, /Foo&lt;"bar"&gt;/);
    assert.match(
      html,
      /title="desc &lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;x&quot;"/,
    );
  });

  it("renderResearchAnswer strips unknown cite tokens", () => {
    const html = renderResearchAnswer(
      "Before [[cite:999]] after.",
      [],
      [cite2297],
    );
    assert.match(html, /Before/);
    assert.match(html, /after/);
    assert.doesNotMatch(html, /cite:999/);
    assert.doesNotMatch(html, /\[\[/);
  });

  it("orderCitationsForDisplay follows markdown appearance", () => {
    const c2 = { ...cite2297, id: 2300 };
    const ordered = orderCitationsForDisplay(
      [cite2297, c2],
      "First [[cite:2300]] then [[cite:2297]].",
    );
    assert.deepEqual(
      ordered.map((c) => c.id),
      [2300, 2297],
    );
  });

  it("citationShortLabel prefers heading leaf", () => {
    assert.equal(citationShortLabel(cite2297), "KeqingMains · C1");
  });

  it("renderResearchAnswer hydrates legacy bracket cites", () => {
    const html = renderResearchAnswer(
      "Particles [2316].",
      [],
      [{ ...cite2297, id: 2316 }],
    );
    assert.match(html, /research-cite/);
    assert.match(html, /#research-cite-2316/);
  });
});
