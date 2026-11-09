# Publishing the database rules automatically

The security rules (`firestore.rules`) decide who can see what in Church Hub. Until now, whenever they changed, someone had to
copy them into the Firebase console by hand (FIREBASE-SETUP.md step 7).

After this one-time setup, GitHub does it for you: when a pull request that changes the rules is merged into `main`, GitHub
tests the rules against Google's own Firestore emulator and, **only if every test passes**, publishes them to Firebase.
You can see each run under **Actions → Publish database rules**.

It needs a "service account": a sign-in for GitHub that may **only publish security rules** – it cannot read or change any
church information. Its key is kept as a GitHub secret, never in the repository (which is public).

Allow about 10 minutes. Use the Google account that owns the Firebase project.

## Step 1 – Create the service account
1. Open **https://console.cloud.google.com/iam-admin/serviceaccounts** and, at the top, choose the project
   **church-hub-7ec02** (the same project as Firebase).
2. Click **+ Create service account**.
3. Name: `GitHub rules publisher`. Click **Create and continue**.
4. Under **Grant this service account access to project**, add these two roles (type the name in the role box to find it):
   - **Firebase Rules Admin**
   - **Service Account User**
5. Click **Continue**, then **Done**. Don't give it any other roles.

## Step 2 – Make a key
1. In the list, click the new **GitHub rules publisher** account.
2. Open the **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.
3. A small file (ending in `.json`) downloads. Treat it like a password: don't email it, don't put it in a chat or on GitHub
   as a file.

## Step 3 – Give the key to GitHub
1. Open **https://github.com/pian1966/church-hub/settings/secrets/actions** → **New repository secret**.
2. Name: `FIREBASE_RULES_KEY`
3. Secret: open the downloaded `.json` file in a text editor (Notepad, TextEdit), select everything, copy, and paste it here.
4. Click **Add secret**.
5. Delete the downloaded file from your computer (and empty the Recycle Bin / Trash).

## Step 4 – Try it
1. Open **https://github.com/pian1966/church-hub/actions/workflows/publish-rules.yml** → **Run workflow** → **Run workflow**.
2. After two or three minutes it should show a green tick and the note **Rules published**.
3. In Firebase → **Firestore** → **Rules**, the latest version now says it was published a moment ago.

From now on you don't need to re-publish the rules after a merge. (Copying them by hand, step 7, still works if ever needed.)

## If something goes wrong
| What you see in the run | What to do |
| --- | --- |
| Yellow warning "Rules not published" | The secret is missing or misnamed – it must be exactly `FIREBASE_RULES_KEY` (step 3). |
| "Test the rules" failed (red) | A rules test failed, so nothing was published – that is the safety net working. Ask Claude to look at the log. |
| "Permission denied" or "does not have permission" mentioning `serviceusage` | Add the role **Service Usage Consumer** to the service account (IAM page → pencil next to it). |
| Other "permission denied" while publishing | Check the two roles in step 1, and that the project at the top was **church-hub-7ec02**. |
| "Key creation is not allowed" in step 2 | An organisation policy blocks keys; publish by hand (FIREBASE-SETUP.md step 7) and ask Claude about "Workload Identity Federation" instead. |

## Taking it away
Delete the secret on GitHub, and delete the service account (or just its key) in Google Cloud. Nothing else changes.
