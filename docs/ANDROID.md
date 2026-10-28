# Church Hub for Android – setting it up

The Android app lets members look after **their own details, their days away and where they'd like to serve**,
from their phone. Staff and leaders can use the same app: everyone signs in and sees what their access allows.

**How it works.** The app shows the Church Hub website full screen, the same way the Leave Manager app does. New
features therefore appear in the app straight away, without anyone updating it. Members open on **Me**, which has three tabs:

| Tab | What they can do |
| --- | --- |
| **My details** | See and correct their name, "known as", email and mobile. See what the church office keeps (birthday, marital status, household) and ask the office to correct it. Change their consent choices; read the privacy notice; choose the language; sign out. |
| **Days away** | Add days they can't serve (tick service days, or add a holiday), remove them, and see approved leave. If they are already on the roster on a day away, it says so, with a **Can't make it** button. |
| **Serving** | Accept or decline turns; see where they serve; **offer to help** in another place, ask to serve more or less often, or ask to stop. The roster coordinator answers under **Rosters → Teams** (Yes / Not now with a short reply). |

The app keeps no church information on the phone; it only remembers who is signed in and the language.

The download link for members (after step 2):
**https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk**

---

## Step 1 – Give GitHub the signing key (once)

Android only installs updates signed with the same key. Church Hub has **its own key**, in the file
**ChurchHub-ANDROID_KEYSTORE.txt** you were given (27 Oct 2026). It is separate from Leave Manager's key.

1. **First, keep a safe copy** of ChurchHub-ANDROID_KEYSTORE.txt in the church's own private storage (e.g. a private
   Google Drive folder of the church account). GitHub never shows a saved secret again, so that file is the only copy.
   If it is ever lost, a new key can be made, but everyone then has to uninstall the app and install it again once.
2. Open the file in Notepad (or TextEdit on a Mac) and copy everything in it (Ctrl+A, then Ctrl+C).
3. Open **https://github.com/pian1966/church-hub/settings/secrets/actions** and sign in to GitHub.
4. Click **New repository secret**.
5. Name: `ANDROID_KEYSTORE`. Secret: paste what you copied. Click **Add secret**.

Never paste the key into a chat or into a file in the repository – the repository is public.

## Step 2 – Build the app

1. Open **https://github.com/pian1966/church-hub/actions/workflows/build-android.yml**.
2. Click **Run workflow** (on the right) → **Run workflow** (the green button).
3. Wait about 3 minutes until the run has a green tick.
4. Open **https://github.com/pian1966/church-hub/releases** – there is now **Church Hub for Android 1.0.N** with
   **ChurchHub.apk** underneath.

From now on GitHub rebuilds it by itself whenever something in the `android` folder changes. The download link above
always gives the newest version.

## Step 3 – Sign in with Google in the app (optional)

Without this step the app offers only the **email link** (step 4 explains how that works in the app). With it,
people can tap **Sign in with Google** and pick their account, as they do in Leave Manager. All of it is in the
Firebase console, signed in with the church's Google account.

**3a. Tell Firebase about the app**
1. Go to **https://console.firebase.google.com** → open the **Church Hub** project.
2. Click the **gear icon** next to **Project Overview** → **Project settings**.
3. Scroll down to **Your apps** → click **Add app** → choose the **Android** icon.
4. Android package name: `org.christchurchhowick.churchhub`
5. App nickname: `Church Hub Android`
6. Debug signing certificate SHA-1: `34:6D:29:12:B8:5E:4B:C6:97:51:11:F6:7A:3A:53:8E:DE:BF:EB:9E`
   (this is the fingerprint of the signing key from step 1 – it is not a secret).
7. Click **Register app**. Skip the next screens (**Next**, **Next**, **Continue to console**) – nothing needs downloading.

**3b. Copy the Web client ID into Church Hub**
1. In the Firebase console, open **Security → Authentication** (older screens: **Build → Authentication**) →
   **Sign-in method** tab → click **Google**.
2. Open **Web SDK configuration**. Copy the **Web client ID** (it ends in `.apps.googleusercontent.com`).
3. Open **https://github.com/pian1966/church-hub/blob/main/js/firebase-config.js** → click the **pencil icon**.
4. Paste it between the quotes on the line `googleWebClientId: ''`, so it looks like
   `googleWebClientId: '123-abc.apps.googleusercontent.com'`.
5. Click **Commit changes…** → **Commit changes**. After a minute or two the app shows **Sign in with Google**.

The Web client ID isn't a password: every visitor's browser receives it anyway.

## Step 4 – Publish the new security rules

The serving offers need the newest rules, so repeat **[FIREBASE-SETUP.md](FIREBASE-SETUP.md), step 7**
(copy `firestore.rules`, paste it into Firestore → Rules, **Publish**).

## Step 5 – Try it, then tell the church

1. On an Android phone, open the download link above, tap **ChurchHub.apk**, then **Install**.
   - The first time, Android asks to allow your browser (e.g. Chrome) to install apps: allow it.
   - If Google Play Protect says it doesn't recognise the app (it isn't from the Play Store), tap
     **More details → Install anyway**.
2. Open **Church Hub** and sign in:
   - **Sign in with Google** (after step 3): pick your account.
   - **Email me a link**: type your email and tap the button. Open the email on the same phone, **press and hold** the
     sign-in link, choose **Copy link**, go back to Church Hub, paste it in the box and tap **Sign in**.
     (Tapping the link instead signs you in to the website in Chrome – that works too, just not in the app.)
3. Check **Me → My details**, **Days away** and **Serving**.
4. Send members the download link (WhatsApp or email works well). They need access first: People → their profile →
   **Edit details → App access: Member**, with their email address filled in.

**iPhones:** there is no iPhone app. Open **https://pian1966.github.io/church-hub/** in **Safari** → **Share** →
**Add to Home Screen**. It then opens full screen like an app, with the same screens.

## Questions

- **Do people need to update the app?** Almost never – new features come through the website. If the `android`
  folder changes, GitHub builds a new version; installing it over the old one keeps people signed in.
- **Is the key restricted to the website (FIREBASE-SETUP step 8) a problem?** No – the app opens the church's
  website address, so the restriction still matches.
- **Can we put it in the Google Play Store later?** Yes: the same app can be uploaded with a Google Play developer
  account (once-off USD 25). Then Play Protect warnings go away and updates install automatically.
- **For developers:** `android/` is a small WebView app (`MainActivity.java`) with a bridge `window.ChurchHubApp`
  (`version()`, `googleSignIn(webClientId)`, `retry()`). The page answers through `window.churchHubGoogle(idToken)`,
  `churchHubGoogleError(message)` and `churchHubGoogleCancel()` (`js/store.js`), and `window.churchHubBack()` closes an
  open window before the back button goes back a page (`js/app.js`). Built by `.github/workflows/build-android.yml`.
