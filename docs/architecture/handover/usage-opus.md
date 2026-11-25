# Usage dashboard – the part for Opus

**Model: Senior (Opus).** Sonnet built the page (0.118.0). Recording usage means a new collection, `firestore.rules`, `js/store.js`
and who may read it, so by `docs/architecture/MODELS.md` rule 1 a lighter model must not do it. **Two decisions are waiting for the
Rector (below): ask him before building the parts that depend on them.**

## What is already built (Sonnet, 0.118.0)
- `js/usage.js` – pure rules, tested in `tests/usage.test.js`: adoption (who is on / invited / not invited, Church Partners and everyone
  else; adults only), who is on right now (opened in the last 5 minutes), active today / 7 / 30 days, growth by week, versions,
  platforms, busiest weekdays, most used parts. Also `Usage.demo()` – made-up usage for the demo.
- `js/mod-usage.js`, `css/usage.css`, `js/i18n/usage.js` + `js/lang/st.js` – the **Usage** page (menu entry for Administrators and Pastors,
  `roles: ['admin', 'pastor']`), `docs/help/usage.md`, browser test `tests/app/usage.js`.
- Today the page reads `Store.list('appUse')` in a `try`. Without records it still shows **who is on the app** and **growth** (from
  `people.appFirstSeen`, which already exists) and says "Nothing recorded yet" on the other cards. **Nothing writes `appUse` yet.**
  No rule, `js/access.js`, `firestore.rules` or `js/store.js` was changed.

## Uptake level per person (added 25 Nov 2026, Sonnet)
The Rector asked for a rating per person, from "hasn't taken up the app" to "power user", seen only by Administrators and Pastors. Built as a
**five-dot meter with a word** (Not on the app yet · Just started · Getting going · Regular · Keen · Power user) rather than stars – stars read like a
mark out of five, the word says what it means. `Usage.level()` in `js/usage.js` works it out from the same `appUse` record (days opened in the last 28
days, number of different parts, first opened, last seen; rules in its comment, tested). It is shown on the Usage page ("How much people use it":
the spread, "Might need a nudge" for people slipping away, and a list of everyone) and on a person's page beside "Using Church & Trellis since"
(`UsageUI.meter`, gated by `H.can('*') || H.can('people.view')`). Not shown to the person, never used to message anyone automatically. Until
`appUse` has records it shows only "On the app". Because a rating is a conclusion about a person, Opus must treat it as personal information in
the POPIA section (purpose: pastoral care and inviting; only Administrators and Pastors; derived, not stored – it is worked out on the device).

## The record the page expects: `appUse/{personId}`
```
{ id: <personId>, firstSeen: 'YYYY-MM-DD', lastSeen: 'YYYY-MM-DDTHH:MM:SSZ', version: '0.118.0',
  platform: 'android' | 'app' | 'browser',     // the Android app, the web app added to the home screen (display-mode: standalone), a browser
  days: { 'YYYY-MM-DD': { n: <sessions that day>, v: { <module id>: <times opened> } } } }   // last 35 days only (Usage.KEEP)
```
One document per person (not per device); counts only, no pages, searches, names or content. `v` keys are `Hub.register` ids.

