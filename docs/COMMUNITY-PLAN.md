# Plan: Events, Community board, Marketplace and Midweek Group online links

Status: the Community board (part 2) and the Marketplace (part 3) were built in 0.97.0 (19 Nov 2026) – see docs/CHANGELOG.md; Midweek Groups online (part 4) was built in 0.99.0 (19 Nov 2026) – "Send on the day" without a server: the message waits in Messages until then (the phone notification comes with push notifications); Events (part 1) – events, sign-up and reminders 3 days and 1 day before (in Messages, and by email through the email robot) – was built in 0.101.0 (20 Nov 2026); the waiting list, questions, cost and check-in are still to come. Asked for by the church on 19 Nov 2026. Each of the four parts is its own
module (`js/mod-*.js`, `Hub.register`), switched on or off by an Administrator in **Settings → Apps**, and each step below is
its own release and pull request. Read the matching section of `docs/POPIA.md` before building any of them.

## Decided (19 Nov 2026)
- **Marketplace: Church Partners only** – only Church Partners can see it and post on it. Attendees (Basic access) don't see
  it at all (no menu entry, no Home card), whatever Settings → Attendees says.
- **First keepers** (for the board and the marketplace): the **pastors**, the **Administrators** and the **church secretary**
  (the extra person already named in Settings for roster declines). These are the defaults for every church; the
  Administrator can add or remove keepers in Settings.

The four parts share three ideas, built once and used by all:

1. **Keepers (moderators).** An Administrator nominates one or more *keepers* for the Community board and for the
   Marketplace (Settings → Apps → the part → Keepers). A keeper must be a Church Partner. Keepers see a
   **Waiting for approval** tab and receive each new item in their **Messages** inbox with *Approve*, *Ask for a change* and
   *Decline* (a kind reason goes back to the person). By default the keepers are the pastors, the Administrators and the
   church secretary (see Decided); a keeper must be a Church Partner or staff. Nothing appears to anyone
   else until a keeper approves it. Everyone can tap **Report** on a live item; the report goes to the keepers.
2. **Contact through Messages, not public threads.** "I can help" / "I'm interested" sends a private message to the person
   who posted (the private replies built in 0.72.0). No public comment threads – this keeps arguments off the board, keeps
   people's inboxes calm and keeps phone numbers private unless the poster chooses to show one.
3. **Things tidy themselves away.** Notices and listings end after 30 days (the poster gets a reminder a few days before and
   can renew once or twice); *Sorted, thank you!* / *Sold* / *Found* takes them down at once. Ended items are deleted after a
   further 30 days (POPIA: keep no longer than needed).

Who may post: Church Partners. The **marketplace is Church Partners only** (decided). For the **board**, Settings → Attendees
gets a tick so a church can let attendees see and post on it too (`Msg.attendeeCan` style) – off by default. Everything here is for signed-in people of the
church only – never public, never on the website.

---

## 1. Events – organising and registration (`events`, `js/mod-events.js`, rules file `js/events.js`)

**For organisers** (Administrators, the Office, and anyone given *Event organiser* in Settings → Roles; an event can also name
its own organisers, e.g. the youth leader for a youth camp):
- **New event**: name, a picture or poster (made small on the phone before upload, to save data), date and time (one day,
  several days, or repeating), place (the church, or an address with a map link), what it's about, who it's for
  (everyone, Church Partners, a group, a service, children of an age), and whether people must sign up.
- **Sign-up settings**: how many places (a waiting list when full, moving people up automatically when someone cancels),
  closing date, guests allowed (with how many), a household signing up together (pick who is coming), and up to a few
  questions of the organiser's own (e.g. "Bringing a dish?", T-shirt size). Dietary and medical questions are a ready-made
  choice with a POPIA note, seen only by the organisers and deleted after the event.
- **Cost (optional)**: an amount and how to pay (EFT with a reference made for each person, or at the door). Organisers tick
  *Paid*. No card payments until a payment company is chosen (task 059).
- **Who's coming**: a list with counts (adults, children, guests), answers to the questions, export to a spreadsheet, print a
  list for the door, and **Message everyone who signed up** (Messages). An automatic reminder the day before.
