# Pastoral visits – the part for Sonnet

**Model: Middle (Sonnet).** Screens, the map and styling, following `docs/PASTORAL-VISITS-PLAN.md`. **Wait for Opus** (`visits-opus.md`): the data
layer, the rules and `js/visits.js` (who may read what, last-visited, coverage) must exist first. Do not touch `firestore.rules`,
`js/store.js` or the visibility logic – if a screen needs a change there, stop and hand it up (`MODELS.md` rule 1). Use `Visits.*` for every
visibility and count decision; never re-work them in a screen.

## Paste this to Sonnet
> You are working on Church & Trellis (read `CLAUDE.md`, `docs/PASTORAL-VISITS-PLAN.md`, `docs/architecture/handover/visits-sonnet.md`).
> Say which tier you are running at. Work on the same branch as Opus's part, from the latest `main`. New module `js/mod-visits.js`
> (`Hub.register`, off until switched on in Settings → Apps), `css/visits.css`, `js/i18n/visits.js` + `js/lang/st.js`, `docs/help/pastoral-visits.md`,
> `tests/app/visits.js` (add it to one of the four lists in `.github/workflows/tests.yml` and the default list in `tests/app.test.js`).
>
> **Screens** (follow CLAUDE.md "Screen layout": page-head, one main button, `Hub.menu` for the rest, friendly empty states, 390px wide):
> 1. **Record a visit** (one short form, **saves automatically as a draft**, no Save button): who (search-as-you-type via
>    `js/people-search.js`; for a household tick who was there), when (now), where (Home, Hospital, Care home, Work, Church, Phone call,
>    Video call, Other; address from the household; saved places for hospitals and care homes; optional **I'm here** button that asks for the
>    phone's position and stores plain latitude/longitude decimals; **Not known** as a choice), visited by (you, plus others), kind, note with
>    its level (three big gentle choices, not radio buttons), optional follow-up date and needs. For a child or vulnerable adult show the
>    "Was a second adult present?" prompt (a prompt, not a block). Works offline.
> 2. **Pastoral care home** (pastors and pastoral staff): cards *Visited this month*, *Follow-ups due*, *Seriously ill*, *Not visited in a while*;
>    the map; the graphs; links into each person.
> 3. **Map** (OpenStreetMap with Leaflet **vendored in the repo**, not from a CDN; show the OSM attribution; cache tiles for offline; load only
>    when opened): pins whose colour **and** icon show recency; filters (dates, visitor, Care Group, kind, seriously ill only); tap a pin for who,
>    last visit, by whom, and the note only if `Visits.canReadNote` allows; a **Gaps** layer; **Plan a round** (pick households, open the route in
>    Google or Apple Maps via a link); honour the church setting for **area-only pins** (use `Visits.fuzz`) or **map off**.
> 4. **Graphs** (draw in plain SVG, calm and beautiful, no libraries): visits per month by kind; the **coverage ring** (also by Care Group);
>    **load by visitor**; a **care timeline** per person. Read `docs/help` and the dataviz tone of the Usage dashboard for style.
> 5. **Care tab** on each person's page: their visits as a timeline, filtered by what the viewer may read (use `Visits.*`).
> 6. **My group** for Care Group leaders: each person with "last visited 3 weeks ago" and a one-tap **I visited**.
> 7. **Settings → Pastoral visits** (Administrators and the Rector): appoint pastoral care workers and their scope, saved places, the
>    not-visited-in-a-while level, map on / area-only / off, how long archived notes are kept. One line saying what each switch does.
>
> **Design**: elegant and calm, not grey lists; a unique soft-watercolour page header (not like Me, Import, Settings, Languages or Petty cash),
> friendly pop-up errors in a colour that stands out from the person's theme, pressed-look buttons, no Save buttons, an Undo bar after changes.
>
> **Also, in the same pull request** (CLAUDE.md): words in English, Afrikaans, isiZulu, isiXhosa and Sesotho (`st.js`); not the other 21
> languages; a line in `NEWS` and a Did you know? tip; the help page and `Help.PAGES`; the brochure; the **setup tool** (`GROW` item and step:
> switch on Pastoral visits, appoint pastoral care workers, choose the not-visited-in-a-while level, choose whether the map is shown); the
> presentation if a slide changes; the public website (generic wording, no mention of other systems); Church health lines from the plan;
> `docs/CHANGELOG.md` and `docs/ROADMAP.md`; version middle number up and `node tools/stamp-files.js`. Run the full browser test before
> pushing. Use made-up demo data only (`js/sample.js`: invented names spread across a made-up town).
