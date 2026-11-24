/*
 * Church & Trellis – the setup tool's content and rules (used by site/setup.html; tested by tests/setup-kit.test.js).
 *
 * The setup tool takes a church from nothing to a working Church & Trellis: a Google account for the church, the church's copy
 * of the website on GitHub, its Firebase database, the first sign-in, the settings to do before anyone joins, and then a
 * list of everything else the church can switch on whenever it is ready ("Grow"). Everything a person types stays in
 * their own browser.
 *
 * KEEP THIS UP TO DATE (CLAUDE.md, "Setup tool"):
 * - A new part of the app (a new Hub.register id) needs a GROW item (or an essential STEP) naming it in `mods`, or a line in
 *   NOT_SETUP saying why there is nothing to set up. tests/setup-kit.test.js fails until it has one.
 * - A new feature an Administrator would want to switch on or fill in gets a GROW item with `since` = the version that
 *   brings it (major.minor): returning Administrators see it marked "New".
 * - When docs/FIREBASE-SETUP.md changes, change the matching STEP here.
 * - When something in COMING is built, move it to GROW.
 * - When the middle version number goes up, read this file and set reviewed-for in site/setup.html (tests/versions.test.js).
 *
 * Pure: no DOM. Step and item bodies are functions of `c` (Kit.ctx(church)) returning HTML made with the helpers in H.
 */
