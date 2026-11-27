# Petty cash – the part for Sonnet

**Model: Middle (Sonnet).** Screens and styling, following `docs/PETTY-CASH-PLAN.md`. **Wait for Opus** (`petty-cash-opus.md`): the data
layer, the rules and `js/petty.js` (balance, "who must approve") must exist first. Do not touch `firestore.rules`, `js/store.js` or the
approval logic – if a screen needs a change there, stop and hand it up (`MODELS.md` rule 1). Use `Petty.*` for every balance and approval
decision; never re-work them in a screen.

## Paste this to Sonnet
> You are working on Church & Trellis (read `CLAUDE.md`, `docs/PETTY-CASH-PLAN.md`, `docs/architecture/handover/petty-cash-sonnet.md`).
> Say which tier you are running at. Work on the same branch as Opus's part, from the latest `main`. New module `js/mod-petty.js`
> (`Hub.register`, off until switched on in Settings → Apps), `css/petty.css`, `js/i18n/petty.js` + `js/lang/st.js`, `docs/help/petty-cash.md`,
> `tests/app/petty.js` (add it to one of the four lists in `.github/workflows/tests.yml` and the default list in `tests/app.test.js`).
>
> **Screens** (follow CLAUDE.md "Screen layout": page-head, one main button, `Hub.menu` for the rest, friendly empty states, 390px wide):
> 1. **Petty cash home**: a card for each tin the person may use, each with its own gentle colour and a big friendly balance
>    ("R1,240 in the office tin"), a warm warning colour under the tin's low level, and one main button **Record a spend**. Keepers also see
>    **Waiting for approval** (count) and **Waiting to be reimbursed** (amount). Keepers, the Treasurer and Council also see all tins with a
>    combined total.
> 2. **Record a spend**: one short form that **saves automatically as a draft** (no Save button): tin (pre-chosen if only one), two big
>    choices **I took cash** / **I paid and need reimbursing**, amount, what it was for, category, date (today), **slip photo – required**
>    (camera first; shrink before upload; works offline), optional note. The send button stays off until the photo is there. Over the level,
>    say plainly that a second approver will be asked. "I took cash": afterwards add the real amount and any change back.
> 3. **Waiting for approval** (Keeper and second approvers): approve, or send back with a note ("please retake the photo"). Show what an
>    entry still needs ("waiting for a second approver"). An Administrator also gets **Slip lost** with a required reason (marks the entry).
> 4. **Top up** and **Move cash between tins**; **Reimbursed** button for the Keeper.
> 5. **Month summary** per tin and combined: opening + top-ups − approved spends − reimbursements = closing; spends by category; a
>    **Cash counted in the tin** box that shows any difference; **Close the month** (Keeper). Print or download as PDF and CSV (reuse the
>    roster PDF writer approach in `js/roster-pdf.js`; keep the writer pure and tested).
> 6. **Settings → Petty cash** (Administrators and the Rector): the Keepers, the second-approver level (R500), **People may approve their own
>    spends** (off by default; church-wide or per tin), the categories, tins (create, share, personal, colour, float, low level).
>    Spells out in one line what each switch does.
>
> **Design**: elegant and calm, not grey lists; a unique soft-watercolour page header (not like Me, Import, Settings or Languages), friendly
> pop-up errors in a colour that stands out from the person's theme, pressed-look buttons, no Save buttons, an Undo bar after changes.
>
> **Also, in the same pull request** (CLAUDE.md): words in English, Afrikaans, isiZulu, isiXhosa and Sesotho (`st.js`); not the other 21
> languages; a line in `NEWS` and a Did you know? tip; the help page and `Help.PAGES`; the brochure (members/administrators panels);
> the **setup tool** (`GROW` item and step: switch on petty cash, choose the Keeper, create the first tin and float, choose whether people
> may approve their own spends); the presentation if a slide changes; the public website (generic wording, no mention of other systems);
> Church health lines from the plan; the Finance line later; `docs/CHANGELOG.md` and `docs/ROADMAP.md`; version middle number up and
> `node tools/stamp-files.js`. Run the full browser test before pushing. Use made-up demo figures only (`js/sample.js`).
