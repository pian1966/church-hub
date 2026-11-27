# Pastoral visits – the part for Opus

**Model: Senior (Opus).** New collections, `firestore.rules`, `js/store.js` and who may read or write them: by `docs/architecture/MODELS.md`
rule 1 a lighter model must not do this. Sonnet builds the screens and the map (`visits-sonnet.md`) on the same branch once the data layer exists.
Read `docs/PASTORAL-VISITS-PLAN.md` first: every question in it is decided. Also read the **Care board, Seriously ill list and Visit notes**
in `docs/ROADMAP.md` (Phase 2): they are the same records – do not build a second visits system.

## Paste this to Opus
> You are working on Church & Trellis (read `CLAUDE.md`, `docs/architecture/MODELS.md`, `docs/POPIA.md`, `docs/PASTORAL-VISITS-PLAN.md`, and
> `js/care.js` / `js/mod-care.js` for how Care Groups and their leaders are modelled). Work on your own branch from the latest `main`
> (check it – the church asks every time before pushing). Say which tier you are running at.
>
> 1. **Data** (shapes in the plan; nothing here holds real people or places):
>    - `visits/{id}`, `visitPlaces/{id}` and the settings `carers`, `visitsMonths`, `visitsMap`, `visitsKeep`.
>    - Store `writerRole` on every visit (set by the rules/store from the writer's real role, **not** trusted from the client) so a Care
>      Group leader can be refused notes written by a pastor.
>    - If the Care board / Seriously ill list has no data layer yet, design `visits` so those records reuse it (a visit of kind
>      "Hospital visit" on a person on the list **is** a visit note); note what you chose.
> 2. **Rules** (`firestore.rules`, `plan()` and the COLLECTIONS in `js/store.js`, the POLICY copy in `tests/fake-firebase.js`,
>    `tests/rules.test.mjs`, and `js/access.js` – a new `PARTS` entry `visits` with permissions and the job `carers`; keep
>    `firestore.rules` to plain keyboard characters). **Enforce in the rules, not only on screen:**
>    - **Create**: Administrators, Pastors, Roster coordinators, Children's ministry (anyone); a Care Group leader only for people in
>      their own Care Group; a Pastoral care worker only within their scope; a Council member for any person, as themselves (`createdBy`
>      and `by` include them). Never as someone else; never with `writerRole` forged.
>    - **Read the fact**: pastors and pastoral staff, all; the Care Group leader, their group's people; the visitor, their own;
>      the church secretary, visits of people on the Seriously ill list. **Read the note** by `noteLevel`: level 1 – the pastoral team
>      (and the visitor); level 2 – Care Group leader of that person and pastors; level 3 – pastors only. **A Care Group leader never reads a
>      note whose `writerRole` is 'pastor'.** If one document can't hide a field, split the note into `visitNotes/{id}` with its own rules
>      (preferred – decide and document).
>    - **Council** reads **no** visit documents; give them totals through a derived summary document (counts only, written by the app for
>      Administrators/pastors, or computed from allowed data) – decide and document so no names or notes reach them. A Council member
>      who wrote a visit reads their own.
>    - Members, attendees, everyone else: nothing.
>    - **Edit/void**: the visitor may edit their own visit for a short window (say 24 hours); after that only a void with a reason by the
>      visitor, a pastor or an Administrator. No client deletes. `voided` is never cleared except by a pastor.
>    - `visitPlaces`, `carers`, `visitsMonths`, `visitsMap`, `visitsKeep`: written only by Administrators, the Rector and (places) pastors; log changes.
> 3. **Store**: load visits only for those who may read them (so nobody else downloads them; keep them out of the offline copy for others);
>    keep notes out of lists that don't need them. Add the new kinds to `History.COVER` and the `okHist` lists so Undo and Version history
>    cover them. `purge` of a person: anonymise or remove per `docs/POPIA.md` and the retention rule (kept while a member, then archived for
>    `visitsKeep`, unless the person asks for deletion; keep what safeguarding requires – decide, document).
> 4. **The pure rules file `js/visits.js`** (tested in `tests/visits.test.js`, added to the CLAUDE.md list of rules files): who may read a
>    given visit/note (the function Sonnet's screens and the rules tests both use), last-visited per person and household, "not visited in
>    N months", coverage per Care Group, load per visitor, follow-ups due, Church health lines, and an **area-only** coordinate fuzzer
>    (round to a sensible grid) for the map setting. One source of truth: the screens must not re-implement visibility.
> 5. **POPIA** (`docs/POPIA.md`, new section "Pastoral visits"): purpose, lawful basis and consent, who sees what, note levels, retention,
>    the right to ask what is recorded and for deletion, safeguarding exception, the area-only/off map setting.
> 6. **Tests**: rules (a Care Group leader cannot read a pastor's note; cannot read visits outside their group; a pastor reads all; level 3
>    only pastors; Council reads no names or notes; a member reads nothing; a visitor cannot forge `createdBy` or `writerRole`; edits after
>    the window are refused; no delete), the fake-firebase copy, and the pure tests.
> 7. **Release work** from `CLAUDE.md` for your part (Sonnet finishes the screens, words, help, brochure, presentation, NEWS and setup tool):
>    raise the version, `node tools/stamp-files.js`, run the **full browser test** before pushing (this changes who sees what), and tick or add
>    lines in `docs/ROADMAP.md`. If the church has not set up `docs/RULES-AUTOPUBLISH.md`, give them **both links**: the `firestore.rules` file
>    (https://raw.githubusercontent.com/pian1966/church-hub/main/firestore.rules) and the Firebase rules page
>    (https://console.firebase.google.com/project/church-hub-7ec02/firestore/databases/-default-/security/rules).
> Never put real names, notes, addresses, places or keys in the repository. Finish by listing the new English lines in
> `docs/architecture/handover/visits-words.md` (MODELS.md rule 2).

## Details to settle while building (use the plan's intent; note what you chose)
- One `visits` document with field hiding vs a separate `visitNotes` collection (suggest: separate).
- How Council totals are produced without exposing names (suggest: a counts-only summary document).
- The edit window for a visitor's own visit (suggest: 24 hours).
- Whether the secretary sees notes (suggest: only at level 1, and only for people on the Seriously ill list).
