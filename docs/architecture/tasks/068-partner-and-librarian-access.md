# 068 – Two new access levels: Partner access and Librarian access

**Model:** Architect first (Fable 5.2 designs the rules and the matrix), then Senior (Opus 5.5) builds it. Not for a light model.

**Status:** draft requested by the owner, 11 Nov 2026. Not started. Two questions for the owner come first (below).

## What is asked
1. Two new access levels for signed-in people:
   - **Partner access** – for Church Partners who should see more than Basic access allows.
   - **Librarian access** – for the people who run the Library.
2. The **Rector** (Senior Pastor) or an **Administrator** decides, in Settings → Who can see what, what each of the two levels may see, field by field, the same way Basic access, Roster coordinator and Children's ministry are set today.

## What already exists (so the change is small where it can be)
- **Librarians today** are not a role. They are Administrators plus people listed in `settings.librarianIds` (`firestore.rules` ~438–439; `js/mod-library.js`). A librarian can add books, record loans and returns. Loans are seen only by librarians and the borrower.
- **Church Partner** is a *category* on a person (`people.category`), and "Basic access" is the role Church Partners get in Settings. The app's roles are in `firestore.rules` (`okRoles`, `smallRole`) and in `docs/ARCHITECTURE.md` ("Roles").
- **Who sees what** is a settings table (`settings.seeOthers`, `seeCare`, `seeCareOwn`) applied by `syncDirectory` (`js/store.js`) and checked by `PeopleParts.mayShare`.

## Questions the owner must answer before design
1. **"Partner access"**: does it mean (a) a *new sign-in role* for Church Partners, which some Church Partners get and others don't, or (b) the existing Basic access for every Church Partner, with a new name? Option (a) is a new role in the rules; option (b) is a rename plus a matrix.
2. **Librarian access**: should it become a real role on the access list (`roles/{email}`, role `librarian`), replacing `settings.librarianIds`? Or stay a list of named people, with the matrix only deciding what they see *beyond* the Library?
3. **Can one person hold more than one level?** (Today a shared sign-in can hold several roles, up to 4 people; a person's record has one `appRole`.)
4. **Who can change the two levels' settings?** Proposed: the Rector and Administrators only.

## Design constraints (from the plan; do not relax)
- Changing who sees what means changing **together**: `firestore.rules`, `plan()` in `js/store.js`, the POLICY copy in `tests/fake-firebase.js`, `tests/rules.test.mjs`, `tests/app/*.js`, and the matrix copy in `docs/ARCHITECTURE.md`.
- **Never** let either level see pastoral notes, medical notes, ID numbers, or the audit log, whatever the matrix says. The matrix can only *widen* what the level sees within the existing rules, never past them. Show this in a test.
- **Rules version:** adding a role is a rules change, so it raises `rulesVersion()` (task 012). Churches whose rules are older simply don't see the new levels until they update (task 022).
- **Privacy (POPIA):** each new visibility must have a purpose and an access rule by role, and be logged where it reveals sensitive information (`docs/POPIA.md`).
- **Shared sign-ins:** a librarian or partner sharing an email with a spouse must not gain the spouse's roles by accident (`roles/{email}` `roles` union).
- **Sign-in codes (015–016):** a code may only ever give **Member**. Neither new level may be given by a code unless the owner decides so; this is an escalation point in `RISKS.md`.

## Steps (after the questions are answered)
1. Write the matrix as a table in `docs/architecture/ACCESS.md`: each level × each field, default off.
2. Rules and `plan()` for the two levels; tests proving the ceilings (no notes, no ID numbers, no audit log for either level) and that existing roles are unchanged.
3. Settings: two new columns in Who can see what, with "i" tips, saved together (`data-autoscope`).
4. Librarian: migrate `settings.librarianIds` to the role (or keep both during a transition), with a test that existing librarians keep access.
5. Translations through the handover file (light model), help pages, roadmap entry.

## Acceptance
- Rules tests pass; the new levels cannot read anything in the forbidden list.
- Browser test: the Rector sets a field for Partner access; a Partner sees it; a Basic-access member does not.
- Existing librarians still work after migration.

## Do not
- Give either level write access to people records, notes, or settings.
- Start this from the sketch alone; answer the four questions first.