## Paste this to Opus
> You are working on Church & Trellis (read `CLAUDE.md`, then `docs/architecture/MODELS.md`, and `docs/POPIA.md`). Work on your own branch from the
> latest `main` (check that, as the church asks every time before pushing). Read `docs/architecture/handover/usage-opus.md` first.
>
> 1. **Rules and the data layer** (change together, as `CLAUDE.md` says: `firestore.rules`, `plan()` and COLLECTIONS in `js/store.js`, the POLICY
>    copy in `tests/fake-firebase.js`, `tests/rules.test.mjs`, `js/access.js` if you add a permission such as `usage.view`):
>    - `appUse/{personId}`: a signed-in person may create and update **only their own** document (`mine(id)`), with exactly the fields above, `version`
>      like `n.n.n`, `platform` in the three values, `days` at most 35 keys, each `v` key a known module id and each count a small whole number.
>      Never a field that holds a name, address, page or search text.
>    - **Read: Administrators and Pastors only** (not Roster coordinators, Children's ministry or members – not even their own). `Store` must load it
>      only for those two roles (so nobody else downloads it) and keep it out of the offline copy for others. No client delete; deleting a person
>      (`purge`) removes their `appUse` record, and so does marking someone as left after the retention period (see Privacy → Retention).
>    - Keep `firestore.rules` to plain keyboard characters.
> 2. **The writer** (a small new file, `js/usage-record.js`, loaded after `js/store.js`; keep the rules in `js/usage.js` pure and tested):
>    - When the app is open and visible, write at most **one write every 4 minutes** (the page treats 5 minutes as "on right now"), when the page is shown
>      again, and not at all when the tab is hidden or offline. Church & Trellis is meant to be gentle on data: batch the section counts you
>      have gathered into that one write; never write on every click.
>    - Count a part when the router opens it (module id only – not sub-pages, not Home, nothing typed). Add one session per day on the first open of the day.
>      Drop days older than 35 days on each write. `firstSeen` is set once.
>    - Not for the demo, not for "View as" (`Store.preview()`), not for a signed-out device, not when the person chose not to be counted (decision 2).
>    - `platform`: the Android app (see `docs/ANDROID.md` for how the wrapper is recognised), else `display-mode: standalone` → `app`, else `browser`.
>    - `version` is `ChurchHubVersion.version`.
> 3. **POPIA** (`docs/POPIA.md`, a new section "Usage"): purpose (the church knows who has not started so it can invite and help them, which parts are
>    worth improving, and whether people need to update), lawful basis, who sees what (above), what is kept (35 days of counts and the last time seen),
>    deletion, and the wording in Privacy and on Me → the person's own page ("Church & Trellis notes when you last opened it and which parts. Only
>    Administrators and Pastors can see this."). Add it to the church's privacy notice texts.
> 4. **Tests**: rules (own record only; others and members refused; Pastors may read; bad fields refused), `tests/app/usage.js` (extend it with seeded
>    `appUse` documents: someone on right now, versions, parts; a member sees nothing), and the quick test for the writer's pure part.
> 5. Release work from `CLAUDE.md`: version (middle number), `node tools/stamp-files.js`, a line in `NEWS` (`js/tips.js`, `js/i18n/tips.js`,
>    `js/lang/st.js`), `docs/help/usage.md` (it says the page "builds up as people open Church & Trellis" – keep it true), the brochure,
>    setup tool, presentation, `docs/CHANGELOG.md`, tick `docs/ROADMAP.md`. Run the full browser test before pushing: this changes who sees what.
> Never put real names, dates or church data in the repository. The rules file is published by `.github/workflows/publish-rules.yml` after the merge;
> if the church has not set that up, give them both links (the `firestore.rules` file and the Firebase rules page).

## Decisions for the Rector (ask before building)
1. **Who may see names under "On right now" and "Not on the app yet".** Built as Administrators and Pastors (the roles that already see everyone in
   People). The part counts never show who. Say if names should be Administrators only, or if "who is on right now" should be counts only.
2. **May a person choose not to be counted?** A switch on Me (like the birthday one, `noCelebrate`) that stops their opens being recorded, so they
   count only as "on the app" by `appFirstSeen`. Recommended: yes, default on.

3. **The uptake level (above): is it right to show a level per person?** Built because the Rector asked. Decide with him: keep the word "Power user"
   and the scale as they are, whether a person's own opt-out (decision 2) should also hide their level, and whether the level may ever be used
   for anything other than looking (it is not used for anything now).

## What not to do
- Do not record what people type, search for, open inside a part, or who they message. Do not record location or device identifiers.
- Do not let the page or the record carry a person's name or email for anyone who is not an Administrator or Pastor.
- Do not add a library or a service for the charts or the statistics: the page draws its own, and no data goes to a third party.
