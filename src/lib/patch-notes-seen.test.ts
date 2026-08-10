import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowPatchNotesPopup } from "./patch-notes-seen.ts";

describe("patch notes seen", () => {
  it("shows when nothing has been seen yet", () => {
    assert.equal(
      shouldShowPatchNotesPopup("2026-08-10-roster-hotfix", null),
      true,
    );
  });

  it("shows when a newer slug exists", () => {
    assert.equal(
      shouldShowPatchNotesPopup(
        "2026-08-11-next",
        "2026-08-10-roster-hotfix",
      ),
      true,
    );
  });

  it("hides when the latest slug was already seen", () => {
    assert.equal(
      shouldShowPatchNotesPopup(
        "2026-08-10-roster-hotfix",
        "2026-08-10-roster-hotfix",
      ),
      false,
    );
  });

  it("hides when there is no latest note", () => {
    assert.equal(shouldShowPatchNotesPopup(null, null), false);
    assert.equal(shouldShowPatchNotesPopup("", "x"), false);
  });
});
