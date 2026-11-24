/*
 * Church & Trellis – messages inside the app (Messages page; js/mod-messages.js). A message goes to everyone in one audience:
 *   care     a care group (its carers and members)               – sent by Administrators, Pastors or the group's carers
 *   group    a message group, e.g. Worship team leaders (msgGroups) – sent by Administrators, Pastors or the group's leaders
 *   leaders  a leadership group, e.g. the Church Council (leaderBodies) – sent by Administrators, Pastors or anyone on it
 *   staff    everyone on the staff (people with staff details)   – Administrators and Pastors only
 *   partners every Church Partner (adults)                       – Administrators and Pastors only
 *   people   people chosen one by one from a checklist           – Administrators and Pastors only
 *   office   the church office channel                            – any signed-in person; Administrators and Pastors receive it
 *   roster   about serving turns (js/mod-rosters.js; never chosen on the Write page): roster: 'ask' (you're on the roster) or
 *            'remind' (please reply), from a roster coordinator or Administrator to one volunteer; 'declined' (someone can't
 *            make it), from the volunteer to the roster team (settings.rosterTeam: Administrators, Roster coordinators and
 *            the people chosen under Settings -> Church Services). turns: the assignment ids it is about, so the inbox shows
 *            them in the reader's language with Accept / Can't make it.
 *   event    about an event (js/events.js; never chosen on the Write page): about 'remind' – a reminder 3 days or 1 day before,
 *            written by the person's own Church & Trellis into their own inbox (from and to themselves; it counts as a new
 *            message all the same, and isn't listed as sent); about 'event' – the organisers to everyone coming.
 *   direct   one person: a reply to a message (replyTo: its id) goes back to its sender only; or a new message to a
 *            minister (a Pastor) or to a leader of one of your own Midweek Groups (groupId: that group)
 * Attendees (Basic access, not Church Partners or staff – Hub.attendee()) only do what Settings → Attendees allows
 * (settings.attendeeCan, default ATTENDEE_CAN): 'write' – the Office, the ministers and their Midweek Group leaders;
 * 'reply' – reply to any message sent to them. Without 'reply' they may still reply to a minister when they may write.
 * Anyone sending to a group may also tick only some of its people (some: true); carers and leaders still only reach
 * people in their own group.
 * messages/{id} = { kind, groupId, audience (its name when sent; one chosen person's name), some, replyTo, roster, turns, about, aboutId, showFrom, title, body, fromId, fromName, to: [personIds], deliveredBy: [personIds], readBy: [personIds] }
 * msgGroups/{id} = { name, memberIds, leaderIds, names: { personId: name } } – leaders are members too; names so leaders who
 *   aren't staff can tick people when writing.
 * The list of people (to) is worked out when the message is sent, so someone who joins a group later doesn't see older
 * messages, and the database rules can check who may read each one. Tested with node: tests/messages.test.js.
 * POPIA: purpose = keeping in touch with the people the church cares for; basis = the church's legitimate interest
 * (the person is in that group or on the staff); access = the people it was sent to, its sender, Administrators and Pastors.
 */
