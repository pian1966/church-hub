/*
 * Church Hub – connection to the church's Firebase project.
 *
 * While this is empty, Church Hub runs as a demo with made-up people.
 * To go live, paste the values from Firebase console → Project settings → Your apps → "SDK setup and configuration" → Config
 * (see docs/FIREBASE-SETUP.md, step 6). Edit this file on GitHub; don't paste it into a chat.
 *
 * These values are not passwords: every visitor's browser receives them anyway. What keeps the church's information safe
 * is sign-in plus the security rules in firestore.rules, and the website restriction on the key (FIREBASE-SETUP.md, step 8).
 * The demo stays available at the same address with ?demo on the end.
 */
window.CHURCH_HUB_FIREBASE = window.CHURCH_HUB_FIREBASE || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
