# Plan: Petty cash – a simple tin system for staff

Status: planned (27 Nov 2026), nothing built yet. Asked for by the Rector on 27 Nov 2026. A module `petty`
(`js/mod-petty.js`, rules file `js/petty.js` – pure and tested), off until an Administrator switches it on in
**Settings → Apps**. Handover: `docs/architecture/handover/petty-cash-opus.md` (rules and data) and
`petty-cash-sonnet.md` (screens). All questions are decided; made-up demo figures only (the repository is public).

## The idea
Staff spend small amounts of church money. Petty cash gives one place to see what is in each tin, what went out, who took it and why.
1. There are **several tins**. A tin is **shared** (several people use it) or **personal** (one person). Each has its own float,
   balance, low-balance level and month close.
2. Staff **record a spend** against a tin: amount, what for, category, date and a **photo of the slip (always required)**.
3. The **Keeper** checks the slip and approves it. The first Keeper is the church secretary; Administrators can change or add Keepers.
4. When a tin is low the Keeper **tops it up**. Cash moved between tins is a **transfer** (out of one, into the other).
5. At month end the Keeper **closes the month** for each tin; the Treasurer and Council see a one-page summary.

## Who sees what
- **Staff** (Administrators, Pastors, Roster coordinators, Children's ministry): record spends on the tins they may use; see those
  tins' balances and their own spends.
- **Keeper** (job `keepers` in `js/access.js`): sees every tin; approves, tops up, transfers, creates tins, closes months.
- **Treasurer and Council**: every tin, entry and summary, **read only** (only the Council sees finances to begin with; may widen later).
- Members and attendees: nothing.

## Approval rules (decided)
- Up to **R500**: the Keeper's approval is enough. **Over R500**: a second approver as well – an Administrator or a Council member,
  never the person who spent it, never the Keeper who gave the first approval. The R500 level is a setting (church's own currency).
- **May someone approve their own spend?** The Administrator's choice: a switch **"People may approve their own spends"**, **off by
  default**, set for the whole church or per tin. On: up to R500 on that tin. Over R500 always needs someone else. The app records who
  approved each spend so the Council can see it. Only Administrators (and the Rector) change the switch and the R500 level; changes
  go into the history.

## Two kinds of spend (decided: both)
- **"I took cash from the tin"**: cash leaves the tin when the spend is approved; the person adds the slip and the real amount, and any
  change back is recorded so the balance stays right.
- **"I paid and need reimbursing"**: paid with their own money; once approved the Keeper pays them back from the tin and marks it
  **Reimbursed**. The balance drops when the reimbursement is paid; the Keeper sees what is still owed.

## Slip photo (decided: compulsory)
- Every spend needs a photo of the slip, whatever the amount and kind. It cannot be sent for approval without it.
- Works offline: kept on the phone, sent when there is signal. Shrunk before upload to save data.
- The Keeper may send a spend back ("please retake the photo").
- **Lost slip (exception):** only an **Administrator** may approve a spend whose slip is lost, and must write a reason. It is marked
  **Slip lost** on the entry, in the month summary and in Church health; over R500 it still needs a second approver. The Keeper cannot
  do this alone.

## Money rules
- Amounts in the church's own currency, set once in Settings.
- A spend cannot take a tin below zero unless the Keeper agrees.
- Nothing is silently deleted: a mistake is **voided** with a reason (Undo and Version history apply).
- A balance is always **worked out from the entries**, never typed in.
- Categories (starter list, the Keeper edits): Stationery and printing · Refreshments · Cleaning and maintenance · Travel and fuel ·
  Children's ministry · Hospitality and gifts · Other.

## Ties with the rest of the app
- **Messages**: Keeper told of a spend waiting; the person told of approved / sent back / reimbursed; second approvers asked for
  anything over the level; a low-balance nudge to the Keeper.
- **Finance** (`docs/FINANCE-PLAN.md`): petty cash totals (all tins) as a line in budget vs actual.
- **Church health**: spends waiting over a week; reimbursements owed over a week; cash taken with no slip added yet; a month not yet
  closed on any tin; slips marked lost; own-spend approvals where that switch is on.
- Financial year starts in May (a setting); summaries can show the year to date. Usage dashboard counts it like any part.
- **Setup tool**: a step "Switch on petty cash, choose the Keeper, create the first tin, set its float, choose whether people may
  approve their own spends".
- Offline and data-saving: spends and photos are saved on the phone and sent later.

## Out of scope
Bank reconciliation, the church's main accounts, payroll, anything with real bank details.
