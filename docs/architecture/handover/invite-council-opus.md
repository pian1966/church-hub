# Who may invite people – the part for Opus

**Model: Senior (Opus).** Changes who may read contact details and write invitations (`firestore.rules`, `js/store.js`), so by
`docs/architecture/MODELS.md` rule 1 a lighter model must not do it. Written by Sonnet on 25 Nov 2026, after the Rector's answers.

## What the Rector asked (25 Nov 2026)

"Rector and staff and council must be able to invite people to Church & Trellis." His answers:
- **Staff** = all staff roles: Administrators, Pastors (the Rector is one), Roster coordinators and Children's ministry.
- **Council** members **may see contact details** (email and cellphone) of the people they invite.

## Where it stands today

- `js/people/welcome.js` `canInvite()` = `H.can('*') || H.can('people.edit')` (Administrators and Pastors only). It gates the
  invite dialog, the "Invite" button on a person's page, Home's to-do and People -> Invitations. The invitation records
  `appInvited` on the person.
- Giving a no-email member a sign-in code (`invites/{code}`) is **Administrators only** in `firestore.rules`; leave that as it is.
- Staff roles are `Access.STAFF_ROLES` (`admin`, `pastor`, `rosters`, `kids`); rosters and kids do not have `people.edit`,
  and may not read everyone's contact details.
- Council members are on Basic access; the app knows them through Leadership (`archivePreviewMembers`, `councilMember()` in
  `firestore.rules`, `store.js` ~line 354).

## Paste this to Opus

> You are working on Church & Trellis (read `CLAUDE.md` first, then `docs/architecture/MODELS.md` and the `docs/POPIA.md`
> section on contact details). Work on your own branch from the latest `main` (check that before pushing).
>
> **Job:** let Administrators, Pastors, Roster coordinators, Children's ministry and Council members send the email / WhatsApp /
> QR invitation to Church & Trellis, and remind people who haven't started. **Decided by the Rector:** Council members may see
> the email and cellphone number of the people they invite.
>
> 1. Add the permission to `js/access.js` as a job or permission (for example `people.invite`), granted to the four staff roles
>    and to Council members; show it on Settings -> Access and roles. Replace `canInvite()` in `js/people/welcome.js` with it.
> 2. Decide the narrowest read that works: staff roles and Council need the **email and mobile of invitable people only**
>    (not children, not people who have left, no notes, no ID numbers). Do not widen anything else a Council member or a
>    Roster coordinator can read. If the only way is to read the whole record, stop and ask the Rector.
> 3. Let them write `appInvited` (and nothing else) on a person: change `firestore.rules`, `plan()` in `js/store.js`, the POLICY
>    copy in `tests/fake-firebase.js`, `tests/rules.test.mjs`. Council membership costs Firestore steps (see the comment above
>    `recordAllows`): check it once, last. Keep `firestore.rules` to plain keyboard characters.
> 4. Sign-in codes for people without email stay Administrator-only; the invitation dialog must say so for others (it already
>    does for Pastors).
> 5. POPIA: add the purpose (inviting someone the church already holds), the people who may read it, and audit-log each
>    invitation (who invited whom, when – no email or number in the log).
> 6. Tests: `tests/app/welcome.js` for each of the six kinds of person (can / can't invite, sees contact details only for
>    invitable people), plus the rules tests.
> 7. Usual release work from `CLAUDE.md`: version (middle number), `node tools/stamp-files.js`, `NEWS` in `js/tips.js` with its
>    words (English, Afrikaans, isiZulu, isiXhosa, Sesotho), help answers in `docs/help/` (people.md, settings.md), setup tool,
>    brochure, presentation, the website. After merging, the church must re-publish the rules (`docs/RULES-AUTOPUBLISH.md`);
>    when you finish, give them both links: https://raw.githubusercontent.com/pian1966/church-hub/main/firestore.rules and
>    https://console.firebase.google.com/project/church-hub-7ec02/firestore/databases/-default-/security/rules
