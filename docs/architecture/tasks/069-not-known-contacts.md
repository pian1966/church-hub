# 069 – Email and mobile "Not known": one clear control inside the box

**Reviewed by:** Architect (Fable) and Senior (Opus), 25 Nov 2026 – the design holds; read the traps below before coding.

## Paste this into a Sonnet session

> Do task 069 in `docs/architecture/tasks/069-not-known-contacts.md`. Read `CLAUDE.md` first, then the whole task,
> especially "Traps found in review". Follow it exactly – if anything is unclear or seems wrong, stop and ask rather than
> guess. Work on your own branch from the latest `main`. This changes how the form works, so run the full browser test
> (`node tests/app.test.js`) before pushing, and check against the latest `main` again just before pushing. Take
> screenshots of the Edit details window at 390px wide in each state in the States table, light and dark, and look at them
> yourself before you say it's done. Open a pull request and tell me in plain English what changed on screen.

**Model:** Middle (Sonnet). Screens only – no change to who sees what, `firestore.rules` or `js/store.js`.
**Needs first:** nothing. **Touches:** `js/people/edit.js`, `css/hub.css`, `js/people/profile.js`, `js/people/search.js`,
`js/mod-me.js` (wording only), i18n (`js/i18n/edit.js`, `profile.js`, `search.js`, `js/lang/st.js`), tests, `docs/help/people.md`.

