/*
 * Church & Trellis – app shell.
 * Modules (people, rosters, leave, privacy, import, settings) register with Hub.register({...}) and appear as cards on Home.
 * A module object:
 *   id, name, desc (one line), icon (SVG path), tint, roles (who may open it; omit = everyone)
 *   render(parts)  → HTML for #/id/...parts      after(parts) → wire up anything after render (optional)
 *   todos(user)    → [{ text, href, tag }]       stat(user)   → short text on the Home card (optional)
 *   actions        → { name: function (el, ev) } called for clicks on [data-act="id:name"]
 *   badge(user)    → a number shown on its menu entry and phone tab, e.g. unread messages (optional; 0 = none)
 *   also()         → true for someone else who may open it besides roles/perm, e.g. the Rector (optional)
 *   inGroups       → true for the kinds of group (Care Groups, Midweek Groups, Leadership): not in the menu or on Home
 *                    themselves but under one "Groups" entry (js/mod-groups.js), as tabs at the top of their pages
 */
var Hub = (function () {
  'use strict';
  var modules = [], user = null, root = null, T = I18n.t, TN = I18n.tn;

  /* ---------- roles and permissions (UI now; database security rules when on Firebase) ---------- */
  // The kinds of access, what each may do, and the parts' own permissions are kept in one place: js/access.js.
  var ROLES = Access.ROLES;
  var RESTRICTED = Access.RESTRICTED;
  function roleLabel(r) {
    if (r === 'admin' && typeof Wording !== 'undefined') return Wording.words(Store.settings() || {}).admin[0];
    return T((ROLES[r] || ROLES.member).label);
  }
  /** The Senior Pastor (Rector), chosen by an Administrator in Settings → What Pastors can do: a Pastor with their own abilities. */
  function seniorId() { return (Store.settings() || {}).seniorPastorId || ''; }
  function isSenior(p) { return !!p && !!seniorId() && p.id === seniorId() && (p.appRole || 'member') === 'pastor' && p.active !== false; }
  /** Someone's app access as the church says it: once a Senior Pastor is chosen, the other Pastors are Assistant Pastors. */
  function personRole(p) {
    var r = (p && p.appRole) || 'member';
    if (r === 'member' && Msg.partnerLevel(p)) return partnerAccess();   // Church Partners on Basic access: Church Partner access
    if (r !== 'pastor' || !seniorId()) return roleLabel(r);
    return T(isSenior(p) ? 'Senior Pastor' : 'Assistant Pastor');
  }
  /** The signed-in person's own label (or the role being viewed with "View as"). */
  function myLabel() { return Store.preview() || !user ? viewLabel(Store.preview() || myRole()) : personRole(Store.get('people', user.id) || user); }
  /** The role the screens follow: normally the person's own; while an Administrator uses "View as", the role being viewed
   *  ("View as" an attendee: Basic access, not a Church Partner). */
  function myRole() { var v = Store.preview(); return v === 'attendee' ? 'member' : v || (user && user.appRole) || 'member'; }
  /** "Church Partner access" in the church's own words (e.g. "Parishioner access"). */
  function partnerAccess() {
    var w = typeof Wording !== 'undefined' ? (Wording.words(Store.settings() || {}).partner || [])[0] : '';
    return T('{partner} access', { partner: w || T('Church Partner') });
  }
  /** An attendee: Basic access, but not a Church Partner or on the staff (by their category, so it follows automatically
   *  when someone becomes a Church Partner). They see and do only what Settings → Attendees allows (attendeeCan). */
  function attendee() {
    if (!user || myRole() !== 'member') return false;
    var v = Store.preview(); if (v) return v === 'attendee';
    return !Msg.partnerLevel(Store.get('people', user.id) || user);
  }
  /** May an attendee do this ('names', 'directory', 'write', 'reply')? Everyone else: yes. */
  function attendeeCan(x) { return !attendee() || Msg.attendeeCan(Store.settings()).indexOf(x) >= 0; }
  /** Really an Administrator (also while viewing as someone else), so "View as" is offered. */
  function realAdmin() { return !!user && (Store.isLive() ? (Store.live.session() || {}).role === 'admin' : (Store.get('people', user.id) || user).appRole === 'admin'); }
  var VIEW_AS = ['pastor', 'rosters', 'kids', 'carer', 'member', 'attendee'], switching = null;   // carer: a Member who leads a care group; attendee: Basic access, not a Church Partner
  /** Really the Senior Pastor (Rector), also while viewing as someone else: they may use "View as" for the roles below theirs. */
  function realRector() {
    if (!user) return false;
    if (Store.isLive()) { var s = Store.live.session() || {}; return s.role === 'pastor' && !!s.personId && s.personId === seniorId(); }
    var p = Store.get('people', user.id) || user; return p.appRole === 'pastor' && p.id === seniorId() && p.active !== false;
  }
  /** Who may use "View as", and the role they come back to: Administrators, and the Rector. */
  function viewHome() { return realAdmin() ? 'admin' : realRector() ? 'pastor' : ''; }
  function canViewAs() { return !!viewHome(); }
  function viewChoices() { return viewHome() === 'admin' ? VIEW_AS : VIEW_AS.filter(function (r) { return r !== 'pastor'; }); }
  /** "Back to Administrator", or for the Rector "Back to Senior Pastor" (the church's own word, e.g. Rector). */
  function backLabel() {
    if (viewHome() === 'admin') return T('Back to Administrator');
    return T('Back to {role}', { role: personRole(Object.assign({}, Store.get('people', user.id) || user, { appRole: 'pastor', active: true })) });
  }
  function viewLabel(r) { return r === 'carer' ? T('Carer') + ' (' + roleLabel('member') + ')' : r === 'member' ? partnerAccess() : r === 'attendee' ? T('Attendee') + ' (' + roleLabel('member') + ')' : roleLabel(r); }
  function viewingAs() { var g = Store.previewCare(); return g ? T('Carer') + ' · ' + ((Store.get('careGroups', g) || {}).name || '') : viewLabel(Store.preview() || myRole()); }
  /** What Pastors can do (Settings → What Pastors can do): the ticks and what each allows are in js/access.js (ABILITIES).
   *  The database rules check the same ticks (may('…') in firestore.rules), copied onto each Pastor's access-list entry. */
  var TX = function (x) { return x; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var PASTOR_CAN = Access.ABILITIES;
  /** The Senior Pastor's ticks (settings.seniorCan) or the other Pastors' (settings.pastorCan). "View as Pastor" shows the other Pastors'. */
  function pastorTicks() {
    var me = user && !Store.preview() ? Store.get('people', user.id) || user : null;
    return Access.pastorTicks(Store.settings(), isSenior(me) ? me.id : '');
  }
  function pastorPerms() { return Access.abilityPerms(pastorTicks()); }
  function can(perm) {
    if (!user) return false;
    var p = (ROLES[myRole()] || ROLES.member).perms;
    if (myRole() === 'pastor' && pastorPerms().indexOf(perm) >= 0) return true;
    // Settings → Who can see what: Roster coordinators, Children's ministry and Church Partners may see the care groups
    // (settings.seeCare; Church Partners only the people in the church directory). Church Partners also get the Care groups
    // page for their own group when "Their own group: see all its members" is ticked (settings.seeCareOwn).
    if (perm === 'care.view' && !Store.previewCare() && Access.seesCare(Store.settings(), myRole())) return true;
    // A part's own permissions (js/access.js PARTS: e.g. 'board.keep'): by kind of person, a Pastor's tick, or a job
    if (Access.isPartPerm(perm)) return Access.allows(perm, { kind: Access.kindOf(myRole(), attendee()), ticks: myRole() === 'pastor' ? pastorTicks() : [],
      id: Store.preview() ? '' : user.id, settings: Store.settings(), people: Store.find('people', function (x) { return x.active !== false && !x.binnedAt && !x.mergedInto; }) });
    return p.indexOf(perm) >= 0 || (p.indexOf('*') >= 0 && RESTRICTED.indexOf(perm) < 0);
  }

  /* ---------- helpers ---------- */
  /** A small "i" that explains something: shown when the mouse is over it, when it has the keyboard's focus, or when tapped
   *  (phones). The text floats above the page (wireTips), so tables that scroll don't cut it off. */
  function tip(text) { return '<span class="tip" tabindex="0" role="button" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">i</span>'; }
  var tipBox = null, tipFor = null;
  function tipShow(el) {
    if (!el || !el.getAttribute) return;
    if (!tipBox) { tipBox = document.createElement('div'); tipBox.className = 'tip-box'; tipBox.setAttribute('role', 'tooltip'); document.body.appendChild(tipBox); }
    tipFor = el; tipBox.textContent = el.getAttribute('data-tip'); tipBox.hidden = false;
    var r = el.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 24); tipBox.style.maxWidth = w + 'px';
    var bw = tipBox.offsetWidth, bh = tipBox.offsetHeight, left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
    var top = r.top - bh - 8 < 8 ? r.bottom + 8 : r.top - bh - 8;
    tipBox.style.left = left + 'px'; tipBox.style.top = (top + window.scrollY) + 'px';
  }
  function tipHide() { if (tipBox) tipBox.hidden = true; tipFor = null; }
  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('.tip'); if (t) tipShow(t); else if (tipFor && !tipFor.contains(document.activeElement)) tipHide(); });
    document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('tip')) tipShow(e.target); else tipHide(); });
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.tip'); if (t) { e.preventDefault(); e.stopPropagation(); if (tipFor === t && tipBox && !tipBox.hidden) tipHide(); else tipShow(t); } else tipHide(); }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tipHide(); });
    window.addEventListener('scroll', tipHide, { passive: true });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmt(iso, withYear) {
    if (!iso) return '';
    var d = LeaveCore.parse(iso);
    return I18n.dow()[d.getDay()] + ' ' + d.getDate() + ' ' + I18n.mon()[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  }
  function today() { return LeaveCore.iso(new Date()); }
  function name(p) { return p ? ((p.preferredName || p.firstName) + ' ' + p.lastName) : ''; }
  /** Sort people A to Z by the name shown (capitals and accents ignored): list.sort(Hub.byName). */
  function byName(a, b) { return name(a).localeCompare(name(b), undefined, { sensitivity: 'base' }); }
  /** Search: every word typed appears somewhere, in any order – "andr pi" finds Andrew Pike, "pike and" too.
   *  Words in quotes must appear together, exactly: '"amber glen"' finds Amber Glen but not "Glen Amber" or "Amberglen". */
  function matches(text, query) {
    var t = String(text || '').toLowerCase().replace(/\s+/g, ' ');
    return PeopleSearch.words(String(query || '').toLowerCase()).every(function (w) { return PeopleSearch.found(t, w); });   // also short names: "bill" finds William
  }
  /** Every way to write someone's name, for searching: "Douglas Pike" and, if different, what they're known as ("Doug Pike"). */
  function names(p) {
    if (!p) return [];
    var a = [((p.firstName || '') + ' ' + (p.lastName || '')).trim()], k = p.preferredName ? (p.preferredName + ' ' + (p.lastName || '')).trim() : '';
    if (k && k.toLowerCase() !== a[0].toLowerCase()) a.push(k);
    return a;
  }
  /** A family's name: its own name if one was given (custom), otherwise its adults, e.g. "Tim & Clare Jacobs",
   *  "Thandi Mokoena & Sipho Dlamini" or "Megan Smith". It follows changes (marriage, moving out, death) by itself. */
  function familyName(f) {
    if (!f) return '';
    if (f.custom && f.name) return f.name;
    var adults = Store.find('people', function (p) { return p.familyId === f.id && p.familyRole !== 'child' && p.active !== false; })
      .sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : (a.createdAt || '') > (b.createdAt || '') ? 1 : (a.id < b.id ? -1 : 1); });
    if (!adults.length) return f.name || 'Family';
    var bySurname = [];
    adults.forEach(function (p) {
      var g = bySurname.filter(function (x) { return x.last === p.lastName; })[0];
      if (!g) bySurname.push(g = { last: p.lastName, firsts: [] });
      g.firsts.push(p.preferredName || p.firstName);
    });
    var join = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1]; };
    return join(bySurname.map(function (g) { return join(g.firsts) + ' ' + g.last; }));
  }
  function initials(p) { return p ? ((p.preferredName || p.firstName || '?')[0] + (p.lastName || '')[0]).toUpperCase() : '?'; }
  var AV = ['#E8590C', '#2F6FB3', '#0F766E', '#7C3AED', '#B0527A', '#4C9A6A', '#A16207', '#0E7490'];
  function avatar(p, size) {
    var c = AV[(p && p.id ? p.id.charCodeAt(p.id.length - 1) : 0) % AV.length];
    var ph = p && p.photo ? ' data-photo="' + esc(p.id) + '" data-v="' + esc(p.photo) + '"' : '';
    return '<span class="av' + (ph && photoCache[p.id + '|' + p.photo] ? ' pic' : '') + '"' + ph + ' style="--c:' + c + (size ? ';--s:' + size + 'px' : '') +
      (ph && photoCache[p.id + '|' + p.photo] ? ';background-image:url(' + photoCache[p.id + '|' + p.photo] + ')' : '') + '" aria-hidden="true">' + esc(initials(p)) + '</span>';
  }
  /** A picture (a file from the phone or computer, or one downloaded) → a small square JPEG (320 × 320, about 20–40 KB), cut from the middle. */
  function shrinkPhoto(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('not a picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight), N = 320, cv = document.createElement('canvas');
        cv.width = N; cv.height = N;
        cv.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, N, N);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('could not read')); };
      img.src = url;
    });
  }
  /**
   * Choose the part of a picture to keep, e.g. one face in a group photo: drag to move, zoom with the slider (or the mouse
   * wheel). The circle shows how it will look. → a small square JPEG (320 × 320), or nothing if they cancel.
   */
  function cropPhoto(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('not a picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('could not read')); };
      img.onload = function () {
        var W = img.naturalWidth, Hh = img.naturalHeight, V = 600, base = V / Math.min(W, Hh), z = 1, cx = W / 2, cy = Hh / 2, done = false;
        modal(dialogHead(T('Choose the face'), T('Drag the photo and zoom in until the face fills the circle.')) + '<div class="dlg-body">' +
          '<div class="crop"><canvas id="crop-c" width="' + V + '" height="' + V + '" aria-label="' + esc(T('Photo to crop')) + '"></canvas><div class="crop-ring" aria-hidden="true"></div></div>' +
          '<div class="crop-zoom"><button type="button" class="icon-btn" id="crop-out" aria-label="' + esc(T('Zoom out')) + '">−</button>' +
          '<input type="range" id="crop-z" min="1" max="8" step="0.01" value="1" aria-label="' + esc(T('Zoom')) + '">' +
          '<button type="button" class="icon-btn" id="crop-in" aria-label="' + esc(T('Zoom in')) + '">+</button></div></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" id="crop-ok">' + T('Use this photo') + '</button></div>', T('Choose the face'));
        var c = document.getElementById('crop-c'), ctx = c.getContext('2d'), zr = document.getElementById('crop-z');
        var clamp = function () { var half = V / 2 / (base * z); cx = Math.min(Math.max(cx, half), W - half); cy = Math.min(Math.max(cy, half), Hh - half); };
        var draw = function () { clamp(); var s = base * z; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, V, V); ctx.drawImage(img, V / 2 - cx * s, V / 2 - cy * s, W * s, Hh * s); };
        var zoomTo = function (nz) { z = Math.min(8, Math.max(1, nz)); zr.value = z; draw(); };
        zr.addEventListener('input', function () { zoomTo(+zr.value); });
        document.getElementById('crop-in').addEventListener('click', function () { zoomTo(z * 1.25); });
        document.getElementById('crop-out').addEventListener('click', function () { zoomTo(z / 1.25); });
        c.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
        var drag = null;
        c.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', function (e) {
          if (!drag) return;
          var k = V / c.getBoundingClientRect().width / (base * z);
          cx -= (e.clientX - drag.x) * k; cy -= (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY }; draw();
        });
        c.addEventListener('pointerup', function () { drag = null; });
        c.addEventListener('keydown', function (e) {   // arrow keys move the photo, + and − zoom
          var step = 20 / (base * z), m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
          if (m) { e.preventDefault(); cx += m[0]; cy += m[1]; draw(); } else if (e.key === '+' || e.key === '=') zoomTo(z * 1.25); else if (e.key === '-') zoomTo(z / 1.25);
        });
        c.tabIndex = 0;
        document.getElementById('crop-ok').addEventListener('click', function () {
          if (done) return; done = true;
          var N = 320, out = document.createElement('canvas'), s = base * z * N / V; out.width = N; out.height = N;
          var o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, N, N); o.drawImage(img, N / 2 - cx * s, N / 2 - cy * s, W * s, Hh * s);
          URL.revokeObjectURL(url); closeModal(); ok(out.toDataURL('image/jpeg', 0.82));
        });
        draw();
      };
      img.src = url;
    });
  }
  /* Photos are fetched only when their circle comes into view, then kept for this visit (key: person + version). */
  var photoCache = {}, photoAsked = {}, photoSeen = null;
  function showPhoto(el) {
    var id = el.getAttribute('data-photo'), key = id + '|' + el.getAttribute('data-v');
    var paint = function () { var d = photoCache[key]; if (d) { el.style.backgroundImage = 'url(' + d + ')'; el.classList.add('pic'); } };
    if (key in photoCache) return paint();
    (photoAsked[key] = photoAsked[key] || Store.photo(id).then(function (d) { photoCache[key] = /^data:image\/(jpeg|png|webp);base64,/.test(d || '') ? d : ''; })).then(function () {
      document.querySelectorAll('.av[data-photo="' + id + '"]').forEach(function (x) { if (x.getAttribute('data-v') === el.getAttribute('data-v')) { var d = photoCache[key]; if (d) { x.style.backgroundImage = 'url(' + d + ')'; x.classList.add('pic'); } } });
    });
  }
  function loadPhotos() {
    var els = document.querySelectorAll('.av[data-photo]:not(.pic)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) return els.forEach(showPhoto);
    if (photoSeen) photoSeen.disconnect();
    photoSeen = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { photoSeen.unobserve(e.target); showPhoto(e.target); } }); }, { rootMargin: '200px' });
    els.forEach(function (el) { photoSeen.observe(el); });
  }
  function icon(path, size) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"></path></svg>';
  }
  /** A small map-pin button that opens an address in Google Maps (a new tab). The address goes to Google only when tapped. */
  function mapLink(address) {
    var q = String(address || '').replace(/\s+/g, ' ').trim(); if (!q) return '';
    var country = (Countries.church(Store.settings()) || {}).name;
    if (country && q.toLowerCase().indexOf(country.toLowerCase()) < 0) q += ', ' + country;   // the church's own country isn't shown, but helps the map
    return '<a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + esc(encodeURIComponent(q)) + '" target="_blank" rel="noopener noreferrer" title="' + esc(T('Open in Google Maps')) + '" aria-label="' + esc(T('Open in Google Maps')) + '">' +
      icon('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 16) + '</a>';
  }
  /** Runs fn once typing has paused for `ms` (searching on every key press is slow on phones). */
  function pause(fn, ms) { var t = null; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms || 300); }; }
  var ICON = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    people: 'M16 11a4 4 0 1 0-8 0M3 21c1-4 5-6 9-6s8 2 9 6',
    rosters: 'M8 3v4M16 3v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 13h3M8 17h3M14 13h3',
    leave: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    privacy: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    import: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    plus: 'M12 5v14M5 12h14', back: 'M15 18l-6-6 6-6', search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-3.5-3.5',
    check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12', lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
    link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    split: 'M16 3h5v5M8 3H3v5M21 3l-7 7M3 3l7 7M12 14v7', out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M4 6h16M4 12h16M4 18h16', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', download: 'M12 3v12M7 10l5 5 5-5M4 21h16', trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15', sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'
  };

  /** Running inside the Church & Trellis Android app (android/), which adds window.ChurchHubApp. */
  function inApp() { return !!(window.ChurchHubApp && window.ChurchHubApp.googleSignIn); }
  /** Opened from the phone's home screen (iPhone "Add to Home Screen", or Android's "Install app"), not in a browser tab. */
  function homeScreen() {
    try { return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
  }
  /** Church & Trellis as an app on a phone: the Android app or the home-screen app. Email links open in the browser there,
   *  which keeps its own sign-in, so people paste the link instead. */
  function phoneApp() { return inApp() || homeScreen(); }
  function isAndroid() { return /Android/i.test(navigator.userAgent || ''); }
  var APK = 'https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk';   // as in js/mod-me.js (docs/ANDROID.md)
  function isIPhone() { var u = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1); }

  /* ---------- prompts on Home and Me: a photo of yourself (in the apps), and putting Church & Trellis on an iPhone's home screen ---------- */
  var LATER_DAYS = { selfie: 30, iphone: 60, android: 60, langs: 3 }, photoAdded = false;   // photoAdded: just added here (the database may not have answered yet)
  function later(k) { var d = Store.pref(k + 'Later'); return d && (Date.now() - Date.parse(d)) < LATER_DAYS[k] * 864e5; }
  function prompts() {
    var me = user && Store.get('people', user.id), out = '';
    if (me && phoneApp() && !me.photo && !photoAdded && me.familyRole !== 'child' && !later('selfie'))
      out += '<section class="panel prompt" id="selfie-ask"><div class="row" style="gap:14px;align-items:center">' + avatar(me, 56) +
        '<div class="grow"><h2 style="margin:0 0 4px">' + T('Add a photo of yourself') + '</h2><p class="muted small" style="margin:0">' + T('So people at church can put a face to your name. Only people who may see your details see it.') + '</p></div></div>' +
        '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="hub:selfie">' + icon(ICON.plus, 18) + T('Take or choose a photo') + '</button>' +
        '<button class="btn" data-act="hub:later" data-k="selfie">' + T('Not now') + '</button></div><input type="file" id="selfie-file" accept="image/*" hidden></section>';
    if (user && isIPhone() && !homeScreen() && !later('iphone'))
      out += '<section class="panel prompt" id="iphone-ask"><h2 style="margin:0 0 4px">' + T('Church & Trellis on your iPhone') + '</h2>' +
        '<p class="small" style="margin:0">' + T('Tap the Share button (the square with an arrow), then “Add to Home Screen”. Church & Trellis then opens like an app, full screen, with its own icon.') + '</p>' +
        '<div class="btns" style="margin-top:10px"><button class="btn" data-act="hub:later" data-k="iphone">' + T('Not now') + '</button></div></section>';
    if (user && isAndroid() && !phoneApp() && !later('android'))
      out += '<section class="panel prompt" id="android-ask"><h2 style="margin:0 0 4px">' + T('Church & Trellis app for Android') + '</h2>' +
        '<p class="small" style="margin:0">' + T('Get the app: it opens full screen with its own icon. It isn’t in the Play Store yet, so your phone may ask you to allow installing it.') + '</p>' +
        '<div class="btns" style="margin-top:10px"><a class="btn primary" href="' + APK + '" target="_blank" rel="noopener">' + T('Get the app') + '</a><button class="btn" data-act="hub:later" data-k="android">' + T('Not now') + '</button></div></section>';
    return out;
  }
  /* Administrators: the extra languages (all but Sesotho) are translated in one go before Church & Trellis is released (docs/RELEASE.md),
   * so Home reminds them every few days how many texts are still in English there. Japanese stands for all of them (it was added
   * last, so has the most waiting); the count is kept on this device for each version, so its file is fetched once per version. */
  var langGap = null;
  function langsWaiting() {
    if (langGap !== null) return langGap;
    var v = (typeof ChurchHubVersion !== 'undefined' && ChurchHubVersion.version) || '', kept = Store.pref('langsGap').split('|');
    if (kept.length === 2 && kept[0] === v) return (langGap = +kept[1] || 0);
    langGap = 0;
    I18n.load('ja', function () {
      langGap = I18n.english().filter(function (en) { return !I18n.word('ja', en, true); }).length;
      Store.pref('langsGap', v + '|' + langGap);
      if (langGap && parts()[0] === 'home') render();
    });
    return 0;
  }
  function langsPrompt() {
    if (!realAdmin() || later('langs')) return '';
    var n = langsWaiting(); if (!n) return '';
    return '<section class="panel prompt" id="langs-ask"><h2 style="margin:0 0 4px">' + T('Not every language is up to date') + '</h2>' +
      '<p class="small" style="margin:0">' + TN('{n} text is still in English in the {count} extra languages (German, French, Portuguese and the others). English, Afrikaans, isiZulu, isiXhosa and Sesotho are complete.', '{n} texts are still in English in the {count} extra languages (German, French, Portuguese and the others). English, Afrikaans, isiZulu, isiXhosa and Sesotho are complete.', n, { count: I18n.MORE.filter(function (m) { return !m[4] && m[0] !== 'st'; }).length }) + '</p>' +
      '<p class="small muted" style="margin:6px 0 0">' + T('That is fine while Church & Trellis is used only by this church. Before other churches use it, ask Claude to translate them.') + '</p>' +
      '<div class="btns" style="margin-top:10px"><button class="btn" data-act="hub:later" data-k="langs">' + T('Remind me in 3 days') + '</button></div></section>';
  }
  function wirePrompts() {
    var f = document.getElementById('selfie-file'); if (!f) return;
    f.addEventListener('change', function () {
      var file = f.files && f.files[0], me = user && Store.get('people', user.id); f.value = ''; if (!file || !me) return;
      cropPhoto(file).then(function (data) { photoAdded = true; return Store.setPhoto(me.id, data, 'Added a photo of ' + name(me) + ' (their own)').then(function () { render(); toast(T('Photo saved')); }); })
        .catch(function () { toast(T('That file isn’t a picture Church & Trellis can read. Try a JPG or PNG photo.'), true); });
    });
  }

  /* ---------- modules ---------- */
  function register(m) { modules.push(m); }
  /** One-off data upgrades (module.upgrade), run when an Administrator signs in. */
  /** Modules may do something for everyone once they are signed in (e.g. keep their care group card up to date). */
  function signedInHooks() { var u = user; setTimeout(function () { if (!u || !user || user.id !== u.id) return; u = user; modules.forEach(function (m) { if (m.signedIn) { try { m.signedIn(u); } catch (e) { console.error('signedIn', m.id, e); } } }); }, 1500); }
  function runUpgrades() { tipShown = null; tipClosed = false; signedInHooks(); if (!can('*')) return; modules.forEach(function (m) { if (m.upgrade) { try { m.upgrade(user); } catch (e) { console.error('upgrade', m.id, e); } } }); }
  /** Is this app switched on (Settings → Apps)? Most are on until switched off; a few (optIn, e.g. Life groups) are off until switched on. */
  function isOn(id) {
    var on = ((Store.settings() || {}).modules || {}), m = moduleById(id);
    if (id === 'library' || id === 'archive') return on.library === true || on.archive === true;
    return m && m.optIn ? on[id] === true : on[id] !== false;
  }
  /** A placeholder for a part not built yet (js/access.js PARTS, soon: true): its menu entry is ready but nobody sees it. */
  function built(m) { return !(Access.part(m.id) || {}).soon; }
  function opens(m) { return built(m) && isOn(m.id) && (!m.roles || m.roles.indexOf(myRole()) >= 0 || can('*') || (m.perm && can(m.perm)) || (m.also && m.also())) && (!m.show || m.show()); }
  function enabled() { return modules.filter(opens); }
  function moduleById(id) { return modules.filter(function (m) { return m.id === id; })[0]; }
  /** What the menu, Home and All apps list: the kinds of group sit under Groups instead. */
  function listed() { return enabled().filter(function (m) { return !m.inGroups && !m.inLibrary && !(m.offMenu && m.offMenu()); }); }   // offMenu: opens, but has no menu entry of its own (e.g. Rosters for members: theirs is on Me)
  /** The kinds of group this person may open (Groups → its tabs), in menu order. */
  function groupMods() {
    var priority = { care: 0, life: 1, staffgroup: 2, leaders: 3 };
    return modules.map(function (m, i) { return { module: m, index: i }; })
      .filter(function (x) { return x.module.inGroups && opens(x.module); })
      .sort(function (a, b) { return (priority[a.module.id] === undefined ? 100 : priority[a.module.id]) - (priority[b.module.id] === undefined ? 100 : priority[b.module.id]) || a.index - b.index; })
      .map(function (x) { return x.module; });
  }

  /* ---------- routing ---------- */
  function parts() { return (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent); }
  function go(path) { location.hash = '#/' + path; }

  /* ---------- rendering ---------- */
  /* ---------- the church's colours (Settings → Appearance) ----------
   * Each theme: the accent (buttons, links, the turning cross, the logo), a darker shade for writing on light backgrounds,
   * a pale shade, and the menu's own dark colour. "Your own colour" works out the shades, darkened if needed so white
   * writing on buttons stays readable. Remembered on each device (Store.pref) so the sign-in screen has it too. */
  var THEMES = [
    { id: 'orange', name: TX('Orange'), accent: '#E8590C', ink: '#B8430A', soft: '#FFE8D9', side: '#231E1A', side2: '#3A322C' },
    { id: 'blue', name: TX('Blue'), accent: '#1D5FB8', ink: '#164A8F', soft: '#E1ECFA', side: '#16202D', side2: '#26354A' },
    { id: 'green', name: TX('Green'), accent: '#2E7D4F', ink: '#23613D', soft: '#E0F2E7', side: '#17241C', side2: '#263A2D' },
    { id: 'purple', name: TX('Purple'), accent: '#6D3FC0', ink: '#55309A', soft: '#EEE6FB', side: '#1F1A2B', side2: '#332A47' },
    { id: 'burgundy', name: TX('Burgundy'), accent: '#A3283B', ink: '#7F1F2E', soft: '#FBE3E7', side: '#251619', side2: '#3D252A' },
    { id: 'teal', name: TX('Teal'), accent: '#0F7C80', ink: '#0B6064', soft: '#DDF3F3', side: '#142224', side2: '#223839' },
    { id: 'gold', name: TX('Gold'), accent: '#A86A12', ink: '#7E500E', soft: '#FBEFD9', side: '#241E15', side2: '#3B3224' },
    { id: 'slate', name: TX('Slate grey'), accent: '#475569', ink: '#334155', soft: '#E7EBF0', side: '#1B1F26', side2: '#2C333D' }
  ];
  function hexRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(c) { return '#' + c.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function mix(c, to, t) { return c.map(function (x, i) { return x + (to[i] - x) * t; }); }
  function lum(c) { var f = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; }
  /** A theme from any colour, kept exactly as chosen (bright yellow stays bright yellow). If white writing on it would be
   *  hard to read (contrast under 3 – button writing is bold), the writing on buttons turns dark instead (on). Links and writing on light
   *  backgrounds (ink) use a darker shade of the colour, so they stay readable on white. */
  function themeFrom(hex) {
    var c = hexRgb(hex) || hexRgb('#E8590C'), d = c, light = 1.05 / (lum(c) + 0.05) < 3;   // bold button writing: 3 is enough (as on the built-in orange)
    for (var i = 0; i < 20 && 1.05 / (lum(d) + 0.05) < 4.5; i++) d = mix(d, [0, 0, 0], 0.08);
    return { id: 'custom', accent: rgbHex(c), on: light ? '#1C1814' : '#FFFFFF', ink: rgbHex(mix(d, [0, 0, 0], 0.22)), soft: rgbHex(mix(c, [255, 255, 255], 0.86)),
      side: rgbHex(mix(d, [22, 20, 18], 0.86)), side2: rgbHex(mix(d, [40, 36, 32], 0.78)), light: light };
  }
  function themeOf(st) {
    var t = (st && st.theme) || {};
    if (t.id === 'custom' && hexRgb(t.color)) return themeFrom(t.color);
    return THEMES.filter(function (x) { return x.id === t.id; })[0] || THEMES[0];
  }
  /** Each person's own theme on this device (Me → Appearance): their colour and their page pictures. Empty = the church's choice. */
  function myColor() { var c = Store.pref('myColor'); return hexRgb(c) ? c.toUpperCase() : ''; }
  function myLook() { var l = Store.pref('myLook'); return l === 'plain' || l === 'line' || l === 'watercolour' ? l : ''; }
  /** The theme in use: the person's own colour if they chose one, otherwise the church's. */
  function themeFor(st) { var c = myColor(); return c ? themeFrom(c) : themeOf(st); }
  /** The church's settings with the person's own page pictures laid over them (for drawing the picture at the top of a page). */
  function lookSettings(st) { var l = myLook(); if (!l) return st; var o = {}; for (var k in (st || {})) o[k] = st[k]; o.look = l; return o; }
  /** Light or dark: each person's own choice on each device (Store.pref('mode'): 'light', 'dark' or '' = same as the device). */
  function modeChoice() { return Store.pref('mode') || ''; }
  function isDark() {
    var m = modeChoice();
    return m === 'dark' || (!m && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }
  function applyMode() {
    var dark = isDark(); document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
    themeKey = ''; applyTheme(Store.settings && Store.settings() ? themeFor(Store.settings()) : null);
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!modeChoice()) applyMode(); }); } catch (e) { /* older browsers */ }
  }
  /** A colour that clashes with the church's (the opposite side of the colour wheel), so a message about something to fix stands out from the theme: --alert (strong), --alert-soft (background), --alert-ink (writing). */
  function rgbHsl(c) { var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function hslRgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; if (!s) return [l * 255, l * 255, l * 255];
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = function (t) { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
  function alertColours(accent, dark) { var a = hexRgb(accent); if (!a) return null; var x = rgbHsl(a), h = x[0] + 180, s = Math.max(.55, Math.min(.85, x[1]));
    return dark ? { strong: rgbHex(hslRgb(h, s, .6)), soft: rgbHex(hslRgb(h, s * .6, .2)), ink: rgbHex(hslRgb(h, s, .82)) } : { strong: rgbHex(hslRgb(h, s, .42)), soft: rgbHex(hslRgb(h, Math.min(1, s + .1), .94)), ink: rgbHex(hslRgb(h, s, .26)) }; }
  var themeKey = '';
  function applyTheme(t) {
    if (!t) { try { t = JSON.parse(Store.pref('theme') || 'null'); } catch (e) { t = null; } if (!t) t = THEMES[0]; }
    var dark = document.documentElement.getAttribute('data-mode') === 'dark';
    var k = t.accent + t.side + (t.on || '') + dark; if (k === themeKey) return; themeKey = k;
    var r = document.documentElement.style, a = hexRgb(t.accent);
    // On dark backgrounds the church's colour gets a lighter shade for writing and a dark pale shade for soft buttons
    var ink = dark && a ? rgbHex(mix(a, [255, 255, 255], 0.45)) : t.ink, soft = dark && a ? rgbHex(mix(a, [30, 26, 23], 0.76)) : t.soft;
    r.setProperty('--accent', t.accent); r.setProperty('--accent-on', t.on || '#FFFFFF'); r.setProperty('--accent-ink', ink); r.setProperty('--accent-soft', soft);
    r.setProperty('--side', t.side); r.setProperty('--side-2', t.side2);
    var al = alertColours(t.accent, dark); if (al) { r.setProperty('--alert', al.strong); r.setProperty('--alert-soft', al.soft); r.setProperty('--alert-ink', al.ink); }
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t.side);
    Store.pref('theme', JSON.stringify({ accent: t.accent, on: t.on || '#FFFFFF', ink: t.ink, soft: t.soft, side: t.side, side2: t.side2 }));
  }
  /** Light / Dark / Automatic (same as this device) – each person's own choice, remembered on this device. A quiet
   *  drop-down like the language one, with a half-shaded circle. */
  function modePicker() {
    var m = modeChoice();
    return '<label class="lang-pick mode-pick"><span class="sr">' + T('Appearance') + '</span>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>' +
      '<select class="mode-sel" aria-label="' + esc(T('Appearance')) + '">' + [['', TX('Automatic')], ['light', TX('Light')], ['dark', TX('Dark')]].map(function (x) {
        return '<option value="' + x[0] + '"' + (m === x[0] ? ' selected' : '') + '>' + esc(T(x[1])) + '' + '</option>';
      }).join('') + '</select></label>';
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (ev) {
    var sel = ev.target; if (!sel.classList || !sel.classList.contains('mode-sel')) return;
    Store.pref('mode', sel.value || ''); applyMode();
    var inMenu = !!sel.closest('#modal'); render(); if (inMenu) { closeModal(); hubActions.menu(); }
  });
  /** About → Speed check (Administrators): how long each page took to draw, and how long the browser was too busy to respond. */
  var speed = { pages: [], longs: [], appJs: Math.round(performance.now()), busyMs: 0, busyLongest: 0, opened: Date.now() };
  try {
    if (typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes || []).indexOf('longtask') >= 0)
      new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { speed.busyMs += e.duration; if (e.duration > speed.busyLongest) speed.busyLongest = e.duration; speed.longs.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); speed.longs.sort(function (x, y) { return y.ms - x.ms; }); speed.longs.length = Math.min(speed.longs.length, 5); }); }).observe({ entryTypes: ['longtask'] });
  } catch (e) { /* not in this browser */ }
  function render() {
    var t0 = Date.now();
    try { draw(); } finally {
      var ms = Date.now() - t0;
      if (user) { speed.pages.unshift({ page: location.hash.split('?')[0] || '#/home', ms: ms, at: Date.now() }); speed.pages.length = Math.min(speed.pages.length, 12); }
    }
  }
  function draw() {
    if (switching) return;   // "View as": the right information is still loading
    if (!document.documentElement.getAttribute('data-mode')) applyMode();
    if (Store.settings && Store.settings()) applyTheme(themeFor(Store.settings())); else applyTheme();
    if (!user) return renderSignIn();
    modules.forEach(function (m) { if (m.beforeRender) { try { m.beforeRender(); } catch (e) { console.error(m.id, e); } } });   // e.g. approved translations
    var p = parts();
    if (p[0] === 'archive') { go('library/archives'); return; }
    var mod = p[0] === 'home' ? null : moduleById(p[0]);
    if (mod && enabled().indexOf(mod) < 0) { go('home'); return; }
    // Translations: remember which texts each page shows, so people can improve exactly those (Translations → "On the page you were on")
    if (p[0] === 'words') { if (!inWords && mod && mod.leaving) mod.leaving(I18n.seen()); inWords = true; I18n.page(null); }
    else { inWords = false; I18n.page(location.hash); }
    var body = mod ? mod.render(p.slice(1)) : renderHome();
    if (mod && mod.inGroups) { var gm = moduleById('groups'); if (gm && gm.tabs) body = gm.tabs(mod.id) + body; }   // Groups: its tabs on each kind of group (moved under the title below)
    if (!mod || (mod.id === 'me' && !p[1])) body = prompts() + body;   // Home and My details
    var keyOf = function (d) { var sm = d.querySelector('summary'); return d.id || (sm ? sm.textContent.trim() : ''); };
    var wasOpen = [].map.call(root.querySelectorAll('details[open]'), keyOf).filter(Boolean), samePage = root.dataset.page === location.hash;
    var hadMsgs = samePage ? [].map.call(root.querySelectorAll('.msg-chat [data-id]'), function (x) { return x.dataset.id; }) : null;
    root.innerHTML = shell(mod, body);
    // Gentle movement: a new page eases in; a message that has just arrived on the page you're on glides into the list
    var pb = root.querySelector('.page-body'); if (pb && !samePage) pb.classList.add('page-in');
    if (hadMsgs) root.querySelectorAll('.msg-chat [data-id]').forEach(function (x) { if (hadMsgs.indexOf(x.dataset.id) < 0) x.classList.add('arrive'); });
    root.dataset.page = location.hash; guardBack(); findables(root);
    // Groups: its tabs go under the page's title, as on every other page (title, tabs, then the page)
    var gt = root.querySelector('main .groups-tabs'), ph = root.querySelector('main .page-head');
    if (gt && ph && (gt.compareDocumentPosition(ph) & 4)) ph.parentNode.insertBefore(gt, ph.nextSibling);
    if (samePage && wasOpen.length) root.querySelectorAll('details').forEach(function (d) { if (wasOpen.indexOf(keyOf(d)) >= 0) d.open = true; });   // a refresh keeps unfolded sections open
    if (window.Banners) Banners.decorate(root, location.hash, lookSettings(Store.settings && Store.settings()));   // the picture behind the page's heading (Me → Appearance, or the church's choice in Settings → Appearance)
    ourWords(root);
    wirePrompts();
    if (mod && mod.after) mod.after(p.slice(1));
    loadPhotos();
    langWire(); markRequired();
    var h = root.querySelector('main h1'); if (h) document.title = h.textContent + ' · Church & Trellis';
  }

  var inWords = false;
  /** At the foot of each page in another language: a way to suggest better wording for what is on it. */
  function improveLink(mod) {
    var w = moduleById('words');
    if (I18n.get() === 'en' || (mod && mod.id === 'words') || !w || enabled().indexOf(w) < 0) return '';
    return '<p class="improve"><a href="#/words/page">' + icon('M4 20h4L19 9l-4-4L4 16v4z', 16) + T('Help improve the {lang} wording on this page', { lang: esc(I18n.name(I18n.get())) }) + '</a></p>';
  }
  function navItems(active) {
    var items = [{ id: 'home', name: T('Home'), icon: ICON.home }].concat(listed().map(function (m) { return { id: m.id, name: T(m.name), icon: m.icon, n: badgeOf(m) }; }));
    return items.map(function (it) {
      return '<a href="#/' + it.id + '" class="nav' + (it.id === active ? ' on' : '') + '"' + (it.id === active ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span class="grow">' + esc(it.name) + '</span>' + badge(it.n) + '</a>';
    }).join('');
  }
  /** A module's count (e.g. unread messages): a small number on its menu entry and phone tab. */
  function badgeOf(m) { try { return m && m.badge ? +m.badge(user) || 0 : 0; } catch (e) { return 0; } }
  function badge(n) { return n > 0 ? '<span class="badge" aria-label="' + esc(T('{n} new', { n: n })) + '">' + (n > 99 ? '99+' : n) + '</span>' : ''; }
  function shell(mod, body) {
    var active = mod ? (mod.inGroups ? 'groups' : mod.id) : 'home', s = Store.settings();
    // Phone tab bar: members get "Me" (their details, days away, serving) first; staff get their working areas first.
    var order = can('people.basic') || can('people.view') || can('*') ? ['people', 'messages', 'rosters', 'leave', 'me'] : ['me', 'messages', 'people', 'rosters', 'leave'];
    var on = listed().map(function (m) { return m.id; });
    var tabs = ['home'].concat(order.filter(function (id) { return on.indexOf(id) >= 0; })).slice(0, 4);
    return '<div class="app">' +
      '<aside class="side" aria-label="' + T('Main menu') + '"><div class="brand"><span class="mark">' + icon('M12 3v18M6 9h12', 18) + '</span><span><b>Church <span class="amp">&amp;</span> Trellis</b><small>' + esc(s.churchName) + '</small></span></div>' +
      '<nav>' + navItems(active) + '</nav>' + '<div class="side-lang">' + I18n.picker() + '<div class="side-mode">' + modePicker() + '</div>' +
      (canViewAs() && !Store.preview() ? '<button class="side-viewas" data-act="hub:viewaspick" title="' + esc(T('See Church & Trellis as another role would')) + '">' + icon(ICON.eye, 16) + T('View as…') + '</button>' : '') + '</div>' +
      '<div class="who">' + avatar(user) + '<span><b>' + esc(name(user)) + '</b><small>' + esc(myLabel()) + '</small></span>' +
      (shared() ? '<button class="icon-btn ghost" data-act="hub:switchwho" aria-label="' + T('Switch person') + '" title="' + T('Switch person') + '">' + icon(ICON.people) + '</button>' : '') +
      '<button class="icon-btn ghost" data-act="hub:signout" aria-label="' + T('Sign out') + '" title="' + T('Sign out') + '">' + icon(ICON.out) + '</button></div></aside>' +
      '<div class="main-col">' +
      '<header class="top"><a href="#/home" class="brand small"><span class="mark">' + icon('M12 3v18M6 9h12', 16) + '</span><b>Church <span class="amp">&amp;</span> Trellis</b></a>' +
      '<span class="top-r">' + (canViewAs() ? '<button class="icon-btn" data-act="hub:viewaspick" aria-label="' + esc(T('View as another role')) + '" title="' + esc(T('View as another role')) + '">' + icon(ICON.eye) + '</button>' : '') +
      '<button class="icon-btn" data-act="hub:menu" aria-label="' + T('All apps') + '">' + icon(ICON.menu) + '</button></span></header>' +
      (s.demo ? '<div class="demo">' + T('Demo with made-up people. Changes stay in this browser.') + ' <button class="link" data-act="hub:reset">' + T('Reset demo') + '</button> · <button class="link" data-act="hub:signout">' + T('Switch person') + '</button></div>' : '') +
      (Store.offline() ? '<div class="offline-bar" role="status">' + icon(ICON.eye, 18) + '<span>' + T('You’re offline – Church & Trellis is view-only until you’re back online.') + '</span></div>' : '') +
      (Store.preview() ? '<div class="viewas" role="status">' + icon(ICON.eye, 18) + '<span>' + T('Viewing as {role} – this is what they see. Nothing you do here is saved.', { role: '<b>' + esc(viewingAs()) + '</b>' }) + '</span>' +
        '<button class="btn small" data-act="hub:viewas" data-r="admin">' + esc(backLabel()) + '</button></div>' : '') +
      '<main id="main" tabindex="-1"><div class="page-body">' + body + '</div>' + improveLink(mod) + '</main></div>' +
      '<nav class="tabbar" aria-label="' + T('Quick menu') + '">' + tabs.map(function (id) {
        var m = id === 'home' ? { name: 'Home', icon: ICON.home } : moduleById(id);
        return '<a href="#/' + id + '" class="' + (id === active ? 'on' : '') + '"><span class="tab-ic">' + icon(m.icon, 22) + badge(id === 'home' ? 0 : badgeOf(m)) + '</span><span>' + esc(T(m.name)) + '</span></a>';
      }).join('') + '<button data-act="hub:menu">' + icon(ICON.menu, 22) + '<span>' + T('More') + '</span></button></nav>' +
      '</div>';
  }

  /* ---------- Home: What's new and Did you know? (js/tips.js), chosen for the person's access ---------- */
  var tipShown = null, tipClosed = false;   // the tip on Home since signing in; "Got it" hides the card until the next sign-in
  /** Who this person is, for the tips: everyone, their role, and librarian / carer / senior / staffwork. */
  function homeTags() {
    var tags = ['everyone', myRole()], me = Store.get('people', user.id) || user;
    if (can('people.basic') || can('people.view') || can('*')) tags.push('staffwork');
    if (typeof Library !== 'undefined' && Library.isLibrarian(Store.settings(), user.id, can('*')) && (can('*') || !Store.preview())) tags.push('librarian');
    if (Store.previewCare() || (!Store.preview() && typeof Care !== 'undefined' && Store.list('careGroups').some(function (g) { return Care.isLeader(g, user.id); }))) tags.push('carer');
    if (!Store.preview() && typeof Care !== 'undefined' && Store.list('lifeGroups').some(function (g) { return Care.isLeader(g, user.id); })) tags.push('lifelead');
    if (!Store.preview() && isSenior(me)) tags.push('senior');
    if (window.ArchiveUI && ArchiveUI.canAccess()) tags.push('archivist');   // Administrators and Council members
    if (attendee()) tags.push('attendee');   // e.g. news about Reply, which attendees may not have
    return tags;
  }
  /** A tip or news line with the names of buttons and menu items (item.btn, English) shown as little buttons, so people can see
   * what to look for. The names are found in the line as it is shown, in the person's language, through T(); a name that
   * is worded differently in a translation is simply left plain. */
  function withButtons(item, text) {
    var out = esc(text), names = (item.btn || []).map(function (b) { return esc(T(b)); }).filter(Boolean);
    if (!names.length) return out;
    names.sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(?<![\\p{L}\\p{N}])(' + names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
    return out.replace(re, '<span class="ui-name">$1</span>');
  }
  function tipCtx() { return { tags: homeTags(), on: function (id) { var m = moduleById(id); return !!m && opens(m); } }; }
  function tipsCard() {
    if (tipClosed || typeof Tips === 'undefined') return '';
    var ctx = tipCtx(), tips = Tips.forPerson(ctx), news = Tips.news(ctx, today()), tip = tips.filter(function (t) { return t.id === tipShown; })[0];
    if (!tip && tips.length) { var r = Tips.next(tips, Store.pref('tipsSeen').split(',').filter(Boolean)); tip = r.tip; tipShown = tip.id; Store.pref('tipsSeen', r.seen.join(',')); }
    if (!tip && !news.length) return '';
    return '<section class="panel tips-card" id="tips-card">' +
      (news.length ? '<h2>' + T('What’s new') + '</h2><ul class="tips-news">' + news.map(function (n) { return '<li>' + withButtons(n, T(n.text)) + '</li>'; }).join('') + '</ul>' : '') +
      (tip ? '<h2>' + T('Did you know?') + '</h2><p class="tip-text" data-tip="' + esc(tip.id) + '">' + withButtons(tip, T(tip.text)) + '</p>' : '') +
      '<div class="btns">' + (tip && tip.href ? '<a class="btn small" href="' + esc(tip.href) + '">' + T('Show me') + '</a>' : '') +
      (tips.length > 1 ? '<button class="btn small" data-act="hub:tipnext">' + T('Another tip') + '</button>' : '') +
      (tips.length > 1 ? '<button class="btn small" data-act="hub:tipsall">' + T('All tips') + '</button>' : '') +
      '<button class="btn small" data-act="hub:tipclose">' + T('Got it') + '</button></div></section>';
  }

  /** Cards a module puts on everyone's Home (module.homeCard), e.g. the church we pray for this month – shown when the
   * module is switched on, even to people who can't open the module itself. */
  function homeCards() {
    return modules.filter(function (m) { return m.homeCard && isOn(m.id); }).map(function (m) { try { return m.homeCard(user) || ''; } catch (e) { console.error('homeCard', m.id, e); return ''; } }).join('');
  }
  /** A card on your own birthday or wedding anniversary (js/celebrate-ui.js). */
  function celebrateCard() { try { return window.CelebrateUI ? CelebrateUI.card(Store.get('people', user.id) || user) : ''; } catch (e) { console.error('celebrate', e); return ''; } }
  function celebrateWeek() { try { return window.CelebrateUI ? CelebrateUI.weekCard() : ''; } catch (e) { console.error('celebrate week', e); return ''; } }
  function renderHome() {
    var todos = [];
    enabled().forEach(function (m) { if (m.todos) (m.todos(user) || []).forEach(function (t) { t.mod = m; todos.push(t); }); });
    todos = todos.filter(function (t) { return t.priority; }).concat(todos.filter(function (t) { return !t.priority; }));
    var hour = new Date().getHours(), hello = T(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    return langsPrompt() + '<div class="page-head"><div><h1>' + hello + ', ' + esc(user.preferredName || user.firstName) + '</h1><p class="lead">' + esc(fmt(today(), true)) + ' · ' + esc(myLabel()) + '</p></div></div>' + celebrateCard() + tipsCard() + homeCards() + celebrateWeek() +
      '<section class="block"><h2>' + T('To do') + '</h2>' + (todos.length ? '<ul class="todo">' + todos.slice(0, 8).map(function (t) {
        return '<li><a href="' + esc(t.href) + '"><span class="dot" style="--c:' + t.mod.tint + '"></span><span class="grow">' + esc(t.text) + '</span><span class="tag" style="--c:' + t.mod.tint + '">' + esc(T(t.tag || t.mod.name)) + '</span></a></li>';
      }).join('') + '</ul>' : '<p class="empty">' + T('Nothing needs you right now.') + '</p>') + '</section>' +
      '<section class="block"><h2>' + T('Apps') + '</h2><div class="cards">' + listed().map(function (m) {
        return '<a class="appcard" href="#/' + m.id + '"><span class="ic" style="--c:' + m.tint + '">' + icon(m.icon, 22) + '</span><b>' + esc(T(m.name)) + '</b><span>' + esc(m.stat ? m.stat(user) : T(m.desc)) + '</span></a>';
      }).join('') + '</div></section>';
  }

  /* ---------- live sign-in (Firebase) ---------- */
  var live = { stage: 'loading' };
  /** Several people share this sign-in (one email address, e.g. a couple): they can switch between themselves. */
  function shared() { return Store.isLive() && Store.live.household().length > 1; }
  function whoButtons(people, current) {
    return '<div class="who-pick">' + people.map(function (h) {
      return '<button class="btn big-btn' + (h.personId === current ? '' : ' primary') + '" data-act="hub:choose" data-id="' + esc(h.personId) + '"' + (h.personId === current ? ' disabled' : '') + '>' + esc(h.name || '?') + '</button>';
    }).join('') + '</div>';
  }
  function liveCard(inner) {
    return '<div class="signin"><div class="signin-card">' +
      '<div class="brand big"><span class="mark">' + icon('M12 3v18M6 9h12', 22) + '</span><span><b>Church <span class="amp">&amp;</span> Trellis</b><small>' + esc((Store.settings() || {}).churchName || 'Christ Church Howick') + '</small></span></div>' +
      '<div class="signin-lang">' + I18n.picker() + '</div>' + inner + '</div></div>';
  }
  /** Opened from an invitation (…#/start, People → Invitations): a welcome, and how to get Church & Trellis on this phone. */
  function welcomeCard() {
    var from = location.hash === '#/start' || /^#\/start\|/.test(Store.pref('afterSignIn') || ''); if (!from) return '';
    var how = inApp() || homeScreen() ? '' : isAndroid() ?
      '<p class="small">' + T('On this phone you can also use the Church & Trellis app. It isn’t in the Play Store yet, so your phone may ask you to allow installing it.') + '</p><p><a class="btn" href="' + APK + '" target="_blank" rel="noopener">' + T('Get the app for Android') + '</a></p>' :
      isIPhone() ? '<p class="small">' + T('After signing in, tap the Share button (the square with an arrow), then “Add to Home Screen”. Church & Trellis then opens like an app, with its own icon.') + '</p>' : '';
    return '<div class="note ok welcome-card"><b>' + T('Welcome!') + '</b><p class="small" style="margin:4px 0 0">' + T('{church} has invited you to Church & Trellis. Sign in below with the email address the church has for you (or your sign-in code). There is no password.', { church: esc((Store.settings() || {}).churchName || T('Your church')) }) + '</p>' + how + '</div>';
  }
  function splashHtml() {
    return '<div class="splash" role="status" aria-label="' + esc(T('Loading…')) + '"><div class="splash-in">' +
      '<div class="mark splash-mark">' + icon('M12 3v18M6 9h12', 28) + '</div>' +
      '<h1>Church <span class="amp">&amp;</span> Trellis</h1>' +
      '<div class="splash-loader" id="splash-loader">' +
      '<svg class="busy-cross splash-cross" viewBox="0 0 48 48" aria-hidden="true"><rect x="22.6" y="3" width="2.8" height="42" rx="1.4"/><rect x="11" y="15.6" width="26" height="2.8" rx="1.4"/></svg>' +
      '<div class="splash-bar"><div class="splash-fill indeterminate" id="splash-fill"></div></div>' +
      '<p class="splash-msg" id="splash-msg">' + esc(T('Loading…')) + '</p>' +
      '<p class="splash-slow" id="splash-slow" hidden></p>' +
      '</div>' +
      '<p id="splash-v">' + (window.ChurchHubVersion ? 'Version ' + ChurchHubVersion.version : '') + '</p>' +
      '</div></div>';
  }

  var splashTimer = null;
  function updateSplash(st) {
    if (!root) root = document.getElementById('app');
    if (!root.querySelector('.splash')) {
      root.innerHTML = splashHtml();
    }
    var fill = document.getElementById('splash-fill');
    var msg = document.getElementById('splash-msg');
    if (fill && msg) {
      if (st.step === 'connecting') {
        fill.className = 'splash-fill indeterminate';
        fill.style.width = '';
        msg.textContent = T('Loading…');
      } else if (st.step === 'checking') {
        fill.className = 'splash-fill indeterminate';
        fill.style.width = '';
        msg.textContent = T('Signing you in…');
      } else if (st.step === 'syncing') {
        var total = Math.max(1, st.total || 1);
        var done = Math.min(total, st.done || 0);
        var pct = Math.round((done / total) * 100);
        fill.className = 'splash-fill';
        fill.style.width = Math.max(15, pct) + '%';
        msg.textContent = T('Getting the latest church records…');
      } else {
        fill.className = 'splash-fill indeterminate';
        msg.textContent = T(st.email ? 'Signing you in…' : 'Loading…');
      }
    }
    if (!splashTimer) {
      splashTimer = setTimeout(function () {
        if (live && live.stage === 'loading') {
          var slow = document.getElementById('splash-slow');
          if (slow) {
            slow.hidden = false;
            slow.innerHTML = esc(T('This is taking longer than usual. Check your internet connection. If nothing changes, tap Try again.')) +
              ' <button type="button" onclick="window.churchHubReload()">' + esc(T('Try again')) + '</button>';
          }
        }
      }, 7000);
    }
  }

  function renderLive() {
    var st = live, html;
    // A link to a page (e.g. the invitation to become a Church Partner, #/people/apply) is remembered through signing in,
    // also when the sign-in link from the email opens Church & Trellis again without it
    if (/^#\/\w/.test(location.hash) && location.hash !== '#/home') Store.pref('afterSignIn', location.hash + '|' + Date.now());
    if (st.stage === 'loading') { updateSplash(st); return; }
    else if (st.stage === 'error') html = '<h1>' + T('Something went wrong') + '</h1><p class="note bad">' + esc(st.message) + '</p><button class="btn" onclick="window.churchHubReload()">' + T('Try again') + '</button>';
    else if (st.stage === 'linkSent' && phoneApp()) html = '<h1>' + T('Check your email') + '</h1><p class="lead">' + T('We sent a sign-in link to {email}. It may take a minute, and could land in your spam folder.', { email: '<b>' + esc(st.email) + '</b>' }) + '</p>' +
      '<ol class="steps"><li>' + T('Open the email on this phone.') + '</li><li>' + T('Press and hold the sign-in link, then choose Copy link.') + '</li><li>' + T('Come back here, paste it in the box and tap Sign in.') + '</li></ol>' +
      '<form id="si-form" novalidate><label class="field">' + T('Sign-in link') + '<input id="si-link" type="url" inputmode="url" autocomplete="off" placeholder="https://…"></label><p id="si-err" class="note bad" hidden></p>' +
      '<button class="btn primary" data-act="hub:pastelink">' + T('Sign in') + '</button> <button class="btn" type="button" data-act="hub:restart">' + T('Use a different way') + '</button></form>';
    else if (st.stage === 'linkSent') html = '<h1>' + T('Check your email') + '</h1><p class="lead">' + T('We sent a sign-in link to {email}. Open it on this device to sign in. It may take a minute, and could land in your spam folder.', { email: '<b>' + esc(st.email) + '</b>' }) + '</p><button class="btn" data-act="hub:restart">' + T('Use a different way') + '</button>';
    else if (st.stage === 'needEmail') html = '<h1>' + T('Confirm your email') + '</h1><p class="lead">' + T('For your safety, type the email address you asked the sign-in link for.') + '</p>' +
      '<form id="si-form" novalidate><label class="field">' + T('Email') + '<input id="si-email" type="email" autocomplete="email" required></label><p id="si-err" class="note bad" hidden></p><button class="btn primary" data-act="hub:finishlink">' + T('Sign in') + '</button></form>';
    else if (st.stage === 'choosePerson') html = '<h1>' + T('Who is using Church & Trellis?') + '</h1><p class="lead">' + T('{email} is shared by more than one person. Choose who you are – you can switch at any time.', { email: '<b>' + esc(st.email) + '</b>' }) + '</p>' +
      whoButtons(st.people, '') + '<button class="btn" data-act="hub:signout">' + icon(ICON.out, 18) + T('Sign out') + '</button>';
    else if (st.stage === 'code') html = '<h1>' + T('Sign in with a code') + '</h1><p class="lead">' + T('Type the code the church office gave you. It has 8 letters and numbers.') + '</p>' +
      '<form id="si-form" novalidate><label class="field">' + T('Sign-in code') + '<input id="si-code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="ABCD-EFGH" value="' + esc(st.code || '') + '" style="font-size:1.4rem;letter-spacing:.12em;text-transform:uppercase"></label>' +
      '<p id="si-err" class="note bad"' + (st.message ? '' : ' hidden') + '>' + esc(st.message || '') + '</p>' +
      '<button class="btn primary" data-act="hub:claimcode">' + T('Continue') + '</button> <button class="btn" type="button" data-act="hub:restart">' + T('Use a different way') + '</button></form>';
    else if (st.stage === 'codeYou') html = '<h1>' + T('Is this you?') + '</h1><p class="lead">' + T('You’re signing in as {name}', { name: '<b>' + esc(st.name) + '</b>' }) + '</p>' +
      '<p class="muted">' + T('Only say yes if this is your name. Next you’ll choose a PIN to sign in with.') + '</p>' +
      '<div class="btns"><button class="btn primary big-btn" data-act="hub:codeyes">' + T('Yes, that’s me') + '</button> <button class="btn" data-act="hub:codeno">' + T('No, that isn’t me') + '</button></div>';
    else if (st.stage === 'choosePin') html = '<h1>' + T('Choose your PIN') + '</h1><p class="lead">' + T('From now on you’ll sign in with your number and a 6-digit PIN, on any phone.') + '</p>' +
      '<form id="si-form" novalidate>' + (st.noNumber ?
        '<p class="note">' + T('Church & Trellis will give you a church number to sign in with.') + ' <button class="link" type="button" data-act="hub:pinnumber">' + T('I do have a number') + '</button></p>' :
        '<label class="field req">' + T('Your cellphone number') + '<input id="si-num" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(st.number || '') + '"></label>' +
        '<p style="margin:-4px 0 12px"><button class="link" type="button" data-act="hub:pinnonumber">' + T('I don’t have my own number') + '</button></p>') +
      pinBox('si-pin', T('PIN (6 numbers)'), 'new-password') + pinBox('si-pin2', T('Type the PIN again'), 'new-password') +
      '<p id="si-err" class="note bad"' + (st.message ? '' : ' hidden') + '>' + esc(st.message || '') + '</p>' +
      '<button class="btn primary" data-act="hub:pinset">' + T('Done') + '</button> <button class="btn" type="button" data-act="hub:restart">' + T('Cancel') + '</button></form>';
    else if (st.stage === 'churchNumber') html = '<h1>' + T('Your church number') + '</h1><p class="code-big" style="text-align:center">' + esc(churchNumber(st.login)) + '</p>' +
      '<p class="lead">' + T('Write it down. You’ll sign in with this number and your PIN. The church office can also look it up for you.') + '</p>' +
      '<button class="btn primary big-btn" data-act="hub:pinbegin">' + T('Continue') + '</button>';
    else if (st.stage === 'pin') html = '<h1>' + T('Sign in with your number') + '</h1><p class="lead">' + T('Use your cellphone number (or church number) and your 6-digit PIN.') + '</p>' +
      '<form id="si-form" novalidate><label class="field">' + T('Cellphone or church number') + '<input id="si-num" type="tel" inputmode="tel" autocomplete="username" value="' + esc(st.number || '') + '"></label>' +
      pinBox('si-pin', T('PIN'), 'current-password') +
      '<p id="si-err" class="note bad"' + (st.message ? '' : ' hidden') + '>' + esc(st.message || '') + '</p>' +
      '<button class="btn primary" data-act="hub:pinsignin">' + T('Sign in') + '</button> <button class="btn" type="button" data-act="hub:restart">' + T('Use a different way') + '</button></form>' +
      '<p class="fine">' + T('Forgot your PIN? Ask the church office for a new sign-in code.') + '</p>';
    else if (st.stage === 'noAccess') html = '<h1>' + T('No access yet') + '</h1><p class="lead">' + ({
      unverified: T('Your email address ({email}) hasn’t been verified. Sign in with Google or an email link instead.', { email: esc(st.email) }),
      notReady: T('Church & Trellis hasn’t been set up yet. Please try again later.'),
      noPerson: T('You have access, but your person record is missing. Please ask the church office.')
    }[st.reason] || T('You are signed in as {email}, but this email address hasn’t been given access to Church & Trellis. Ask the church office to add it, or sign out and use another account.', { email: '<b>' + esc(st.email) + '</b>' })) + '</p>' +
      '<button class="btn" data-act="hub:signout">' + icon(ICON.out, 18) + T('Sign out') + '</button>';
    else if (st.stage === 'setup') html = '<h1>' + T(st.needChurch ? 'Set up Church & Trellis' : 'Welcome') + '</h1><p class="lead">' + T(st.needChurch ? 'You are the first Administrator. This creates the church’s settings, the leave rules and some starter serving teams (you can change them all later).' : 'Please add your name to finish setting up your access.') + '</p>' +
      '<form id="su-form" novalidate>' + reqKey() + (st.needChurch ? '<label class="field req">' + T('Church name') + '<input id="su-church" value="Christ Church Howick"></label>' : '') +
      '<div class="two"><label class="field req">' + T('Your first name') + '<input id="su-first" autocomplete="given-name"></label><label class="field req">' + T('Last name') + '<input id="su-last" autocomplete="family-name"></label></div>' +
      '<p id="su-err" class="note bad" hidden></p></form><button class="btn primary" data-act="hub:setup">' + T(st.needChurch ? 'Set up' : 'Continue') + '</button> <button class="btn" data-act="hub:signout">' + T('Sign out') + '</button>';
    else html = welcomeCard() + '<h1>' + T('Sign in') + '</h1><p class="lead">' + T('For church staff, leaders and members who have been given access.') + '</p>' +
      (st.message ? '<p class="note bad">' + esc(st.message === 'unlinked' ? T('This sign-in has been switched off. Ask the church office for a new sign-in code.') : st.message) + '</p>' : '') +
      (inApp() && !(window.CHURCH_HUB_FIREBASE || {}).googleWebClientId ? '' : '<button class="btn primary big-btn" data-act="hub:google">' + icon('M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.8v2.4h3.1c1.8-1.7 2.8-4.1 2.8-6.9zM12 21c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.4C5.1 18.9 8.3 21 12 21zM6.7 13.3a5.4 5.4 0 0 1 0-3.4V7.5H3.5a9 9 0 0 0 0 8.2zM12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9 9 0 0 0 3.5 7.5l3.2 2.4C7.4 8.2 9.5 6.6 12 6.6z', 18) + T('Sign in with Google') + '</button>' +
      '<p class="muted" style="text-align:center;margin:14px 0 6px">' + T('or get a sign-in link by email') + '</p>') +
      '<form id="si-form" novalidate><label class="field"><span class="sr">' + T('Email') + '</span><input id="si-email" type="email" placeholder="' + 'you@example.com' + '" autocomplete="email"></label><p id="si-err" class="note bad" hidden></p>' +
      '<button class="btn" data-act="hub:sendlink">' + T('Email me a link') + '</button></form>' +
      (phoneApp() && Store.live.pendingEmail() ? '<p style="margin:10px 0 0"><button class="link" data-act="hub:havelink">' + T('I already have a sign-in link') + '</button></p>' : '') +
      '<p class="muted" style="text-align:center;margin:18px 0 6px">' + T('No email? Sign in with your cellphone number and PIN.') + '</p>' +
      '<button class="btn" style="width:100%" data-act="hub:pinstart">' + T('Sign in with my number') + '</button>' +
      '<p style="margin:10px 0 0;text-align:center"><button class="link" data-act="hub:havecode">' + T('I have a sign-in code') + '</button></p>' +
      '<p class="fine">' + esc(((Store.settings() || {}).privacyNotice || T('The church keeps your information secure and stores it in South Africa')).split('.')[0]) + '. ' + T('Want to look around first?') + ' <a href="?demo">' + T('Try the demo with made-up people') + '</a>.</p>';
    root.innerHTML = liveCard(html);
    var f = root.querySelector('input'); if (f) f.focus();
    langWire();
  }
  /** A sign-in code, typed or from its link (?j=…): check it, then ask "is this you?" */
  function useCode(code, btn) {
    if (btn) btn.disabled = true;
    live = { stage: 'loading', email: '' }; renderLive();
    Store.live.claimCode(code).then(function (r) { live = { stage: 'codeYou', name: r.name || '?', mobile: r.mobile || '', code: code }; renderLive(); },
      function (e) { live = { stage: 'code', code: code, message: codeMessage(e && e.code) }; renderLive(); });
  }
  function codeMessage(c) {
    return ({
      'codes/unknown': T('That code wasn’t found. Check each letter and number, or ask the church office.'),
      'codes/used': T('That code has already been used. Ask the church office for a new one.'),
      'codes/expired': T('That code has expired (codes last 14 days). Ask the church office for a new one.'),
      'codes/off': T('Sign-in codes aren’t switched on for this church yet. Please ask the church office.'),
      'codes/busy': T('Lots of people are joining right now – please try again in a little while.')
    })[c] || T('That didn’t work. Check your internet connection and try again.');
  }
  /** A PIN box: numbers only, shown as dots, big enough to read. */
  function pinBox(id, label, ac) {
    return '<label class="field">' + label + '<input id="' + id + '" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="' + ac + '" style="font-size:1.4rem;letter-spacing:.3em"></label>';
  }
  /** A church number (stored as c482913) as people read it: 482 913. */
  function churchNumber(login) { var d = String(login || '').replace(/\D/g, ''); return d.slice(0, 3) + ' ' + d.slice(3); }
  /** Is this PIN too easy to guess? (111111, 123456, 654321, 121212 …) */
  function weakPin(pin) {
    if (/^(\d)\1+$/.test(pin) || /^(\d\d)\1+$/.test(pin) || /^(\d\d\d)\1$/.test(pin)) return true;
    return '0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0;
  }
  function pinMessage(c) {
    return ({
      'pin/number': T('Check the number: type your cellphone number, or your 6-digit church number.'),
      'pin/unknown': T('There’s no Church & Trellis sign-in for that number. Check it, or ask the church office for a sign-in code.'),
      'pin/wrong': T('That PIN isn’t right. Try again, or ask the church office for a new sign-in code.'),
      'pin/busy': T('Too many tries. Please wait a few minutes and try again.'),
      'pin/off': T('Signing in with a PIN isn’t switched on for this church yet. Please ask the church office.'),
      'pin/taken': T('That number is already used to sign in by someone else. Use another number, or ask the church office.')
    })[c] || codeMessage(c);
  }
  /** Opened from a code's link (…/?j=ABCD-EFGH): take the code out of the address and use it. */
  function codeFromLink() {
    var m = /[?&]j=([^&#]+)/.exec(location.search); if (!m) return '';
    history.replaceState(null, '', location.pathname + location.search.replace(/([?&])j=[^&#]*(&|$)/, function (x, a, b) { return b ? a : ''; }).replace(/[?&]$/, '') + location.hash);
    return decodeURIComponent(m[1]);
  }
  /** The first time someone signs in, note the day on their record (People → Invitations: who has started using Church & Trellis).
   *  Not for "View as" or the demo. */
  function firstSeen() {
    if (!Store.isLive() || Store.preview() || !user) return;
    var p = Store.get('people', user.id); if (!p || p.appFirstSeen) return;
    p = JSON.parse(JSON.stringify(p)); p.appFirstSeen = today();
    Store.put('people', p);
  }
  var linkCode = '';
  function onLiveState(st) {
    live = st;
    if (switching && st.stage === 'ready') { clearTimeout(splashTimer); splashTimer = null; var d = switching; switching = null; user = st.person; Store.setUser(user); d(); return; }   // "View as" finished loading
    if (switching && st.stage === 'loading') { updateSplash(st); return; }   // still loading the new role: keep waiting
    switching = null;
    if (st.stage === 'ready') {
      clearTimeout(splashTimer); splashTimer = null;
      user = st.person; Store.setUser(user);
      Store.audit('Signed in', 'people/' + user.id);
      runUpgrades();
      firstSeen();
      setTimeout(keepFiles, 4000);   // not needed for the first screen: a few seconds later, so the phone answers taps sooner
      var after = (Store.pref('afterSignIn') || '').split('|'); Store.pref('afterSignIn', '');
      if ((!location.hash || location.hash === '#' || location.hash === '#/home') && after[0] && Date.now() - (+after[1] || 0) < 864e5) location.hash = after[0];   // within a day
      if (location.hash === '#/start') location.hash = '#/home';   // the invitation's link (People → Invitations): Home, with its app prompts
      if (!location.hash || location.hash === '#') location.hash = phoneApp() && !can('people.basic') && !can('people.view') && !can('*') && enabled().indexOf(moduleById('me')) >= 0 ? '#/me' : '#/home';
      render();
    } else if (st.stage === 'loading') {
      updateSplash(st);
    } else {
      clearTimeout(splashTimer); splashTimer = null;
      user = null; Store.setUser(null);
      if (st.stage === 'signedOut' && linkCode) { var c = linkCode; linkCode = ''; return useCode(c); }   // opened from a code's link
      renderLive();
    }
  }

  function renderSignIn() {
    if (Store.isLive()) return renderLive();
    var s = Store.settings();
    var people = Store.list('people').filter(function (p) { return p.familyRole !== 'child' && p.active !== false; });
    var byRole = {};
    people.forEach(function (p) { (byRole[p.appRole] = byRole[p.appRole] || []).push(p); });
    var order = ['admin', 'pastor', 'rosters', 'kids', 'member'];
    root.innerHTML = '<div class="signin"><div class="signin-card">' +
      '<div class="brand big"><span class="mark">' + icon('M12 3v18M6 9h12', 22) + '</span><span><b>Church <span class="amp">&amp;</span> Trellis</b><small>' + esc(s.churchName) + '</small></span></div>' +
      '<div class="signin-lang">' + I18n.picker() + '</div><h1>' + T('Sign in') + '</h1>' +
      '<p class="lead">' + T('This is a demo with made-up people. Choose who to be: each role sees different things.') + '</p>' +
      order.filter(function (r) { return byRole[r]; }).map(function (r) {
        return '<h2 class="role-h">' + esc(roleLabel(r)) + '</h2><div class="pick">' + byRole[r].slice(0, r === 'member' ? 4 : 3).map(function (p) {
          return '<button data-act="hub:signin" data-id="' + p.id + '">' + avatar(p) + '<span><b>' + esc(name(p)) + '</b><small>' + esc(p.staff ? p.staff.category : p.category) + '</small></span></button>';
        }).join('') + '</div>';
      }).join('') +
      '<div class="row" style="margin-top:14px"><label class="field grow" style="margin:0">' + T('Or anyone else') + '<select id="si-any">' + people.slice().sort(function (a, b) { return name(a).localeCompare(name(b)); }).map(function (p) { return '<option value="' + p.id + '">' + esc(name(p)) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" style="align-self:flex-end" data-act="hub:signinany">' + T('Sign in') + '</button></div>' +
      '<p class="fine">' + T('When live: sign in with Google or an email link.') + ' ' + esc(s.privacyNotice.split('.')[0]) + '. <a href="#" data-act="hub:notice">' + T('Privacy notice') + '</a></p>' +
      '</div></div>';
    langWire();
  }

  /* ---------- modal and toast ---------- */
  var lastFocus = null;
  /** The church's own words (Settings → Terminology (Church Words)) on everything shown – in English; translations keep theirs. */
  var wordKey = null, wordFn = null;
  function words() {
    var st = Store.settings && Store.settings(), k = I18n.get() + JSON.stringify((st && st.wording) || {});
    if (k !== wordKey) { wordKey = k; wordFn = I18n.get() === 'en' && st && st.wording ? Wording.changer(st) : null; }
    return wordFn;
  }
  /** Every dropdown (a <select>) becomes one box: tap it and the whole list opens; type and the list narrows as you type
   *  (part of a name – "dar ben" – or any word in the list). Arrow keys and Enter, or a tap, choose. The real <select> stays
   *  underneath (invisible) and keeps the value, so saving – and anything listening for a change – works as before; a value
   *  set on the select itself (by the page, or a test) shows in the box too. Left alone: lists marked data-plain, lists that
   *  choose several (multiple, size) and hidden helper lists (sr-only, aria-hidden) that already have a picker of their own. */
  var findN = 0, SKIP = '[multiple],[size],.sr-only,[aria-hidden="true"],[data-plain]';
  var selValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var selIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  function findables(el) {
    if (!el || !el.querySelectorAll) return;
    el.querySelectorAll('select').forEach(function (sel) {
      if (sel.dataset.fw || sel.matches(SKIP) || !sel.parentNode) return;
      sel.dataset.fw = '1';
      var all = [], names = sel.classList.contains('findable');
      var lid = 'find-l' + (++findN);
      var block = !!sel.closest('.field, .adv-row, .set-c, td, .side-lang, .side-mode, .two');
      var box = document.createElement('div'); box.className = 'find-box' + (block ? '' : ' find-inline'); box.setAttribute('data-noauto', '');
      if (sel.getAttribute('style')) box.setAttribute('style', sel.getAttribute('style'));
      box.innerHTML = '<input type="text" class="find-in" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + lid + '">' +
        '<span class="find-arrow" aria-hidden="true"></span><ul class="find-list" id="' + lid + '" role="listbox" hidden></ul>';
      if (names && window.Voice && Voice.can()) { box.classList.add('has-mic'); box.insertAdjacentHTML('beforeend', Voice.button('.find-in')); }   // say the name (js/voice.js)
      sel.parentNode.insertBefore(box, sel);
      sel.classList.add('find-sel'); sel.tabIndex = -1;
      var inp = box.querySelector('input'), list = box.querySelector('ul'), shown = [], at = -1, typed = false;
      var lab = sel.getAttribute('aria-label') || (sel.id && document.querySelector('label[for="' + CSS.escape(sel.id) + '"]') || {}).textContent ||
        (function () { var l = sel.closest('label'), t = l && l.firstChild; return t && t.nodeType === 3 ? t.textContent : ''; })();
      if (lab && lab.trim()) inp.setAttribute('aria-label', lab.trim());
      function read() {
        all = [].map.call(sel.options, function (o) { return { v: o.value, t: o.text, keep: !o.value || /^__/.test(o.value), off: o.disabled }; });
        var short = all.length < 8;   // a short list: tapping shows it all; no keyboard pops up on a phone (typing still works)
        if (short) inp.setAttribute('inputmode', 'none'); else inp.removeAttribute('inputmode');
        if (!block) inp.size = Math.min(24, Math.max(6, all.reduce(function (m, o) { return Math.max(m, o.t.length); }, 0) + 1));
      }
      function cur() { var i = selIndex.get.call(sel); return i >= 0 ? all[i] : null; }
      function showChosen() {   // the box shows what is chosen; an empty choice ("Choose…") shows as the grey hint
        var c = cur(); inp.value = c && c.v ? c.t : '';
        inp.placeholder = c && !c.v ? c.t : names ? T('Type part of a name to narrow the list') : T('Type to narrow the list');
        inp.disabled = sel.disabled; box.hidden = sel.hidden; box.style.display = sel.style.display === 'none' ? 'none' : '';
        box.classList.toggle('is-req', sel.required);
      }
      function mark(i, scroll) {
        at = i;
        [].forEach.call(list.children, function (li, n) { var on = n === i; li.classList.toggle('on', on); if (li.dataset.i) li.setAttribute('aria-selected', on ? 'true' : 'false'); });
        var li = list.children[i];
        if (li && li.id) { inp.setAttribute('aria-activedescendant', li.id); if (scroll) li.scrollIntoView({ block: 'nearest' }); } else inp.removeAttribute('aria-activedescendant');
      }
      function fill() {
        var q = typed ? inp.value.trim() : '', c = cur();
        shown = all.filter(function (o) { return o.keep || !q || matches(o.t, q); });
        var real = shown.filter(function (o) { return !o.keep; }).length;
        if (names && q.length >= 3 && real < 6 && window.NameList) {   // names that sound like it (said aloud, or spelt by ear)
          var spoken = inp.dataset.spoken && inp.dataset.spoken.split('|')[0] === q ? inp.dataset.spoken : q;
          var like = NameList.rank(spoken, all.map(function (o, i) { return o.keep || o.off || shown.indexOf(o) >= 0 ? null : NameList.asPerson(i, o.t); }).filter(Boolean)).slice(0, 6 - real);
          like.forEach(function (h) { shown.push(all[h.id]); }); real += like.length;
        }
        list.innerHTML = shown.map(function (o, i) {
          return '<li role="option" id="' + lid + '-' + i + '" data-i="' + i + '" class="' + (o.keep ? 'keep' : '') + (o === c ? ' chosen' : '') + (o.off ? ' off' : '') + '"' + (o.off ? ' aria-disabled="true"' : '') + '>' + esc(o.t) + '</li>';
        }).join('') + (q && !real ? '<li class="none" aria-disabled="true">' + esc(names ? T('Nobody matches that – try fewer letters') : T('Nothing matches that – try fewer letters')) + '</li>' : '');
        var first = -1;
        shown.some(function (o, i) { if (q ? !o.keep && !o.off : o === c) { first = i; return true; } return false; });
        mark(first, true);
      }
      function open() {
        if (inp.disabled || !list.hidden) return;
        typed = false; list.hidden = false; box.classList.add('open'); inp.setAttribute('aria-expanded', 'true'); fill();
      }
      function close() { list.hidden = true; box.classList.remove('open'); inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); typed = false; showChosen(); }
      function pick(i) {
        var o = shown[i]; if (!o || o.off) return;
        var n = all.indexOf(o), changed = selIndex.get.call(sel) !== n; selIndex.set.call(sel, n); close();
        if (changed) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      // A value set on the select by the page shows in the box straight away.
      Object.defineProperty(sel, 'value', { configurable: true, get: function () { return selValue.get.call(this); }, set: function (v) { selValue.set.call(this, v); showChosen(); } });
      Object.defineProperty(sel, 'selectedIndex', { configurable: true, get: function () { return selIndex.get.call(this); }, set: function (v) { selIndex.set.call(this, v); showChosen(); } });
      inp.addEventListener('focus', function () { try { inp.select(); } catch (e) { /* fine */ } });
      inp.addEventListener('click', open);
      box.querySelector('.find-arrow').addEventListener('mousedown', function (ev) { ev.preventDefault(); if (list.hidden) { inp.focus(); open(); } else close(); });
      inp.addEventListener('input', function () { if (list.hidden) open(); typed = true; fill(); });
      ['input', 'change', 'keyup'].forEach(function (t) { box.addEventListener(t, function (ev) { if (ev.target === inp) ev.stopPropagation(); }); });   // the page only hears the select
      inp.addEventListener('keydown', function (ev) {
        var k = ev.key, n = shown.length;
        if (k === 'ArrowDown' || k === 'ArrowUp') {
          ev.preventDefault(); if (list.hidden) { open(); return; }
          if (n) mark(k === 'ArrowDown' ? (at < n - 1 ? at + 1 : 0) : (at > 0 ? at - 1 : n - 1), true);
        } else if (k === 'Enter') { ev.preventDefault(); ev.stopPropagation(); if (!list.hidden && at >= 0) pick(at); else open(); }
        else if (k === 'Escape') { if (!list.hidden) { ev.preventDefault(); ev.stopPropagation(); close(); } }
        else if (k === 'Tab') { if (!list.hidden) { if (typed && at >= 0) pick(at); else close(); } }
      });
      inp.addEventListener('blur', function () { if (list.hidden) return; if (typed && inp.value.trim() && at >= 0) pick(at); else close(); });
      list.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // keep the cursor in the box
      list.addEventListener('mousemove', function (ev) { var li = ev.target.closest('li[data-i]'); if (li && +li.dataset.i !== at) mark(+li.dataset.i); });
      list.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();   // inside a <label>: don't let it open the list again
        var li = ev.target.closest('li[data-i]'); if (li) pick(+li.dataset.i);
      });
      sel.addEventListener('change', function () { if (list.hidden) showChosen(); });   // chosen another way (or by a test)
      sel.addEventListener('focus', function () { inp.focus(); });   // the page (or a label) sends the cursor to the list
      new MutationObserver(function (ms) {
        if (ms.some(function (m) { return m.type === 'childList' || m.target !== sel; })) { read(); if (!list.hidden) fill(); }
        showChosen();
      }).observe(sel, { attributes: true, attributeFilter: ['disabled', 'hidden', 'style', 'required'], childList: true, subtree: true, characterData: true });
      read(); showChosen();
    });
  }
  // Dropdowns drawn later, anywhere (the side bar, a list redrawn in place), get the same box.
  var findT = null;
  new MutationObserver(function () { if (!findT) findT = requestAnimationFrame(function () { findT = null; findables(document.body); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  function ourWords(el) { var f = words(); if (f && el) Wording.apply(el, f); }
  /* ---------- saving as you go (like Google Docs) ----------
   * A panel whose save button has data-autosave saves by itself: straight after a tick or a choice, and once typing pauses.
   * The button stays hidden; a small "Saved" note shows it worked (or what is still missing). Pop-up windows keep their buttons,
   * unless the form in them has data-autoscope (Edit details): closing such a window first saves what is still waiting, and if
   * that can't be saved the window stays open once, showing why (closing it again lets the change go). */
  var autoT = null, autoQuiet = false, autoNoteT = null, autoSaid = '', autoPending = null, autoBad = null, autoAnyway = null;
  function autoBtn(el) {
    if (!el || !el.closest || (el.closest('.dialog') && !el.closest('[data-autoscope]')) || el.type === 'search' || el.closest('[data-noauto]')) return null;
    var sec = el.closest('[data-autoscope]') || el.closest('section, .panel');   // a scope: several panels saved by one button
    return sec ? sec.querySelector('[data-autosave]') : null;
  }
  /** Which field had the cursor, so it can be found again after the page is redrawn. */
  function focusKey(el) {
    if (!el || el === document.body || !el.closest || !el.closest('main')) return null;
    var sel = el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase() + [].map.call(el.classList, function (c) { return '.' + CSS.escape(c); }).join('') +
      ['i', 'code', 'k', 't'].map(function (k) { return el.dataset && el.dataset[k] != null ? '[data-' + k + '="' + CSS.escape(el.dataset[k]) + '"]' : ''; }).join('');
    var all = [].slice.call(document.querySelectorAll(sel));
    return { sel: sel, n: Math.max(0, all.indexOf(el)), a: el.selectionStart, b: el.selectionEnd, y: window.scrollY };
  }
  function refocus(k) {
    if (!k) return;
    var el = document.querySelectorAll(k.sel)[k.n]; if (!el) return;
    try { el.focus({ preventScroll: true }); if (k.a != null && el.setSelectionRange) el.setSelectionRange(k.a, k.b); } catch (e) { /* not a text box */ }
    window.scrollTo(0, k.y);
  }
  function autoNote(msg, bad) {
    var n = document.getElementById('autosaved');
    if (!n) { n = document.createElement('div'); n.id = 'autosaved'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    var wf = words();
    n.innerHTML = '<span class="as-ic" aria-hidden="true">' + (bad ? '!' : '✓') + '</span><span>' + esc(bad ? (wf ? wf(String(msg)) : msg) : T('Saved')) + '</span>';
    n.className = ''; void n.offsetWidth;   // start the pop again, also when saving twice in a row
    n.className = 'show' + (bad ? ' bad' : '');
    if (!bad && autoSaid !== 'bad') autoSaid = 'ok'; else autoSaid = 'bad';
    clearTimeout(autoNoteT); autoNoteT = setTimeout(function () { n.className = ''; }, bad ? 5000 : 2600);
  }
  /** The tick, choice or box just saved lights up green for a moment, so it is clear what was saved. */
  function flashSaved(el) {
    var row = el && el.closest && (el.closest('label, .field, .check, .item, td') || el); if (!row) return;
    row.classList.remove('just-saved'); void row.offsetWidth; row.classList.add('just-saved');
    setTimeout(function () { row.classList.remove('just-saved'); }, 1600);
  }
  function autoFire(btn) {
    clearTimeout(autoT); autoPending = null;
    if (!document.body.contains(btn)) return;
    var k = focusKey(document.activeElement);
    autoQuiet = true; autoSaid = '';
    try { btn.click(); } finally { autoQuiet = false; }
    autoBad = autoSaid === 'bad' ? btn : autoBad === btn ? null : autoBad;
    refocus(k);
    if (autoSaid === 'ok' && k) flashSaved(document.querySelectorAll(k.sel)[k.n]);
  }
  function autoRun(btn, wait) {
    clearTimeout(autoT); autoPending = btn;
    autoT = setTimeout(function () { autoFire(btn); }, wait);
  }
  /** A window saved by its own button (Done): nothing left waiting to save as you go. */
  function autoForget() { clearTimeout(autoT); autoPending = autoBad = autoAnyway = null; }
  /** Closing a window that saves as you go: save what is still waiting. false = it couldn't be saved, so keep the window open (once). */
  function autoFlush(m) {
    var pend = [autoPending, autoBad].filter(function (b) { return b && m.contains(b); })[0];
    if (!pend) return true;
    if (autoAnyway === pend) { autoForget(); return true; }
    autoFire(pend);
    if (autoSaid === 'bad') { autoAnyway = pend; return false; }
    autoForget(); return true;
  }
  document.addEventListener('change', function (ev) { var b = autoBtn(ev.target); if (b) autoRun(b, 0); });
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || /^(checkbox|radio|date|range|file|search)$/.test(t.type)) return;
    var b = autoBtn(t); if (b) autoRun(b, 900);
  });

  function modal(html, label, wide) {
    var m = document.getElementById('modal');
    if (m.firstChild) autoFlush(m), autoForget();   // one window replacing another (Mark as left…): save what was waiting first
    lastFocus = document.activeElement;
    var again = !!m.firstChild;   // one window replacing another: no second entrance
    m.innerHTML = '<div class="overlay' + (again ? ' again' : '') + '" data-act="hub:overlay"><div class="dialog' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + html + '</div></div>';
    ourWords(m); findables(m);
    var body = m.querySelector('.dlg-body');
    if (body && body.querySelector('.field.req')) body.insertAdjacentHTML('afterbegin', reqKey());
    markRequired();
    var f = m.querySelector('input:not([type=hidden]), select, textarea, button:not(.x)'); if (f) f.focus();
  }
  /** Boxes that must be filled in are shaded (class "field req"); a short key explains the shading. */
  function reqKey() { return '<p class="req-key"><span class="req-swatch" aria-hidden="true"></span>' + T('Shaded boxes must be filled in.') + '</p>'; }
  function markRequired() {
    document.querySelectorAll('.field input, .field select, .field textarea').forEach(function (x) {
      if (x.closest('.field.req')) x.setAttribute('aria-required', 'true'); else x.removeAttribute('aria-required');
    });
  }
  function closeModal() {
    var m = document.getElementById('modal'), ov = m.firstChild;
    if (ov && !autoFlush(m)) return;   // saving as you go: the last change couldn't be saved – the note says why
    // A copy of the window fades away by itself (the real one is gone at once, so a new window can open straight away)
    if (ov && ov.classList && ov.classList.contains('overlay') && !reduceMotion()) {
      var ghost = ov.cloneNode(true); ghost.classList.add('leaving'); ghost.setAttribute('aria-hidden', 'true');
      [ghost].concat([].slice.call(ghost.querySelectorAll('[data-act], [id], [name], [role]'))).forEach(function (x) { ['data-act', 'id', 'name', 'role'].forEach(function (a) { x.removeAttribute(a); }); });   // only a picture: nothing in it can be found or tapped
      document.body.appendChild(ghost); setTimeout(function () { ghost.remove(); }, 220);
    }
    m.innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function reduceMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  // A section that folds open (<details>) slides its contents in – only when someone opens it, not when the page is redrawn
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    d.classList.remove('unfold'); void d.offsetWidth; d.classList.add('unfold');
    setTimeout(function () { d.classList.remove('unfold'); }, 400);
  }, true);
  function dialogHead(title, sub) { return '<header class="dlg-h"><div><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><button class="icon-btn ghost x" data-act="hub:close" aria-label="' + T('Close') + '">' + icon(ICON.x) + '</button></header>'; }
  var toastTimer = null;
  /**
   * Long jobs (an import, changing many people): a turning cross over the page until the work is done and saved.
   * The work runs a moment later, so the cross is on screen first. Returns a promise.
   */
  function busy(msg, work) {
    var el = document.getElementById('busy');
    if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = '<div class="busy-box"><svg class="busy-cross" viewBox="0 0 48 48" aria-hidden="true"><rect x="22.6" y="3" width="2.8" height="42" rx="1.4"/><rect x="11" y="15.6" width="26" height="2.8" rx="1.4"/></svg>' +
      '<p>' + esc(msg || T('Working…')) + '</p><p class="small">' + T('Please keep this page open.') + '</p></div>';
    el.hidden = false; document.body.classList.add('is-busy');
    var done = function () { el.hidden = true; document.body.classList.remove('is-busy'); };
    return new Promise(function (ok, fail) {
      requestAnimationFrame(function () { setTimeout(function () {
        var out;
        try { out = work(); } catch (e) { done(); console.error(e); toast(T('Something went wrong. Please try again.'), true); return fail(e); }
        Promise.resolve(out).then(function () { return Store.whenSaved(); }).then(function (v) { done(); ok(v); }, function (e) { done(); fail(e); });
      }, 30); });
    });
  }
  /** Messages that say something was saved or done: the toast gets a small tick that draws itself. */
  var SAVED_WORDS = ['Saved', 'Photo saved', 'Note saved', 'Wording saved', 'Terms saved', 'Added', 'Reply sent', 'Recorded.', 'Service added', 'Stand-in set'];
  function savedMsg(msg) { return SAVED_WORDS.some(function (w) { var x = T(w); return msg === x || msg.indexOf(T('Saved') + ' ') === 0; }); }
  function toast(msg, bad) {
    if (autoQuiet) { autoNote(msg, bad); return; }   // saving as you go: a small note instead of a toast
    var t = document.getElementById('toast');
    var wf = words(), text = wf ? wf(String(msg)) : String(msg), ok = !bad && savedMsg(String(msg));
    t.innerHTML = (ok ? '<svg class="toast-tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>' : '') + '<span>' + esc(text) + '</span>';
    t.className = 'toast'; void t.offsetWidth;   // play the tick again when saving twice in a row
    t.className = 'toast show' + (bad ? ' bad' : '') + (ok ? ' ok' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  function download(filename, text, type) {
    // In the Android app (version with saveFile): saved in the phone's Downloads. Browsers: an ordinary download.
    if (window.ChurchHubApp && typeof window.ChurchHubApp.saveFile === 'function') { window.ChurchHubApp.saveFile(filename, type || 'application/json', String(text)); return; }
    if (window.ChurchHubApp) { toast(T('Please update the Church & Trellis app to download files, or use a browser.'), true); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- events ---------- */
  var hubActions = {
    signin: function (el) { var p = Store.get('people', el.dataset.id); user = p; Store.setUser(p); try { sessionStorage.setItem('hub_user', p.id); } catch (e) {} Store.audit('Signed in (demo)', 'people/' + p.id); runUpgrades(); go('home'); render(); },
    signinany: function () { hubActions.signin({ dataset: { id: document.getElementById('si-any').value } }); },
    /** Signing out asks first (not in the demo, where it means "switch person"). */
    signout: function () {
      if (!Store.isLive()) return hubActions.signoutyes();
      var pinNo = Store.live.isCodeSession();
      modal(dialogHead(T('Sign out of Church & Trellis?')) + '<div class="dlg-body"><p style="margin:0">' + (/^c\d/.test(pinNo) ? T('You’ll sign in again with your church number ({number}) and PIN.', { number: churchNumber(pinNo) }) :
        pinNo ? T('You’ll sign in again with your cellphone number and PIN.') : T('You will need to sign in again next time.')) + '</p></div>' +
        '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="hub:signoutyes">' + T('Sign out') + '</button></div>', T('Sign out'));
    },
    /** Someone sharing the sign-in: choose who is using Church & Trellis now. */
    switchwho: function () {
      modal(dialogHead(T('Who is using Church & Trellis?')) + '<div class="dlg-body">' + whoButtons(Store.live.household(), user && user.id) + '</div>', T('Switch person'));
    },
    choose: function (el) {
      if (user) Store.audit('Switched to someone else sharing this sign-in', 'people/' + user.id);
      closeModal(); Store.live.choose(el.dataset.id);
    },
    signoutyes: function () {
      if (Store.preview() && !Store.isLive()) Store.preview('');
      if (user) Store.audit('Signed out', 'people/' + user.id);
      user = null; Store.setUser(null); try { sessionStorage.removeItem('hub_user'); } catch (e) {}
      if (Store.isLive()) { closeModal(); Store.live.signOut(); history.replaceState(null, '', location.pathname + location.search); return; }
      location.hash = ''; render();
    },
    google: function () {
      Store.live.google().catch(function (e) {
        var code = (e && e.code) || 'error';
        live = { stage: 'signedOut', message: code === 'app/not-set-up' ? T('Sign in with Google isn’t set up in the app yet. Please use the email link.')
          : code === 'app/google' && e.message ? e.message : T('Google sign-in didn’t work ({code}). Try again, or use the email link.', { code: code }) };
        renderLive();
      });
    },
    pastelink: function (el, ev) {
      if (ev) ev.preventDefault();
      var link = document.getElementById('si-link').value.trim(), errEl = document.getElementById('si-err');
      if (!Store.live.isEmailLink(link)) { errEl.textContent = T('That doesn’t look like the sign-in link from the email. Copy the whole link and try again.'); errEl.hidden = false; return; }
      var email = live.email || Store.live.pendingEmail();
      live = { stage: 'loading', email: email }; renderLive(); Store.live.finishEmailLink(email, link);
    },
    sendlink: function (el, ev) {
      if (ev) ev.preventDefault();
      var email = document.getElementById('si-email').value.trim(), errEl = document.getElementById('si-err');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errEl.textContent = T('Please type your email address.'); errEl.hidden = false; return; }
      el.disabled = true;
      Store.live.emailLink(email).then(function () { live = { stage: 'linkSent', email: email }; renderLive(); })
        .catch(function (e) {
          var code = (e && e.code) || 'error'; el.disabled = false;
          console.error('email link', code, e && e.message);
          errEl.textContent = code === 'auth/operation-not-allowed' ? T('Signing in by email link isn’t switched on yet. Please use Google, or ask the church office.') + ' (' + code + ')'
            : code === 'auth/unauthorized-continue-uri' || code === 'auth/unauthorized-domain' ? T('Signing in by email link isn’t allowed from this web address yet. Please use Google, or ask the church office.') + ' (' + code + ')'
            : T('We couldn’t send the link. Check the address and try again.') + ' (' + code + ')';
          errEl.hidden = false;
        });
    },
    finishlink: function (el, ev) {
      if (ev) ev.preventDefault();
      var email = document.getElementById('si-email').value.trim(); if (!email) return;
      live = { stage: 'loading', email: email }; renderLive(); Store.live.finishEmailLink(email);
    },
    restart: function () { Store.live.cancelCode(); live = { stage: 'signedOut' }; renderLive(); },
    havecode: function () { live = { stage: 'code' }; renderLive(); },
    claimcode: function (el, ev) {
      if (ev) ev.preventDefault();
      var code = (document.getElementById('si-code') || {}).value || '';
      useCode(code, el);
    },
    codeyes: function () { live = { stage: 'choosePin', number: live.mobile || '', code: live.code || '' }; renderLive(); },
    pinnonumber: function () { live.noNumber = true; live.message = ''; renderLive(); },
    pinnumber: function () { live.noNumber = false; live.message = ''; renderLive(); },
    /** Their number (or a church number) and a PIN: link the sign-in, then open Church & Trellis (a church number is shown first). */
    pinset: function (el, ev) {
      if (ev) ev.preventDefault();
      var v = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ''; };
      var num = live.noNumber ? '' : v('si-num'), pin = v('si-pin'), pin2 = v('si-pin2'), errEl = document.getElementById('si-err');
      var say = function (m) { errEl.textContent = m; errEl.hidden = false; };
      if (!live.noNumber && !num) return say(T('Type your cellphone number.'));
      if (!/^\d{6}$/.test(pin)) return say(T('Your PIN must be 6 numbers.'));
      if (weakPin(pin)) return say(T('Choose a PIN that isn’t easy to guess (not 123456 or 111111).'));
      if (pin !== pin2) return say(T('The two PINs aren’t the same.'));
      var back = { stage: 'choosePin', number: num, noNumber: !!live.noNumber, code: live.code };
      el.disabled = true; live = { stage: 'loading', email: '' }; renderLive();
      Store.live.confirmCode(num, pin).then(function (r) {
        if (/^c\d/.test(r.login)) { live = { stage: 'churchNumber', login: r.login }; renderLive(); } else Store.live.begin();
      }, function (e) {
        var c = e && e.code;
        if (c === 'codes/used' || c === 'codes/expired') { Store.live.cancelCode(); live = { stage: 'code', code: back.code, message: codeMessage(c) }; }
        else live = Object.assign(back, { message: pinMessage(c) });
        renderLive();
      });
    },
    pinbegin: function () { live = { stage: 'loading', email: '' }; renderLive(); Store.live.begin(); },
    pinstart: function () { live = { stage: 'pin' }; renderLive(); },
    pinsignin: function (el, ev) {
      if (ev) ev.preventDefault();
      var num = (document.getElementById('si-num') || {}).value || '', pin = (document.getElementById('si-pin') || {}).value || '', errEl = document.getElementById('si-err');
      if (!num.trim() || !pin.trim()) { errEl.textContent = T('Type your number and your PIN.'); errEl.hidden = false; return; }
      el.disabled = true; live = { stage: 'loading', email: '' }; renderLive();
      Store.live.signInPin(num, pin.trim()).catch(function (e) { live = { stage: 'pin', number: num, message: pinMessage(e && e.code) }; renderLive(); });
    },
    codeno: function () {
      Store.live.cancelCode();
      live = { stage: 'signedOut', message: T('Nothing was changed. Please ask the church office for your own sign-in code.') }; renderLive();
    },
    selfie: function () { var f = document.getElementById('selfie-file'); if (f) f.click(); },
    sesotho: function (el) { useLang(el.dataset.l); },
    tipnext: function () { var ctx = tipCtx(), tips = Tips.forPerson(ctx), r = Tips.next(tips, Store.pref('tipsSeen').split(',').filter(Boolean)); tipShown = r.tip ? r.tip.id : null; Store.pref('tipsSeen', r.seen.join(',')); render(); },
    tipclose: function () { tipClosed = true; var c = document.getElementById('tips-card'); if (c) c.remove(); },
    tipsall: function () {
      var tips = Tips.forPerson(tipCtx());
      modal(dialogHead(T('Did you know?'), T('Tips for getting the most out of Church & Trellis')) + '<div class="dlg-body"><ul class="tips-all">' + tips.map(function (t) {
        return '<li><span class="grow">' + withButtons(t, T(t.text)) + '</span>' + (t.href ? ' <a class="btn small" href="' + esc(t.href) + '">' + T('Show me') + '</a>' : '') + '</li>';
      }).join('') + '</ul></div>', T('Did you know?'));
    },
    later: function (el) { Store.pref(el.dataset.k + 'Later', new Date().toISOString()); var b = el.closest('.prompt'); if (b) b.remove(); },
    havelink: function () { live = { stage: 'linkSent', email: Store.live.pendingEmail() }; renderLive(); },
    setup: function (el) {
      var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, errEl = document.getElementById('su-err');
      if (!v('su-first') || !v('su-last') || (live.needChurch && !v('su-church'))) { errEl.textContent = T('Please fill in every box.'); errEl.hidden = false; return; }
      el.disabled = true;
      Store.live.setup({ churchName: live.needChurch ? v('su-church') : '', firstName: v('su-first'), lastName: v('su-last') }, makeSampleData)
        .catch(function (e) { el.disabled = false; errEl.textContent = T('Setting up didn’t work ({code}). Check the rules were published (setup guide, step 7).', { code: (e && e.code) || 'error' }); errEl.hidden = false; });
    },
    reset: function () { if (confirmBtn(this)) { Store.reset(makeSampleData); user = Store.get('people', user.id) || null; render(); toast(T('Demo data reset')); } },
    mode: function (el) { Store.pref('mode', el.dataset.m || ''); applyMode(); var inMenu = !!el.closest('#modal'); if (inMenu) closeModal(); render(); if (inMenu) hubActions.menu(); },
    menu: function () {
      modal(dialogHead(T('All apps')) + '<div class="cards in-dialog">' + [{ id: 'home', name: 'Home', icon: ICON.home, tint: '#6B625A', desc: 'Your to-do list' }].concat(listed()).map(function (m) {
        return '<a class="appcard" href="#/' + m.id + '" data-act="hub:close"><span class="ic" style="--c:' + m.tint + '">' + icon(m.icon, 22) + '</span><b>' + esc(T(m.name)) + '</b><span>' + esc(T(m.desc)) + '</span></a>';
      }).join('') + '</div>' +
        (canViewAs() ? '<div class="dlg-foot" style="justify-content:flex-start;border-top:0;padding-top:0">' + (Store.preview() ? '<button class="btn" data-act="hub:viewas" data-r="admin">' + icon(ICON.eye, 18) + esc(backLabel()) + '</button>' : '<button class="btn" data-act="hub:viewaspick">' + icon(ICON.eye, 18) + T('View as another role…') + '</button>') + '</div>' : '') +
        '<div class="dlg-foot" style="justify-content:flex-start;border-top:0;padding-top:0">' + modePicker() + '</div>' +
        '<div class="dlg-foot" style="justify-content:space-between">' + I18n.picker('lang-menu') + '<span>' + (shared() ? '<button class="btn" data-act="hub:switchwho">' + icon(ICON.people, 18) + T('Switch person') + '</button> ' : '') +
        '<button class="btn" data-act="hub:signout">' + icon(ICON.out, 18) + T('Sign out') + '</button></span></div>', T('All apps'));
      langWire();
    },
    notice: function (el, ev) { ev.preventDefault(); modal(dialogHead(T('Privacy notice'), T('How we use your information')) + '<div class="dlg-body"><p>' + esc(Store.settings().privacyNotice) + '</p><p class="muted">' + T('Information Officer') + ': ' + esc(Store.settings().informationOfficer.name) + '</p></div>', T('Privacy notice')); },
    /** "View as": an Administrator sees Church & Trellis the way a Pastor, Roster coordinator, Children's ministry or a Member would. */
    viewaspick: function () {
      var home = viewHome(); if (!home) return;
      var cur = Store.previewCare() ? 'carer' : Store.preview() || home;
      modal(dialogHead(T('View as another role'), T('See what other people see when they sign in')) + '<div class="dlg-body"><p class="muted" style="margin-top:0">' + T('You stay signed in as yourself, but Church & Trellis shows only what that role may see.') + ' ' +
        T('Nothing you do is saved while you’re viewing. Pastoral and medical notes stay hidden – only Pastors and Children’s ministry may see those.') + '</p><div class="viewas-pick">' +
        [home].concat(viewChoices()).map(function (r) {
          return '<button class="btn' + (r === cur ? ' primary' : '') + '" data-act="hub:viewas" data-r="' + (r === home ? 'admin' : r) + '"' + (r === cur ? ' aria-current="true"' : '') + '>' + esc(viewLabel(r)) + (r === home ? ' (' + T('you') + ')' : '') + '</button>';
        }).join('') + '</div></div>', T('View as another role'));
    },
    viewas: function (el) {
      var r = el.dataset.r === 'admin' ? '' : el.dataset.r, g = el.dataset.g || '';
      if (!canViewAs() || (r && viewChoices().indexOf(r) < 0)) { closeModal(); return; }
      if (r === 'carer' && !g) {   // a carer of which group?
        var gs = Store.list('careGroups').slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        if (!gs.length) { closeModal(); toast(T('There are no Care Groups yet – add them on the Care Groups page'), true); return; }
        modal(dialogHead(T('View as a carer'), T('Which Care Group?')) + '<div class="dlg-body"><p class="muted" style="margin-top:0">' + T('See the group the way its carer does, on their Me page.') + '</p><div class="viewas-pick">' +
          gs.map(function (x) { return '<button class="btn" data-act="hub:viewas" data-r="carer" data-g="' + esc(x.id) + '">' + esc(x.name) + ' <span class="muted small">(' + (x.memberIds || []).length + ')</span></button>'; }).join('') + '</div></div>', T('View as a carer'));
        return;
      }
      var role = r === 'carer' ? 'member' : r;
      if (role === Store.preview() && g === Store.previewCare()) { closeModal(); return; }
      closeModal();
      var label = r === 'carer' ? T('Carer') + ' · ' + ((Store.get('careGroups', g) || {}).name || '') : viewLabel(r);
      var after = function () { location.hash = r === 'carer' ? '#/me' : '#/home'; render(); toast(r ? T('Viewing as {role} – nothing is saved', { role: label }) : backLabel()); };
      if (!Store.isLive()) { Store.preview(role, g); after(); return; }
      busy(r ? T('Loading what {role} sees…', { role: label }) : backLabel() + '…', function () {
        return new Promise(function (done) { switching = done; Store.preview(role, g); });
      }).then(after);
    },
    stay: function () { closeModal(); try { history.pushState({ hubTop: 1 }, ''); } catch (e) {} },
    leave: function () {
      closeModal(); leaveOk = Date.now(); history.back();
      setTimeout(function () { if (document.visibilityState !== 'hidden') { try { window.close(); } catch (e) {} } }, 400);   // nothing to go back to: try to close the window
    },
    close: function () { closeModal(); },
    overlay: function (el, ev) { if (ev.target === el) closeModal(); }
  };
  /** Two-step confirm on a button: first click asks, second click does it. */
  function confirmBtn(el, text) {
    if (!el || !el.dataset) return true;
    if (el.dataset.sure) return true;
    el.dataset.sure = '1'; el.dataset.was = el.innerHTML; el.textContent = text || T('Click again to confirm'); el.classList.add('danger');
    setTimeout(function () { if (el.isConnected && el.dataset.sure) { delete el.dataset.sure; el.innerHTML = el.dataset.was; el.classList.remove('danger'); } }, 4000);
    return false;
  }

  /** A "More ▾" button with a short list of less-used actions (each an HTML <button> or <a>). It closes when one is chosen,
   *  or on a click anywhere else (onClick below), so pages can keep one main button and tuck the rest away. */
  function menu(label, items, cls, aria) {
    var dots = label === '⋯';
    return '<details class="menu' + (cls ? ' ' + cls : '') + '"><summary class="' + (dots ? 'icon-btn ghost' : 'btn') + '"' + (aria ? ' aria-label="' + esc(aria) + '" title="' + esc(aria) + '"' : '') + '>' +
      esc(label) + (dots ? '' : ' <span aria-hidden="true">▾</span>') + '</summary><div class="menu-list" role="menu">' + items.join('') + '</div></details>';
  }
  /** A menu that would open past the edge of the screen (a "More" button near the middle of a phone) is moved back in. */
  if (typeof document !== 'undefined') document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d.matches || !d.matches('details.menu') || !d.open) return;
    var l = d.querySelector('.menu-list'); if (!l) return;
    l.style.left = ''; l.style.right = '';
    var r = l.getBoundingClientRect(), vw = document.documentElement.clientWidth, pad = 8;
    if (r.right > vw - pad) { l.style.right = 'auto'; l.style.left = Math.round(l.offsetLeft - (r.right - (vw - pad))) + 'px'; }
    else if (r.left < pad) { l.style.right = 'auto'; l.style.left = Math.round(l.offsetLeft + (pad - r.left)) + 'px'; }
  }, true);
  function onClick(ev) {
    document.querySelectorAll('details.menu[open]').forEach(function (d) { if (!d.contains(ev.target) || ev.target.closest('.menu-list')) d.removeAttribute('open'); });
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var spec = el.dataset.act.split(':'), fn;
    if (spec[0] === 'hub') fn = hubActions[spec[1]];
    else { var m = moduleById(spec[0]); fn = m && m.actions && m.actions[spec[1]]; }
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
    fn.call(el, el, ev);
  }
  /** The language pickers (sidebar, menu, sign-in): remembered on this device, the screen redrawn in the new language. */
  function langWire() {
    document.querySelectorAll('.lang-sel').forEach(function (sel) {
      if (sel.dataset.wired) return; sel.dataset.wired = '1';
      sel.addEventListener('change', function () {
        if (sel.value === 'st') { sesothoAsk(); return; }   // two spellings: ask which
        useLang(sel.value);
      });
    });
  }
  function useLang(code) {
    I18n.set(code); Store.pref('lang', code);   // a language from another file is redrawn when it arrives
    if (document.querySelector('#modal .overlay')) closeModal();
    render(); var again = document.querySelector('.lang-sel'); if (again) again.focus();
  }
  /** Sesotho is written a little differently in South Africa and in Lesotho (dintlha / lintlha): people choose. */
  function sesothoAsk() {
    var b = function (code, name, eg) { return '<button class="btn choice" data-act="hub:sesotho" data-l="' + code + '"><b>' + name + '</b><span class="small muted">' + eg + '</span></button>'; };
    modal(dialogHead('Sesotho', T('Which spelling would you like?')) + '<div class="dlg-body"><div class="choices">' +
      b('st', 'Sesotho sa Afrika Borwa', T('South Africa') + ' · dintlha, dihlopha') + b('st-LS', 'Sesotho sa Lesotho', T('Lesotho') + ' · lintlha, lihlopha') + '</div></div>', 'Sesotho');
  }
  function onKey(ev) { if (ev.key === 'Escape' && document.querySelector('#modal .overlay')) closeModal(); }

  /** The Android back button: close an open window first (true = handled); otherwise the app goes back a page. */
  window.churchHubBack = function () { if (document.querySelector('#modal .overlay')) { closeModal(); return true; } return false; };
  /** The Android app asks "Leave Church & Trellis?" in the chosen language before the back button closes it. */
  window.churchHubReload = function () { leaveOk = Date.now(); location.reload(); };
  window.churchHubLeaveText = function () { return JSON.stringify([T('Leave Church & Trellis?'), T('Are you sure you want to close Church & Trellis?'), T('Stay'), T('Close Church & Trellis')]); };

  /* ---------- On a computer or phone browser: check before closing the tab or window while signed in ---------- */
  // Browsers show their own wording ("Leave site?"); a page can't change it. Not in the Android app, which asks itself.
  // Email, phone and WhatsApp links open another app without leaving, so they don't ask.
  var leaveOk = 0;
  /** Back past Church & Trellis's first screen (a browser's Back, or the iPhone home-screen app) asks "Leave Church & Trellis?" first:
   *  an extra step in the history catches it. The Android app asks itself (MainActivity.confirmLeave). */
  var backGuard = false;
  function guardBack() {
    if (backGuard || inApp() || !user || !window.history || !history.pushState) return;
    backGuard = true;
    try { history.replaceState({ hubBase: 1 }, ''); history.pushState({ hubTop: 1 }, ''); } catch (e) { return; }
    window.addEventListener('popstate', function (ev) {
      if (!(ev.state && ev.state.hubBase) || !user) return;
      modal(dialogHead(T('Leave Church & Trellis?')) + '<div class="dlg-body"><p style="margin:0">' + T('Are you sure you want to close Church & Trellis?') + '</p></div>' +
        '<div class="dlg-foot"><button class="btn" data-act="hub:stay">' + T('Stay') + '</button><button class="btn primary" data-act="hub:leave">' + T('Close Church & Trellis') + '</button></div>', T('Leave Church & Trellis?'));
    });
  }
  function watchLeaving() {
    if (inApp()) return;
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href]');
      if (a && /^(mailto|tel|sms|whatsapp):/i.test(a.getAttribute('href') || '')) leaveOk = Date.now();
    }, true);
    window.addEventListener('beforeunload', function (ev) {
      if (!user || Date.now() - leaveOk < 2000) return;
      ev.preventDefault(); ev.returnValue = '';
    });
  }

  /* ---------- without the internet ---------- */
  /** Church & Trellis opens without the internet: sw.js keeps a copy of its files on this device (the church's information is
   *  kept by Store, live mode). Not for a copy opened straight from a computer's files. Offline, live mode is view-only. */
  function workOffline() {
    window.addEventListener('offline', onlineChanged);
    window.addEventListener('online', onlineChanged);
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(keepFiles, function (e) { console.warn('Church & Trellis can’t keep a copy for offline use here', e && e.message); });
  }
  /** Tell sw.js every file this page has loaded (scripts, styles, icons, the chosen language, the Firebase library), so
   *  they are kept from the very first visit. */
  function keepFiles() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.getRegistration().then(function (reg) {
      var sw = reg && (reg.active || reg.waiting || reg.installing); if (!sw || !window.performance || !performance.getEntriesByType) return;
      var urls = [location.href.split('#')[0]].concat(performance.getEntriesByType('resource').filter(function (r) {
        return /^(script|link|css|img|other)$/.test(r.initiatorType);
      }).map(function (r) { return r.name; }));
      sw.postMessage({ keep: urls });
    }).catch(function () {});
  }
  function onlineChanged() {
    if (!Store.isLive() || !user) return;
    if (!Store.offline()) toast(T('Back online – you can make changes again.'));
    var a = document.activeElement;
    if (!document.querySelector('#modal .overlay') && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
    else { var bar = document.querySelector('.offline-bar'); if (bar && !Store.offline()) bar.remove(); }
  }

  /** Back to the top and to the bottom: two small round arrows at the bottom right of a long page – up once someone has
   *  scrolled well down, down while there is still a long way to go (e.g. a long list, or Settings). */
  function jumpButtons() {
    var box = document.createElement('div'); box.id = 'jump';
    var make = function (id, path) { var b = document.createElement('button'); b.type = 'button'; b.id = id; b.hidden = true; b.innerHTML = icon(path, 20); box.appendChild(b); return b; };
    var up = make('to-top', 'M12 19V5M5 12l7-7 7 7'), down = make('to-bottom', 'M12 5v14M19 12l-7 7-7-7');
    var label = function () { [[up, T('Back to the top')], [down, T('Go to the bottom')]].forEach(function (x) { x[0].setAttribute('aria-label', x[1]); x[0].title = x[1]; }); };
    label(); document.body.appendChild(box);
    var shown = { 'to-top': false, 'to-bottom': false };
    var show = function (b, on) {
      if (on === shown[b.id]) return; shown[b.id] = on;
      if (on) { label(); b.hidden = false; requestAnimationFrame(function () { b.classList.add('show'); }); } else { b.classList.remove('show'); setTimeout(function () { if (!shown[b.id]) b.hidden = true; }, 200); }
    };
    // On phones the arrows would sit on top of buttons near the bottom right (an Add button, a ✕), so there they show only
    // while you scroll and fade away a moment after you stop – scroll a little to bring them back.
    var idle = null, phone = function () { return !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches); };
    var check = function () {
      var y = window.scrollY, h = document.documentElement.scrollHeight, left = h - (y + window.innerHeight);
      show(up, y > 600); show(down, left > 600);
      clearTimeout(idle);
      if (phone()) idle = setTimeout(function () { if (box.contains(document.activeElement)) return; show(up, false); show(down, false); }, 2000);
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    window.addEventListener('hashchange', function () { setTimeout(check, 50); });
    if (window.ResizeObserver) new ResizeObserver(function () { check(); }).observe(document.body);   // the page grew or shrank (drawn again, a panel opened)
    var smooth = function () { return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
    up.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: smooth() ? 'smooth' : 'auto' });
      var m = document.getElementById('main'); if (m) m.focus({ preventScroll: true });
    });
    down.addEventListener('click', function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() ? 'smooth' : 'auto' }); });
  }

  function start() {
    root = document.getElementById('app');
    jumpButtons();
    if (inApp()) document.documentElement.classList.add('in-app');
    if (homeScreen()) document.documentElement.classList.add('home-screen');
    I18n.onLoad(function () { if (document.querySelector('#modal .overlay')) closeModal(); render(); keepFiles(); });
    I18n.set(Store.pref('lang') || 'en');
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    watchLeaving();
    document.addEventListener('submit', function (ev) {      // Enter in a form = its button
      ev.preventDefault();
      if (ev.submitter && ev.submitter.dataset && ev.submitter.dataset.act) return;    // the button's own click already ran
      var b = ev.target.querySelector('[data-act]'); if (b) b.click();
    });
    window.addEventListener('hashchange', function () { if (!user) return; closeModal(); render(); var m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); window.scrollTo(0, 0); });
    Store.onChange(function () { if (user) user = Store.get('people', user.id) || user; });
    Store.onError(function (msg) { toast(msg === Store.OFFLINE_MSG ? T('You’re offline – Church & Trellis is view-only until you’re back online.') : msg, true); });
    workOffline();
    if (Store.isLive()) {
      // Someone else changed something: refresh the screen, unless this person is typing or has a dialog open.
      Store.onRemoteChange(function () {
        if (!user) return;
        user = Store.get('people', user.id) || user;
        var a = document.activeElement;
        // Not while a dialog is open, someone is typing, or a "click again to confirm" button is waiting for its second click
        // … or a page holds work that a redraw would lose (data-keep: the brochure editor's brochure)
        if (document.querySelector('#modal .overlay') || document.querySelector('[data-sure]') || document.querySelector('[data-keep]') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
        render();
      });
      linkCode = codeFromLink();
      Store.live.boot(onLiveState);
      return;
    }
    Store.load(makeSampleData);
    try { var id = sessionStorage.getItem('hub_user'); if (id) { user = Store.get('people', id); Store.setUser(user); } } catch (e) {}
    if (user) runUpgrades();
    render();
  }

  return { groupMods: groupMods, tip: tip, speed: function () { return speed; }, register: register, isOn: isOn, start: start, render: render, go: go, can: can, user: function () { return user; }, ROLES: ROLES,
    menu: menu, esc: esc, fmt: fmt, today: today, name: name, byName: byName, names: names, familyName: familyName, avatar: avatar, shrinkPhoto: shrinkPhoto, cropPhoto: cropPhoto, icon: icon, ICON: ICON, mapLink: mapLink, pause: pause, modal: modal, closeModal: closeModal, autoForget: autoForget,
    THEMES: THEMES, themeOf: themeOf, themeFrom: themeFrom, themeFor: themeFor, myColor: myColor, myLook: myLook, applyTheme: applyTheme,
    dialogHead: dialogHead, toast: toast, busy: busy, matches: matches, markRequired: markRequired, reqKey: reqKey, download: download, confirmBtn: confirmBtn, MON: MON, DOW: DOW, roleLabel: roleLabel, personRole: personRole, tags: function () { return user ? homeTags() : ['everyone']; }, myLabel: myLabel, attendee: attendee, attendeeCan: attendeeCan, partnerAccess: partnerAccess, isRector: function () { return realRector() && !Store.preview(); }, canViewAs: function () { return canViewAs() && !Store.preview(); }, viewChoices: function () { return canViewAs() ? viewChoices() : []; }, isSenior: isSenior, PASTOR_CAN: PASTOR_CAN, T: T, mon: function () { return I18n.mon(); } };
})();
