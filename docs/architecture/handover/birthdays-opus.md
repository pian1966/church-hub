# Birthdays and anniversaries – the part for Opus

**Done in 0.115.0 (Opus, 24 Nov 2026)** – all five steps, in one pull request. The Rector chose: the birthday goes with the Church directory consent, with an opt-out. Kept below as the record of what was asked.

**Model: Senior (Opus).** Everything here changes who may see a date, or reads personal information across people, so by
`docs/architecture/MODELS.md` rule 1 a lighter model must not do it. Sonnet built the first part (below); this is the rest.

## Paste this to Opus

> You are working on Church & Trellis (read `CLAUDE.md` first, then `docs/architecture/MODELS.md`, and `docs/POPIA.md`
> sections "Children: who gives consent…" and "Coming to the church since, and the birthday on the application").
> Work on your own branch from the latest `main` (check that, as the church asks every time before pushing).
>
> **Already done (0.114.0, Sonnet):** `js/celebrate.js` (pure rules: whether a day is someone's birthday or wedding
> anniversary; never for someone who has died, left or been merged, never an anniversary for someone widowed, divorced,
> separated or single, whose spouse has died, or a child – the same rules as `js/emails.js`), `js/celebrate-ui.js` and
> `css/celebrate.css` (a card with falling petals on a person's own Home and Me page; a 🎂 / 💍 tag beside a name; a 🎂 on
> Care Group and Midweek Group cards), tests in `tests/celebrate.test.js`. Those screens show a date **only where the
> screen already shows that person's birthday or anniversary** – the profile page for people who see everything
> (Administrators and Pastors; the person themself), and Care / Midweek Group cards for carers when the member agreed to
> "Care group" consent (`js/care.js`, `birthday` day and month only). No access rule, `firestore.rules`, `js/store.js` or
> `js/access.js` was changed.
>
> **Decision already made by the church's Rector:** other people should be able to see that it is someone's birthday or
> anniversary (not only the person themself).
>
> **Your job – the parts that change who sees what. Do them in this order, one pull request each, and stop to ask the
> Rector before widening anything he has not approved:**
>
> 1. **Church Partners seeing the 🎂 / 💍 in the church directory (and on a person's page in the directory view).**
>    - Today a Church Partner only sees what Settings → Who can see what shares with their role, of people who agreed
>      (`js/people/core.js` `contactHtml`, `js/access.js`). Decide with the Rector whether the birthday (day and month, never
>      the year or age) becomes a field a person can agree to share in the directory, with its own consent line on Me →
>      My details → Consent, its own purpose in `docs/POPIA.md`, and a default of **off** until the person agrees
>      (children: guardians decide; see the children section).
>    - Change together, as `CLAUDE.md` says: `js/access.js`, `firestore.rules`, `plan()` in `js/store.js`, the POLICY copy in
>      `tests/fake-firebase.js`, `tests/rules.test.mjs`, `tests/app/*.js`; keep `firestore.rules` to plain keyboard characters.
>    - Never let the date or the year leak: the tag shows only "Birthday today" and a person's age is never shown to
>      people who cannot already see it. Never celebrate for someone who has died (see `Celebrate.gone`).
>    - Once approved, call `CelebrateUI.tag(p)` / `CelebrateUI.cake(mmdd)` from the directory list and profile for those
>      people only.
> 2. **"Birthdays this week" on Home for carers, Midweek Group leaders and Pastors.** Pastors and Administrators can
>    already read everyone; carers and leaders only have the care-group cards (`Care.card`). Build it from the data each
>    role already has – do not give carers more data to make it work. Show names and the day, nothing else, and make it
>    quiet (a short list, hidden when empty). Add the WhatsApp / Messages shortcut ("Send a birthday message") only to
>    people who may already message that person.
> 3. **A quiet pastoral reminder, for Pastors only, on the anniversary of a spouse's death and on the wedding anniversary
>    of someone newly widowed** ("this may be a hard day – a call or a visit may mean a lot"). `js/emails.js` already knows
>    the death anniversary (`spouseDeath`). It must never be shown to anyone else, must be audit-logged like other pastoral
>    views (`docs/POPIA.md`), must only use data Pastors can already see, and must never wish the widowed person a happy anniversary.
> 4. **A way to opt out.** Me → My details: "Don't celebrate my birthday or anniversary" (the person's own choice; honoured
>    by the card, the tags and every list above). Store it where consent is stored; default is to celebrate.
> 5. **A browser test** `tests/app/celebrate.js` (add it to one of the four `PARTS` lists in `.github/workflows/tests.yml` and to the
>    default list in `tests/app.test.js`), covering: the card on the day, no card on another day, nothing for a widowed person's
>    anniversary, nothing for someone who has died, the tag only where the birthday is already shown, and the opt-out.
>
> For each step also do the usual release work from `CLAUDE.md`: the version in `js/version.js` (middle number for a feature)
> and `node tools/stamp-files.js`; a line in `NEWS` in `js/tips.js` with its words in `js/i18n/tips.js` and `js/lang/st.js`
> (Afrikaans, isiZulu, isiXhosa, Sesotho – not the other 21 languages); help answers in `docs/help/` (the 🎂 answer is already in
> `getting-started.md` – extend it, and add to `people.md` / `settings.md` / `privacy.md` as needed); the brochure
> (`reviewed-for`), the setup tool and the conference presentation when the middle number goes up; a `docs/CHANGELOG.md`
> line; tick `docs/ROADMAP.md`. Run `node tests/celebrate.test.js`, every other quick test, and the full browser test
> (`node tests/app.test.js`) before pushing, because these steps change who sees what. Never put real names, dates or
> church data in the repository.

## What not to do
- Do not show a birthday date, age or year to anyone who cannot already see it.
- Do not celebrate (or suggest a message) for someone who has died, left the church, is a merged duplicate, or – for anniversaries –
  is widowed, separated, divorced or single.
- Do not add effects that need pictures or extra data: the petals are CSS only, and must stay off under "reduce motion".
