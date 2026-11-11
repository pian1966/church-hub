# 050 – Guides, brochure, terms, roadmap

**Model:** Light.

**Goal:** the written material matches how it now works.

**Files:** `docs/ROADMAP.md` (rewrite Phase 7 from `DECISION.md`; keep "The yearly gift" and "Decisions waiting",
remove "Who runs it" as an operator question and re-ask it only for receiving gifts), `docs/CHANGELOG.md`,
`docs/FIREBASE-SETUP.md` (title it "Setting up by hand – only if the helper can't"), `docs/ARCHITECTURE.md`
("Hosting", "Layers"), `docs/POPIA.md` (each church is the responsible party; Church Hub's author holds nothing),
`brochure.html` (other-churches panel: "set up in a minute, your information stays in your own Google account";
no prices; set `reviewed-for`), a short `terms.html` (plain words; flagged for a lawyer – `RISKS.md` R8),
`README.md`.

**Acceptance:** `node tests/versions.test.js` and the quick tests pass; nothing claims what the app does not do.