var Msg = (function () {
  'use strict';
  var KINDS = ['office', 'care', 'life', 'group', 'leaders', 'staff', 'partners', 'people', 'direct', 'roster', 'event'];
  var ROSTER_NOTES = ['ask', 'remind', 'declined', 'off', 'awayask', 'cover', 'covered', 'cancelled', 'back'], MAX_TURNS = 100;
  var MAX_BODY = 4000, MAX_TITLE = 120;
  /** What attendees may do (Settings → Attendees): the choices and the default are kept with the rest of "who can see what"
   *  in js/access.js. */
  var A = typeof Access !== 'undefined' ? Access : require('./access.js');
  var ATTENDEE_CAN = A.ATTENDEE_CAN, ATTENDEE_OPTIONS = A.ATTENDEE_OPTIONS, attendeeCan = A.attendeeCan;
  /** Church Partner access: Basic access plus being a Church Partner (or on the staff) – given by the category, automatically. */
  function partnerLevel(p) { return !!p && (p.category === 'Church Partner' || p.category === 'Staff'); }
  /** May this person write new messages / reply? who = { manager, attendee, can: [what attendees may do] } */
  function mayWrite(who) { return !who.attendee || (who.can || []).indexOf('write') >= 0; }
  function mayReplyAll(who) { return !who.attendee || (who.can || []).indexOf('reply') >= 0; }
  function isMinister(pid, d) { return ((d || {}).ministers || []).some(function (x) { return x.id === pid; }); }

  function alive(p) {
    return !!p && p.active !== false && p.familyRole !== 'child' && p.category !== 'Deceased' && !p.binnedAt && !p.mergedInto && !p.deletedAt && p.firstName !== 'Deleted';
  }
  function uniq(ids) { var seen = {}; return (ids || []).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function nameOf(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }
  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; }
  function leads(g, pid) { return !!g && (g.leaderIds || []).indexOf(pid) >= 0; }
  function onBody(b, pid) { return !!b && (b.memberIds || []).indexOf(pid) >= 0; }

  /** Who a message to this audience goes to (person ids). d = { people, careGroups, lifeGroups, msgGroups, leaderBodies }. "Chosen people": everyone
   *  who may be chosen (adults still in the church). */
  function recipients(kind, groupId, d) {
    d = d || {};
    if (kind === 'office' || kind === 'direct') return [];
    if (kind === 'staff') return (d.people || []).filter(function (p) { return alive(p) && !!p.staff; }).map(function (p) { return p.id; });
    if (kind === 'people') return (d.people || []).filter(alive).map(function (p) { return p.id; });
    if (kind === 'partners') return (d.people || []).filter(function (p) { return alive(p) && p.category === 'Church Partner'; }).map(function (p) { return p.id; });
    if (kind === 'leaders') { var b = byId(d.leaderBodies, groupId); return b ? uniq(b.memberIds || []) : []; }
    var g = byId(kind === 'care' ? d.careGroups : kind === 'life' ? d.lifeGroups : kind === 'group' ? d.msgGroups : [], groupId);
    return g ? uniq((g.memberIds || []).concat(g.leaderIds || [])) : [];
  }

  /**
   * The audiences someone may send to, in the order they are offered: [{ kind, groupId, name, personId }].
   * who = { id, manager (Administrator or Pastor), attendee, can }; names of care groups and message groups as stored.
   * d.ministers = [{ id, name }] (Settings keeps the Pastors' names for everyone: settings.ministers).
   */
  function audiences(who, d) {
    d = d || {}; var out = [], name = function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); };
    if (who.manager || mayWrite(who)) out.push({ kind: 'office', groupId: '', name: 'Office' });
    if (who.manager) { out.push({ kind: 'people', groupId: '', name: 'Chosen people' }); out.push({ kind: 'staff', groupId: '', name: 'Staff' }); out.push({ kind: 'partners', groupId: '', name: 'Church Partners' }); }
    else if (mayWrite(who)) {
      (d.ministers || []).slice().sort(name).forEach(function (x) { if (x.id && x.id !== who.id) out.push({ kind: 'direct', groupId: '', personId: x.id, name: x.name || '' }); });
      // the leaders of their own Midweek Groups (those they don't lead themselves)
      (d.lifeGroups || []).slice().sort(name).forEach(function (g) {
        if ((g.memberIds || []).indexOf(who.id) < 0 || leads(g, who.id)) return;
        (g.leaderIds || []).forEach(function (l) { if (l !== who.id && !isMinister(l, d)) out.push({ kind: 'direct', groupId: g.id, personId: l, name: (g.names || {})[l] || '', group: g.name || '' }); });
      });
    }
    (d.careGroups || []).slice().sort(name).forEach(function (g) { if (who.manager || leads(g, who.id)) out.push({ kind: 'care', groupId: g.id, name: g.name }); });
    (d.lifeGroups || []).slice().sort(name).forEach(function (g) { if (who.manager || leads(g, who.id)) out.push({ kind: 'life', groupId: g.id, name: g.name }); });
    (d.msgGroups || []).slice().sort(name).forEach(function (g) { if (who.manager || leads(g, who.id)) out.push({ kind: 'group', groupId: g.id, name: g.name }); });
    (d.leaderBodies || []).slice().sort(name).forEach(function (b) { if (who.manager || onBody(b, who.id)) out.push({ kind: 'leaders', groupId: b.id, name: b.name }); });
    return out;
  }
  /** May this person send to this audience? (The database rules check the same.) personId: for a direct message. */
  function maySend(who, kind, groupId, d, personId) {
    if (KINDS.indexOf(kind) < 0 || kind === 'roster') return false;   // roster messages are sent by Rosters, not written
    if (kind === 'office') return !!who.manager || mayWrite(who);
    if (who.manager) return true;
    if (kind === 'direct') return audiences(who, d).some(function (a) { return a.kind === 'direct' && a.personId === personId && (a.groupId || '') === (groupId || ''); });
    if (kind === 'care') return leads(byId((d || {}).careGroups, groupId), who.id);
    if (kind === 'life') return leads(byId((d || {}).lifeGroups, groupId), who.id);
    if (kind === 'group') return leads(byId((d || {}).msgGroups, groupId), who.id);
    if (kind === 'leaders') return onBody(byId((d || {}).leaderBodies, groupId), who.id);
    return false;
  }
  /** May this person reply to this message (privately, to its sender)? Not to their own, not to one that has no sender;
   *  it must have come to them (or, for Administrators and Pastors, to the Office). Attendees: only with Settings' 'reply',
   *  or to a minister when they may write. */
  function mayReply(m, who, d) {
    if (!m || !m.fromId || m.fromId === who.id) return false;
    var got = (m.to || []).indexOf(who.id) >= 0 || (!!who.manager && m.kind === 'office');
    if (!got) return false;
    if (who.manager || mayReplyAll(who)) return true;
    return mayWrite(who) && isMinister(m.fromId, d);
  }
  /** A reply, ready to save (or { error }): privately to the original's sender, "Re: …" as its subject. */
  function reply(orig, body, from) {
    var t = String(orig.title || '').trim(), title = !t ? '' : /^re:/i.test(t) ? t : 'Re: ' + t;
    var m = make({ kind: 'direct', groupId: '', personId: orig.fromId, name: orig.fromName || '' }, title, body, from, {});
    if (!m.error) m.replyTo = orig.id || '';
    return m;
  }

  /** A new message, ready to save; or { error } saying what is missing. a = { kind, groupId, name }, from = person.
   *  chosen = the ids ticked on the checklist (needed for "Chosen people"; for a group, only those of its people get it). */
  function make(a, title, body, from, d, chosen) {
    title = String(title || '').trim(); body = String(body || '').trim();
    if (!body) return { error: 'empty' };
    if (body.length > MAX_BODY) return { error: 'long' };
    var all = recipients(a.kind, a.groupId, d), to = all, some = false;
    if (a.kind === 'office') to = [];
    if (a.kind === 'direct') { if (!a.personId || a.personId === from.id) return { error: 'nobody' }; to = [a.personId]; }
    else if (a.kind !== 'office' && (a.kind === 'people' || chosen)) {
      var want = {}; (chosen || []).forEach(function (id) { want[id] = 1; });
      to = all.filter(function (id) { return want[id]; });
      some = a.kind !== 'people' && to.length < all.length;
      if (!to.length) return { error: all.length ? 'none' : 'nobody' };
    }
    if (a.kind !== 'office' && !to.length) return { error: 'nobody' };
    var m = { kind: a.kind, groupId: a.groupId || '', audience: a.name || '', title: title.slice(0, MAX_TITLE), body: body,
      fromId: from.id, fromName: nameOf(from), to: to, deliveredBy: [from.id], readBy: [from.id] };
    if (a.kind === 'people') m.audience = to.length === 1 ? nameOf(byId(d.people, to[0]) || {}) : '';
    if (some) m.some = true;
    if (a.kind === 'direct') { m.audience = a.name || ''; if (a.replyTo) m.replyTo = a.replyTo; }
    return m;
  }

  /**
   * A message about serving turns (kind 'roster'), ready to save; or { error }. note: 'ask' | 'remind' | 'declined' | 'off' (taken off a turn)
   * | 'awayask' (are you away? turns = [the awayAsks id]) | 'cover' (can you take my place? and the answer; turns = [the turn]) | 'covered' (to the roster team)
   * | 'cancelled' (the service you were on is cancelled) | 'back' (it is back on) – turns = the person's turns at that service, the words are made in the reader's language;
   * to: who gets it (the sender is left out); turns: assignment ids; title and body in the sender's language (the inbox
   * shows the turns in the reader's own).
   */
  function rosterNote(note, to, turns, from, title, body) {
    if (ROSTER_NOTES.indexOf(note) < 0) return { error: 'kind' };
    to = uniq(to).filter(function (x) { return x !== from.id; }); turns = uniq(turns).slice(0, MAX_TURNS);
    if (!to.length) return { error: 'nobody' };
    if (!turns.length) return { error: 'empty' };
    body = String(body || '').trim().slice(0, MAX_BODY); if (!body) return { error: 'empty' };
    return { kind: 'roster', groupId: '', audience: '', roster: note, turns: turns, title: String(title || '').trim().slice(0, MAX_TITLE), body: body,
      fromId: from.id, fromName: nameOf(from), to: to, deliveredBy: [from.id], readBy: [from.id] };
  }

  /**
   * A note to the church office (Administrators and Pastors) that Church & Trellis sends for someone, e.g. about: 'partnerApp' –
   * they applied to become a Church Partner. Sent even by attendees who may not write to the Office themselves.
   */
  function officeNotice(about, from, title, body) {
    if (NOTICES.indexOf(about) < 0 || !from || !from.id) return { error: 'kind' };
    return { kind: 'office', groupId: '', audience: '', about: about, title: String(title || '').slice(0, MAX_TITLE), body: String(body || '').trim().slice(0, MAX_BODY),
      fromId: from.id, fromName: nameOf(from), to: [], deliveredBy: [from.id], readBy: [from.id] };
  }
  var NOTICES = ['partnerApp'];

  function newestFirst(a, b) { return String(a.createdAt || '') < String(b.createdAt || '') ? 1 : String(a.createdAt || '') > String(b.createdAt || '') ? -1 : 0; }
  /** Messages sent to this person, newest first; managers also receive the Office channel. */
  /** A message that waits for its day (showFrom: Midweek Group links sent "on the day") hasn't arrived yet – except for its sender. */
  function arrived(m, pid, now) { return !m.showFrom || m.fromId === pid || m.showFrom <= (now === undefined ? Date.now() : now); }
  function inbox(messages, pid, office, now) { return (messages || []).filter(function (m) { return ((m.to || []).indexOf(pid) >= 0 || (office && m.kind === 'office' && m.fromId !== pid)) && arrived(m, pid, now); }).sort(newestFirst); }
  /** Messages this person sent (or, for Administrators and Pastors, everyone's: all = true), newest first. */
  function sent(messages, pid, all) { return (messages || []).filter(function (m) { return (all || m.fromId === pid) && !selfNote(m); }).sort(newestFirst); }
  /** An event reminder, written by a person's own Church & Trellis into their own inbox (js/events.js reminder). */
  function selfNote(m) { return !!m && m.kind === 'event' && m.about === 'remind'; }
  function isUnread(m, pid, office, now) { return ((m.to || []).indexOf(pid) >= 0 || (office && m.kind === 'office')) && (m.fromId !== pid || selfNote(m)) && (m.readBy || []).indexOf(pid) < 0 && arrived(m, pid, now); }
  function unread(messages, pid, office, now) { return (messages || []).filter(function (m) { return isUnread(m, pid, office, now); }); }
  /** Ticks, as on WhatsApp: 'sent' (✓ grey) – 'delivered' (✓✓ grey) once it has reached EVERYONE it went to – 'some'
   *  (✓✓, the first blue) once it has reached everyone and some have read it – 'read' (✓✓ blue) once everyone has opened it. people (optional): only those who can sign in count, as the others can never open it.
   *  A message to the Office (no list of people): delivered / read as soon as anyone in the office has it / opens it. */
  function status(m, people) {
    var to = uniq(m.to || []).filter(function (x) { return x !== m.fromId; });
    if (people) to = inApp(to, people);
    var has = function (list, x) { return (list || []).indexOf(x) >= 0; };
    var got = function (x) { return has(m.deliveredBy, x) || has(m.readBy, x); };
    if (!to.length) {
      var others = function (list) { return (list || []).some(function (id) { return id !== m.fromId; }); };
      return others(m.readBy) ? 'read' : others(m.deliveredBy) ? 'delivered' : 'sent';
    }
    var read = function (x) { return has(m.readBy, x); };
    if (to.every(read)) return 'read';
    if (!to.every(got)) return 'sent';
    return to.some(read) ? 'some' : 'delivered';
  }
  /** How the ticks are drawn: 'ticks' (as on WhatsApp), 'post' (envelopes), 'circle' (fills up as people read, as on
   *  DingTalk in China) or 'words' (as on LINE in Japan and QQ in China). Each person may choose (chosen); otherwise what
   *  people in the church's country are used to. */
  var MARK_STYLES = ['ticks', 'post', 'circle', 'words'];
  var MARKS_BY_COUNTRY = { CN: 'circle', HK: 'circle', MO: 'circle', TW: 'words', JP: 'words', KR: 'words', TH: 'words' };
  function markStyle(country, chosen) {
    if (MARK_STYLES.indexOf(chosen) >= 0) return chosen;
    return MARKS_BY_COUNTRY[String(country || '').toUpperCase()] || 'ticks';
  }
  /** For a sent message's details: how many it went to, have it on their device, and have read it (the sender doesn't count). */
  function counts(m, people) {
    var to = uniq(m.to || []).filter(function (x) { return x !== m.fromId; });
    if (people) to = inApp(to, people);
    var read = to.filter(function (x) { return (m.readBy || []).indexOf(x) >= 0; });
    var got = to.filter(function (x) { return (m.deliveredBy || []).indexOf(x) >= 0 || read.indexOf(x) >= 0; });
    return { of: to.length, delivered: got.length, read: read.length, waiting: to.filter(function (x) { return got.indexOf(x) < 0; }) };
  }
  /** How many of the people it went to have opened it (the sender doesn't count). */
  function seen(m) {
    var to = (m.to || []).filter(function (x) { return x !== m.fromId; });
    return { of: to.length, n: to.filter(function (x) { return (m.readBy || []).indexOf(x) >= 0; }).length };
  }
  /** Who has read it and who hasn't (the sender doesn't count): { read: [ids], unread: [ids] }. */
  function readers(m) {
    var to = uniq(m.to || []).filter(function (x) { return x !== m.fromId; }), r = m.readBy || [];
    return { read: to.filter(function (x) { return r.indexOf(x) >= 0; }), unread: to.filter(function (x) { return r.indexOf(x) < 0; }) };
  }
  /** Of the people a message goes to, those who can open it: they can sign in to Church & Trellis (Administrators and Pastors know). */
  function inApp(ids, people) {
    return (ids || []).filter(function (id) { var p = byId(people, id); return !!p && !!p.email && !!p.appRole && p.appRole !== 'none'; });
  }
  function mayDelete(m, who) { return !!who.manager || m.fromId === who.id; }

  /* ---------- message groups ---------- */
  /** Add someone to a group, as a leader or not (a copy), or null when nothing changes. name: their name, kept for leaders. */
  function placeIn(g, pid, leader, name) {
    var x = JSON.parse(JSON.stringify(g)); x.memberIds = x.memberIds || []; x.leaderIds = x.leaderIds || [];
    if (x.memberIds.indexOf(pid) < 0) x.memberIds.push(pid);
    if (name) { x.names = x.names || {}; x.names[pid] = name; }
    var isL = x.leaderIds.indexOf(pid) >= 0;
    if (leader && !isL) x.leaderIds.push(pid);
    if (!leader && isL) x.leaderIds = x.leaderIds.filter(function (y) { return y !== pid; });
    return JSON.stringify(x) === JSON.stringify(g) ? null : x;
  }
  function takeOut(g, pid) {
    var x = JSON.parse(JSON.stringify(g));
    x.memberIds = (x.memberIds || []).filter(function (y) { return y !== pid; }); x.leaderIds = (x.leaderIds || []).filter(function (y) { return y !== pid; });
    if (x.names) delete x.names[pid];
    return JSON.stringify(x) === JSON.stringify(g) ? null : x;
  }

  return { arrived: arrived, selfNote: selfNote, officeNotice: officeNotice, ATTENDEE_CAN: ATTENDEE_CAN, ATTENDEE_OPTIONS: ATTENDEE_OPTIONS, attendeeCan: attendeeCan, partnerLevel: partnerLevel, mayWrite: mayWrite, mayReply: mayReply, reply: reply, isMinister: isMinister,
    counts: counts, KINDS: KINDS, rosterNote: rosterNote, MAX_TURNS: MAX_TURNS, MAX_BODY: MAX_BODY, MAX_TITLE: MAX_TITLE, recipients: recipients, audiences: audiences, maySend: maySend, make: make,
    inbox: inbox, sent: sent, isUnread: isUnread, unread: unread, status: status, MARK_STYLES: MARK_STYLES, markStyle: markStyle, seen: seen, readers: readers, inApp: inApp, mayDelete: mayDelete, nameOf: nameOf, placeIn: placeIn, takeOut: takeOut, leads: leads };
})();
if (typeof module !== 'undefined') module.exports = Msg;
