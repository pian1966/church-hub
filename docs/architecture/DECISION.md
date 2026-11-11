# Church Hub for every church – the decision

Written 11 Nov 2026 as a plan for other sessions to carry out. Nothing here is built yet.
Read this first, then `TARGET.md`. The work is in `tasks/`.

## The decision in one paragraph

**Every church keeps its own database, in its own Google account – and Church Hub creates it for them.**
A church's Administrator opens Church Hub, clicks "Set up Church Hub for my church", signs in with the church's
Google account, clicks **Allow**, and waits about a minute. Church Hub does the ten steps of `docs/FIREBASE-SETUP.md`
by itself, in that person's browser. Nobody types anything into a Google console. Nothing about a church's people
is ever stored in, or passes through, any account belonging to the person who wrote Church Hub. The only central
record is a short customer list – each church's name, country and the email of the Google account that set it up –
kept for the yearly subscription (`TARGET.md` section 10).

Firebase is still underneath. What goes away is the church ever seeing it.

## Why this, and not the other ideas

| Idea | Why not |
| --- | --- |
| One shared database we run for all churches (the old Phase 7 of the roadmap) | The person who runs it becomes legally responsible for every church's personal information, including children's medical notes, and pays the bill. The owner of Church Hub does not want that. |
| No database at all (each phone keeps its own copy and they sync) | It cannot be done without losing things Church Hub does today: signing in by email, "only Pastors read pastoral notes", one roster everyone sees, messages that arrive. Those need a place every device trusts. |
| A different database product (Supabase, PocketBase, a server per church) | Each church would still need an account somewhere, usually paid, and somebody technical. It would also mean rewriting the data layer (`js/store.js`), all 466 lines of security rules and their tests, and the offline copy – the riskiest parts of the app – for no gain a church would notice. |
| Google Sheets / Drive as the database | No way to stop a signed-in member reading everything; slow; no offline copy. |

What makes the chosen route possible: Google lets a signed-in person's browser create and configure a Firebase
project through its public web addresses (the "Firebase Management API" and friends). Church Hub already works as
"one church, one project", so **the data layer, the security rules and Christ Church Howick's live data do not change**.

## What a church does (the target)

1. Opens `https://<church hub address>/` and clicks **Set up Church Hub for my church**.
2. Types the church's name and chooses its country (which decides where in the world the data is kept).
3. Clicks **Sign in with Google** – using the church's Google account, because that account will own the data –
   and **Allow**.
4. Watches a short list tick itself off (about a minute).
5. Lands on the existing "Set up Church Hub" screen as the first Administrator.
6. Shares the church's own link (for example `…/?c=ch-stmarks-7k2p`) or its QR code with members.

## What it costs

- **Each church:** nothing to Google – each has its own free Google allowance (50 000 reads a day, 1 GB), not a share
  of one, and Google asks for no bank card. To Church Hub: **one Big Mac a year at the price in the church's own
  country**, plus whatever extra the church chooses to give. A yearly reminder; after 60 days unpaid Church Hub
  becomes view-only (never deleted, always downloadable). The first 30 days are free.
- **Church Hub's owner:** the web address, and nothing per church.

## What Church Hub's owner still has to own (small, and holds no church data)

- The web address and the website files (GitHub Pages, as today).
- **One Google account for Church Hub itself** (not a personal one – for example `hello@<church hub address>`).
  Google insists that the "Sign in with Google / Allow" window belongs to somebody. It holds a name, a logo and a
  privacy policy. It never sees a church's information: the permission a church gives goes from the church's browser
  straight to Google.
- Getting that window **verified by Google** before more than 100 churches use it (see `RISKS.md`).

## What is honestly not solved by this

1. **Email-link sign-in is limited to 5 emails a day per church on Google's free plan.** Signing in with Google is
   unlimited. For members with no email at all – common in the churches Church Hub is meant for – the plan adds
   **sign-in codes**: the Administrator gives a member a code on paper or by WhatsApp, and that phone is linked from
   then on. Free, no daily limit, members only (`TARGET.md` section 9; tasks 015–017). Every church has all three
   ways in; none replaces another.
2. **Security rules live in each church's project**, so when Church Hub changes them, each church's Administrator
   has to click one button ("Update") once. Church Hub will tell them when. The app is built so it keeps working
   safely in the meantime (`TARGET.md`, "Rules versions").
3. **A few of the automatic steps are not yet proven** (they are documented by Google but have not been tried from a
   browser on a free project). Task 002 proves them before anything is built on them. Where a step cannot be
   automated, the fallback is one guided click with a picture, not the 30-minute guide.
4. **The Elvanto robot** stays for Christ Church Howick only.
5. **The subscription is a lock on the official website, not on the data.** Each church owns its database and the
   code is public, so a technical person could run a copy without paying. Accepted.
6. **Who receives the money, the tax on it, and the payment company** are decisions for people (task 059).

## What happens to the old Phase 7 in the roadmap

Steps 7.1 (one database for many churches), 7.2 (a project per region), 7.4 (operator agreement), 7.5 (backups for
a shared database), 7.6 (robot for many churches) and 7.9 (moving Christ Church Howick across) are **no longer needed**.
7.3 (sign-up) becomes the setup helper. 7.8 (gifts) becomes the subscription in `TARGET.md` section 10.
7.7 (countries we don't serve) and 7.10 (public website) remain.
