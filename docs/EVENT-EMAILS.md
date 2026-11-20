# Event reminders by email – setting it up

When people sign up for an event, Church & Trellis reminds them **3 days before** and **1 day before**.

- **In Messages – always, nothing to set up.** Each person's own Church & Trellis puts the reminder in their Messages on the
  day it is due (the menu shows it as a new message).
- **By email – for people who ask.** When an organiser ticks **Offer reminders by email too** on an event, people signing up
  see **Email me reminders too**. A small robot on GitHub sends those emails every morning (about 06:40) from the church's
  Gmail, in each person's own language. This page sets that robot up. It takes about 15 minutes, once.

Until it is set up, nothing breaks: the reminders in Messages still go, and the robot just says "not set up yet".

## What you need
- The church's **Gmail** account (the one the emails should come from), with **2-Step Verification** switched on.
- The **robot's Church & Trellis sign-in**. If you already set up the Elvanto robot (`docs/ELVANTO-ROBOT.md`), you have it –
  skip to Step 2.

## Step 1 – Give the robot a Church & Trellis sign-in (only if you haven't already)
Follow **Steps 1 and 2 of `docs/ELVANTO-ROBOT.md`** (make the robot's account in Firebase, then tell Church & Trellis its email
and User UID under **Leave → Elvanto** – you can leave every Elvanto tick off). Then on GitHub add the two secrets
**ROBOT_EMAIL** and **ROBOT_PASSWORD** as in its Step 4 (you don't need the Elvanto ones).

## Step 2 – Make an app password for the church's Gmail
An app password lets the robot send email without knowing the real Gmail password, and you can take it away at any time.
1. Sign in to the church's Gmail, then open **https://myaccount.google.com/apppasswords**.
   (If Google says the page isn't available, switch on **2-Step Verification** first: **https://myaccount.google.com/signinoptions/two-step-verification**.)
2. **App name:** type `Church and Trellis reminders` → **Create**.
3. Google shows a code of 16 letters in four groups. **Copy it** – you only see it once. (Spaces don't matter.)

## Step 3 – Give the robot the Gmail details (GitHub)
1. Open **https://github.com/pian1966/church-hub/settings/secrets/actions** (signed in to GitHub).
2. Click **New repository secret**. **Name:** `GMAIL_USER` – **Secret:** the church's Gmail address → **Add secret**.
3. Click **New repository secret** again. **Name:** `GMAIL_APP_PASSWORD` – **Secret:** the 16-letter code from Step 2 → **Add secret**.
4. *(Optional)* The emails come from the church's name as written in Settings. To use another name, open the **Variables** tab →
   **New repository variable** → **Name:** `MAIL_FROM_NAME`, **Value:** e.g. `Christ Church Office` → **Add variable**.

## Step 4 – Publish the new security rules
If GitHub publishes the rules for you (`docs/RULES-AUTOPUBLISH.md`), this happens by itself once the change is merged.
Otherwise copy the rules again as in `docs/FIREBASE-SETUP.md` step 7:
- the rules file: **https://raw.githubusercontent.com/pian1966/church-hub/main/firestore.rules**
- paste them here and click **Publish**: **https://console.firebase.google.com/project/church-hub-7ec02/firestore/databases/-default-/security/rules**

## Step 5 – Try it
1. Open **https://github.com/pian1966/church-hub/actions** → **Event reminders by email** (left) → **Run workflow** → **Run workflow**.
2. After a minute a **green tick** means it worked. Click the run to see a line like `Event reminders: 2 sent`. It never
   shows names or addresses (this page is public).
3. To see an email arrive: put up a test event 2 days from today with **Offer reminders by email too**, sign up with
   **Email me reminders too** and your own address, and run it again.

## Good to know
- **Each reminder goes once.** The robot notes on each sign-up which reminders it sent. If a day was missed, only the latest
  one goes (nobody gets "in 3 days" the day before).
- **Cancelled events** and people who tapped **I can't come after all** get no more reminders.
- **Gmail's limit** is about 500 emails a day – plenty for a church.
- **Privacy (POPIA):** an email address is kept on a sign-up only when the person ticks *Email me reminders too*, only for that
  event, and is deleted with the sign-up 30 days after the event. To stop the robot, delete the `GMAIL_APP_PASSWORD` secret
  (or remove the app password in Google).
- **Another time zone:** the robot counts days in South African time. A church elsewhere changes `TZ` in
  `.github/workflows/event-reminders.yml` to its own (e.g. `Europe/London`).
