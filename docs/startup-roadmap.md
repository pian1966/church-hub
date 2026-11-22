# Church & Trellis: splash and startup roadmap

Goal: opening the app should feel calm, polished and quick, and the person should always know what is happening. Nothing should look stuck, flash, jump, or leave them guessing.

Read `docs/SPLASH.md` first, then this file. Treat the code as the source of truth. Where the doc and the code disagree, fix the doc once the code is confirmed.

## Standing rules (apply to every phase)

- Before editing, read the current code for the area you're changing. Don't work from memory or from this roadmap alone.
- Run `node tools/stamp-files.js` after changing `index.html`, `js/app.js` or `js/version.js`, or `tests/versions.test.js` fails.
- Every new visible English string goes into `js/i18n/` and `js/lang/`, or `tests/i18n.test.js` fails.
- Every progress message keeps `stage: 'loading'`, and `ready` is still sent when loading finishes. The View-as flow depends on both.
- Never remove the splash before `ready`. Never replace `#splash-slow` or its Try again button while loading.
- Keep the turning cross on the `busy-cross` class. The busy overlay shares it.
- Give the person complete, clean code for each changed file, not partial patches.
- Run the full test suite, including the browser test "View as another role", before calling a phase done.

## Phase 0: Verify the current state

Before any design work, confirm these known points in the code:

1. **Stuck overlay on error during View as.** In `onLiveState` (`js/app.js`), an `error` stage during View as clears `switching` without calling `done()`. The busy overlay may stay on screen. Reproduce this in a browser first, then fix it so the overlay closes and the error is shown.
2. **Timer not cleared on the View-as success path.** The early return for `ready` while `switching` is set doesn't call `clearTimeout(splashTimer)`. Harmless but untidy. Clear it.
3. **Two splashes may not match.** Compare the static splash in `index.html` with `splashHtml()` in `js/app.js`. Check the version line (the static one is empty until the app sets it), the aria-labels, and whether the handover between them causes a flash or jump.
4. **Doc status is stale.** Remove the PR-specific status from `docs/SPLASH.md`, and state whether the fix is on `main`.

Acceptance: a written list of confirmed issues, each with a reproduction step.

## Phase 1: Fix reliability

- Make every path out of the loading state end in either `ready`, a sign-in screen, or an error with a retry. No path should leave the splash or overlay on screen silently.
- Make the error screens say what to do next in plain words ("Check your internet connection, then tap Try again"), and say when the person is offline.
- Make sure Try again works from every error state, including during View as.

Acceptance: the timeout and error paths are covered by tests, and the browser test passes on `main`.

## Phase 2: Smooth the handover

- Plan one visual sequence: static splash, then in-app splash, then Home. Remove any visible jump between them. Keep the logo, colours and layout identical in both.
- Add a minimum display time for the splash (around 300-500 ms, to be tuned) so it doesn't flash on fast connections. Balance this against the time it takes to load.
- Fade the splash out and the first screen in, rather than swapping them instantly. Respect `prefers-reduced-motion` (the existing rule for `busy-cross` is the model).
- Check dark mode on both splashes, and the Android window colour (`#231E1A`) so there is no white or black flash.

Acceptance: screen recording on a slow phone shows no flash, jump or blank frame.

## Phase 3: Keep the person informed

- Show progress in plain words for each step: connecting, signing in, loading the records (with a count where possible, e.g. "Getting church records, 12 of 40"), and opening.
- Use the progress bar for steps that have a known total. Use the indeterminate bar only when the total is unknown.
- After about 2 seconds, show a short reassurance if loading is still running, such as "Still working. Thanks for your patience." Keep the 7-second slow-connection notice for longer waits.
- Announce changes to screen readers with `aria-live="polite"` on the message, so people using assistive technology hear progress.

Acceptance: at every moment during startup, the message and bar tell the person what is happening.

## Phase 4: Polish

- Consider a skeleton of the Home screen in place of the splash after `ready`, so the app feels present sooner. Only do this if Phase 2 shows the splash is still noticeably slow.
- Review the copy for tone: warm, short, and free of technical words.
- Check contrast on the splash text (`rgba(255,255,255,.88)` on the brand colour) against WCAG AA.
- Test on small phones, large text settings, and a landscape tablet.

Acceptance: a short checklist of devices and settings signed off by the person.

## Test checklist (run at the end of each phase)

- Full test suite passes, including `tests/versions.test.js`, `tests/i18n.test.js`, and the browser "View as another role" test.
- Cold start, signed-in start, sign-in link, sign-in code, and offline start all reach the right screen.
- Slow network (throttled to 3G): the 7-second notice appears and Try again works.
- Error during View as: the overlay closes and the error is shown.
- Reduced motion, dark mode, and screen reader announcements behave as described.

## What to ask the person before starting

1. Do they want the Home skeleton (Phase 4), or is the splash alone enough?
2. What is the target maximum wait before the first screen appears?
3. Which devices matter most (their own phone, the church's shared devices)?
4. Should new wording be translated into Sesotho and Afrikaans now, or later?
