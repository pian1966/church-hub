# Risks, and what to send back to the architect

## Hard to reverse – decide carefully, once

| # | Decision | Why it is hard to undo |
| --- | --- | --- |
| H1 | The website's address | Sign-in links, each church's authorised domain and key restriction, installed home-screen apps and the offline copy are all tied to it. Choose it before the first other church. |
| H2 | The Google account that owns the "Allow" window (task 001) | Moving it later means every church meets an unfamiliar window, and verification starts again. Use an account made for Church Hub, with a second person able to recover it. |
| H3 | A church's data region (helper step 4) | Google does not allow it to be changed. Show it in words and ask "Is this right?". |
| H4 | The shape of `public/hub` and of the church link (`?c=`) | Printed QR codes and shared links carry it. Only ever add fields. |
| H5 | The rules-version rule (`rulesAtLeast`) | Every later website depends on it. Never remove it or lower the number. |
| H6 | The Android app id | A published app cannot be renamed; the any-church app is a new listing (task 041). |

## Known risks

**R1 – Google must verify the "Allow" window.** The permission asked for (`cloud-platform`) is one Google calls
sensitive. Until verified, people see an "unverified app" warning and only 100 accounts in total may ever use it.
Verification needs: the address proved in Google Search Console, a privacy policy page, a short video of the helper,
and can take weeks to months. Start it as soon as the helper works (task 001 lists the steps).
*If Google refuses:* ask for the narrower `firebase` permission plus fewer steps, and turn the refused steps into
guided clicks. Escalate.

**R2 – Unproven automatic steps** (task 002 settles each):
- Switching on sign-in by API on a free project. *Fallback:* one guided click – the helper opens the church's
  Authentication page; the person clicks **Get started**; the helper carries on.
- Google sign-in with Church Hub's shared client id. *Fallback:* email link only for that church, plus the guided
  click to enable Google in the console (which makes its own client id).
- Reading `public/hub` with no key. *Fallback:* the longer church code (`TARGET.md` section 3).
- AI Logic and App Check by API. *Fallback:* AI stays a guided setup.
- First-time Google users accepting Google Cloud's terms. *Expected:* one guided click.

**R3 – Five email-link emails a day per church (free plan).** Google's published limit. Sign-in with Google is not
limited. Choices, cheapest first: (a) lead with Google sign-in and say plainly when today's emails are used up;
(b) see whether the church's own email (SMTP settings in the project) lifts the limit – untested;
(c) the church adds a bank card to its own project (25 000 a day; still free at church sizes) – a guided, optional step;
(d) add a second way in that needs no email from Google (for example a one-time code an Administrator reads out).
(a) is in task 031. (b) is a question for 002. (d) changes who can get in – **escalate before building**.

**R4 – Rules lag.** A church whose Administrator never clicks Update runs old rules. The app hides what needs newer
rules, so nothing breaks, but a security fix does not reach that church until they click. For a fix that matters,
the banner must say so. There is no way to force it without holding churches' keys, which is ruled out.

**R5 – Reads on the free plan.** A large church with busy staff could reach 50 000 reads in a day because every start
loads whole lists. Task 030 measures first. If it is a problem, the cure is fewer, bigger documents for the lists
everyone loads (for example the directory) – a data-shape change, so **escalate**.

**R6 – Google changes its addresses or console.** The helper would stop at a step. Each step must fail with a plain
message naming the step, and `docs/FIREBASE-SETUP.md` remains as the by-hand route.

**R7 – A church loses its Google account.** The data is theirs alone; nobody else can recover it. The helper should
say so, and suggest adding a second owner (a link to the project's access page).

**R8 – Church Hub's owner is still the publisher of software that holds sensitive information.** Not the operator of
anyone's database, but a short terms page ("each church owns and is responsible for its own information; provided
as is") should be read by a lawyer once before the first other church. Not legal advice.

**R9 – Countries not served.** With no central sign-up there is nothing to refuse. The helper can decline to create
a database for the listed countries and explain why; a determined person could still do it by hand.

## Send back to the architect instead of deciding

- 002 fails on project creation, adding Firebase, creating the database, publishing rules or writing the first
  documents.
- Anything that would put a church's information, keys or tokens somewhere other than that church's own project
  and that person's own browser.
- Any wish to add a server, Cloud Function, shared database or list of churches.
- Any change to who can read or write what, beyond the two rules added in 011 and 012.
- A new way of signing in (R3 d), or changing the household sign-in.
- Changing the shape of the documents everyone loads (R5).
- Google refusing verification (R1).
