# The Church & Trellis splash screen

This note explains what the splash screen is for, how it is built, and how it
connects to "View as". Read it before changing loading, sign-in or View as code.

Status (22 Nov 2026): PR #286 (`loading-feedback`) adds the splash progress
messages and was merged into `main`. It caused a timeout in the browser test
"View as another role". The fix (one line in `js/app.js`, `onLiveState`) is on
the `loading-feedback` branch and was merged with the PR. Check the latest
"App in a browser" run on `main` to confirm the test passes there.

## What the splash is for

The splash is the loading screen people see while Church & Trellis starts and
loads the church's records. It should:

1. Show the app's identity straight away: the cross logo, the name "Church & Trellis", and the church's colours.
2. Show that something is happening: a turning cross and a progress bar.
3. Say what it is doing in plain words ("Loading…", "Signing you in…", "Getting the latest church records…").
4. Never leave someone stuck. After about 7 seconds it offers a "Try again" button.
5. Look right on Android. The app window shows the brand colour before the web page paints, so there is no white or black flash.

## Two splashes that must match

**A. Pre-app splash (`index.html`, styled in `css/hub.css`).** The browser shows
this before any Church & Trellis JavaScript has run. It shows the menu colour,
the logo and the turning cross. On a slow phone it is the only thing visible
while the scripts download. The CSS comment reads: "The loading screen
(index.html), before Church & Trellis's code has run: the menu colour, the logo
and the cross."

**B. In-app splash (`js/app.js`).** Once the code runs, the splash is drawn
into the `#app` element. Its markup comes from `splashHtml()` and it is updated
by `updateSplash(st)`. It contains:

- `.splash`: the full-screen container, with `role="status"`
- `.splash-mark`: the logo
- `h1`: the app name
- `#splash-loader`: the turning cross (`.busy-cross.splash-cross`), a progress bar (`#splash-fill`), a message (`#splash-msg`), and a slow-connection notice (`#splash-slow`, hidden at first)
- `#splash-v`: the version, from `ChurchHubVersion.version`

**Android window.** `android/app/src/main/java/org/christchurchhowick/churchhub/MainActivity.java`
sets the web view background to `0xFF231E1A` (the dark menu colour).
`android/app/src/main/res/values/styles.xml` and `values-night/styles.xml` set
`android:windowBackground` to the brand colour.

## States the splash shows

`js/store.js` sends state messages to `onLiveState` in `js/app.js`. The splash
reacts as follows:

| Message | Splash shows | Progress bar |
|---|---|---|
| `{stage:'loading', step:'connecting'}` | "Loading…" | indeterminate (moving) |
| `{stage:'loading', step:'checking', email}` | "Signing you in…" | indeterminate |
| `{stage:'loading', step:'syncing', done, total}` | "Getting the latest church records…" | fills to `done/total` (at least 15%) |
| `{stage:'loading'}` (no step) | "Loading…", or "Signing you in…" if there is an email | indeterminate |
| `{stage:'error', message}` | The error text and a "Try again" button (`window.churchHubReload`) | none |
| `{stage:'ready', person}` | The real app and Home | none |

Other stages (`linkSent`, `choosePin`, `code`, `noAccess`, and so on) are
sign-in screens. They replace the splash and are not part of it.

## The timeout

While the splash is showing and the stage is still `loading`, a timer
(`splashTimer`, 7 seconds) starts. If the stage is still `loading` when it fires,
`#splash-slow` appears: "This is taking longer than usual. Check your internet
connection. If nothing changes, tap Try again." with a Try again button. The
timer is cleared on `ready` or on any non-loading stage.

## "View as" and the splash

"View as" lets an Administrator (and the Senior Pastor) see the app as another
role. The flow:

1. `hubActions.viewas` shows a busy overlay ("Loading what … sees…", with the turning cross) and sets `switching` to a function `done`.
2. `Store.preview(role)` reloads the data, which sends `loading` messages.
3. `draw()` returns early while `switching` is set, so the page does not redraw half-way.
4. When `ready` arrives, `onLiveState` clears `switching`, calls `done()`, and the page opens as the new role.

**The bug (PR #286):** `onLiveState` used to clear `switching` on the first
message that was not `ready`. The new `loading` messages arrived first, so
`done()` never ran, the overlay stayed up, and the browser test timed out after
15 seconds on "View as another role".

**The fix (on `loading-feedback`, `js/app.js`, in `onLiveState`), placed before `switching = null;`:**

```js
if (switching && st.stage === 'loading') { updateSplash(st); return; }   // still loading the new role: keep waiting
```

## Rules that must not break

- Every progress message keeps `stage: 'loading'`, and `ready` is still sent when loading finishes. View as depends on this.
- `updateSplash` must not remove the splash before `ready`, and must not replace `#splash-slow` or its Try again button.
- The turning cross uses the class `busy-cross`. The same SVG is used in the busy overlay, so changing one changes the other.
- Any change to `index.html`, `js/app.js` or `js/version.js` needs `node tools/stamp-files.js` first, or `tests/versions.test.js` fails.
- Any new visible English text (for example a new splash message) must be added to `js/i18n/` and `js/lang/`. `tests/i18n.test.js` fails otherwise. This is why PR #281 fails its Languages check.

## Files to read

- `index.html`: the pre-app splash markup
- `css/hub.css`: `.splash`, `.splash-bar`, `.splash-fill`, `.busy-cross`, and the dark-mode rules
- `js/app.js`: `splashHtml`, `updateSplash`, `onLiveState`, `hubActions.viewas`, `draw`
- `js/store.js`: where `loading`, `step`, `done` and `total` are sent during `boot`, `startSession`, and the data sync
- `android/app/src/main/java/org/christchurchhowick/churchhub/MainActivity.java` and the two `styles.xml` files
- `tests/app/care.js` and `tests/app.test.js`: the browser test that waits for the page after a role switch
