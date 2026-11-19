# 032 – Download only what changed (church information)

**Model:** Architect (Fable) designs it; Senior (Opus) builds it. It changes how every list loads in `js/store.js` and
probably needs a new kind of record for deletions and a rule for it – the "shape of the documents everyone loads"
that `RISKS.md` (R5) and rule list say to escalate. Don't start building before the design is written.

**Why:** many members pay for every megabyte. Church & Trellis keeps the church's information on the phone (Firestore's
offline copy, `openDb()` in `js/store.js`) and an update doesn't wipe it, but each list is a live listener on a whole
collection (`onSnapshot`, ~674, 713, 735, 777). When Church & Trellis has been closed for more than about 30 minutes,
Firestore may send the whole of each list again rather than only the changes. On a big church that is the largest
download in daily use, and it also counts towards the free 50 000 reads a day (R5).

**Needs:** 030's numbers (documents received on a second start within 30 minutes and after) – they say how much this
saves and for which church sizes. Program files are already done: 0.79.1 downloads only the files that changed
(`tools/stamp-files.js`).

**Questions the design must answer**
1. Every saved record gets a server time of its last change (`updatedAt`)? Which collections, and how existing records
   get one (a data upgrade).
2. On start: show the copy on the phone at once, then ask only for records with `updatedAt` after the last time this
   phone checked – per collection, per sign-in. Where is that time kept, and is it wiped with the copy (sign-out)?
3. Deletions: a deleted record can't be found by `updatedAt`. Tombstones (a small "deleted" record), a soft-delete
   field, or a periodic full check? Who may read them (they must not reveal anything the role couldn't see)?
4. Access changes: when someone's role changes, records they may no longer see must leave the phone; records they now
   may see must arrive even though they didn't change. (Probably: a role change means a full load once.)
5. Clocks: use server time only; a record saved offline gets its `updatedAt` when it reaches the server.
6. Does `firestore.rules` allow these queries for every role (`plan()` in `js/store.js`, `tests/fake-firebase.js`,
   `tests/rules.test.mjs` change together)?
7. Fallback: if anything looks wrong (a gap, an error), a full load as today.

**Acceptance (for the build):** a second start after more than 30 minutes receives only changed documents (measured
as in 030); deleted and no-longer-allowed records leave the phone; offline and sign-out wiping work as before; all
tests pass, including the rules tests.
