/*
 * Church & Trellis – the Community board and the Marketplace share one way of being looked after: the keepers.
 * This file is the rules of it (pure: no DOM, no Store), used by js/mod-board.js and js/mod-market.js through
 * js/community-ui.js. Tested with node: tests/community.test.js. The plan: docs/COMMUNITY-PLAN.md parts 2 and 3.
 *
 * How it works (decided 19 Nov 2026):
 *  - Someone pins a notice (board/{id}) or lists something (market/{id}). It is "waiting": only they and the keepers see it.
 *  - A keeper approves it (live, for 30 days), asks for a change (change: a kind note goes back) or declines it (declined).
 *    Keepers (js/access.js JOBS.keepers): at first the pastors, the Administrators and the church secretary; the
 *    Administrator chooses others (settings.keepers.board / .market). A keeper must be a Church Partner or on the staff.
 *  - Changing a notice or listing sends it back to the keepers – except marking it sorted / sold, or lowering a price.
 *  - "Sorted, thank you!" / "Sold" shows a stamp across it for a day, then it goes.
 *  - A few days before it ends the poster is reminded and can renew it, twice. Everything ended is deleted 30 days later.
 *  - Contact is a private message to the poster (Messages, about: 'board' | 'market'), never a public thread.
 *  - Anyone may report a live one: the keepers see the reports.
 *
 * A notice:  { kind, title, body, phone, personId, name, status, endsAt, renews, note, by, decidedAt, doneAt, reports, createdAt, updatedAt }
 * A listing: the same, plus { price, offer, condition, category, area, photos, thumb } (no phone: contact through Messages).
 *   status: 'waiting' | 'live' | 'change' (asked for a change) | 'declined' | 'done' (sorted / sold)
 *   endsAt, decidedAt, doneAt: milliseconds; renews: how many times it was renewed; reports: the person ids who reported it.
 * Its photos (up to 3, small JPEGs) are kept apart in marketPhotos/{id} = { data: [..] }, fetched only when it is opened.
 *
 * POPIA: purpose – people of the church helping one another; the poster chooses to share what they write (their first name
 * shows to signed-in Church Partners and staff; a phone number only if they add one); deleted 30 days after it ends;
 * keepers' decisions are kept on the item (by, decidedAt) and in the audit log.
 */
