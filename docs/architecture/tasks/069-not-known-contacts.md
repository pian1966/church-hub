# 069 – Email and mobile "Not known": one clear control inside the box

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
| Empty | The ordinary input with a real example as placeholder: `name@example.com` / `082 123 4567` (use the church country's example if `js/countries.js` has one; otherwise these). The **Not known** button on the label line. |
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
leaves the box (`blur`, not `input`), turn it into the Not known state and empty the box. Put the one matching rule in a
single helper (e.g. `P.isUnknownWord(v)` in `js/people/core.js`) and use it in `typedPerson`, `savePerson` and the blur
handler – delete the other two copies. `typedPerson` (duplicate check) then needs no special case: the box is empty.

**Accessibility.** Label-line button: `aria-controls` the input, `aria-pressed`. On switching to Not known, focus moves to
**Add it**; on **Add it**, focus moves to the input. The panel has `role="status"` text "Email not known" for screen readers.
Works at 390px and in dark mode (use `--surface-2`, `--line`, `--muted`; no hard-coded colours).

**Everywhere else says "Not known".** Profile (`profile.js` 161–162): `T('Not known')` instead of `T('Unknown')`.
Change selected… (`search.js` 417, 419): option `TX('Not known')` instead of `TX('Unknown')` (it already exists in
`js/i18n/common.js`; remove `'Unknown'` rows only if nothing else uses them – grep first).

## Remove

- `.chip-unknown` buttons and their CSS (end of `css/hub.css`), the `sync` wiring (`edit.js` ~180–184), the `unknown`
  action's write-the-word behaviour (`edit.js` ~349–354 – replace with the new toggle), the `un()` / `unknown()` copies.
- The strings `Not known? Choose “{word}” below`, `Please fill in the email address, or choose “{word}”.`,
  `Please fill in the mobile number, or choose “{word}”.` – replace with the new ones (all five languages, `st.js` too).

## New words (English; add Afrikaans, isiZulu, isiXhosa in `js/i18n/edit.js` and Sesotho in `js/lang/st.js`)

`Add it` · `Email not known` · `Mobile not known` · `Add their email address, or choose Not known.` ·
`Add their mobile number, or choose Not known.` (plus the two example placeholders if you translate them – addresses
and numbers stay as they are). Don't add lines to the other 21 language files.

## Tests (update, then add)

Update: `tests/app/admin.js` 290–296 (placeholder check → the label-line button exists; error text; instead of
`fill('#pf-email','Unknown')` click the button; profile shows "Not known"), `tests/app/partners.js` 86 and
`tests/app/people-details.js` 143 (click **Not known** instead of filling the word), `tests/app/people.js` 209
(Change selected… option is now "Not known").
Add (in `tests/app/people-details.js`): button hides while a real email is typed and comes back when cleared; choosing
Not known shows the panel and saves `emailUnknown: true` with `email: ''` in one save; **Add it** clears the flag and
focuses the box; typing `Unknown` and leaving the box turns into the Not known state; an existing not-known person opens
in that state; at 390px width the panel and button fit on one line.

Run the quick tests and `node tests/app.test.js` (this changes behaviour, so the full browser test before pushing).

## Also

- `docs/help/people.md` line ~18: say that if an adult's email or mobile isn't known, tap **Not known** beside the box,
  and **Add it** later.
- Version: last number up (fix). What's new: one line for Administrators and Pastors (`app: 'people'`): "Not known for an
  email or mobile is now a button beside the box – no more typing “unknown”."
- Check `js/health.js` line 23 (`UNKNOWN` pattern) still behaves: it should count flagged people as answered, as now.
- Branch from the latest `main`; check it again before pushing.
