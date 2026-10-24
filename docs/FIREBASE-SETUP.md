# Connecting Church Hub to Firebase – step by step

This connects Church Hub to the church's own database, stored in Johannesburg. It takes about 30 minutes.
You don't need to be technical: follow each step and click exactly what it says.
Google sometimes moves buttons around; if something isn't where this guide says, look for the same words nearby.

**Before you start**
- Use a computer, not a phone.
- Sign in to Google with **the church's Google account** (the one the church office controls), not a personal account.
  The account that creates the project owns it and all the church's data in it.
- Never paste passwords, keys or real church information into this repository or into a chat. Where this guide asks
  you to copy something, it says exactly where it goes.

---

## Step 1 – Create the project
1. Go to **https://console.firebase.google.com** and check the round picture at the top right is the church's account.
2. Click **Create a project** (or **Add project**).
3. Project name: type `Church Hub CCH`. Firebase shows a project ID underneath (e.g. `church-hub-cch`); write it down. Click **Continue**.
4. If it asks about Gemini / AI assistance, you can switch it off. Click **Continue**.
5. **Google Analytics: switch it OFF** (Church Hub doesn't need it, and POPIA says collect only what you need). Click **Create project**.
6. Wait until it says the project is ready, then click **Continue**.

The project stays on the free **Spark** plan. Don't add a credit card; a church this size stays well inside the free limits.

## Step 2 – Create the database in Johannesburg
1. In the menu on the left, open **Databases & Storage**, then click **Firestore** (on older screens: **Build → Firestore Database**).
2. Click **Create database**.
3. If asked for an edition, choose **Standard edition**. Click **Next**.
4. Database ID: leave it as **(default)**.
5. Location: choose **africa-south1 (Johannesburg)**.
   ⚠️ **This can't be changed later.** Check it says Johannesburg before you continue.
6. Security rules: choose **Start in production mode** (this locks everything until step 7). Click **Create**.

## Step 3 – Switch on sign-in
1. In the left menu, open **Security**, then click **Authentication** (older screens: **Build → Authentication**). Click **Get started**.
2. On the **Sign-in method** tab, click **Google** → switch **Enable** on → choose the church's email as the
   **Project support email** → **Save**.
3. Click **Add new provider** → **Email/Password** → switch on **Email/Password** *and* **Email link (passwordless sign-in)** → **Save**.
   (Church Hub never uses passwords; the first switch just has to be on for email links to work.)
4. Click the **Settings** tab → **Authorized domains** → **Add domain** → type `pian1966.github.io` → **Add**.

## Step 4 – Register the website and get its settings
1. Click the **gear icon** next to **Project Overview** (top left) → **Project settings**.
2. Scroll down to **Your apps** and click the **web** icon, which looks like `</>`.
3. App nickname: `Church Hub website`. **Don't** tick "Firebase Hosting". Click **Register app**.
4. Firebase shows some code containing `const firebaseConfig = { ... }`. Leave this page open: you need four of its lines in step 6:
   `apiKey`, `authDomain`, `projectId` and `appId`. Click **Continue to console**.

## Step 5 – Add yourself as the first Administrator
Church Hub only lets in people on its access list. The first name goes on it by hand; after that, Administrators give access inside Church Hub.
1. Go back to **Firestore** (step 2, point 1) and click the **Data** tab.
2. Click **+ Start collection**. Collection ID: `roles` → **Next**.
3. Document ID: type **the email address you will sign in with**, all in small letters (e.g. `office@example.org`).
4. Add a field: Field name `role`, Type **string**, Value `admin`. Click **Save**.

## Step 6 – Connect the website (on GitHub)
1. Open **https://github.com/pian1966/church-hub/blob/main/js/firebase-config.js** and sign in to GitHub.
2. Click the **pencil icon** (Edit this file).
3. Between the quotes, fill in the four values from step 4, for example:
   ```
   apiKey: 'AIza…',
   authDomain: 'church-hub-cch.firebaseapp.com',
   projectId: 'church-hub-cch',
   appId: '1:1234…:web:abcd…'
   ```
   Copy each value from the Firebase page directly into GitHub; don't paste them into emails or chats.
4. Click **Commit changes…** → **Commit changes**.

**Is it safe to put these in a public repository?** Yes. They are not passwords: they only tell the website which project
to talk to, and every visitor's browser receives them anyway. The church's information is protected by sign-in, the
access list and the security rules (step 7). Step 8 also stops other websites from using them.

## Step 7 – Publish the security rules
These decide who can see what (POPIA). Without them nobody can use Church Hub.
1. Open **https://github.com/pian1966/church-hub/blob/main/firestore.rules** and click the **Copy raw file** icon (two overlapping squares, top right of the file).
2. In Firebase, go to **Firestore** → **Rules** tab.
3. Select everything in the editor (Ctrl+A, or ⌘+A on a Mac) and paste (Ctrl+V / ⌘+V), replacing what was there.
4. Click **Publish**.

Whenever `firestore.rules` changes on GitHub, repeat this step.

## Step 8 – Only let the church's website use the key
1. Open **https://console.cloud.google.com/apis/credentials** (signed in as the church's account) and choose the
   Church Hub project in the project picker at the top.
2. Under **API Keys**, click **Browser key (auto created by Firebase)**.
3. Under **Application restrictions**, choose **Websites**, then **Add** each of these two lines (use your project ID from step 1):
   - `https://pian1966.github.io/*`
   - `https://church-hub-cch.firebaseapp.com/*`
4. Click **Save**. It can take a few minutes to take effect.

## Step 9 – First sign-in and setting up
1. Wait two minutes after step 6, then open **https://pian1966.github.io/church-hub/**. You should see **Sign in**
   (not the demo). The demo with made-up people is still at **https://pian1966.github.io/church-hub/?demo**.
2. Click **Sign in with Google** and choose the email from step 5 (or use **Email me a link**).
3. Church Hub asks you to **Set up Church Hub**: check the church name, type your name, click **Set up**.
   This creates the church settings, the leave rules (same as Leave Manager) and a few starter serving teams.
4. You're in. Go to **Privacy** and fill in the Information Officer and privacy notice before adding anyone.

## Step 10 – Give other people access
1. **People → Add person** (or open someone), fill in their **email address**, choose **App access**
   (Administrator, Pastor, Roster coordinator, Children's ministry or Member) and **Save**.
2. Tell them to go to the website and sign in with that email address (Google, or "Email me a link").
3. To take access away, choose **No access**, or **Mark as left**. It works at once.

People added without access stay on the church records but can't sign in.

## If something goes wrong
| You see | Do this |
| --- | --- |
| "No access yet" | Their email isn't on the access list, or is spelt differently. Check their email in People and their App access. For yourself: check step 5. |
| "Setting up didn't work" | The security rules aren't published – do step 7. |
| Google sign-in window closes straight away | Check step 3 (Google enabled, `pian1966.github.io` authorised) and step 8 (both website lines). |
| The email link doesn't arrive | Check the spam folder; check step 3 point 3. |
| Still the demo, not "Sign in" | Step 6 isn't saved yet, or the browser kept the old page: wait two minutes and refresh. |

## Before real church information goes in
- The Information Officer reviews `docs/POPIA.md`, approves the privacy notice, and accepts Google's data processing terms
  (Firebase console → **Project settings** → look for **Data privacy / Data processing terms**) – the operator agreement POPIA s21 asks for.
- Do a trial with two or three staff and made-up people first.
