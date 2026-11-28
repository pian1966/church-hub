# Birthday opt-out removed – tidy-up for Opus (touches `firestore.rules`, `js/store.js`)

**Model:** Senior (Opus). Sonnet removed the screen and rules logic (0.121.7); these files are Senior-tier, so they were left alone.

The "Celebrate my birthday and anniversary" switch is gone and `js/celebrate.js` / `js/care.js` ignore `noCelebrate` and `quiet`.
Nothing breaks if the following stay, but they are now dead and let a person write a flag that does nothing:

1. `firestore.rules` ~line 205: remove `'noCelebrate'` from the `onlyChanges([...])` list and its `is bool` line for `mine(id)`.
2. `firestore.rules` ~line 430: `'quiet'` in the Care / Midweek Group card `hasOnly([...])`.
3. `js/store.js` ~line 379: `'noCelebrate'` in the person field list (check what the list is for before removing).
4. `tests/fake-firebase.js` (POLICY copies of 1 and 2) and `tests/rules.test.mjs` (lines about `noCelebrate` ~218-221 and `quiet` ~575).
5. Decide whether to clear existing `noCelebrate: true` / `quiet: true` values from records (a one-off tidy by an Administrator's app), or leave them ignored.

**Open question for the church (POPIA):** people who already switched celebrations off are now celebrated again, and their
day and month go back into the church directory *if* they agreed to Church directory. What's new tells everyone. Confirm this is wanted.