var SetupKit = (function () {
  'use strict';
  var UPSTREAM = 'pian1966/church-hub';
  var DOCS = 'https://github.com/' + UPSTREAM + '/blob/main/docs/';

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function plain(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  /** Words of the church's name without the little ones, for addresses: "St Mary's Anglican Church, Durban" → ['st','marys','anglican','church','durban']. */
  function words(name) { return plain(name).replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean); }
  var SMALL = { the: 1, of: 1, and: 1, a: 1, an: 1, in: 1, at: 1, for: 1 };
  // Words every church name has, left out when an address would be too long ("St Mark's Anglican Church, Durban" → stmarksdurban).
  var COMMON = { church: 1, anglican: 1, methodist: 1, baptist: 1, catholic: 1, presbyterian: 1, lutheran: 1, pentecostal: 1, reformed: 1,
    parish: 1, community: 1, fellowship: 1, ministries: 1, ministry: 1, congregation: 1, chapel: 1, assembly: 1, international: 1 };
  function shortWords(name, max) {
    var w = words(name).filter(function (x) { return !SMALL[x]; });
    if (w.join('').length <= max) return w;
    var s = w.filter(function (x) { return !COMMON[x]; });
    return s.length ? s : w;
  }
  function slug(name, max) {
    max = max || 30;
    var s = shortWords(name, max).join('');
    if (s.length > max) s = initials(name).toLowerCase() + (words(name).length > 1 ? words(name).slice(-1)[0] : '');
    return s.slice(0, max) || 'ourchurch';
  }
  function initials(name) { return words(name).filter(function (x) { return !SMALL[x]; }).map(function (x) { return x[0]; }).join('').toUpperCase().slice(0, 6); }

  /** Ideas for the church's Gmail address (Gmail allows letters, numbers and dots; 6–30 characters). */
  function emailIdeas(name) {
    var s = slug(name, 23), out = [s, s + '.office'];
    return out.filter(function (x, k) { return out.indexOf(x) === k && x.length >= 6; }).map(function (x) { return x.slice(0, 30) + '@gmail.com'; });
  }
  /** A GitHub username idea (letters, numbers and single hyphens; up to 39). */
  function githubIdea(name) {
    var s = shortWords(name, 20).join('-') || 'our-church';
    return s.length <= 30 ? s : slug(name, 30);
  }
  function validGithub(u) { return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(String(u || '')); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  /** The Firebase project's name (4–30 characters): "Church & Trellis" and the church's initials. */
  function projectName(name) { var i = initials(name); return ('Church & Trellis ' + (i.length >= 2 ? i : slug(name, 12))).slice(0, 30); }

  /* ---------- where the church's information is kept (Firestore locations; can't be changed later) ---------- */
  var PLACES = {
    'africa-south1': 'Johannesburg, South Africa',
    'europe-west2': 'London, United Kingdom',
    'eur3': 'Europe (Belgium and the Netherlands)',
    'nam5': 'the United States',
    'northamerica-northeast1': 'Montréal, Canada',
    'southamerica-east1': 'São Paulo, Brazil',
    'asia-south1': 'Mumbai, India',
    'asia-southeast1': 'Singapore',
    'australia-southeast1': 'Sydney, Australia'
  };
  /** The nearest place for a country (code, and its continent from js/countries.js). docs/architecture/TARGET.md section 5. */
  function place(code, continent) {
    var byCountry = { GB: 'europe-west2', US: 'nam5', CA: 'northamerica-northeast1', IN: 'asia-south1', AU: 'australia-southeast1', NZ: 'australia-southeast1' };
    if (byCountry[code]) return byCountry[code];
    if (continent === 'Africa') return 'africa-south1';
    if (continent === 'Europe') return 'eur3';
    if (continent === 'Asia') return 'asia-southeast1';
    if (continent === 'Oceania') return 'australia-southeast1';
    if (continent === 'Americas') return ['AR', 'BR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO', 'EC', 'VE'].indexOf(code) >= 0 ? 'southamerica-east1' : 'nam5';
    return 'eur3';
  }

  /* ---------- Firebase's settings: read them from what Firebase shows, and write the church's settings file ---------- */
  var KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];
  var CHECK = {
    apiKey: /^AIza[0-9A-Za-z_-]{30,45}$/,
    authDomain: /^[a-z0-9-]+\.firebaseapp\.com$/,
    projectId: /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
    appId: /^1:\d+:web:[0-9a-f]+$/
  };
  /** Paste anything containing Firebase's `const firebaseConfig = {…}` (or just the lines) → { ok, cfg, missing }. */
  function parseConfig(text) {
    var cfg = {}, missing = [];
    KEYS.forEach(function (k) {
      var m = new RegExp('["\']?' + k + '["\']?\\s*[:=]\\s*["\'`]([^"\'`]+)["\'`]').exec(String(text || ''));
      var v = m ? m[1].trim() : '';
      if (v && CHECK[k].test(v)) cfg[k] = v; else missing.push(k);
    });
    if (cfg.projectId && cfg.authDomain && cfg.authDomain.indexOf(cfg.projectId) !== 0 && !missing.length) { /* a custom auth domain is fine */ }
    return { ok: !missing.length, cfg: cfg, missing: missing };
  }
  /** The whole js/firebase-config.js for the church's copy (same shape as the repository's file). */
  function configFile(cfg, churchName) {
    var q = function (v) { return "'" + String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };
    return '/*\n' +
      ' * Church & Trellis – connection to ' + String(churchName || 'the church').replace(/\*\//g, '') + '’s Firebase project.\n' +
      ' * Made by the setup tool (site/setup.html). These values are not passwords: every visitor’s browser receives them anyway.\n' +
      ' * What keeps the church’s information safe is sign-in, the security rules in firestore.rules, and the website\n' +
      ' * restriction on the key. The demo stays available at the same address with ?demo on the end.\n' +
      ' */\n' +
      'window.CHURCH_HUB_FIREBASE = window.CHURCH_HUB_FIREBASE || {\n' +
      '  apiKey: ' + q(cfg.apiKey) + ',\n' +
      '  authDomain: ' + q(cfg.authDomain) + ',\n' +
      '  projectId: ' + q(cfg.projectId) + ',\n' +
      '  appId: ' + q(cfg.appId) + ',\n' +
      '  // For "Sign in with Google" in the Android app (docs/ANDROID.md, step 3). Empty = email link only.\n' +
      "  googleWebClientId: '',\n" +
      '  // For "Ask in your own words" with AI (docs/AI-SEARCH-SETUP.md). Empty = no AI.\n' +
      "  appCheckKey: '',\n" +
      '  appCheckEnterprise: false\n' +
      '};\n';
  }

  /* ---------- everything the steps need to know about one church ---------- */
  function ctx(ch, countries) {
    ch = ch || {};
    var co = countries && countries.find ? countries.find(ch.country) : null;
    var loc = ch.location || place(co ? co.code : ch.country, co ? co.continent : '');
    var gh = (ch.gh || '').trim(), cfg = ch.cfg || {};
    var site = gh ? 'https://' + gh.toLowerCase() + '.github.io/church-hub/' : '';
    return {
      name: ch.name || 'your church', short: initials(ch.name || ''), you: ch.you || '',
      countryName: co ? co.name : (ch.country || ''), location: loc, place: PLACES[loc] || loc,
      email: (ch.churchEmail || '').trim().toLowerCase(), adminEmail: (ch.adminEmail || ch.churchEmail || '').trim().toLowerCase(),
      emailIdeas: emailIdeas(ch.name || ''), githubIdea: githubIdea(ch.name || ''), projectName: projectName(ch.name || ''),
      gh: gh, repo: gh ? 'https://github.com/' + gh + '/church-hub' : '', site: site, domain: gh ? gh.toLowerCase() + '.github.io' : '',
      cfg: cfg, projectId: cfg.projectId || '', app: function (route) { return (site || 'https://' + UPSTREAM.split('/')[0] + '.github.io/church-hub/') + (route ? '#/' + route : ''); },
      fb: function (path) { return 'https://console.firebase.google.com/' + (cfg.projectId ? 'project/' + cfg.projectId + '/' + (path || 'overview') : ''); }
    };
  }

  /* ---------- HTML helpers for step bodies (setup.html wires up .copy and .open) ---------- */
  var H = {
    ui: function (s) { return '<b class="ui">' + esc(s) + '</b>'; },
    copy: function (v, label) { return '<button type="button" class="copy" data-copy="' + esc(v) + '" title="Copy">' + esc(label || v) + '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v12H9zM5 15H4V3h12v1" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>'; },
    open: function (url, label) { return '<a class="open" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + ' <span aria-hidden="true">↗</span></a>'; },
    note: function (html) { return '<p class="note">' + html + '</p>'; },
    warn: function (html) { return '<p class="warn">' + html + '</p>'; },
    ol: function (items) { return '<ol class="how">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; },
    esc: esc
  };
  var ui = H.ui, copy = H.copy, open = H.open, note = H.note, warn = H.warn, ol = H.ol;

  /* ---------- the setup itself: chapters and steps ---------- */
  var CHAPTERS = [
    { id: 'ready', title: 'Get ready', blurb: 'The church’s own Google account, so the church – not a person – owns everything.' },
    { id: 'website', title: 'The church’s website', blurb: 'The church’s own copy of Church & Trellis, free on GitHub.' },
    { id: 'database', title: 'The church’s database', blurb: 'A private, free database on Google, near your church.' },
    { id: 'open', title: 'Connect and open', blurb: 'Tell the website where its database is, and sign in.' },
    { id: 'first', title: 'Before anyone joins', blurb: 'Privacy, the church’s words, services and staff.' }
  ];

  // Each step: id, chapter, title, mins, why (one sentence), body(c) → HTML, fields?, ready?(church) → true when it may be ticked.
  // `mods` names the app parts (Hub.register ids) a step sets up – see NOT_SETUP and the test.
  var STEPS = [
    { id: 'church', chapter: 'ready', title: 'About the church', mins: 1,
      why: 'Church & Trellis uses these to suggest addresses and choose where the church’s information is kept.',
      fields: [{ key: 'name', label: 'Church name', req: true }, { key: 'country', label: 'Country', type: 'country', req: true }, { key: 'you', label: 'Your name' }],
      body: function (c) { return note('The church’s information will be kept in <b>' + esc(c.place) + '</b>, the nearest place Google offers. You can change this until the database is made – after that it is fixed.'); },
      ready: function (ch) { return !!(ch.name && ch.country); } },

    { id: 'gmail', chapter: 'ready', title: 'A Google account for the church', mins: 10,
      why: 'Whoever owns this account owns the church’s information, so it must belong to the church, not to you.',
      fields: [{ key: 'churchEmail', label: 'The church’s Google email', type: 'email', req: true }],
      body: function (c) {
        return '<p>Already have one the church office controls? Type it below and tick this step. Otherwise:</p>' + ol([
          open('https://accounts.google.com/signup', 'Create a Google account') + ' – it opens in a new tab.',
          'First and last name: the church’s name, for example ' + ui(c.name) + '.',
          'When Google asks what the account is for, choose ' + ui('For my personal use') + '. A free Gmail address is all Church & Trellis needs – you don’t need to pay for Google Workspace.',
          'Choose an address. Ideas (tap one to copy it): ' + c.emailIdeas.map(function (e) { return copy(e.replace('@gmail.com', ''), e); }).join(' '),
          'Use the <b>church office’s</b> phone number for the security code, so the account never depends on one person’s phone.',
          'Write the password on paper and keep it in the church safe (or the church’s password manager). <b>Never type it into this tool.</b>'
        ]);
      },
      ready: function (ch) { return validEmail(ch.churchEmail); } },

    { id: 'safety', chapter: 'ready', title: 'Keep the account safe', mins: 5,
      why: 'If the church loses this account it loses its database, so give it a second way in.',
      body: function () {
        return ol([
          open('https://myaccount.google.com/signinoptions/two-step-verification', 'Turn on 2-Step Verification') + ', signed in as the church’s account.',
          'On the same page, print the ' + ui('Backup codes') + ' and keep them with the password.',
          open('https://myaccount.google.com/recovery/email', 'Add a recovery email') + ' of a second trusted person (a warden, elder or treasurer).'
        ]);
      } },

    { id: 'github', chapter: 'website', title: 'A GitHub account for the church', mins: 5,
      why: 'GitHub gives the church a free website address for Church & Trellis. No programming involved.',
      fields: [{ key: 'gh', label: 'The church’s GitHub username', req: true, check: 'github', idea: 'githubIdea' }],
      body: function (c) {
        return ol([
          open('https://github.com/signup', 'Create a GitHub account') + ' with ' + (c.email ? copy(c.email) : 'the church’s Google email') + '.',
          'Username idea: ' + copy(c.githubIdea) + ' – it becomes part of the church’s web address.',
          'Choose the free plan if asked. Keep the password with the Google one.'
        ]) + (c.gh ? note('Your church’s address will be <b>' + esc(c.site) + '</b>') : '');
      },
      ready: function (ch) { return validGithub(ch.gh); } },

    { id: 'copy', chapter: 'website', title: 'Make the church’s copy of Church & Trellis', mins: 2,
      why: 'The church gets its own copy, so its address and settings are its own.',
      body: function (c) {
        return ol([
          'Sign in to GitHub as ' + (c.gh ? ui(c.gh) : 'the church') + '.',
          open('https://github.com/' + UPSTREAM + '/fork', 'Make our copy') + ' – GitHub calls this a “fork”.',
          'Leave the name as ' + ui('church-hub') + ' and click ' + ui('Create fork') + '.'
        ]);
      } },

    { id: 'pages', chapter: 'website', title: 'Switch the website on', mins: 3,
      why: 'This puts the church’s copy on the internet at its own address.',
      body: function (c) {
        return ol([
          (c.repo ? open(c.repo + '/settings/pages', 'Open the website settings') : 'In the church’s copy, click ' + ui('Settings') + ' → ' + ui('Pages')) + '.',
          'Under ' + ui('Build and deployment') + ', Source: ' + ui('Deploy from a branch') + '. Branch: ' + ui('main') + ', folder ' + ui('/ (root)') + '. Click ' + ui('Save') + '.',
          'After a minute or two the church’s address works: ' + (c.site ? copy(c.site) : 'https://<username>.github.io/church-hub/') + '.'
        ]) + note('It shows a sign-in page that doesn’t work yet. That’s expected – it has no database until the next chapter.');
      } },

    { id: 'fb-project', chapter: 'database', title: 'Create the database’s home', mins: 3,
      why: 'Firebase is Google’s free service that keeps the church’s information private and in sync on every phone.',
      body: function (c) {
        return ol([
          open('https://console.firebase.google.com', 'Open Firebase') + ' and check the round picture at the top right is the <b>church’s</b> account' + (c.email ? ' (' + esc(c.email) + ')' : '') + '.',
          'Click ' + ui('Create a project') + ' (or ' + ui('Get started with a Firebase project') + ').',
          'Name: ' + copy(c.projectName) + '. Click ' + ui('Continue') + '.',
          'If it offers Gemini or AI assistance, switch it off. ' + ui('Continue') + '.',
          'Switch <b>Google Analytics off</b> – Church & Trellis doesn’t need it. Click ' + ui('Create project') + ', wait, then ' + ui('Continue') + '.'
        ]) + note('The church stays on the free <b>Spark</b> plan. Don’t add a bank card.');
      } },

    { id: 'fb-db', chapter: 'database', title: 'Make the database', mins: 3,
      why: 'Keeping it near the church makes it quick, and keeps people’s details where privacy law expects.',
      body: function (c) {
        return ol([
          'In the menu on the left, open ' + ui('Databases & Storage') + ' → ' + ui('Firestore') + ' (older screens: ' + ui('Build') + ' → ' + ui('Firestore Database') + ').',
          'Click ' + ui('Create database') + '. If asked for an edition, choose ' + ui('Standard edition') + '.',
          'Database ID: leave it as ' + ui('(default)') + '.',
          'Location: choose ' + copy(c.location, c.location + ' – ' + c.place) + '.',
          'Choose ' + ui('Start in production mode') + ' and click ' + ui('Create') + '.'
        ]) + warn('The place can’t be changed later. Check it says <b>' + esc(c.place) + '</b> before clicking Create.');
      } },

    { id: 'fb-signin', chapter: 'database', title: 'Switch on signing in', mins: 4,
      why: 'People sign in with Google or with a link sent to their email – no passwords to forget.',
      body: function (c) {
        return ol([
          'In the left menu open ' + ui('Security') + ' → ' + ui('Authentication') + ' (older: ' + ui('Build') + ' → ' + ui('Authentication') + '). Click ' + ui('Get started') + '.',
          ui('Sign-in method') + ' → ' + ui('Google') + ' → switch ' + ui('Enable') + ' on → choose the church’s email as support email → ' + ui('Save') + '.',
          ui('Add new provider') + ' → ' + ui('Email/Password') + ' → switch on <b>both</b> ' + ui('Email/Password') + ' and ' + ui('Email link (passwordless sign-in)') + ' → ' + ui('Save') + '.',
          ui('Add new provider') + ' → ' + ui('Anonymous') + ' → switch it on → ' + ui('Save') + '. This lets members with no email use a code from the office to choose a PIN; on its own it lets nobody see anything.',
          ui('Settings') + ' tab → ' + ui('Authorized domains') + ' → ' + ui('Add domain') + ' → ' + (c.domain ? copy(c.domain) : '<i>your GitHub username</i>.github.io') + ' → ' + ui('Add') + '.'
        ]);
      } },

    { id: 'fb-web', chapter: 'database', title: 'Get the database’s address', mins: 3,
      why: 'Firebase gives four lines that tell the church’s website which database is its own.',
      fields: [{ key: 'cfgText', label: 'Paste what Firebase shows', type: 'config', req: true }],
      body: function () {
        return ol([
          'Click the ' + ui('gear') + ' next to ' + ui('Project Overview') + ' (top left) → ' + ui('Project settings') + '.',
          'Scroll to ' + ui('Your apps') + ' and click the web icon ' + ui('</>') + '.',
          'Nickname: ' + copy('Church & Trellis website') + '. Don’t tick Firebase Hosting. Click ' + ui('Register app') + '.',
          'Select all the code Firebase shows (it starts with ' + ui('import') + ' or ' + ui('const firebaseConfig') + '), copy it, and paste it in the box below.'
        ]) + note('These lines are not passwords – every visitor’s phone receives them. Sign-in and the security rules keep the information safe.');
      },
      ready: function (ch) { return parseConfig(ch.cfgText).ok; } },

    { id: 'fb-admin', chapter: 'database', title: 'Make yourself the first Administrator', mins: 3,
      why: 'Church & Trellis only lets in people on its access list. The first name goes on by hand; after that you add people inside Church & Trellis.',
      fields: [{ key: 'adminEmail', label: 'The email you will sign in with', type: 'email', req: true }],
      body: function (c) {
        var e = c.adminEmail || 'your email';
        return ol([
          (c.projectId ? open(c.fb('firestore/databases/-default-/data'), 'Open the database') : 'Open ' + ui('Firestore') + ' → ' + ui('Data')) + '.',
          'Click ' + ui('+ Start collection') + '. Collection ID: ' + copy('roles') + ' → ' + ui('Next') + '.',
          'Document ID: ' + copy(e) + ' (all small letters).',
          'Field: ' + copy('role') + ', Type ' + ui('string') + ', Value: ' + copy('admin') + '. Click ' + ui('Save') + '.'
        ]);
      },
      ready: function (ch) { return validEmail(ch.adminEmail || ch.churchEmail); } },

    { id: 'fb-rules', chapter: 'database', title: 'Publish the security rules', mins: 2,
      why: 'The rules decide who may see what – for example, only pastors read pastoral notes.',
      body: function (c) {
        return ol([
          '<button type="button" class="copy rules" data-rules="1">Copy the rules</button> – Church & Trellis puts the latest rules on your clipboard.',
          (c.projectId ? open(c.fb('firestore/databases/-default-/security/rules'), 'Open the rules page') : 'Open ' + ui('Firestore') + ' → ' + ui('Rules')) + '.',
          'Click in the editor, select everything (' + ui('Ctrl+A') + ', or ' + ui('⌘+A') + ' on a Mac) and paste (' + ui('Ctrl+V') + ' / ' + ui('⌘+V') + ').',
          'Click ' + ui('Publish') + '.'
        ]) + note('When Church & Trellis’s rules change, it tells Administrators to do this again (it’s on your Keep it up to date list).');
      } },

    { id: 'fb-key', chapter: 'database', title: 'Let only the church’s website use it', mins: 3,
      why: 'This stops other websites from borrowing the church’s database address.',
      body: function (c) {
        return ol([
          open('https://console.cloud.google.com/apis/credentials' + (c.projectId ? '?project=' + c.projectId : ''), 'Open the keys page') + ' (signed in as the church’s account' + (c.projectId ? '' : '; choose the Church & Trellis project at the top') + ').',
          'Under ' + ui('API Keys') + ', click ' + ui('Browser key (auto created by Firebase)') + '.',
          'Under ' + ui('Application restrictions') + ' choose ' + ui('Websites') + ', then ' + ui('Add') + ' each of these: ' +
            copy(c.domain ? 'https://' + c.domain + '/*' : 'https://<username>.github.io/*') + ' ' + copy(c.projectId ? 'https://' + c.projectId + '.firebaseapp.com/*' : 'https://<project>.firebaseapp.com/*'),
          'Click ' + ui('Save') + '. It takes a few minutes to work.'
        ]);
      } },

    { id: 'connect', chapter: 'open', title: 'Connect the website to the database', mins: 3,
      why: 'One small file tells the church’s copy of Church & Trellis where its database is.',
      body: function (c) {
        return ol([
          '<button type="button" class="copy file" data-file="1">Copy the church’s settings file</button>',
          (c.repo ? open(c.repo + '/edit/main/js/firebase-config.js', 'Open the file on GitHub') : 'Open ' + ui('js/firebase-config.js') + ' in the church’s copy and click the pencil') + ' (signed in as ' + (c.gh ? esc(c.gh) : 'the church') + ').',
          'Click in the file, select everything (' + ui('Ctrl+A') + ' / ' + ui('⌘+A') + ') and paste (' + ui('Ctrl+V') + ' / ' + ui('⌘+V') + ').',
          'Click ' + ui('Commit changes…') + ' → ' + ui('Commit changes') + '.'
        ]);
      } },

    { id: 'signin', chapter: 'open', title: 'Sign in for the first time', mins: 3,
      why: 'You become the church’s first Administrator, and Church & Trellis sets up its starter settings.',
      body: function (c) {
        return ol([
          'Wait two minutes after the last step, then ' + open(c.app(), 'Open Church & Trellis') + '. You should see ' + ui('Sign in') + '.',
          'Click ' + ui('Sign in with Google') + ' and choose ' + (c.adminEmail ? ui(c.adminEmail) : 'the email from “first Administrator”') + ' (or use ' + ui('Email me a link') + ').',
          'Church & Trellis says ' + ui('Set up Church & Trellis') + ': check the church’s name, type your name and click ' + ui('Set up') + '.'
        ]) + note('Seeing the demo instead? The browser kept the old page – wait a minute and refresh. Seeing “No access yet”? Check the email in the first-Administrator step matches exactly.');
      } },

    { id: 'privacy', chapter: 'first', title: 'Privacy first', mins: 10, mods: ['privacy'],
      why: 'Before anyone’s details go in, name who looks after privacy and publish the church’s privacy notice.',
      route: 'privacy',
      body: function (c) {
        return ol([
          open(c.app('privacy'), 'Open Privacy') + ': fill in the ' + ui('Information Officer') + ' and read and approve the privacy notice.',
          'Accept Google’s data processing terms: ' + (c.projectId ? open(c.fb('settings/general'), 'Project settings') : 'Firebase → Project settings') + ' → look for ' + ui('Data privacy') + ' / ' + ui('Data processing terms') + '.'
        ]);
      } },

    { id: 'settings', chapter: 'first', title: 'The church’s name, colour and words', mins: 5, mods: ['settings'],
      why: 'Church & Trellis speaks your church’s language – Rector or Pastor, Parishioner or Member.',
      body: function (c) {
        return ol([
          open(c.app('settings/general'), 'Name and country') + ' – check the church’s name and country.',
          open(c.app('settings/colours'), 'Colours') + ' – choose the church’s colour.',
          open(c.app('settings/terminology'), 'Church words') + ' – choose your kind of church, then change any word.'
        ]);
      } },

    { id: 'services', chapter: 'first', title: 'Service times', mins: 5,
      why: 'Rosters, the calendar and the service outlines all start from the church’s services.',
      body: function (c) { return ol([open(c.app('settings/services'), 'Open Church services') + ' and add each regular service: its name, day, time and venue.']); } },

    { id: 'access', chapter: 'first', title: 'Who can see what', mins: 5,
      why: 'Decide what members and visitors may see of each other – phone numbers, addresses, groups.',
      body: function (c) {
        return ol([
          open(c.app('settings/access'), 'Settings → Access and roles') + ' – one page: a card for each kind of person says what they see and can do (with View as to check).',
          'On the same page: tick which contact details each kind of access sees, what Pastors can do (and who the Senior Pastor is), and what attendees – people who aren’t Church Partners – may do.'
        ]);
      } },

    { id: 'staff', chapter: 'first', title: 'Invite the staff', mins: 10, mods: ['people'],
      why: 'A small trial with two or three staff first catches surprises before the whole church joins.',
      body: function (c) {
        return ol([
          open(c.app('people'), 'Open People') + ' → ' + ui('Add person') + '. Fill in their email and choose their ' + ui('App access') + ' (Administrator, Pastor, Roster coordinator…). ' + ui('Save') + '.',
          'Tell them the church’s address ' + (c.site ? copy(c.site) : '') + ' and to sign in with that email.',
          'Try things together with made-up people before the real records go in.'
        ]);
      } },

    { id: 'owner2', chapter: 'first', title: 'A second owner for the database', mins: 3,
      why: 'If the church’s Google account is ever lost, a second owner can still get in.',
      body: function (c) {
        return ol([
          (c.projectId ? open(c.fb('settings/iam'), 'Open Users and permissions') : 'Firebase → ' + ui('Project settings') + ' → ' + ui('Users and permissions')) + '.',
          ui('Add member') + ': the Google email of a trusted leader (the Rector, a warden or the treasurer). Role: ' + ui('Owner') + '. ' + ui('Add member') + '.'
        ]);
      } }
  ];

  /* ---------- Grow: what the church can switch on or fill in whenever it is ready ---------- */
  // id, group, title, what (one sentence), how(c) → HTML, mods (Hub.register ids), since (major.minor), every (days) for repeating jobs.
  var GROUPS = [
    { id: 'people', title: 'People' }, { id: 'groups', title: 'Groups' }, { id: 'serving', title: 'Serving' },
    { id: 'talk', title: 'Messages' }, { id: 'office', title: 'Office and staff' }, { id: 'records', title: 'Records' },
    { id: 'extras', title: 'Extras' }, { id: 'care', title: 'Keep it up to date' }
  ];
  var GROW = [
    { id: 'elvanto', group: 'people', title: 'Bring people across from Elvanto', mods: ['import'], since: '0.1',
      what: 'Moving from Elvanto? Bring everyone across, with households, groups and serving, in one go.',
      how: function (c) { return ol([open(c.app('import'), 'Open Import') + ' and follow the steps on the screen.']); } },
    { id: 'people', group: 'people', title: 'Add the church’s people and households', mods: ['people'], since: '0.1',
      what: 'Everyone in one place: households, children with their guardians, birthdays and anniversaries.',
      how: function (c) { return ol([open(c.app('people'), 'Open People') + ' → ' + ui('Add person') + '. Couples sharing one email can share a sign-in.']); } },
    { id: 'partners', group: 'people', title: 'Church Partners and the membership application', mods: ['me'], since: '0.70',
      what: 'Invite people to become Church Partners, with your declaration and documents to read.',
      how: function (c) { return ol([open(c.app('settings/application'), 'Membership application') + ' – write the declaration and add the documents.', open(c.app('people/applications'), 'Applications') + ' – invite people and answer their applications.']); } },
    { id: 'care', group: 'groups', title: 'Care Groups', mods: ['care', 'groups'], since: '0.1',
      what: 'Every person cared for: a carer for each group, so no one falls through the cracks.',
      how: function (c) { return ol([open(c.app('groups'), 'Open Groups') + ' → ' + ui('Care Groups') + ' → add a group and its carer.']); } },
    { id: 'life', group: 'groups', title: 'Midweek Groups (Bible studies, life groups)', mods: ['life'], since: '0.1',
      what: 'Groups with a leader, members, a map of where they meet, and messages to the group.',
      how: function (c) { return ol([open(c.app('settings/apps'), 'Settings → Apps') + ': switch on Midweek Groups.', open(c.app('groups'), 'Open Groups') + ' → ' + ui('Midweek Groups') + ' → add the groups.']); } },
    { id: 'life-online', group: 'groups', title: 'Midweek Groups online: this week’s links', mods: ['life'], since: '0.99',
      what: 'Group leaders post the week’s meeting link (Google Meet, Zoom, YouTube) and notes: the group gets them in Messages, with a card on Home on the day. A live-streamed study can be open to the whole church.',
      how: function (c) { return ol(['Switch on Midweek Groups and give each group a leader (above).', 'Tell the leaders: ' + open(c.app('groups'), 'Groups') + ' → ' + ui('Midweek Groups') + ' → ' + ui('Post this week’s links') + '. The Google Meet link is remembered, so most weeks only the notes are new.']); } },
    { id: 'leaders', group: 'groups', title: 'Leadership: Council, elders, leaders', mods: ['leaders'], since: '0.1',
      what: 'The church’s leadership bodies, with roles, titles and portfolios.',
      how: function (c) { return ol([open(c.app('groups'), 'Open Groups') + ' → ' + ui('Leadership') + '.']); } },
    { id: 'custom', group: 'groups', title: 'Staff and your own groups', mods: ['customgroups', 'staffgroup'], since: '0.80',
      what: 'A Staff group that keeps itself up to date, plus any other groups you need (choir, youth leaders…).',
      how: function (c) { return ol([open(c.app('groups'), 'Open Groups') + ' and add a group.']); } },
    { id: 'teams', group: 'serving', title: 'Serving teams and positions', mods: ['rosters'], since: '0.1',
      what: 'Departments and positions – one click sets up a starter set you can change.',
      how: function (c) { return ol([open(c.app('rosters/teams'), 'Open Rosters → Teams') + ' and choose the starter teams, or add your own.', 'Put the departments in the order of your service: ' + ui('More') + ' → ' + ui('Rearrange teams') + ', then the ↑ ↓ arrows beside each name (the roster follows that order).']); } },
    { id: 'rosters', group: 'serving', title: 'Make the first roster', mods: ['rosters'], since: '0.1',
      what: 'Church & Trellis fills the roster fairly, keeps families together and asks volunteers in Messages – and someone who can’t make it can ask a free team-mate to take their place. Volunteers see who else is serving with them (Settings → Church Services can switch that off).',
      how: function (c) { return ol([open(c.app('rosters'), 'Open Rosters') + '. Before filling a new term, ' + ui('More') + ' → ' + ui('Ask who’s away…') + ' asks every volunteer to add their days away or say they’re free.', 'Choose a service and fill it.', 'To put it up on the noticeboard: ' + ui('More') + ' → ' + ui('Print the roster') + '. Choose the term and the services – each service gets its own A4 page with only the positions it uses. Choose “Save as PDF” as the printer to make a PDF.']); } },
    { id: 'msggroups', group: 'talk', title: 'Message groups', mods: ['messages'], since: '0.1',
      what: 'Write to a care group, the staff or any list of people inside Church & Trellis – no data costs for SMS.',
      how: function (c) { return ol([open(c.app('messages/groups'), 'Open Messages → Groups') + ' and make the groups you write to often.', open(c.app('messages/send'), 'Send a first message') + ' to the staff.']); } },
    { id: 'emails', group: 'talk', title: 'Birthday, anniversary and welcome emails', mods: [], since: '0.1',
      what: 'Warm emails that go out on the right day, in the church’s own words.',
      how: function (c) { return ol([open(c.app('settings/emails'), 'Open Email templates') + ' and edit each email.']); } },
    { id: 'board', group: 'talk', title: 'The Community board', mods: ['board'], since: '0.97',
      what: 'A corkboard of sticky notes where people ask for help, offer it and say thank you – a keeper checks each one first, and the latest three show on everyone’s Home page.',
      how: function (c) { return ol([open(c.app('settings/apps'), 'Open Settings → Apps') + ' and switch on ' + ui('Community board') + '.',
        open(c.app('board'), 'Open the Community board') + ' → ' + ui('More') + ' → ' + ui('Keepers…') + ' – the pastors, the Administrators and the church secretary check notices until you choose others.',
        ui('More') + ' → ' + ui('The note on the board…') + ' – say, in your own words, that the church doesn’t vouch for offers on the board.']); } },
    { id: 'market', group: 'talk', title: 'The Marketplace', mods: ['market'], since: '0.97',
      what: 'Buy, sell and give away within the church, for Church Partners only. Nothing shows until a keeper approves it.',
      how: function (c) { return ol([open(c.app('settings/apps'), 'Open Settings → Apps') + ' and switch on ' + ui('Marketplace') + '.',
        open(c.app('market'), 'Open the Marketplace') + ' → ' + ui('More') + ' → ' + ui('Marketplace rules…') + ' – read the rules everyone accepts first, and change them if you like.',
        ui('More') + ' → ' + ui('Keepers…') + ' – choose who checks listings (it can be the same people as the board’s).']); } },
    { id: 'events', group: 'talk', title: 'Events and sign-ups', mods: ['events'], since: '0.103',
      what: 'Put church events up; people tap I’ll be there and are reminded 3 days and 1 day before – in Messages, and by email if they ask. Anyone on the staff can add people who put their name down on a paper sheet.',
      how: function (c) { return ol([open(c.app('settings/apps'), 'Open Settings → Apps') + ' and switch on ' + ui('Events') + '.',
        open(c.app('events'), 'Open Events') + ' → ' + ui('More') + ' → ' + ui('Event organisers…') + ' – the pastors, the Administrators and the church secretary put events up until you choose others.',
        'Reminders in Messages need nothing more. For reminders by email too, follow ' + open(DOCS + 'EVENT-EMAILS.md', 'Event reminders by email') + ' (about 15 minutes, once).']); } },
    { id: 'sheets', group: 'talk', title: 'Sign-up sheets and visitor cards from a photo', mods: ['events', 'people'], since: '0.106',
      what: 'Take a photo of a paper sign-up sheet (Events) or of visitor cards (People → From a photo): Church & Trellis reads the handwriting, finds each name in People, and someone checks every name before it is added – with guests for each person. On Android, Choose a photo also opens Google Photos. Names can also be typed or said with the microphone.',
      how: function () { return ol(['Reading photos uses the same AI as Ask in your own words: ' + open(DOCS + 'AI-SEARCH-SETUP.md', 'follow the AI setup guide') + ' if you haven’t, then switch AI on in Settings → Apps.',
        'Tell your privacy notice that photos of sign-up sheets and visitor cards are read by Google’s Gemini (and not kept). Without AI, people can still type or say the names.']); } },
    { id: 'leave', group: 'office', title: 'Staff leave', mods: ['leave'], since: '0.1',
      what: 'Staff ask for leave, it is approved in one tap, and rosters know who is away.',
      how: function (c) { return ol([open(c.app('leave'), 'Open Leave') + ' and check the leave rules.', 'Coming from Leave Manager? ' + open(c.app('import/leave'), 'Import its records') + '.']); } },
    { id: 'library', group: 'records', title: 'The church library', mods: ['library'], since: '0.1',
      what: 'Books acquired, lent and returned, with gentle reminders.',
      how: function (c) { return ol([open(c.app('library'), 'Open Library') + ' and add the books (or choose librarians to do it).']); } },
    { id: 'archive', group: 'records', title: 'Archives', mods: ['archive'], since: '0.1',
      what: 'Minutes, building plans, contracts and appraisals, each seen only by the right people.',
      how: function (c) { return ol([open(c.app('library'), 'Open Library') + ' → ' + ui('Archives') + '.']); } },
    { id: 'archive-folders', group: 'records', title: 'Archive folders, by year and month', mods: ['archive'], since: '0.92',
      what: 'Make the folders your church files things in. A folder for meetings can sort itself into years and months by date, so nobody has to make “2026” or “November”.',
      how: function (c) { return ol([open(c.app('library/archives'), 'Open Archives') + ' → ' + ui('More') + ' → ' + ui('New folder') + ' (or open a folder and choose ' + ui('Change this folder') + ').', 'Switch on ' + ui('Sort by year and month') + ' for folders of monthly meetings – Council meetings already does this.']); } },
    { id: 'languages', group: 'extras', title: 'Languages and your church’s wording', mods: ['words'], since: '0.1',
      what: 'Everyone chooses their own language; fluent speakers can improve the wording for everyone.',
      how: function (c) { return ol([open(c.app('words'), 'Open Translations') + ' to check or improve a language.']); } },
    { id: 'ai', group: 'extras', title: 'Ask in your own words, with AI', mods: [], since: '0.43',
      what: 'Find people by asking a question – “Who has a birthday this month in a care group?”.',
      how: function () { return ol([open(DOCS + 'AI-SEARCH-SETUP.md', 'Follow the AI setup guide') + ' (about 15 minutes), then switch it on in Settings → Apps.']); } },
    { id: 'codes', group: 'people', title: 'Sign-in codes and PINs for members with no email', mods: [], since: '0.87',
      what: 'Give a member a code on a slip or by WhatsApp: with it they choose a PIN, then sign in on any phone with their cellphone number (or a church number) and PIN. Free; Member access only.',
      how: function (c) { return ol(['Check ' + ui('Anonymous') + ' and ' + ui('Email/Password') + ' sign-in are switched on in ' + (c.projectId ? open(c.fb('authentication/providers'), 'Firebase → Sign-in method') : 'Firebase → Authentication → Sign-in method') + '.', open(c.app('people'), 'Open People') + ', open the person → ' + ui('Give a sign-in code') + '.']); } },
    { id: 'invite', group: 'people', title: 'Invite people to start using Church & Trellis', mods: ['people'], since: '0.102',
      what: 'Send people their invitation by email or WhatsApp – one person, a Care Group, a Midweek Group, a serving team or everyone. It gives them access, and its link shows them how to get the app on their phone. People → Invitations shows who hasn’t started yet, with Remind.',
      how: function (c) { return ol([open(c.app('people/search'), 'Open Advanced search') + ', find the people (for example Care Group is …) and choose ' + ui('Invite everyone found to Church & Trellis') + '. For one person, open their page → ' + ui('Invite to Church & Trellis') + '.', 'Send the email, or tap ' + ui('WhatsApp') + ' for each person. People with no email address get a sign-in code instead.', 'A week later, ' + open(c.app('people/welcome'), 'open Invitations') + ' and remind anyone who hasn’t started.']); } },
    { id: 'share', group: 'extras', title: 'Tell the church', mods: [], since: '0.1',
      what: 'Share the church’s address; people can add it to their phone’s home screen like an app.',
      how: function (c) { return (c.site ? '<p>' + copy(c.site) + '</p>' : '') + '<div class="qr" data-qr="' + esc(c.site || '') + '"></div>'; } },
    { id: 'coffee', group: 'extras', title: 'A coffee a month (or a prayer)', mods: ['support'], since: '0.98',
      what: 'Church & Trellis costs one cup of coffee a month for your whole church, at a suggested local price – paid through PayFast by card, Instant EFT or SnapScan – or nothing, if your church promises to pray each month for another church. A hard month? A church that gives monthly can take a payment holiday whenever it needs one, no questions asked.',
      how: function (c) { return ol([open(c.app('support'), 'Open Support Church & Trellis') + ' and choose what suits your church.']); } },
    { id: 'prayercard', group: 'extras', title: 'Your church’s prayer card (every church has one)', mods: ['support'], since: '0.95',
      what: 'Every church that uses Church & Trellis shares a photo and two things to pray for, and looks at them once a month. Every week, everyone’s Home shows another church to pray for – and other churches pray for yours.',
      how: function (c) { return ol([open(c.app('support/card'), 'Open your prayer card') + ' and add a photo and two prayer points. Pray for things, not people by name.',
        'Each month Home asks you to look at it again: change it, or tap ' + ui('Keep it as it is') + '.',
        'Churches that pay may turn off the weekly card on Home under ' + ui('Churches to pray for') + '; churches that pray instead of paying keep it on.']); } },
    { id: 'autorules', group: 'care', title: 'Let GitHub publish the security rules', mods: [], since: '0.31',
      what: 'A one-time setup (about 10 minutes) so the rules update themselves whenever Church & Trellis changes them.',
      how: function () { return ol([open(DOCS + 'RULES-AUTOPUBLISH.md', 'Follow the guide') + ' in the church’s copy.']); } },
    { id: 'sync', group: 'care', title: 'Get the latest Church & Trellis', mods: ['about'], since: '0.1', every: 30,
      what: 'New features arrive on the main Church & Trellis first. Bring them into the church’s copy about once a month.',
      how: function (c) {
        return ol([(c.repo ? open(c.repo, 'Open the church’s copy') : 'Open the church’s copy on GitHub') + ' (signed in as the church).',
          'Click ' + ui('Sync fork') + ' → ' + ui('Update branch') + '. Done – the website updates within a few minutes.',
          'If Church & Trellis says the rules changed, publish them again: ' + '<button type="button" class="copy rules" data-rules="1">Copy the rules</button> ' + (c.projectId ? open(c.fb('firestore/databases/-default-/security/rules'), 'Open the rules page') : '') + ' → paste → ' + ui('Publish') + '.']);
      } },
    { id: 'backup', group: 'care', title: 'Check the church’s accounts', mods: [], since: '0.1', every: 180,
      what: 'Twice a year: can the second owner still get in, and are the passwords and backup codes still in the safe?',
      how: function (c) { return ol([open('https://myaccount.google.com/security', 'Check the church’s Google account'), (c.projectId ? open(c.fb('settings/iam'), 'Check who owns the database') : 'Check who owns the database in Firebase → Users and permissions') + '.']); } }
  ];
  /** App parts with nothing for an Administrator to set up (and why) – the test accepts these. */
  var NOT_SETUP = {
    me: 'Each member’s own page – covered by Church Partners.',
    import: 'Covered by Bring people across from Elvanto.'
  };
  /** Not in Church & Trellis yet – shown so the church knows what is coming. Move an item to GROW when it is built. */
  var COMING = [
    { title: 'Set up in about a minute', what: 'One address for every church, and a setup that makes the database for you – no Firebase or GitHub screens.' },
    { title: 'The Android app for every church', what: 'Today the Android app is for one church; soon any church can use it.' },
    { title: 'A care board', what: 'Who needs a visit – including who is seriously ill in hospital or at home – sent to the right Care Group leaders, the church secretary and the pastors, so no one falls through the cracks.' },
    { title: 'Sunday’s Bible passage', what: 'The passage being preached, on the service outline.' }
  ];

  /* ---------- progress ---------- */
  function stepDone(ch, id) { return !!(ch && ch.done && ch.done[id]); }
  function progress(ch) {
    var n = STEPS.filter(function (s) { return stepDone(ch, s.id); }).length;
    return { done: n, total: STEPS.length, next: STEPS.filter(function (s) { return !stepDone(ch, s.id); })[0] || null, live: stepDone(ch, 'signin') };
  }
  function chapterOf(id) { return CHAPTERS.filter(function (x) { return x.id === id; })[0]; }
  function stepsIn(chapter) { return STEPS.filter(function (s) { return s.chapter === chapter; }); }
  function minor(v) { var p = String(v || '0.0').split('.'); return (+p[0] || 0) * 1000 + (+p[1] || 0); }
  /** A Grow item's state: 'done', 'skip', 'due' (a repeating job whose time has come), or 'todo'. today: 'YYYY-MM-DD'. */
  function growState(ch, item, today) {
    var g = (ch && ch.grow && ch.grow[item.id]) || null;
    if (!g) return 'todo';
    if (g.skip) return 'skip';
    if (item.every && g.at) { var days = (Date.parse(today) - Date.parse(g.at)) / 864e5; return days >= item.every ? 'due' : 'done'; }
    return 'done';
  }
  /** Is this item new since the church last looked (seen = 'major.minor')? */
  function isNew(item, seen) { return !!seen && minor(item.since) > minor(seen); }

  return {
    UPSTREAM: UPSTREAM, CHAPTERS: CHAPTERS, STEPS: STEPS, GROUPS: GROUPS, GROW: GROW, COMING: COMING, NOT_SETUP: NOT_SETUP, PLACES: PLACES, H: H,
    slug: slug, initials: initials, emailIdeas: emailIdeas, githubIdea: githubIdea, validGithub: validGithub, validEmail: validEmail,
    projectName: projectName, place: place, parseConfig: parseConfig, configFile: configFile, ctx: ctx,
    progress: progress, stepDone: stepDone, chapterOf: chapterOf, stepsIn: stepsIn, growState: growState, isNew: isNew, minor: minor, esc: esc
  };
})();
if (typeof module !== 'undefined') module.exports = SetupKit;
