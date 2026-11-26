# Moving Church & Trellis to its own address – step by step

Today the app lives at `pian1966.github.io/church-hub`, so every invitation link starts with that. This guide moves it to
**https://app.churchandtrellis.com** (chosen 26 Nov 2026). Invitation links copy the address the app is opened on, so once people
open the app there, new invitations start with `app.churchandtrellis.com` by themselves. The old address keeps working: GitHub
forwards it.

**Do this on a computer**, signed in as the church's Google account (steps 1–3), Cloudflare (step 4) and GitHub (step 5).
About 30 minutes, plus a wait of up to an hour for the padlock. **The order matters** – if you skip ahead, people can be locked out.
Nobody notices anything until step 5, and nothing is removed at any point.
Google sometimes moves buttons around; if something isn't where this guide says, look for the same words nearby.

## 1. Tell Firebase the new address is allowed
1. Open **https://console.firebase.google.com**, choose the Church & Trellis project, then **Security → Authentication**.
2. Click the **Settings** tab → **Authorized domains** → **Add domain** → type `app.churchandtrellis.com` → **Add**.
3. **Leave `pian1966.github.io` there.** Add, never replace.

## 2. Let the new address use the church's key
1. Open **https://console.cloud.google.com/apis/credentials** and choose the Church & Trellis project at the top.
2. Under **API Keys**, click **Browser key (auto created by Firebase)**.
3. Under **Application restrictions → Websites**, click **Add** and type `https://app.churchandtrellis.com/*`.
   Keep the lines already there.
4. Click **Save**. It can take a few minutes to take effect.

## 3. Let the new address use the reCAPTCHA key (only if you switched on AI search)
1. Open **https://console.cloud.google.com/security/recaptcha** (same project).
2. Click the key named `Church & Trellis` → **Domains** → add `app.churchandtrellis.com` → **Save**. Keep the others.

## 4. Point the address at GitHub (Cloudflare)
1. Go to **https://dash.cloudflare.com** and log in (where you bought churchandtrellis.com).
2. Click **Websites** → **churchandtrellis.com** → **DNS** → **Records** → **Add record**.
3. **Type:** `CNAME`. **Name:** `app`. **Target:** `pian1966.github.io`.
4. **Proxy status:** click the orange cloud so it turns **grey – "DNS only"**. (Orange stops GitHub making the padlock.)
5. Click **Save**. The payment doorway at `churchandtrellis.com/pay` is not touched.

## 5. Tell GitHub about it
1. Open **https://github.com/pian1966/church-hub/settings/pages**.
2. Under **Custom domain**, type `app.churchandtrellis.com` and click **Save**.
3. GitHub checks the address (a minute or two; it may say "DNS check in progress"). When the check goes green, tick
   **Enforce HTTPS**. If that box is grey, wait up to an hour and look again.
4. GitHub adds a file called `CNAME` to the repository by itself. Leave it.

From now on, `pian1966.github.io/church-hub` forwards to the new address.

## 6. Check you can still sign in – before telling anyone
1. Open **https://app.churchandtrellis.com** in a private window.
2. Sign in with Google, and then (in another private window) with the email link. Both must work.
3. Open **People → Invitations** and copy a link: it should start with `https://app.churchandtrellis.com/`.
4. If sign-in fails, tell Claude exactly what the screen says. To go back: in GitHub Pages, click **Remove** next to the
   custom domain; the old address serves again. Leave the settings you added.

## 7. Tell Claude: "The new address works"
Claude then changes, in one small pull request: the email robot's default address (`robot/robot.js`, `robot/event-mail.js`), the
Android app's address (`android/app/build.gradle`, shown to people after the next Android build), and the addresses in the
brochures, the setup tool, the README and the guides.

## 8. Tell the church
- People who added Church & Trellis to their phone's home screen can keep using it, but should add it again from the new
  address. They will sign in once more, because the saved offline copy belongs to the old address.
- Invitations sent before this carry the old address; it forwards, so they still work.

**Do not** remove `pian1966.github.io` from Firebase, the key or reCAPTCHA – keep it for at least a year.
