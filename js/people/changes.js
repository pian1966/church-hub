/* Church Hub – People: changes to family details that people ask for themselves (Me → My details), checked by an Administrator.
 * Collection detailChanges, one request per person at a time:
 *   { personId, maritalStatus, anniversary, spouse, children, note, status: waiting|checked|declined, reply }
 * waiting  – the person asked; nothing on their record has changed yet.
 * checked  – an Administrator made the changes to marital status and anniversary, and still has to add or link
 *            the spouse and children in the household (People → Households). "Done" removes the request.
 * declined – the Administrator didn't make the changes, with a short reply; the person presses OK to clear it. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var MARITAL = P.MARITAL, WEDDING = P.WEDDING;
  function keyDate() { return P.keyDate.apply(this, arguments); }

  function canCheck() { return H.can('people.changes'); }
  function mine() { var u = H.user(); return u ? S.find('detailChanges', function (c) { return c.personId === u.id; })[0] || null : null; }
  function open() { return canCheck() ? S.find('detailChanges', function (c) { return c.status === 'waiting' || c.status === 'checked'; }) : []; }
  function lines(s) { return String(s || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /** Me → My details: what they asked for and where it stands, under "Kept by the church office". */
  function mePanel() {
    var c = mine(), p = S.get('people', (H.user() || {}).id);
    if (p && p.familyRole === 'child') return '';
    if (!c) return '<div class="btns" style="margin-top:12px"><button class="btn" data-act="people:askchange">' + T('Ask to change these') + '</button></div>';
    var asked = '<small>' + esc(summary(c)) + '</small>';
    if (c.status === 'declined') return '<div class="note" style="margin-top:12px">' + asked + '<p style="margin:6px 0">' + '<span class="tag grey">' + T('Not changed') + '</span>' +
      (c.reply ? ' ' + esc(T('The church office says: “{text}”', { text: c.reply })) : '') + '</p><button class="btn small" data-act="people:withdrawchange">' + T('OK') + '</button></div>';
    if (c.status === 'checked') return '<div class="note" style="margin-top:12px">' + asked + '<p style="margin:6px 0 0"><span class="tag ok">' + T('Checked') + '</span> ' + T('The church office has made the changes and is adding your family to your household.') + '</p></div>';
    return '<div class="note warn" style="margin-top:12px">' + asked + '<p style="margin:6px 0"><span class="tag warn">' + T('Waiting for the church office to check') + '</span></p><button class="btn small" data-act="people:withdrawchange">' + T('Withdraw') + '</button></div>';
  }
  /** "Marital status: Married · Wedding anniversary: 17 Apr 2010 · Spouse or partner: Clare · Children: 2" */
  function summary(c) {
    var out = [];
    if (c.maritalStatus) out.push(T('Marital status') + ': ' + T(c.maritalStatus));
    if (c.anniversary) out.push(T('Wedding anniversary') + ': ' + H.fmt(c.anniversary, true));
    if (c.spouse) out.push(T('Spouse or partner') + ': ' + c.spouse);
    if (c.children) out.push(T('Children') + ': ' + lines(c.children).length);
    return out.join(' · ');
  }

  function askDialog() {
    var p = S.get('people', H.user().id) || H.user(), wed = keyDate(p, WEDDING);
    H.modal(H.dialogHead(T('Ask to change these'), T('The church office checks what you send before your details change.')) + '<div class="dlg-body">' +
      '<label class="field">' + T('Marital status') + '<select id="dc-ms"><option value="">' + T('No change') + '</option>' +
        MARITAL.filter(function (m) { return m !== 'Not known'; }).map(function (m) { return '<option value="' + esc(m) + '">' + esc(T(m)) + (m === p.maritalStatus ? ' ' + T('(now)') : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Wedding anniversary') + '<input id="dc-wed" type="date" max="' + H.today() + '" value="' + esc(wed) + '"></label>' +
      '<label class="field">' + T('Spouse or partner') + '<input id="dc-sp" maxlength="80" placeholder="' + esc(T('Their full name')) + '"></label>' +
      '<label class="field">' + T('Your children') + '<textarea id="dc-ch" rows="3" maxlength="600" placeholder="' + esc(T('One child per line, with their birthday, e.g. Sam Jacobs, 3 May 2015')) + '"></textarea></label>' +
      '<label class="field">' + T('Anything else the church office should know?') + '<textarea id="dc-note" rows="2" maxlength="300"></textarea></label>' +
      '<p id="dc-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:sendchange">' + T('Send to the church office') + '</button></div>', T('Ask to change these'));
  }

  /** People → Changes to check (Administrators). */
  function renderChanges() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canCheck()) return back + '<p class="empty">' + T('This is for Administrators.') + '</p>';
    var list = open().sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
    return back + '<div class="page-head"><div><h1>' + T('Changes people asked for') + '</h1><p class="lead">' + T('Family details people sent from their own page. Nothing on their record changes until you check it.') + '</p></div></div>' +
      (list.length ? list.map(card).join('') : '<p class="empty">' + T('Nothing to check.') + '</p>');
  }
  function card(c) {
    var p = S.get('people', c.personId);
    if (!p) return '';
    var now = keyDate(p, WEDDING), row = function (label, was, want) {
      return '<dt>' + esc(label) + '</dt><dd>' + esc(want) + (was !== want ? ' <span class="muted small">' + esc(T('now: {what}', { what: was || T('Not recorded') })) + '</span>' : '') + '</dd>';
    };
    var dl = (c.maritalStatus ? row(T('Marital status'), p.maritalStatus ? T(p.maritalStatus) : '', T(c.maritalStatus)) : '') +
      (c.anniversary ? row(T('Wedding anniversary'), now ? H.fmt(now, true) : '', H.fmt(c.anniversary, true)) : '') +
      (c.spouse ? '<dt>' + T('Spouse or partner') + '</dt><dd>' + esc(c.spouse) + '</dd>' : '') +
      (c.children ? '<dt>' + T('Children') + '</dt><dd>' + lines(c.children).map(esc).join('<br>') + '</dd>' : '') +
      (c.note ? '<dt>' + T('Note') + '</dt><dd>' + esc(c.note) + '</dd>' : '');
    var btns = c.status === 'checked'
      ? '<p class="hint" style="margin:0 0 8px">' + T('Marital status and anniversary are saved. Add or link the spouse and children in their household, then press Done.') + '</p>' +
        '<div class="btns"><a class="btn small" href="#/people/p/' + p.id + '">' + T('Open') + '</a><button class="btn small primary" data-act="people:donechange" data-id="' + c.id + '">' + T('Done') + '</button></div>'
      : '<div class="btns"><button class="btn small primary" data-act="people:applychange" data-id="' + c.id + '">' + T('Yes, make these changes') + '</button>' +
        '<button class="btn small" data-act="people:declinechange" data-id="' + c.id + '">' + T('Don’t change') + '</button><a class="btn small" href="#/people/p/' + p.id + '">' + T('Open') + '</a></div>';
    return '<section class="panel" style="margin-bottom:12px"><div class="row" style="gap:10px">' + H.avatar(p, 36) + '<h2 class="grow" style="margin:0;font-size:1rem"><a href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a></h2>' +
      (c.status === 'checked' ? '<span class="tag ok">' + T('Checked') + '</span>' : '<span class="tag warn">' + T('To check') + '</span>') + '</div>' +
      '<dl class="kv" style="margin:10px 0">' + dl + '</dl>' + btns + '</section>';
  }

  Object.assign(P.actions, {
    askchange: function () { askDialog(); },
    sendchange: function () {
      var g = function (id) { return document.getElementById(id).value.trim(); }, err = document.getElementById('dc-err');
      var p = S.get('people', H.user().id) || H.user(), wed = g('dc-wed');
      var c = { personId: p.id, maritalStatus: g('dc-ms'), anniversary: wed && wed !== keyDate(p, WEDDING) ? wed : '', spouse: g('dc-sp').slice(0, 80), children: g('dc-ch').slice(0, 600), note: g('dc-note').slice(0, 300), status: 'waiting' };
      if (c.maritalStatus === p.maritalStatus) c.maritalStatus = '';
      if (!c.maritalStatus && !c.anniversary && !c.spouse && !c.children && !c.note) { err.textContent = T('Nothing has changed yet. Fill in what should change, or Cancel.'); err.hidden = false; return; }
      S.put('detailChanges', c, 'Asked the church office to change their family details');
      H.closeModal(); H.render(); H.toast(T('Sent – the church office will check it'));
    },
    withdrawchange: function () { var c = mine(); if (c) S.remove('detailChanges', c.id); H.render(); },
    applychange: function (el) {
      var c = S.get('detailChanges', el.dataset.id); if (!c || !canCheck()) return;
      var p = JSON.parse(JSON.stringify(S.get('people', c.personId))), what = [];
      if (c.maritalStatus) { p.maritalStatus = c.maritalStatus; what.push('marital status ' + c.maritalStatus); }
      if (c.anniversary) { p.keyDates = (p.keyDates || []).filter(function (k) { return !WEDDING.test(k.label || ''); }).concat([{ label: 'Wedding anniversary', date: c.anniversary }]); what.push('wedding anniversary'); }
      if (what.length) S.put('people', p, 'Checked a change they asked for: ' + what.join(', ') + ' for ' + H.name(p));
      if (c.spouse || c.children) { c = JSON.parse(JSON.stringify(c)); c.status = 'checked'; S.put('detailChanges', c); H.render(); H.toast(T('Saved')); }
      else { S.remove('detailChanges', c.id, 'Checked a change ' + H.name(p) + ' asked for'); H.render(); H.toast(T('Saved')); }
    },
    donechange: function (el) { var c = S.get('detailChanges', el.dataset.id); if (!c || !canCheck()) return; S.remove('detailChanges', c.id, 'Added the family ' + H.name(S.get('people', c.personId)) + ' asked for'); H.render(); },
    declinechange: function (el) {
      H.modal(H.dialogHead(T('Don’t change'), T('Say why, so they know what to do.')) + '<div class="dlg-body"><label class="field">' + T('Reply') + '<textarea id="dc-reply" rows="3" maxlength="300"></textarea></label></div>' +
        '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:senddecline" data-id="' + esc(el.dataset.id) + '">' + T('Send') + '</button></div>', T('Don’t change'));
    },
    senddecline: function (el) {
      var c = S.get('detailChanges', el.dataset.id); if (!c || !canCheck()) return;
      c = JSON.parse(JSON.stringify(c)); c.status = 'declined'; c.reply = document.getElementById('dc-reply').value.trim().slice(0, 300);
      S.put('detailChanges', c, 'Didn’t make the change ' + H.name(S.get('people', c.personId)) + ' asked for');
      H.closeModal(); H.render();
    }
  });

  Object.assign(P, { changesToCheck: open, changesMePanel: mePanel, renderChanges: renderChanges });
})(PeopleParts);