Read `CLAUDE.md` first (screen layout, `T('…')` in five languages, `field req`, version and What's new rules), then this file.

## Why

The church finds today's way of saying an adult's email or mobile is not known clumsy and unclear (review of 25 Nov 2026):

- Under each box is a dashed "Not known" pill (`.chip-unknown`). On a phone it stretches full width and looks like a
  second, empty box.
- Tapping it writes the word "unknown" *into the email box*, so it looks like data – an email address called "unknown".
  The state lives in the box's text, matched in three places with slightly different rules
  (`typedPerson` `un()` line ~58, the chip `sync` line ~182, `savePerson` `unknown()` line ~401), one of them depending on
  the translation of "unknown". Typing "Unknown" by hand also works, which nobody would guess.
- The placeholder ("Not known? Choose “Not known” below") is long, gets cut off on a phone, and is an instruction rather
  than an example.
- The error card adds a second "Not known" button (`.fe-act`), so for a moment there are two.
- Saving as you go fires on every keystroke, so writing the word into the box triggers saves and errors for the other box.
- Wording differs: the profile says "Unknown" (`profile.js` 161–162), Me says "Not known" (`mod-me.js` 60), Change selected…
  offers "Unknown" (`search.js` 417, 419).

The data side is fine and stays: `emailUnknown` / `mobileUnknown` flags (kept with the private details), email/mobile saved
as `''`. Only the form and the words change.

## The design

One control per box, on the label line, and a calm "not known" state that replaces the box – the box never holds a fake word.

**Label line.** `Email` on the left; on the right a small text button **Not known** (accent colour, no border, like a link;
`aria-pressed="false"`, at least 44px tap height on phones). For Mobile the same. It shows for adults and children alike
(children aren't required to have either, but it is still useful to record).

**States, for each of the two boxes:**

| State | What they see |
| --- | --- |
| Empty | The ordinary input with a real example as placeholder: email `name@example.com`; mobile `082 123 4567` when the church's country (`Countries.church(S.settings()).code`) is `ZA`, otherwise `+` + that country's dialling code + ` …` (`js/countries.js` has dialling codes but no example numbers). The **Not known** button on the label line. |
| Typing a real value | The **Not known** button hides (they clearly know it). Clearing the box brings it back. |
| Not known | The input is hidden and in its place, the same size and shape, a soft neutral panel: a small "?" circle icon, the words **Not known**, and at the right a text button **Add it**. The label-line button is hidden. No shading as "must fill" (it is answered). |
| Add it | Back to the empty input with the cursor in it; the flag is cleared. |
| Error on save (adult, box empty, not marked) | The existing error card under the box: **Add their email address, or choose Not known.** (mobile: **Add their mobile number, or choose Not known.**) with **one** button in the card, **Not known**, which does the same as the label-line button. No second button anywhere. |
| Editing someone already marked not known | Opens in the Not known state. |
| Someone who has died | Not required (as today); the control still works. |

**How the state is kept.** A hidden input next to each box: `<input type="hidden" id="pf-email-unknown" value="1|''">`
(and `pf-mobile-unknown`). The visible input's value is always the real address/number or empty. Switching state sets the
hidden value and dispatches one `change` event (so saving as you go saves once, not per keystroke). `savePerson` reads the
hidden inputs for `emailUnknown` / `mobileUnknown`; the required check becomes "real value **or** hidden = 1".

**Old habits and imported data.** If someone still types `unknown` / `not known` (any case, or the translated word) and
leaves the box (the input's `change` event – see trap 3), turn it into the Not known state and empty the box. Put the one matching rule in a
single helper (e.g. `P.isUnknownWord(v)` in `js/people/core.js`) and use it in `typedPerson`, `savePerson` and the blur
handler – delete the other two copies. `typedPerson` (duplicate check) then needs no special case: the box is empty.

**Accessibility.** Label-line button: `aria-controls` the input, `aria-pressed`. On switching to Not known, focus moves to
**Add it**; on **Add it**, focus moves to the input. The panel has `role="status"` text "Email not known" for screen readers.
Works at 390px and in dark mode (use `--surface-2`, `--line`, `--muted`; no hard-coded colours).

**Everywhere else says "Not known".** Profile (`profile.js` 161–162): `T('Not known')` instead of `T('Unknown')`.
Change selected… (`search.js` 417, 419): option `TX('Not known')` instead of `TX('Unknown')` (it already exists in
`js/i18n/common.js`; remove `'Unknown'` rows only if nothing else uses them – grep first).

## Traps found in review (Fable, 25 Nov 2026) – read before coding

1. **A button inside a `<label>` hijacks taps.** Today each box is `<label class="field" id="pf-email-f">…<input>…</label>`
   (`edit.js` 124–125). A `<button>` placed before the input inside that label becomes the label's target: tapping the
   word "Email" would press **Not known**. Change these two fields to `<div class="field …" id="pf-email-f">` with
   `<label for="pf-email">` around the label text only, and the button as a sibling on that line. Keep the ids
   `pf-email-f` / `pf-mobile-f` and the `req` class on the wrapper: line ~189 toggles `req` by id when Adult/Child changes,
   `fail()` finds the box with `el.closest('.field')`, and tests look for `#pf-email-f.req`. Check `.field` CSS in
   `css/hub.css` still lays a `div.field` out like a `label.field` (column, gap, the `small` hints).
2. **Saving as you go** (`js/app.js` 997–1060): a `change` anywhere in the `data-autoscope` form saves at once; `input`
   saves 900 ms after typing stops; afterwards `autoFire` puts the cursor back where it was (`focusKey` / `refocus`).
   So: when switching state, **move focus first** (to **Add it**, or to the input), **then** dispatch a single bubbling
   `change` on the hidden input – never `input`, and never two events. Don't dispatch anything when the window first opens.
3. **The typed word must never reach validation as an address.** Someone typing "unknown" pauses, and 900 ms later
   `savePerson(true)` runs with that text still in the box. `savePerson` must treat `P.isUnknownWord(value)` exactly like
   the hidden flag (as it does today), so no "That email address doesn't look right" appears; the box is swapped for the
   panel on the input's own `change` (which fires when they leave it), not on `blur` and not while typing.
   Keep the `['unknown', …]` row in `js/i18n/edit.js` – the helper needs the translated word.
4. **Not known + a real value can't both be true.** If the hidden flag is 1 the visible input is empty and `hidden`; on
   **Add it** clear the flag before showing the input. `savePerson`: a real value wins and deletes the flag.
5. **`data-was` and the duplicate hints** (`contactHint`, lines ~77–91) read the visible input: leave `data-was` and the
   `…-dup` hint where they are, and hide the hint while the panel is showing.
6. **Members edit their own details through this same window** (`me`): for them the errors read
   **Add your email address, or choose Not known.** / **Add your mobile number, or choose Not known.** (two more lines to translate).
7. **`js/health.js` does not read the flags** (it tests the text of email/mobile only) – no change there, and don't "fix" it
   in this task; someone marked not known still counts as hard to reach, which is right.
8. **After choosing Not known for one box, saving as you go may say the other is still missing.** That is existing
   behaviour (the note at the bottom); leave it, but make sure that note never appears merely because the window was opened.
9. Other writers of the flags – `js/name-scan.js` 222–223 and Change selected… – need no change beyond the wording; a
   person they marked simply opens in the Not known state.

10. **Words already stored in the box (Opus).** Some records may hold the word itself in `email` / `mobile` (typed before
    the flags existed, or typed in Elvanto and imported). When the window opens and `P.isUnknownWord(p.email)` is true, open
    in the Not known state with the box empty – without dispatching any event (trap 2); the next real save clears the word.
    The helper should also accept `n/a`, `none` and `-` (any case, trimmed), the same words `js/health.js` line 23 treats as empty.
11. **`Email not known` and `Mobile not known` are already translated** (`js/i18n/households.js` 128–129, and in
    `js/lang/st.js`). Use them – adding them again in `js/i18n/edit.js` makes `node tests/i18n.test.js` fail as duplicates.
12. **One state-switching function (Opus).** Write the show/hide once, e.g. `nkShow(id, on, quietly)`, and call it from the
    label-line button, the error card's button, **Add it**, the input's `change` (typed word), and on opening (`quietly`:
    no event, no focus move). Replace today's `unknown` action (~349–354) with `unknown` and `known` actions that call it.
    Remove any `.field-err` / `aria-invalid` on the field when switching to Not known.
13. **Change selected… (Opus).** `search.js` 417/419 become `options: [TX('Not known')]`; check how the chosen option is
    matched in that code (it may compare the option text) and keep it working; `tests/app/people.js` 209 selects it by text.

## Remove

- `.chip-unknown` buttons and their CSS (end of `css/hub.css`), the `sync` wiring (`edit.js` ~180–184), the `unknown`
  action's write-the-word behaviour (`edit.js` ~349–354 – replace with the new toggle), the `un()` / `unknown()` copies.
- The strings `Not known? Choose “{word}” below`, `Please fill in the email address, or choose “{word}”.`,
  `Please fill in the mobile number, or choose “{word}”.` – replace with the new ones (all five languages, `st.js` too).

## New words (English; add Afrikaans, isiZulu, isiXhosa in `js/i18n/edit.js` and Sesotho in `js/lang/st.js`)

(`Email not known` / `Mobile not known` already exist – trap 11. Addresses and the phone example are not translated.
Don't add lines to the other 21 language files. These are drafts; the church will have a fluent speaker check them.)

| English | Afrikaans | isiZulu | isiXhosa | Sesotho |
| --- | --- | --- | --- | --- |
| Add it | Voeg dit by | Yengeza | Yongeza | E kenye |
| Add their email address, or choose Not known. | Voeg hul e-posadres by, of kies Nie bekend nie. | Engeza ikheli le-imeyili yabo, noma ukhethe Akwaziwa. | Yongeza idilesi ye-imeyile yabo, okanye ukhethe Akwaziwa. | Kenya aterese ya imeile ya bona, kapa o kgethe Ha ho tsejwe. |
| Add their mobile number, or choose Not known. | Voeg hul selfoonnommer by, of kies Nie bekend nie. | Engeza inombolo yeselula yabo, noma ukhethe Akwaziwa. | Yongeza inombolo yeselfowuni yabo, okanye ukhethe Akwaziwa. | Kenya nomoro ya mohala ya bona, kapa o kgethe Ha ho tsejwe. |
| Add your email address, or choose Not known. | Voeg jou e-posadres by, of kies Nie bekend nie. | Engeza ikheli lakho le-imeyili, noma ukhethe Akwaziwa. | Yongeza idilesi yakho ye-imeyile, okanye ukhethe Akwaziwa. | Kenya aterese ya hao ya imeile, kapa o kgethe Ha ho tsejwe. |
| Add your mobile number, or choose Not known. | Voeg jou selfoonnommer by, of kies Nie bekend nie. | Engeza inombolo yakho yeselula, noma ukhethe Akwaziwa. | Yongeza inombolo yakho yeselfowuni, okanye ukhethe Akwaziwa. | Kenya nomoro ya hao ya mohala, kapa o kgethe Ha ho tsejwe. |

## Tests (update, then add)

Update: `tests/app/admin.js` 290–296 (placeholder check → the label-line button exists; error text; instead of
`fill('#pf-email','Unknown')` click the button; profile shows "Not known"), `tests/app/partners.js` 86 and
`tests/app/people-details.js` 143 (click **Not known** instead of filling the word), `tests/app/people.js` 209
(Change selected… option is now "Not known").
Add (in `tests/app/people-details.js`): button hides while a real email is typed and comes back when cleared; choosing
Not known shows the panel and saves `emailUnknown: true` with `email: ''` in one save; **Add it** clears the flag and
focuses the box; typing `Unknown` and leaving the box turns into the Not known state; an existing not-known person opens
in that state; at 390px width the panel and button fit on one line; tapping the word “Email” puts the cursor in the box and does **not** press Not known (trap 1); opening and closing the window without touching anything saves nothing and shows no note; a person stored with `email: 'unknown'` opens in the Not known state (trap 10); pressing **Done** with an empty mobile shows the error card with exactly one **Not known** button, and pressing it clears the error.

Run the quick tests and `node tests/app.test.js` (this changes behaviour, so the full browser test before pushing).

## Also

- `docs/help/people.md` line ~18: say that if an adult's email or mobile isn't known, tap **Not known** beside the box,
  and **Add it** later.
- Version: last number up (fix). What's new: one line for Administrators and Pastors (`app: 'people'`): "Not known for an
  email or mobile is now a button beside the box – no more typing “unknown”."
- Don't touch `js/health.js`, `js/name-scan.js`, `js/store.js` or `firestore.rules`.
- Branch from the latest `main`; check it again before pushing.