var Community = (function () {
  'use strict';
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var DAY = 864e5, DAYS = 30, KEEP = 30, RENEWS = 2, REMIND = 4, STAMP = 1;   // days

  /* ---------- the kinds of notice and listing ---------- */
  // [id, name, a hint for the box, the sticky note's colour]
  var BOARD_KINDS = [
    ['need', TX('I need help'), TX('e.g. I need a plumber, or a lift to church from Hilton'), '#FFE27A'],
    ['offer', TX('I can offer'), TX('e.g. Spare time on Tuesdays – happy to help with shopping'), '#B9EBA8'],
    ['notice', TX('Notice'), TX('e.g. Lost: a blue umbrella after the 10am service'), '#A9D8F5'],
    ['thanks', TX('Thank you'), TX('e.g. Thank you to everyone who brought meals this week!'), '#E3C3F2']
  ];
  var MARKET_KINDS = [['sale', TX('For sale')], ['wanted', TX('Wanted')], ['free', TX('Free')]];
  var CATEGORIES = [['furniture', TX('Furniture')], ['children', TX('Children')], ['clothing', TX('Clothing')], ['vehicles', TX('Vehicles')],
    ['electronics', TX('Electronics')], ['books', TX('Books')], ['household', TX('Household')], ['garden', TX('Garden')], ['other', TX('Other')]];
  var CONDITIONS = [['new', TX('New')], ['likenew', TX('Like new')], ['good', TX('Good')], ['used', TX('Well used')]];
  var MAX = { title: 80, body: 600, marketBody: 1000, phone: 30, area: 60, note: 300, name: 60, photos: 3 };
  var PART_IDS = ['board', 'market'];

  function kindsOf(part) { return part === 'market' ? MARKET_KINDS : BOARD_KINDS; }
  function kind(part, id) { var ks = kindsOf(part); return ks.filter(function (k) { return k[0] === id; })[0] || ks[0]; }
  function text(s, n) { return String(s == null ? '' : s).replace(/\s+$/g, '').replace(/^\s+/, '').slice(0, n); }
  function oneLine(s, n) { return text(String(s == null ? '' : s).replace(/\s+/g, ' '), n); }
  function firstName(p) { return oneLine((p && (p.preferredName || p.firstName)) || '', MAX.name); }

  /* ---------- where an item stands ---------- */
  function ended(x, now) { return x.status === 'live' && (+x.endsAt || 0) <= now; }
  function isLive(x, now) { return !!x && x.status === 'live' && (+x.endsAt || 0) > now; }
  /** Sorted / sold within the last day: still on the board with its stamp. */
  function stamped(x, now) { return !!x && x.status === 'done' && now - (+x.doneAt || 0) < STAMP * DAY; }
  function mine(x, who) { return !!x && !!who && (who.ids || [who.id]).indexOf(x.personId) >= 0; }
  /** What one person sees on the board / in the marketplace: everything live, the stamped ones, and their own (any status). */
  function shown(items, who, now) {
    return (items || []).filter(function (x) { return isLive(x, now) || stamped(x, now) || (mine(x, who) && x.status !== 'done'); })
      .sort(function (a, b) { return order(b) - order(a); });
  }
  function order(x) { return +x.decidedAt || Date.parse(String(x.createdAt || '').replace(' ', 'T')) || 0; }
  /** Waiting for a keeper, oldest first (the keepers' "Waiting for approval"). */
  function waiting(items) { return (items || []).filter(function (x) { return x.status === 'waiting'; }).sort(function (a, b) { return order(a) - order(b); }); }
  /** Live ones someone reported, most reports first. */
  function reported(items, now) { return (items || []).filter(function (x) { return isLive(x, now) && (x.reports || []).length; }).sort(function (a, b) { return b.reports.length - a.reports.length; }); }
  /** The latest few live ones (Home and Me): newest first. */
  function latest(items, now, n) { return (items || []).filter(function (x) { return isLive(x, now); }).sort(function (a, b) { return order(b) - order(a); }).slice(0, n || 3); }
  /** My own ones that need me: asked for a change, or ending within a few days (and still renewable). */
  function needsMe(items, who, now) {
    return (items || []).filter(function (x) { return mine(x, who) && (x.status === 'change' || ending(x, now)); });
  }
  function ending(x, now) { return isLive(x, now) && (+x.endsAt - now) < REMIND * DAY && (+x.renews || 0) < RENEWS; }
  function daysLeft(x, now) { return Math.max(0, Math.ceil(((+x.endsAt || 0) - now) / DAY)); }
  /** The ids to delete now: ended, sorted / sold or declined more than 30 days ago (POPIA: keep no longer than needed). */
  function tidy(items, now) {
    return (items || []).filter(function (x) {
      var since = x.status === 'live' ? +x.endsAt : x.status === 'done' ? +x.doneAt : x.status === 'declined' ? +x.decidedAt : 0;
      return !!since && since <= now && now - since > KEEP * DAY;
    }).map(function (x) { return x.id; });
  }

  /* ---------- making and changing one ---------- */
  /**
   * A new notice or listing, waiting for a keeper; or { error }: 'title', 'price', 'rules' (the Marketplace rules weren't accepted).
   * f = what they typed; me = the person posting.
   */
  function make(part, f, me, now) {
    f = f || {};
    var x = { kind: kind(part, f.kind)[0], title: oneLine(f.title, MAX.title), body: text(f.body, part === 'market' ? MAX.marketBody : MAX.body),
      personId: me.id, name: firstName(me), status: 'waiting', endsAt: now + DAYS * DAY, renews: 0, note: '', by: '', decidedAt: 0, doneAt: 0, reports: [] };
    if (!x.title) return { error: 'title' };
    if (part === 'market') {
      if (!f.rulesOk) return { error: 'rules' };
      var price = x.kind === 'free' ? 0 : parsePrice(f.price);
      if (x.kind === 'sale' && !(price > 0) && !f.offer) return { error: 'price' };
      x.price = price >= 0 ? price : 0; x.offer = x.kind === 'sale' && !!f.offer;
      x.condition = (CONDITIONS.filter(function (c) { return c[0] === f.condition; })[0] || CONDITIONS[2])[0];
      x.category = (CATEGORIES.filter(function (c) { return c[0] === f.category; })[0] || CATEGORIES[CATEGORIES.length - 1])[0];
      x.area = oneLine(f.area, MAX.area); x.photos = Math.max(0, Math.min(MAX.photos, +f.photos || 0)); x.thumb = String(f.thumb || '');
    } else x.phone = oneLine(f.phone, MAX.phone).replace(/[^0-9+ ()-]/g, '');
    return x;
  }
  /** Their own one, changed: back to the keepers (unless only the price went down). */
  function edit(part, old, f, me, now) {
    var x = make(part, Object.assign({ rulesOk: true }, f), me, now); if (x.error) return x;
    var keep = { id: old.id, createdAt: old.createdAt, renews: +old.renews || 0, reports: [] };
    if (part === 'market' && old.status === 'live' && onlyCheaper(old, x)) return Object.assign({}, old, { price: x.price });
    return Object.assign(x, keep, { endsAt: old.status === 'live' ? +old.endsAt : x.endsAt });
  }
  function onlyCheaper(old, x) {
    var same = ['kind', 'title', 'body', 'offer', 'condition', 'category', 'area', 'photos', 'thumb'].every(function (k) { return JSON.stringify(old[k]) === JSON.stringify(x[k]); });
    return same && x.price < (+old.price || 0);
  }
  /** "R 1 250", "1250", "1,250.00" → 1250 (–1 when it isn't a price). */
  function parsePrice(s) {
    var t = String(s == null ? '' : s).replace(/[^0-9.,]/g, '');
    if (!t) return -1;
    if (/,\d{1,2}$/.test(t) && t.indexOf('.') < 0) t = t.replace(',', '.');
    t = t.replace(/,/g, '');
    var n = parseFloat(t); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : -1;
  }
  /**
   * A keeper's decision: 'approve' (live for 30 days from now), 'change' (with a note: what to change) or 'decline' (with a
   * kind reason). Returns the item as it should be saved, or { error: 'note' } when a note is needed.
   */
  function decide(x, action, note, keeper, now) {
    note = text(note, MAX.note);
    if ((action === 'change' || action === 'decline') && !note) return { error: 'note' };
    var y = Object.assign({}, x, { note: action === 'approve' ? '' : note, by: firstName(keeper) || 'Keeper', decidedAt: now, reports: [] });
    if (action === 'approve') { y.status = 'live'; y.endsAt = now + DAYS * DAY; }
    else y.status = action === 'change' ? 'change' : 'declined';
    return y;
  }
  /** Sorted, thank you! / Sold / Found: a stamp across it for a day, then gone. */
  function done(x, now) { return Object.assign({}, x, { status: 'done', doneAt: now }); }
  /** Another 30 days (twice at most). null when it can't be renewed. */
  function renew(x, now) {
    if (!isLive(x, now) || (+x.renews || 0) >= RENEWS) return null;
    return Object.assign({}, x, { endsAt: now + DAYS * DAY, renews: (+x.renews || 0) + 1 });
  }
  /** Someone reports it to the keepers (once each). null when they already did, or it isn't live. */
  function report(x, pid, now) {
    if (!isLive(x, now) || !pid || (x.reports || []).indexOf(pid) >= 0) return null;
    return Object.assign({}, x, { reports: (x.reports || []).concat([pid]).slice(0, 50) });
  }
  /** A sticky note's slant, the same every time for the same notice: −3° … +3°. */
  function tilt(id) {
    var h = 0, s = String(id || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 13 - 6) / 2;
  }

  /* ---------- messages (Messages, js/messages.js: kind 'direct', about 'board' | 'market') ---------- */
  /**
   * A private message to the person who posted it: from someone who can help or is interested, or from a keeper about their
   * decision. Returns a message ready to save, or { error }.
   */
  function message(part, x, from, title, body) {
    body = text(body, 4000);
    if (!x || !from || !from.id || x.personId === from.id) return { error: 'nobody' };
    if (!body) return { error: 'empty' };
    return { kind: 'direct', groupId: '', audience: oneLine(x.name, 100), some: false, replyTo: '', about: part, aboutId: x.id,
      title: oneLine(title, 120), body: body, fromId: from.id, fromName: oneLine(((from.preferredName || from.firstName || '') + ' ' + (from.lastName || '')), 100),
      to: [x.personId], deliveredBy: [from.id], readBy: [from.id] };
  }

  return { DAY: DAY, DAYS: DAYS, KEEP: KEEP, RENEWS: RENEWS, REMIND: REMIND, MAX: MAX, PART_IDS: PART_IDS,
    BOARD_KINDS: BOARD_KINDS, MARKET_KINDS: MARKET_KINDS, CATEGORIES: CATEGORIES, CONDITIONS: CONDITIONS, kindsOf: kindsOf, kind: kind,
    isLive: isLive, ended: ended, stamped: stamped, mine: mine, shown: shown, waiting: waiting, reported: reported, latest: latest,
    needsMe: needsMe, ending: ending, daysLeft: daysLeft, tidy: tidy,
    make: make, edit: edit, parsePrice: parsePrice, decide: decide, done: done, renew: renew, report: report, tilt: tilt, message: message, firstName: firstName };
})();
if (typeof module !== 'undefined') module.exports = Community;
