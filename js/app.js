/*
 * Church Hub – app shell.
 * Modules (people, rosters, leave, privacy, import, settings) register with Hub.register({...}) and appear as cards on Home.
 * A module object:
 *   id, name, desc (one line), icon (SVG path), tint, roles (who may open it; omit = everyone)
 *   render(parts)  → HTML for #/id/...parts      after(parts) → wire up anything after render (optional)
 *   todos(user)    → [{ text, href, tag }]       stat(user)   → short text on the Home card (optional)
 *   actions        → { name: function (el, ev) } called for clicks on [data-act="id:name"]
 */
var Hub = (function () {
  'use strict';
  var modules = [], user = null, root = null, T = I18n.t;

  /* ---------- roles and permissions (UI now; database security rules when on Firebase) ---------- */
  var ROLES = {
    admin: { label: 'Administrator', perms: ['*'] },          // everything except the two restricted kinds of notes below
    pastor: { label: 'Pastor', perms: ['people.view', 'people.edit', 'notes', 'children', 'rosters.view'] },
    rosters: { label: 'Roster coordinator', perms: ['people.basic', 'rosters.manage', 'rosters.view'] },
    kids: { label: 'Children’s ministry', perms: ['people.basic', 'children', 'medical', 'rosters.view'] },
    member: { label: 'Member', perms: [] },
    none: { label: 'No access (can’t sign in)', perms: [] }
  };
  /** POPIA: children's medical notes are for Children's ministry only and pastoral notes for Pastors only –
   *  not even Administrators see them (the database rules enforce the same). */
  var RESTRICTED = ['medical', 'notes'];
  function roleLabel(r) { return T((ROLES[r] || ROLES.member).label); }
  function can(perm) {
    if (!user) return false;
    var p = (ROLES[user.appRole] || ROLES.member).perms;
    return p.indexOf(perm) >= 0 || (p.indexOf('*') >= 0 && RESTRICTED.indexOf(perm) < 0);
  }

  /* ---------- helpers ---------- */
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
    return '<span class="av" style="--c:' + c + (size ? ';--s:' + size + 'px' : '') + '" aria-hidden="true">' + esc(initials(p)) + '</span>';
  }
  function icon(path, size) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"></path></svg>';
  }
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
    menu: 'M4 6h16M4 12h16M4 18h16', download: 'M12 3v12M7 10l5 5 5-5M4 21h16', trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15', sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'
  };

  /* ---------- modules ---------- */
  function register(m) { modules.push(m); }
  /** One-off data upgrades (module.upgrade), run when an Administrator signs in. */
  function runUpgrades() { if (!can('*')) return; modules.forEach(function (m) { if (m.upgrade) { try { m.upgrade(user); } catch (e) { console.error('upgrade', m.id, e); } } }); }
  function enabled() {
    var on = (Store.settings().modules || {});
    return modules.filter(function (m) { return on[m.id] !== false && (!m.roles || m.roles.indexOf(user.appRole) >= 0 || can('*')); });
  }
  function moduleById(id) { return modules.filter(function (m) { return m.id === id; })[0]; }

  /* ---------- routing ---------- */
  function parts() { return (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent); }
  function go(path) { location.hash = '#/' + path; }

  /* ---------- rendering ---------- */
  function render() {
    if (!user) return renderSignIn();
    var p = parts(), mod = p[0] === 'home' ? null : moduleById(p[0]);
    if (mod && enabled().indexOf(mod) < 0) { go('home'); return; }
    var body = mod ? mod.render(p.slice(1)) : renderHome();
    root.innerHTML = shell(mod, body);
    if (mod && mod.after) mod.after(p.slice(1));
    langWire();
    var h = root.querySelector('main h1'); if (h) document.title = h.textContent + ' · Church Hub';
  }

  function navItems(active) {
    var items = [{ id: 'home', name: T('Home'), icon: ICON.home }].concat(enabled().map(function (m) { return { id: m.id, name: T(m.name), icon: m.icon }; }));
    return items.map(function (it) {
      return '<a href="#/' + it.id + '" class="nav' + (it.id === active ? ' on' : '') + '"' + (it.id === active ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + esc(it.name) + '</span></a>';
    }).join('');
  }
  function shell(mod, body) {
    var active = mod ? mod.id : 'home', s = Store.settings();
    var tabs = ['home'].concat(enabled().filter(function (m) { return ['people', 'rosters', 'leave'].indexOf(m.id) >= 0; }).map(function (m) { return m.id; })).slice(0, 4);
    return '<div class="app">' +
      '<aside class="side" aria-label="' + T('Main menu') + '"><div class="brand"><span class="mark">' + icon('M12 3v18M6 9h12', 18) + '</span><span><b>Church Hub</b><small>' + esc(s.churchName) + '</small></span></div>' +
      '<nav>' + navItems(active) + '</nav>' + '<div class="side-lang">' + I18n.picker() + '</div>' +
      '<div class="who">' + avatar(user) + '<span><b>' + esc(name(user)) + '</b><small>' + esc(roleLabel(user.appRole)) + '</small></span>' +
      '<button class="icon-btn ghost" data-act="hub:signout" aria-label="' + T('Sign out') + '" title="' + T('Sign out') + '">' + icon(ICON.out) + '</button></div></aside>' +
      '<div class="main-col">' +
      '<header class="top"><a href="#/home" class="brand small"><span class="mark">' + icon('M12 3v18M6 9h12', 16) + '</span><b>Church Hub</b></a>' +
      '<button class="icon-btn" data-act="hub:menu" aria-label="' + T('All apps') + '">' + icon(ICON.menu) + '</button></header>' +
      (s.demo ? '<div class="demo">' + T('Demo with made-up people. Changes stay in this browser.') + ' <button class="link" data-act="hub:reset">' + T('Reset demo') + '</button> · <button class="link" data-act="hub:signout">' + T('Switch person') + '</button></div>' : '') +
      '<main id="main" tabindex="-1">' + body + '</main></div>' +
      '<nav class="tabbar" aria-label="' + T('Quick menu') + '">' + tabs.map(function (id) {
        var m = id === 'home' ? { name: 'Home', icon: ICON.home } : moduleById(id);
        return '<a href="#/' + id + '" class="' + (id === active ? 'on' : '') + '">' + icon(m.icon, 22) + '<span>' + esc(T(m.name)) + '</span></a>';
      }).join('') + '<button data-act="hub:menu">' + icon(ICON.menu, 22) + '<span>' + T('More') + '</span></button></nav>' +
      '</div>';
  }

  function renderHome() {
    var todos = [];
    enabled().forEach(function (m) { if (m.todos) (m.todos(user) || []).forEach(function (t) { t.mod = m; todos.push(t); }); });
    var hour = new Date().getHours(), hello = T(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    return '<div class="page-head"><div><h1>' + hello + ', ' + esc(user.preferredName || user.firstName) + '</h1><p class="lead">' + esc(fmt(today(), true)) + ' · ' + esc(roleLabel(user.appRole)) + '</p></div></div>' +
      '<section class="block"><h2>' + T('To do') + '</h2>' + (todos.length ? '<ul class="todo">' + todos.slice(0, 8).map(function (t) {
        return '<li><a href="' + esc(t.href) + '"><span class="dot" style="--c:' + t.mod.tint + '"></span><span class="grow">' + esc(t.text) + '</span><span class="tag" style="--c:' + t.mod.tint + '">' + esc(t.tag || T(t.mod.name)) + '</span></a></li>';
      }).join('') + '</ul>' : '<p class="empty">' + T('Nothing needs you right now.') + '</p>') + '</section>' +
      '<section class="block"><h2>' + T('Apps') + '</h2><div class="cards">' + enabled().map(function (m) {
        return '<a class="appcard" href="#/' + m.id + '"><span class="ic" style="--c:' + m.tint + '">' + icon(m.icon, 22) + '</span><b>' + esc(T(m.name)) + '</b><span>' + esc(m.stat ? m.stat(user) : T(m.desc)) + '</span></a>';
      }).join('') + '</div></section>';
  }

  /* ---------- live sign-in (Firebase) ---------- */
  var live = { stage: 'loading' };
  function liveCard(inner) {
    return '<div class="signin"><div class="signin-card">' +
      '<div class="brand big"><span class="mark">' + icon('M12 3v18M6 9h12', 22) + '</span><span><b>Church Hub</b><small>' + esc((Store.settings() || {}).churchName || 'Christ Church Howick') + '</small></span></div>' +
      '<div class="signin-lang">' + I18n.picker() + '</div>' + inner + '</div></div>';
  }
  function renderLive() {
    var st = live, html;
    if (st.stage === 'loading') html = '<h1>Church Hub</h1><p class="lead">' + T(st.email ? 'Signing you in…' : 'Loading…') + '</p>';
    else if (st.stage === 'error') html = '<h1>' + T('Something went wrong') + '</h1><p class="note bad">' + esc(st.message) + '</p><button class="btn" onclick="location.reload()">' + T('Try again') + '</button>';
    else if (st.stage === 'linkSent') html = '<h1>' + T('Check your email') + '</h1><p class="lead">' + T('We sent a sign-in link to {email}. Open it on this device to sign in. It may take a minute, and could land in your spam folder.', { email: '<b>' + esc(st.email) + '</b>' }) + '</p><button class="btn" data-act="hub:restart">' + T('Use a different way') + '</button>';
    else if (st.stage === 'needEmail') html = '<h1>' + T('Confirm your email') + '</h1><p class="lead">' + T('For your safety, type the email address you asked the sign-in link for.') + '</p>' +
      '<form id="si-form" novalidate><label class="field">' + T('Email') + '<input id="si-email" type="email" autocomplete="email" required></label><p id="si-err" class="note bad" hidden></p><button class="btn primary" data-act="hub:finishlink">' + T('Sign in') + '</button></form>';
    else if (st.stage === 'noAccess') html = '<h1>' + T('No access yet') + '</h1><p class="lead">' + ({
      unverified: T('Your email address ({email}) hasn’t been verified. Sign in with Google or an email link instead.', { email: esc(st.email) }),
      notReady: T('Church Hub hasn’t been set up yet. Please try again later.'),
      noPerson: T('You have access, but your person record is missing. Please ask the church office.')
    }[st.reason] || T('You are signed in as {email}, but this email address hasn’t been given access to Church Hub. Ask the church office to add it, or sign out and use another account.', { email: '<b>' + esc(st.email) + '</b>' })) + '</p>' +
      '<button class="btn" data-act="hub:signout">' + icon(ICON.out, 18) + T('Sign out') + '</button>';
    else if (st.stage === 'setup') html = '<h1>' + (st.needChurch ? 'Set up Church Hub' : 'Welcome') + '</h1><p class="lead">' + (st.needChurch ? 'You are the first Administrator. This creates the church’s settings, the leave rules and some starter serving teams (you can change them all later).' : 'Please add your name to finish setting up your access.') + '</p>' +
      '<form id="su-form" novalidate>' + (st.needChurch ? '<label class="field">Church name<input id="su-church" value="Christ Church Howick"></label>' : '') +
      '<div class="two"><label class="field">Your first name<input id="su-first" autocomplete="given-name"></label><label class="field">Last name<input id="su-last" autocomplete="family-name"></label></div>' +
      '<p id="su-err" class="note bad" hidden></p></form><button class="btn primary" data-act="hub:setup">' + (st.needChurch ? 'Set up' : 'Continue') + '</button> <button class="btn" data-act="hub:signout">Sign out</button>';
    else html = '<h1>' + T('Sign in') + '</h1><p class="lead">' + T('For church staff, leaders and members who have been given access.') + '</p>' + (st.message ? '<p class="note bad">' + esc(st.message) + '</p>' : '') +
      '<button class="btn primary big-btn" data-act="hub:google">' + icon('M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.8v2.4h3.1c1.8-1.7 2.8-4.1 2.8-6.9zM12 21c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.4C5.1 18.9 8.3 21 12 21zM6.7 13.3a5.4 5.4 0 0 1 0-3.4V7.5H3.5a9 9 0 0 0 0 8.2zM12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9 9 0 0 0 3.5 7.5l3.2 2.4C7.4 8.2 9.5 6.6 12 6.6z', 18) + T('Sign in with Google') + '</button>' +
      '<p class="muted" style="text-align:center;margin:14px 0 6px">' + T('or get a sign-in link by email') + '</p>' +
      '<form id="si-form" novalidate><label class="field"><span class="sr">' + T('Email') + '</span><input id="si-email" type="email" placeholder="you@example.com" autocomplete="email"></label><p id="si-err" class="note bad" hidden></p>' +
      '<button class="btn" data-act="hub:sendlink">' + T('Email me a link') + '</button></form>' +
      '<p class="fine">' + esc(((Store.settings() || {}).privacyNotice || 'The church keeps your information secure and stores it in South Africa').split('.')[0]) + '. ' + T('Want to look around first?') + ' <a href="?demo">' + T('Try the demo with made-up people') + '</a>.</p>';
    root.innerHTML = liveCard(html);
    var f = root.querySelector('input'); if (f) f.focus();
    langWire();
  }
  function onLiveState(st) {
    live = st;
    if (st.stage === 'ready') {
      user = st.person; Store.setUser(user);
      Store.audit('Signed in', 'people/' + user.id);
      runUpgrades();
      if (!location.hash || location.hash === '#') location.hash = '#/home';
      render();
    } else { user = null; Store.setUser(null); renderLive(); }
  }

  function renderSignIn() {
    if (Store.isLive()) return renderLive();
    var s = Store.settings();
    var people = Store.list('people').filter(function (p) { return p.familyRole !== 'child' && p.active !== false; });
    var byRole = {};
    people.forEach(function (p) { (byRole[p.appRole] = byRole[p.appRole] || []).push(p); });
    var order = ['admin', 'pastor', 'rosters', 'kids', 'member'];
    root.innerHTML = '<div class="signin"><div class="signin-card">' +
      '<div class="brand big"><span class="mark">' + icon('M12 3v18M6 9h12', 22) + '</span><span><b>Church Hub</b><small>' + esc(s.churchName) + '</small></span></div>' +
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
  function modal(html, label, wide) {
    lastFocus = document.activeElement;
    var m = document.getElementById('modal');
    m.innerHTML = '<div class="overlay" data-act="hub:overlay"><div class="dialog' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + html + '</div></div>';
    var f = m.querySelector('input:not([type=hidden]), select, textarea, button:not(.x)'); if (f) f.focus();
  }
  function closeModal() { document.getElementById('modal').innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function dialogHead(title, sub) { return '<header class="dlg-h"><div><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><button class="icon-btn ghost x" data-act="hub:close" aria-label="' + T('Close') + '">' + icon(ICON.x) + '</button></header>'; }
  var toastTimer = null;
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  function download(filename, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- events ---------- */
  var hubActions = {
    signin: function (el) { var p = Store.get('people', el.dataset.id); user = p; Store.setUser(p); try { sessionStorage.setItem('hub_user', p.id); } catch (e) {} Store.audit('Signed in (demo)', 'people/' + p.id); runUpgrades(); go('home'); render(); },
    signinany: function () { hubActions.signin({ dataset: { id: document.getElementById('si-any').value } }); },
    signout: function () {
      if (user) Store.audit('Signed out', 'people/' + user.id);
      user = null; Store.setUser(null); try { sessionStorage.removeItem('hub_user'); } catch (e) {}
      if (Store.isLive()) { closeModal(); Store.live.signOut(); history.replaceState(null, '', location.pathname + location.search); return; }
      location.hash = ''; render();
    },
    google: function () {
      Store.live.google().catch(function (e) { live = { stage: 'signedOut', message: T('Google sign-in didn’t work ({code}). Try again, or use the email link.', { code: (e && e.code) || 'error' }) }; renderLive(); });
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
    restart: function () { live = { stage: 'signedOut' }; renderLive(); },
    setup: function (el) {
      var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, errEl = document.getElementById('su-err');
      if (!v('su-first') || !v('su-last') || (live.needChurch && !v('su-church'))) { errEl.textContent = 'Please fill in every box.'; errEl.hidden = false; return; }
      el.disabled = true;
      Store.live.setup({ churchName: live.needChurch ? v('su-church') : '', firstName: v('su-first'), lastName: v('su-last') }, makeSampleData)
        .catch(function (e) { el.disabled = false; errEl.textContent = 'Setting up didn’t work (' + ((e && e.code) || 'error') + '). Check the rules were published (setup guide, step 7).'; errEl.hidden = false; });
    },
    reset: function () { if (confirmBtn(this)) { Store.reset(makeSampleData); user = Store.get('people', user.id) || null; render(); toast('Demo data reset'); } },
    menu: function () {
      modal(dialogHead(T('All apps')) + '<div class="cards in-dialog">' + [{ id: 'home', name: 'Home', icon: ICON.home, tint: '#6B625A', desc: 'Your to-do list' }].concat(enabled()).map(function (m) {
        return '<a class="appcard" href="#/' + m.id + '" data-act="hub:close"><span class="ic" style="--c:' + m.tint + '">' + icon(m.icon, 22) + '</span><b>' + esc(T(m.name)) + '</b><span>' + esc(T(m.desc)) + '</span></a>';
      }).join('') + '</div><div class="dlg-foot" style="justify-content:space-between">' + I18n.picker('lang-menu') + '<button class="btn" data-act="hub:signout">' + icon(ICON.out, 18) + T('Sign out') + '</button></div>', T('All apps'));
      langWire();
    },
    notice: function (el, ev) { ev.preventDefault(); modal(dialogHead(T('Privacy notice'), T('How we use your information')) + '<div class="dlg-body"><p>' + esc(Store.settings().privacyNotice) + '</p><p class="muted">' + T('Information Officer') + ': ' + esc(Store.settings().informationOfficer.name) + '</p></div>', 'Privacy notice'); },
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

  function onClick(ev) {
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
        I18n.set(sel.value); Store.pref('lang', I18n.get());
        if (document.querySelector('#modal .overlay')) closeModal();
        render(); var again = document.querySelector('.lang-sel'); if (again) again.focus();
      });
    });
  }
  function onKey(ev) { if (ev.key === 'Escape' && document.querySelector('#modal .overlay')) closeModal(); }

  function start() {
    root = document.getElementById('app');
    I18n.set(Store.pref('lang') || 'en');
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('submit', function (ev) {      // Enter in a form = its button
      ev.preventDefault();
      if (ev.submitter && ev.submitter.dataset && ev.submitter.dataset.act) return;    // the button's own click already ran
      var b = ev.target.querySelector('[data-act]'); if (b) b.click();
    });
    window.addEventListener('hashchange', function () { if (!user) return; closeModal(); render(); var m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); window.scrollTo(0, 0); });
    Store.onChange(function () { if (user) user = Store.get('people', user.id) || user; });
    Store.onError(function (msg) { toast(msg, true); });
    if (Store.isLive()) {
      // Someone else changed something: refresh the screen, unless this person is typing or has a dialog open.
      Store.onRemoteChange(function () {
        if (!user) return;
        user = Store.get('people', user.id) || user;
        var a = document.activeElement;
        // Not while a dialog is open, someone is typing, or a "click again to confirm" button is waiting for its second click
        if (document.querySelector('#modal .overlay') || document.querySelector('[data-sure]') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
        render();
      });
      Store.live.boot(onLiveState);
      return;
    }
    Store.load(makeSampleData);
    try { var id = sessionStorage.getItem('hub_user'); if (id) { user = Store.get('people', id); Store.setUser(user); } } catch (e) {}
    if (user) runUpgrades();
    render();
  }

  return { register: register, start: start, render: render, go: go, can: can, user: function () { return user; }, ROLES: ROLES,
    esc: esc, fmt: fmt, today: today, name: name, familyName: familyName, avatar: avatar, icon: icon, ICON: ICON, modal: modal, closeModal: closeModal,
    dialogHead: dialogHead, toast: toast, download: download, confirmBtn: confirmBtn, MON: MON, DOW: DOW, roleLabel: roleLabel, T: T, mon: function () { return I18n.mon(); } };
})();