- **At the door**: tick people in (later: the same QR check-in as kids' check-in in Phase 4), add walk-ins.
- **Volunteers**: later, link an event to Rosters so helpers are rostered for it.

**For members**:
- An **Events** page: what's coming up, as picture cards (the poster, date and a big *I'll be there* button), and *My events*.
- **I'll be there** → choose who in the household is coming → answer the questions → done, with *Add to my calendar*
  (an .ics file – works on every phone, no Google needed) and *I can't come after all*.
- **Home**: a small "Coming up" card with the next one or two events people can sign up for.
- **Guests without Church & Trellis** (later step): a sign-up link the Office can share on WhatsApp or the website – name, cellphone,
  email and consent only, kept until 30 days after the event. Needs a careful rules review (writing without signing in).

**Build order**: 1.1 events and the Events page (no sign-up) → 1.2 sign-up, places, waiting list, questions, Who's coming,
message and reminder → 1.3 cost and *Paid* → 1.4 door check-in and walk-ins → 1.5 the public sign-up link for guests.

---

## 2. Community board (`board`, `js/mod-board.js`, rules file `js/board.js`)

A notice board where people pin notices and ask for help – "I need a plumber", "Anyone know a good mechanic?",
"Lift to church from Hilton?", "Free to a good home: kittens", "Lost: blue umbrella after the 10am" – so that requests go on a
board people choose to look at, instead of into everyone's inbox.

**Kinds of notice** (each its own colour of sticky note):
- 🟨 **I need help** (a tradesperson, a lift, a meal, a hand moving house)
- 🟩 **I can offer** (a skill, spare time, lifts)
- 🟦 **Notice** (lost and found, general news from members)
- 🟪 **Thank you** (a public thank-you – these make the board a happy place)

Prayer requests and pastoral needs stay out: they belong on the **Care board** (Phase 2), which is private to pastoral
staff and leaders. The board explains this gently and offers a link to write to the Office instead.

**The look – a real corkboard, not a list** (the church asked for it to be fun):
- A cork-textured background (a small CSS pattern, not a big picture – data saving), with notes as **sticky notes** in soft
  colours, each turned slightly (−3° to +3°, fixed per notice so it doesn't jump about), held by a **coloured push-pin** or a
  strip of **washi tape**, with a gentle shadow, as if really pinned up.
- Note text in a friendly hand-written style font that is still easy to read (one small font file kept on the device, or the
  phone's own rounded font – decide by size); the title large, two or three lines of detail, the poster's first name and
  when it was pinned.
- Tapping a note lifts it off the board (it grows and straightens in the middle of the screen) to show everything, with
  *I can help* / *Message* and *Report*.
- **Pinning a new note**: the main button *Pin a notice* → choose the colour/kind → write → the note "flies" onto the board
  with a little pin-press, marked *Waiting for a keeper* (dashed edge, faint) until approved – only the poster sees it then.
- **Sorted, thank you!** puts a "Sorted ✓" stamp across the note for a day, then it's unpinned.
- Phone (390px): two columns of notes; desktop: a wider board. Filter by kind with coloured chips (folded until used).
- **Dark mode**: a chalkboard with the notes still in colour. **Reduced motion**: no flying or tilting. Screen readers get a
  plain list of the same notices.

**Moderation**: every notice goes to the board's keeper(s) first (see *Keepers* above). Later the church may choose *Check
after posting* for people whose notices have always been approved – off by default.

**On Home (and Me)**: a small **Community board** card showing the latest 3 approved notices as tiny sticky notes (title
only), with *See the board*. Anyone can hide the card from their own Home.

**A short note on the board**, written by the church in Settings (a default is supplied): the church doesn't vouch for
tradespeople or offers on the board; people arrange things between themselves.

**Build order**: 2.1 board, notices, keepers and approval, Home card → 2.2 the full corkboard look and animations →
2.3 renew/expire reminders, reports, *Check after posting*.

---

## 3. Marketplace (`market`, `js/mod-market.js`, rules file `js/market.js`)

Like Facebook Marketplace, but only for the church and **vetted**: **nothing is shown until a Marketplace keeper approves
it**, and changes to a listing (other than marking it sold or lowering the price) go back to the keeper.

**Listings** – four kinds, as tabs: **For sale**, **Wanted**, **Free** (give-aways), and later **To lend** (borrow a
trailer, a drill). Each has: a title, up to 3 photos (made small on the phone – about 100 KB each – and saved in parts like
Archive files), the price in the church's currency (or *Free* / *Make an offer*), condition, a category (furniture,
children, clothing, vehicles, electronics, books, household, garden, other), and the area (suburb only, never an address).

**The look**: a grid of photo cards like Facebook Marketplace (photo, price large, title, area), search and category chips
(folded until used), *My listings*, and a listing page with the photos to swipe and *I'm interested* (a private message to
the seller with the item attached).

