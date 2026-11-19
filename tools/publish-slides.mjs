// Church & Trellis – puts the conference presentation (docs/presentation/church-and-trellis-presentation.pptx) into its Google Slides
// copy, so the shared Google Slides link always shows the latest slides. Run by .github/workflows/publish-slides.yml.
// Needs two secrets, set up as docs/SLIDES-AUTOPUBLISH.md explains:
//   SLIDES_ROBOT_KEY – the JSON key of a Google Cloud service account (the "robot") that the Slides file is shared with
//   SLIDES_FILE_ID   – the Google Slides file's id (the long part of its link between /d/ and /edit)
// No packages needed: Node's own crypto signs the sign-in, and fetch talks to Google Drive. The key is never printed.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const SLIDES_NAME = 'Church & Trellis – conference presentation';
const PPTX = new URL('../docs/presentation/church-and-trellis-presentation.pptx', import.meta.url);
const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function b64url(x) { return Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

/** Signs in as the robot and returns a short-lived Google access token. */
async function token(key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(head + '.' + claim).sign(key.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + b64url(sig) })
  });
  const out = await res.json();
  if (!res.ok || !out.access_token) throw new Error('The robot could not sign in to Google (' + res.status + ' ' + (out.error_description || out.error || '') + '). Check the SLIDES_ROBOT_KEY secret.');
  return out.access_token;
}

async function main() {
  const raw = process.env.SLIDES_ROBOT_KEY || '', id = (process.env.SLIDES_FILE_ID || '').trim();
  if (!raw || !id) { console.log('::warning::Slides not updated: the SLIDES_ROBOT_KEY or SLIDES_FILE_ID secret is missing (see docs/SLIDES-AUTOPUBLISH.md).'); return; }
  let key; try { key = JSON.parse(raw); } catch (e) { throw new Error('SLIDES_ROBOT_KEY is not the whole .json key file – paste all of it.'); }
  const auth = { Authorization: 'Bearer ' + await token(key) };

  const meta = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=name,mimeType,capabilities/canEdit&supportsAllDrives=true', { headers: auth });
  const m = await meta.json();
  if (meta.status === 404) throw new Error('The robot can’t see the Slides file. Share it with ' + key.client_email + ' as an Editor, and check SLIDES_FILE_ID.');
  if (!meta.ok) throw new Error('Google Drive said ' + meta.status + ': ' + ((m.error && m.error.message) || ''));
  if (m.mimeType !== 'application/vnd.google-apps.presentation') throw new Error('SLIDES_FILE_ID is not a Google Slides file (it is ' + m.mimeType + ').');
  if (!m.capabilities || !m.capabilities.canEdit) throw new Error('The robot may only view the Slides file. Share it with ' + key.client_email + ' as an Editor.');

  // Uploading the .pptx onto the Google Slides file converts it into Slides and keeps the same file and link.
  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(id) + '?uploadType=media&supportsAllDrives=true&fields=name,modifiedTime', {
    method: 'PATCH', headers: Object.assign({ 'Content-Type': PPTX_TYPE }, auth), body: readFileSync(PPTX)
  });
  const u = await up.json();
  if (!up.ok) throw new Error('Google Drive did not accept the slides (' + up.status + '): ' + ((u.error && u.error.message) || ''));
  // The Google Slides file's name follows the app's name (renamed to Church & Trellis in Nov 2026).
  let name = u.name;
  if (name !== SLIDES_NAME) {
    const rn = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=name', {
      method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: JSON.stringify({ name: SLIDES_NAME })
    });
    if (rn.ok) name = (await rn.json()).name; else console.log('::warning::Slides updated, but Google Drive did not rename the file (' + rn.status + ').');
  }
  console.log('Slides updated: “' + name + '” at ' + u.modifiedTime);
}

main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
