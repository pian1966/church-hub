# 011 – The public card (`public/hub`)

**Goal:** from only a project id, the website can find a church's name and connection settings.

**Read:** `TARGET.md` section 3 and `SPIKE-RESULTS.md` question a. **Needs:** 012 merged.

**Files:** `firestore.rules` (raise `rulesVersion()` to 2, `RULES: 2`), `js/store.js`, `js/church.js`, `js/app.js`
(the "Finding your church…" stage), `tests/rules.test.mjs`, `tests/fake-firebase.js`, `tests/church.test.js`,
`docs/POPIA.md` (one paragraph: the card holds nothing personal), i18n.

**Steps**
1. Rule:
   ```
   match /public/{doc} {
     allow get: if doc == 'hub';
     allow list: if false;
     allow write: if admin() && doc == 'hub'
       && request.resource.data.keys().hasOnly(['name','country','apiKey','appId','googleClientId','appCheckKey','appCheckEnterprise','rules','updatedAt']);
   }
   ```
2. `Store`: when an Administrator is signed in and `rulesOk(2)`, write/refresh `public/hub` from `settings/church`
   (name, country) and `cfg` whenever those differ. Never anything else.
3. `Church.fetchCard(projectId, fetch)` → the REST address in `TARGET.md` section 3; convert Firestore's typed
   JSON to a plain object; validate (`apiKey` and `appId` present, strings, sane lengths); build the config with
   `authDomain: projectId + '.firebaseapp.com'`. If 002 said a key is needed, implement the long-code fallback
   instead and say so in the pull request.
4. Shell: when `window.CHURCH_HUB_PENDING` is set → fetch the card → `Church.save` → reload at `?c=`. Not found or
   offline → a plain message with **Try again** and **Try the demo**.

**Acceptance:** rules tests: signed-out `get public/hub` allowed; `get public/other`, list, member write, admin
write with an extra field all denied. Browser test: `?c=<fake>` with no saved config reaches that church's sign-in.

**Do not:** put a person's name, email or anything from `people` in the card; allow `list`.
