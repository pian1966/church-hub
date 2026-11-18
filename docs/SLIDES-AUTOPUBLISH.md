# Keeping the Google Slides copy of the presentation up to date

The conference presentation is built in this repository (`docs/presentation/church-hub-presentation.pptx`), and it's
updated whenever Church Hub changes in a way the slides talk about. The last slide says which version it describes
(for example "Slides for Church Hub 0.92.0 · 18 Nov 2026"), so you can compare any copy with **About** in the app.

After this one-time setup, GitHub also puts every new version into **your Google Slides file**, so its link always shows
the latest slides. You can see each run under **Actions → Publish the slides**.

It needs a "robot" (Google calls it a *service account*): a sign-in for GitHub that can open **only the files shared with
it** – here, just the presentation. Its key is kept as a GitHub secret, never in the repository (which is public).

**Good to know:** the PowerPoint in GitHub is the master copy. Anything changed by hand in the Google Slides file is
replaced at the next update – ask Claude to make the change instead. If you want a copy to tweak for a particular talk,
use **File → Make a copy** in Google Slides and change the copy.

Allow about 15 minutes.

## Which Google account?
The robot lives inside a Google Cloud project, which belongs to an ordinary Google account. Use **Church Hub's own Google
account** – the one for Church Hub itself (its website, its subscriptions) – not a church's account: each church's account
belongs to that church, and the presentation belongs to Church Hub. Until Church Hub's own account exists, use the account
that owns the Google Slides file; the robot can be moved later by repeating these steps.

## Step 1 – A Google Cloud project with Google Drive switched on
1. Open **https://console.cloud.google.com/projectcreate**, signed in with that account. Accept the terms if asked.
2. Project name: `Church Hub slides`. Click **Create** and wait a few seconds.
3. Open **https://console.cloud.google.com/apis/library/drive.googleapis.com** – check the project at the top says
   **Church Hub slides** – and click **Enable**.

## Step 2 – Create the robot
1. Open **https://console.cloud.google.com/iam-admin/serviceaccounts** (project **Church Hub slides**).
2. Click **+ Create service account**.
3. Name: `Slides robot`. Click **Create and continue**.
4. Don't give it any roles: click **Continue**, then **Done**.
5. Copy the robot's email address from the list – it ends in `@church-hub-slides…iam.gserviceaccount.com`. You need it in step 4.

## Step 3 – Make a key
1. Click the **Slides robot** in the list → **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.
2. A small `.json` file downloads straight away (check the browser's downloads, Ctrl+J). It can't be downloaded again: if
   it's lost, delete that key and make a new one. Treat it like a password – don't email it or put it in a chat.

## Step 4 – Share the presentation with the robot
1. Open the presentation in Google Slides → **Share**.
2. Paste the robot's email address, choose **Editor**, untick **Notify people**, and click **Share** (or **Send** – Google may
   say the address is outside your organisation; that's fine).

## Step 5 – Give GitHub the key and the file
1. Open **https://github.com/pian1966/church-hub/settings/secrets/actions** → **New repository secret**.
2. Name: `SLIDES_ROBOT_KEY`. Secret: open the downloaded `.json` file in a text editor (Notepad, TextEdit), select
   everything, copy, and paste it here. Click **Add secret**.
3. **New repository secret** again. Name: `SLIDES_FILE_ID`. Secret: the long code in the presentation's link, between
   `/d/` and `/edit` (for `https://docs.google.com/presentation/d/1AbC…xyz/edit` it is `1AbC…xyz`). Click **Add secret**.
4. Delete the downloaded `.json` file from your computer (and empty the Recycle Bin / Trash).

## Step 6 – Try it
1. Open **https://github.com/pian1966/church-hub/actions/workflows/publish-slides.yml** → **Run workflow** → **Run workflow**.
2. After a minute it should show a green tick and **Slides updated** in the log.
3. Open the presentation: the last slide shows the version and today's date. (**File → Version history** keeps the older
   versions, if you ever need one back.)

From now on, whenever a pull request with new slides is merged, the Google Slides file is updated by itself.

## If something goes wrong
| What you see in the run | What to do |
| --- | --- |
| Yellow warning "Slides not updated: … secret is missing" | A secret is missing or misnamed – exactly `SLIDES_ROBOT_KEY` and `SLIDES_FILE_ID` (step 5). |
| "is not the whole .json key file" | Paste the entire contents of the `.json` file again, from the first `{` to the last `}`. |
| "could not sign in to Google" | The key was deleted or pasted wrongly – make a new key (step 3) and replace the secret. |
| "The robot can't see the Slides file" | Share it with the robot as an Editor (step 4), and check `SLIDES_FILE_ID`. |
| "may only view the Slides file" | Change the robot's access to **Editor** in Share. |
| "Google Drive API has not been used in project… or it is disabled" | Step 1.3 – enable the Google Drive API, wait a minute, re-run. |
| "Key creation is not allowed" in step 3 | An organisation policy blocks keys (usual for Google Workspace accounts): use a plain Gmail account for the project, or ask Claude about "Workload Identity Federation". |
| "This workflow does not exist" on GitHub | The workflow isn't in `main` yet – merge its pull request first. |
