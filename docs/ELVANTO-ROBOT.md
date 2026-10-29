# The Elvanto robot – setting it up

The robot does two jobs:
1. **Church Hub → Elvanto:** when leave is approved in Church Hub, the person is marked unavailable in Elvanto, so nobody rosters
   them in Elvanto while they're away (as Leave Manager did). Switched on at switch-over (step 6).
2. **Elvanto → Church Hub (until you switch over):** every night it reads who is unavailable in Elvanto – names and dates only,
   never the reason – and an Administrator checks and adds them to Church Hub as away dates (step 7).

Volunteers' **departments and positions** come across with the Elvanto import (Import → From Elvanto, the "Department
Positions" column), not the robot: the export already holds them exactly, and reading them page by page in Elvanto would be
slow and break easily. Run the import again whenever you want them refreshed – it adds, never removes.

**How it works.** Elvanto doesn't let other programs set "Unavailable Volunteers", so a robot logs into Elvanto with a browser
every 15 minutes (on GitHub) and adds, changes or removes the unavailability, like a person would. Each entry it makes has the
note "Church Hub ‹request ID›". Church Hub keeps the list of what needs doing under **Leave → Elvanto**, and shows what the robot
did. The robot has its own Church Hub sign-in that can only see that list (names and dates – never the kind of leave or the reason).

It takes about 15 minutes to set up. Use a computer. Never paste passwords into a chat.

---

## Step 1 – Give the robot a Church Hub sign-in (Firebase)
1. Open **https://console.firebase.google.com** → the Church Hub project → **Authentication** (left menu, under Security or Build).
2. Click the **Users** tab → **Add user**.
3. **Email:** an address only for the robot. The easiest is the church's Gmail with "+robot" added, e.g.
   `yourchurch+robot@gmail.com` (using the church’s own Gmail address) (it never receives anything).
4. **Password:** make up a long one (20+ characters) and keep it somewhere safe – you need it once, in step 4.
5. Click **Add user**. In the list, find the robot and copy its **User UID** (the long code in the last column).

## Step 2 – Tell Church Hub about the robot
1. In Church Hub, go to **Leave → Elvanto**.
2. Fill in your **Elvanto web address** (e.g. `https://yourchurch.elvanto.eu`), the robot's **email** and its **User UID**.
3. **Leave "Keep Elvanto up to date" unticked for now** – Leave Manager's robot is still doing this job (see step 6).
4. Click **Save**.

## Step 3 – Publish the new security rules
The rules now include the robot. Do **step 7 of FIREBASE-SETUP.md** again (copy `firestore.rules` from GitHub, paste in
Firebase → Firestore → Rules, Publish).

## Step 4 – Give the robot its passwords (GitHub)
1. Open **https://github.com/pian1966/church-hub/settings/secrets/actions** (signed in to GitHub).
2. Click **New repository secret** four times, once for each of these (Name, then Secret):
   - `ROBOT_EMAIL` – the robot's email from step 1
   - `ROBOT_PASSWORD` – the robot's password from step 1
   - `ELVANTO_USERNAME` and `ELVANTO_PASSWORD` – the same Elvanto login Leave Manager's robot uses
     (one without two-step verification)
3. If Leave Manager has a variable called `ELVANTO_LIST_PATH` (leave-manager → Settings → Secrets and variables → Actions →
   Variables), add the same one here under **Variables** – it saves the robot looking for the page each time.

GitHub keeps secrets hidden – not even the robot's log shows them.

## Step 5 – Try it (changes nothing)
1. Open **https://github.com/pian1966/church-hub/actions** → **Elvanto robot** (left) → **Run workflow** → mode **explore** → **Run workflow**.
2. After a minute or two a **green tick** means the robot could sign in to Church Hub and to Elvanto and find the
   Unavailable Volunteers page. A red cross: click it to see why (the log never shows names).

## Step 6 – Switch over (when you stop using Leave Manager)
Do these together, so entries aren't made twice:
1. **Leave Manager:** on the Settings tab of its Google Sheet, set `ElvantoSync` to `FALSE`; then on GitHub open
   leave-manager → **Actions** → **Elvanto robot** → **⋯** → **Disable workflow**.
2. **Church Hub:** run the Leave Manager import one last time (Import → From Leave Manager), then go to **Leave → Elvanto**,
   tick **Keep Elvanto up to date** and **Save**.

Leave that Leave Manager's robot already put in Elvanto stays there. If it's later cancelled or changed in Church Hub, the
robot finds Leave Manager's entry by its note ("Leave Manager ‹request ID›") and updates it.

## Step 7 – Bring Elvanto's unavailable dates into Church Hub (until switch-over)
1. In Church Hub, **Leave → Elvanto**: tick **Read Elvanto's unavailable dates every night** and **Save**.
2. To try it now: GitHub → **Actions** → **Elvanto robot** → **Run workflow** → mode **read** → **Run workflow**. A green tick
   after a few minutes means it read the list. (From then on it runs by itself at about 3am.)
3. In Church Hub, **Import → Unavailable dates from Elvanto**: each entry is matched to a person by name.
   - **Ready to add** – untick any you don't want.
   - **Choose who it is** – the name matches several people, or no one exactly: choose the person, or untick it.
   - **Already in Church Hub** – away dates you added before, and leave (already in Church Hub).
   Then **Add … away dates**. Rosters in Church Hub now know those people are away. Nothing changes in Elvanto.
4. Do this every week or so until you switch over; already-added dates are never doubled.
5. At switch-over (step 6), untick **Read Elvanto's unavailable dates every night** – from then on people enter their own
   away dates in Church Hub (Me → Days away), and the robot copies leave the other way.

## Every day
- Approve, change and cancel leave in **Church Hub only**. Within about 15 minutes **Leave → Elvanto** shows **Done**.
- If something shows **Failed** or **Check by hand**, Home shows a to-do. Do it in Elvanto yourself, then click **Done by hand**
  (or **Try again** after fixing the cause – e.g. the person's name differs between Church Hub and Elvanto).
- If entries stay **Waiting for the robot** for more than 2 hours, Home shows a to-do: check the robot's runs on GitHub (Actions).
  GitHub pauses scheduled jobs in a repository with no changes for 60 days – if so, the Actions page shows a button to enable it again.
