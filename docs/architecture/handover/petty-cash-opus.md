# Petty cash – the part for Opus

**Model: Senior (Opus).** New collections, `firestore.rules`, `js/store.js` and who may read or write them: by `docs/architecture/MODELS.md`
rule 1 a lighter model must not do this. Sonnet builds the screens (`petty-cash-sonnet.md`) on the same branch once the data layer exists.
Read `docs/PETTY-CASH-PLAN.md` first: every question in it is decided.

## Paste this to Opus
> You are working on Church & Trellis (read `CLAUDE.md`, `docs/architecture/MODELS.md`, `docs/POPIA.md`, `docs/PETTY-CASH-PLAN.md`,
> and the Finance section of `docs/FINANCE-PLAN.md` for how Council access works). Work on your own branch from the latest `main`
> (check it – the church asks every time before pushing). Say which tier you are running at.
>
> 1. **Data** (collections, shapes in the plan; keep amounts as whole cents, never floats; nothing here holds real bank details):
>    - `pettyTins/{id}`: name, `kind` 'shared'|'personal', `users` (person ids; one for personal), `float`, `low` (low-balance level),
>      `selfApprove` (true|false|absent = use the church setting), `colour`, `active`.
>    - `pettyEntries/{id}`: `tin`, `type` 'spend'|'topup'|'transfer'|'reimburse'|'change'|'void', `kind` ('cash'|'paid') for spends, `amount`,
>      `what`, `category`, `date`, `by` (person id), `slip` (file id), `slipLost` ({by, reason} or absent), `status`
>      'draft'|'waiting'|'approved'|'sent-back'|'voided', `approvals` (list of {by, at}), `note`, and for transfers `toTin`.
>      Balance is **derived** from approved entries – never stored as a number the client can set.
>    - `pettyMonths/{tin_YYYY-MM}`: the close – opening, closing, counted cash, difference, `closedBy`.
>    - Settings (church-wide, in the existing settings document or a new one): `pettyLevel` (default 50000 cents = R500), `pettySelfApprove`
>      (default false), `pettyKeepers` (person ids; the church secretary to start with, set in Settings).
> 2. **Rules** (`firestore.rules`, `plan()` and the COLLECTIONS in `js/store.js`, the POLICY copy in `tests/fake-firebase.js`,
>    `tests/rules.test.mjs`, and `js/access.js` – a new `PARTS` entry `petty` with permissions and the job `keepers`; keep `firestore.rules`
>    to plain keyboard characters):
>    - **Read**: a person reads the tins they are in and their own entries (and the entries of a shared tin's balance only as far as the
>      balance needs – decide and document); Keepers read everything; **Council members and the Treasurer read everything, read only**;
>      nobody else, including members, attendees and Administrators who are not Keepers or on the Council *except* that Administrators
>      must be able to administer tins, approve a lost slip and be second approvers – give them what that needs and no more.
>    - **Create**: a person may create a spend only for a tin they use, as themselves, as `draft` or `waiting`, never `approved`.
>      A spend cannot be `waiting` without a `slip`, **unless** `slipLost` is set – and `slipLost` may be set only by an Administrator.
>    - **Approve** (enforce in the rules, not only on screen): an entry becomes `approved` only when the approvals satisfy the plan: one Keeper
>      approval up to the level; over the level, a Keeper **and** a different Administrator or Council member, neither of them the spender.
>      The spender may approve their own spend only when the tin's `selfApprove` (else the church `pettySelfApprove`) is true and the amount
>      is within the level; never over it. The Keeper may not be both approvers.
>    - **No overdrawn tin** unless the Keeper's approval carries an explicit "allow below zero" flag.
>    - **Immutable once approved**: no client edit or delete; a mistake is a `void` entry written by a Keeper or an Administrator with a reason.
>      Nothing is deleted by clients; `purge` of a person removes or anonymises their spender id only as `docs/POPIA.md` allows – decide, and keep the
>      money records (finance records have a retention rule: say what it is).
>    - Only Administrators and the Rector change `pettyLevel`, `pettySelfApprove`, `pettyKeepers` and a tin's `selfApprove`; log each change.
>    - Months: only a Keeper closes; a closed month's entries cannot change.
> 3. **Store**: load tins and entries only for those who may read them (so nobody else downloads them; keep them out of the offline copy for
>    others); slip photos go through `saveFile` like other files, readable only by those who may read the entry; keep photos small. Add the new
>    kinds to `History.COVER` and the `okHist` lists so Undo and Version history cover them (never the slip photo itself).
> 4. **The pure rules file `js/petty.js`** (tested in `tests/petty.test.js`, added to the CLAUDE.md list of rules files): balance of a tin, month
>    totals, who must approve a given entry (the function Sonnet's screens and the rules tests both use), health checks, transfers. One source of
>    truth: the screens must not re-implement the approval rule.
> 5. **POPIA** (`docs/POPIA.md`, a new section "Petty cash"): purpose, lawful basis, who sees what, what is kept and for how long, slip photos
>    (may show names or card numbers – say staff must not photograph cards, and that photos are readable only by the people above).
> 6. **Tests**: rules (a staff member cannot approve their own spend when the switch is off; can when on and within R500; never over R500;
>    Keeper alone cannot approve over R500; Council and Treasurer read but cannot write; members see nothing; `slipLost` only by an
>    Administrator; no submit without a slip; approved entries cannot be edited; overdraft refused), the fake-firebase copy, and the pure tests.
> 7. **Release work** from `CLAUDE.md` for your part (Sonnet finishes the screens, words, help, brochure, presentation, NEWS and setup tool):
>    raise the version, `node tools/stamp-files.js`, run the **full browser test** before pushing (this changes who sees what), and tick or add
>    lines in `docs/ROADMAP.md`. If the church has not set up `docs/RULES-AUTOPUBLISH.md`, give them **both links**: the `firestore.rules` file
>    (https://raw.githubusercontent.com/pian1966/church-hub/main/firestore.rules) and the Firebase rules page
>    (https://console.firebase.google.com/project/church-hub-7ec02/firestore/databases/-default-/security/rules).
> Never put real names, amounts, slips, keys or banking details in the repository. Finish by listing the new English lines in
> `docs/architecture/handover/petty-cash-words.md` (MODELS.md rule 2).

## Details to settle while building (use the plan's intent; note what you chose)
- How a shared tin's members see each other's spends (suggest: they see the tin's balance and their own spends; the Keeper sees all).
- Whether the second approver may be a Council member who is also the Keeper (no: two different people).
- The retention period for petty cash records (suggest: as the church's financial records – ask the Rector what the church requires).
