# Church & Trellis in the Google Play Store – what it costs and how to do it

Today members download the Android app from GitHub (docs/ANDROID.md). That works, but the phone warns them and asks them to
"allow installing unknown apps", which puts many people off. In the Play Store they just tap **Install**, and updates arrive
by themselves.

**Why it matters soon:** Google now requires every Android app to be registered by a **verified developer**, even apps
installed outside the Play Store. It started on 30 September 2026 in Brazil, Indonesia, Singapore and Thailand and reaches
the rest of the world (South Africa included) from 2027. After that, a phone will only install the downloaded app if its
developer is verified. Registering for the Play Store does that verification too, so it is worth doing before then.

## What it costs
| | |
|---|---|
| Google Play developer account | **US$25, once** (roughly R450–R500, depending on the exchange rate). No yearly fee, and it covers every app on the account |
| Each app | Nothing extra. Church & Trellis is free to download, so Google takes no share |
| Apple App Store (for comparison, not needed) | US$99 **every year** – iPhones keep using "Add to Home Screen", which costs nothing |
| Paying | A credit or debit card in the account holder's own name |

## Which kind of account: personal or organisation
| | Personal account | Organisation account |
|---|---|---|
| Who | One person, in their own name | A registered organisation (company, NPC, trust) |
| You need | Your ID document | A **D-U-N-S number** (free from Dun & Bradstreet; takes a few days to weeks) and registration documents |
| Shown in the Play Store | **Your legal name and address** | The organisation's name, address and phone |
| Before the first app is public | A **closed test**: at least **12 people** testing it for **14 days in a row** | No test required |

**Recommendation:** an **organisation** account, if Church & Trellis is (or becomes) a registered organisation – e.g. a
non-profit company. It keeps your home address out of the store, has no 12-tester wait, and can be handed on later. A
personal account cannot be turned into an organisation one; you would have to start again and pay again.

If you go personal: the 12 testers are easy for a church – ask 12 people from Christ Church Howick with Android phones
(see step 5). They must stay in the test for the full 14 days; if one leaves on day 13, that place starts again.

Use the **Church & Trellis Google account** (not a personal Gmail), so the app never depends on one person's account.

## The steps
### 1. Create the account (about 30 minutes, then waiting for checks)
1. Sign in to the Church & Trellis Google account and open **https://play.google.com/console/signup**.
2. Choose **Organisation** (or **Yourself** for personal) and fill in the details. For an organisation, have the D-U-N-S
   number ready.
3. Accept the Developer Distribution Agreement and pay the US$25.
4. Verify your identity when asked (ID document, or the organisation's documents) and a phone number. Google checks this
   within a few days. The fee is not refunded if verification fails, so the names must match exactly.

### 2. Get the app ready (Claude does this, in a pull request)
- The Play Store needs an **app bundle** (`.aab`); the GitHub build (`.github/workflows/build-android.yml`) will be changed to make one
  alongside the `.apk`.
- The app's ID stays `org.christchurchhowick.churchhub` for Christ Church Howick's own app. The app for every church
  (docs/architecture/tasks/041-android-any-church.md) gets its own ID, e.g. `com.churchandtrellis.app` – best decided before the
  first upload, because an app's ID can never change in the store.
- **Play App Signing:** Google keeps the final signing key; the key in ChurchHub-ANDROID_KEYSTORE.txt becomes the "upload key".
  Keep that file safe as before.

### 3. The store listing (about an hour)
In Play Console → **Create app**: name "Church & Trellis", free, app. Then fill in:
- **Short description** (80 characters) and **full description** – the website text works well.
- **Icon** 512 × 512, **feature graphic** 1024 × 500, at least **2 phone screenshots** (the presentation's `img/m-…`
  screenshots of the demo can be used – made-up people only).
- **Privacy policy link** – the public website's privacy page.
- **Data safety form:** what the app collects (name, email, phone, church records), that it is encrypted in transit, not
  shared with third parties, and that people can ask for their data to be deleted.
- **App access:** reviewers need to sign in. Give them a demo sign-in, or explain that the demo opens with `?demo`.
- **Content rating** questionnaire (a few minutes), **target audience** (18+ is simplest; children's records are kept by
  staff, children don't sign in), and **ads: none**.

### 4. Internal test (a day)
Upload the `.aab` to **Testing → Internal testing**, add yourself and a few staff by email, install from the link they
get and check that signing in works (Google sign-in needs the Play signing certificate's SHA-1 added in Firebase – Play
Console shows it under **App integrity**).

### 5. Closed test (personal accounts only: 14 days)
**Testing → Closed testing** → create a track, add the 12+ testers' Gmail addresses (or a Google Group), send them the
opt-in link. Wait 14 days with all of them still opted in, then **Apply for production** and answer Google's questions about
the test.

### 6. Publish
**Production → Create new release** → upload the `.aab` → **Review release** → **Start rollout**. Google's review usually
takes from a few hours to a few days (longer for a brand-new account). After that, members find it by searching
"Church & Trellis" in the Play Store, and the invitation's **Get the app** button can point to the store instead of GitHub.

## After it's live
- Each new version: GitHub builds it; upload the new `.aab` in Play Console (this can be automated later).
- Answer Google's yearly policy updates and keep the Data safety form true when Church & Trellis starts collecting
  something new.

*Costs and rules checked 20 Nov 2026 (Google Play Console Help; Android developer verification announcements). Google changes
these from time to time – check play.google.com/console before paying.*
