# Plan: Finances – the budget and how the church is tracking (for pastors and the Council)

Status: planned (19 Nov 2026), nothing built yet. Asked for by the church on 19 Nov 2026. A module `finance`
(`js/mod-finance.js`, rules file `js/finance.js` – pure and tested), off until an Administrator switches it on in
**Settings → Apps**. It sits beside Leadership and Archive and follows their access model.

## Decided (19 Nov 2026)
- **The Treasurer is a role on the Council** in Leadership: whoever holds the role *Treasurer* in the Council (`leaderBodies`)
  is the Treasurer in Finances – no separate list in Settings. When the role passes to someone else at the end of a term,
  Finances follows automatically.
- **Only the Council sees Finances** to begin with – every current member of the Council (which includes the Treasurer).
  Not Administrators, pastors or staff unless they are on the Council. Settings keeps a choice to widen this later
  (e.g. a finance committee, the wardens, all pastors), but it starts as Council only.
- **Financial year starts in May** (May–April) at Christ Church Howick. It is a setting, because it may change: changing it
  starts the new pattern from the next budget year, and earlier years keep the months they were budgeted with.

## What the church asked for
- The Rector, the pastors and the Council can see the **budget set for the year**.
- The **Treasurer** updates it whenever the monthly management reports are produced (about 10 times a year), with the month
  and the **year to date**.
- At a glance: **is the church on track financially right now, or not?** – with **areas of concern, anomalies,
  overspends and underspends** highlighted.

(Compared: ChurchHUB.AI at getchurchhub.com, a different product, offers a "Budget Analyzer" that turns spreadsheets into
plain-language insights for boards. Its website doesn't show more than that. Church Hub does the same job inside the app, with
the church's own figures and no extra subscription.)

## Who sees what
- **Treasurer** – the person holding the *Treasurer* role on the Council (Leadership): sets the budget, uploads reports,
  writes notes, sees every line. (Later, if wanted: the Treasurer may name a bookkeeper to help upload.)
- **Council members**: see the dashboard, the lines and the notes; can ask the Treasurer a question about a line (a message in
  Messages, with the line attached).
- **Nobody else, to begin with** – not Administrators, pastors or staff unless they are on the Council; members never.
  An Administrator can switch Finances on, but **cannot see the figures** unless on the Council, and only a Council member who
  is an Administrator (or the Rector, if on the Council) can widen who sees it later – so access can't be quietly given away.
- The Council already has its members and term dates in Leadership; someone whose term ends loses access the same day.
- **Salaries**: a budget line can be marked *Staff pay – show as one total*, so the Council view shows "Staff costs" as one line
  and individual pay is seen only by the Treasurer and Administrators (POPIA – pay is personal information).
- **Giving by person is never here** – only totals.

## 1. The year's budget
- **Financial year** chosen in Settings (Christ Church Howick: **May–April**; any starting month) – shared with the Archive
  folders' financial-year option on the roadmap.
- **Import the budget from the spreadsheet** the Treasurer already uses (Excel or CSV, read with `js/xlsx-lite.js`): Church Hub
  shows the columns and asks which is the line name, the account number (if any) and the amount(s). Or type it in.
- Lines are grouped as **Income** (giving, collections, hall hire, interest…) and **Expenses** (staff costs, ministry, buildings,
  diocesan assessment, missions…), with sub-groups the Treasurer chooses.
- **Spread over the year**: evenly, or as the spreadsheet gives month by month (giving dips in the holidays and rises at
  Christmas; insurance paid once a year). The on-track check compares with the *expected-by-now* amount, not just a twelfth.
- **Approved by the Council on** (a date) and the approved budget kept; a mid-year **revised budget** can be added, with both
  shown.

## 2. Monthly management reports (about 10 a year)
- The Treasurer taps **Add this month's figures** and uploads the management accounts spreadsheet (actual for the month and
  year to date). Church Hub matches each row to a budget line by account number or name, and **remembers the matching** so
  next month it is automatic; anything new or unmatched is asked about once.
- **Skipped months are fine**: a report can cover two months (e.g. December–January); year-to-date figures keep everything
  right, and the dashboard says which month the figures run to.
- The Treasurer can attach the **PDF report** – it is filed in the Archive (Finance folder, sorted by Year → Month, as the Archive
  already does) so there's one copy.
- After saving, Council members get a short message: "March figures are in – 2 things to look at."

## 3. The dashboard – "Are we on track?"
- One big **traffic light** for the year to date: **On track** (green), **Watch** (amber), **Concern** (red), with one plain
  sentence: "Income is 6% behind budget and expenses 2% under – a shortfall of R38 000 so far."
- Four tiles: **Income** (year to date vs expected), **Expenses**, **Surplus or shortfall**, and **Year-end if this continues**
  (a simple projection at the current pace, clearly labelled as an estimate).
- A **line chart** of income and expenses through the year against the budget (cumulative), and a bar list of the groups.
- **Things to look at**, sorted by how much they matter (amount × percentage), each with a short reason:
  - **Overspend** – a line past its expected-by-now amount by more than the church's threshold (default 10% *and* R2 000), or
    already past its whole year's budget.
  - **Underspend** – a line well under (money for ministry not being used, or a bill not yet paid – the Treasurer can say which).
  - **Income behind** – giving below expected, and **falling for three reports in a row**.
  - **Anomalies** – a month far out of line with that line's usual months, a line with spending but no budget, a budget line
    with nothing at all by mid-year, a figure that went down year to date (a correction worth explaining).
- The **Treasurer's notes** sit beside each flag ("Roof repair approved by Council in March", "Insurance paid annually in
  April") and turn a flag grey once explained, so the Council sees what is truly unexplained.
- Thresholds (percentage and amount) set by the church in Settings.
- **Print for the Council pack**: one A4 page – the traffic light, the four tiles, the chart and the things to look at.
- Phone (390px) first, figures in the church's own currency, light on data (charts drawn on the phone from the numbers, no
  pictures downloaded).

## 4. Later: a summary in plain words (AI, optional)
With AI switched on for the church (as for *Ask in your own words*), a **"What the Council should know this month"** paragraph
written from the figures and the Treasurer's notes only – no names, no salary lines. Off by default; the dashboard works fully
without it.

## Privacy and safety (add to `docs/POPIA.md` when built)
Church finances are mostly not personal information, except staff pay (handled above) and anything naming a person in a note
(the Treasurer is reminded not to). Access rules change `firestore.rules`, `plan()` in `js/store.js`, `tests/fake-firebase.js`
and the tests together; the Treasurer is a new kind of access – have the Architect (Fable) read that rules diff. Views of the
lines are audit-logged.

## Build order (each its own release and pull request)
5.1 Settings (switch, financial year, who sees it – Council by default – the Treasurer taken from Leadership) and the budget (import or type, spread) →
5.2 monthly figures (import, matching remembered, PDF to Archive, message) →
5.3 the dashboard (traffic light, tiles, chart, things to look at, notes, thresholds) →
5.4 print for the Council pack; revised budget →
5.5 the AI summary.
With every step: the five kept languages, What's new, the setup tool (`GROW`), brochures, presentation and website, as CLAUDE.md asks.

## Decisions waiting (defaults above until the church decides)
- The thresholds for "overspend" (10% and R2 000 to start?).
- Should staff pay always show as one total to the Council?