**Marketplace rules**: the Administrator writes or uploads the rules (a default is supplied: no weapons, alcohol,
medicines, animals for breeding, business advertising beyond a member's own skills, nothing illegal); posters tick that they
accept them. Safety tips on every listing (meet at church after a service, don't pay before seeing the item). No payments go
through Church & Trellis, and the church is not a party to any sale.

**Keepers**: may be the same people as the board's keepers or others (Settings). They see the photos before approving.

**Build order**: 3.1 listings with photos, keepers and approval, For sale / Wanted / Free → 3.2 search, categories, My
listings, mark sold, expiry and renew → 3.3 To lend, reports.

---

## 4. Midweek Groups online: this week's meeting links (inside `js/mod-life.js`)

Christ Church Howick live-streams its Wednesday night Bible study and each week sends the **Google Meet link** and the link
to a **Google Doc of the notes** on WhatsApp. This brings that into Church & Trellis.

**For the group's leader** (or a helper the leader names in the group):
- On the group's page, **Post this week's links**: the meeting link (Google Meet, Zoom, Teams or YouTube Live), the notes
  link (Google Docs, a PDF, or any link), and optionally the topic or passage. The date is filled in from the group's meeting
  day (Groups plan step 2); the meeting link is remembered from last week, since a recurring Meet link stays the same – so most
  weeks only the notes link is new.
- **Send now** or **Send on the day** (e.g. Wednesday 17:00 – needs the small server step that push notifications need;
  until then, Send now).
- Each group chooses who receives it: **the group's members**, or – for a live-streamed study – **open to the whole church**
  (anyone signed in sees it on the Midweek Groups page and on Home that day).

**For members**:
- A message in **Messages** ("Wednesday Bible study – tonight 19:00") with two big buttons: **Join the meeting** and
  **Open the notes**. Later, a phone notification too.
- On the day, a card on **Home**: "Bible study tonight at 19:00 · Join · Notes", which turns into *Join now* 15 minutes before.
- On the group's page, **Past studies**: each week's topic and notes link, so anyone who missed a week can catch up.

**Safety**: only http(s) links; known meeting and document sites show their name and icon; any other link shows the address
plainly with a gentle "check this link" note. Church & Trellis stores the links only – nobody needs to connect a Google account.

**Build order**: 4.1 Post this week's links, the message, Home card on the day, Past studies → 4.2 open to the whole church →
4.3 Send on the day (with push notifications, Phase 5).

---

## Privacy (POPIA) – add to `docs/POPIA.md` when built
- **Events**: purpose – organising the event; dietary/medical answers seen by organisers only and deleted after the event;
  guests' details deleted 30 days after the event.
- **Board and Marketplace**: the poster chooses to share what they write; their first name shows to signed-in people of the
  church; phone numbers only if the poster adds them; items deleted 30 days after they end; keepers' decisions logged.
- **Midweek links**: no personal information beyond the group, which members already agreed to share.
- Access rules for each change `firestore.rules`, `plan()` in `js/store.js`, `tests/fake-firebase.js` and the tests together
  (CLAUDE.md). Keepers and organisers are new kinds of access: have the Architect (Fable) read those rules diffs.

## With every step
Words in all five kept languages, What's new on Home, the setup tool (`GROW` items for each switch and the Keepers),
the brochures, the presentation and the public website (`site/index.html`), as CLAUDE.md asks.

## Decisions waiting (defaults above until the church decides)
- May attendees (Basic access) see and post on the **community board** (the marketplace is decided: Church Partners only)?
- Should Thank-you notes need approval too, or go straight up?
- Is 30 days right for notices and listings?
- Event cost: EFT reference and *Paid* tick for now – later card payments with task 059?
