# AI for “Ask in your own words” – one-time setup

With this switched on, **People → Advanced search → Ask in your own words** sends each question to Google's **Gemini** AI,
through the church's own Firebase project, and Gemini turns it into search filters. Church Hub checks every filter
(only fields that person may search on, only real values) and runs the search on the device as before. If the AI can't
be reached, Church Hub quietly uses its own rules instead.

**What is sent:** the question as typed or spoken, today's date, the names of the search fields, and the safe choices
(categories, positions, teams, service times, care group names). **Never** anyone's records, households, contact details
or names from the church. If someone types a name into the question (*services where Andy Pike serves*), that name is
part of the question and does go to Google.

It takes about 15 minutes. Use a computer, signed in to Google with **the church's account** (the one that owns the
Firebase project). Google sometimes moves buttons; if something isn't where this says, look for the same words nearby.

---

## Step 1 – Privacy first (Information Officer)
1. The Information Officer agrees to questions going to Google's Gemini (Google processes them outside South Africa).
2. Add a sentence to the privacy notice (**Privacy → Overview → Privacy notice**), for example:
   *“When staff search the church records in their own words, the question is sent to Google's Gemini AI to be understood;
   no church records are sent with it.”*
3. On the **free** Gemini tier Google may use what is sent to improve its products. That is why no records are sent –
   but tell staff not to type private matters (health, pastoral concerns) into a question. (On the paid Blaze plan Google
   doesn't use it; Church Hub doesn't need Blaze.)

## Step 2 – Switch on Firebase AI Logic
1. Open **https://console.firebase.google.com** and choose the Church Hub project.
2. In the left menu open **AI Services → AI Logic** (older screens: **Build → AI Logic**). Click **Get started**.
3. Choose **Gemini Developer API** (free, no credit card). Don't choose the Agent Platform / Vertex AI option – that needs billing.
4. Follow the steps; it switches on the APIs it needs. When it gets to **App Check**, keep this page open and do step 3.

## Step 3 – App Check: prove that requests come from Church Hub
Firebase AI Logic only answers apps that pass **App Check**, so nobody else can use the church's AI allowance.
App Check on a website uses a **reCAPTCHA** key (invisible – nobody has to tick boxes).

**3a. Make the reCAPTCHA key**
1. Open **https://console.cloud.google.com/security/recaptcha** (same church account, Church Hub project chosen at the top).
   If it asks to enable the reCAPTCHA API, click **Enable**.
2. Click **Create key**. Name: `Church Hub`. Platform: **Website**.
3. Domains – add both (use your project ID):
   - `pian1966.github.io`
   - `church-hub-7ec02.firebaseapp.com`
4. Leave “Use checkbox challenge” **off**. Click **Create key**.
5. Copy the **key ID** (a long code starting with `6L…`). This is not a password.

**3b. Register it in Firebase**
1. In the Firebase console open **Security → App Check** (or follow the AI Logic setup's App Check step).
2. On the **Apps** tab, click the web app (Church Hub) → **reCAPTCHA Enterprise**.
3. Paste the key ID from 3a. Token time to live: leave as it is. Click **Save**.
4. On the **APIs** tab, find **Firebase AI Logic** and click **Enforce** (the AI Logic setup may already have done this).
   ⚠️ Leave **Cloud Firestore** and **Authentication** as **Unenforced** – enforcing those isn't needed and could lock people out.

**3c. Put the key in Church Hub**
Ask whoever looks after Church Hub (or a Claude session): *“Put this App Check key in js/firebase-config.js: 6L…, it is a
reCAPTCHA Enterprise key.”* That sets `appCheckKey` to the key and `appCheckEnterprise: true`. Merge that pull request.

*(If you used an older **reCAPTCHA v3** key from google.com/recaptcha/admin instead – with a site key and a secret key –
register it in App Check as **reCAPTCHA** with the secret key, and leave `appCheckEnterprise` false.)*

## Step 4 – If the website key has an API list
Step 8 of FIREBASE-SETUP.md limited the key to the church's website. If you (or Google) also set **API restrictions** on
**Browser key (auto created by Firebase)** at https://console.cloud.google.com/apis/credentials, add **Firebase AI Logic API**
to that list and save. If it says **Don't restrict key**, there's nothing to do.

## Step 5 – Switch it on
1. Open Church Hub → **About → Update now**, so you have the version with the key.
2. **Settings → Apps → AI for “Ask in your own words”** → switch on **Use AI to understand questions**.
3. Go to **People → Advanced search** and ask, e.g. *all men who are Church Partners whose wives are not Church Partners*.
   It should say **Understood by AI as** and show the filters. If it says the AI couldn't be reached, see below.

## If it doesn't work
- **“The AI couldn't be reached”** every time: check step 3 (the key ID in firebase-config.js, the domains, App Check
  registered) and step 4. It can take 10–15 minutes after saving before App Check works.
- **The model has been retired** (Google retires Gemini models every year or so): open
  https://firebase.google.com/docs/ai-logic/models, pick the current **Flash-Lite** model that doesn't need billing, and
  type its name into **Settings → Apps → Model**. Church Hub starts with `gemini-3.5-flash-lite`.
- **Too many questions**: the free tier allows a set number of requests a minute and a day – far more than a church office
  asks. If it's ever reached, Church Hub uses its own rules until the next minute or day.
- To stop using the AI at any time, switch it off in **Settings → Apps**. Nothing else changes.
