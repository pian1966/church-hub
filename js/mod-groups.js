/* Church Hub – Groups: one menu entry for every kind of group – Care Groups, Midweek Groups and Leadership – instead of one
 * each. Its first tab, "My groups", shows the groups the person is in; the other tabs are the kinds of group they may open
 * (each still switched on or off on its own in Settings → Apps, and with its own privacy rules). Those pages keep their
 * own addresses (#/care, #/life, #/leaders); app.js puts these tabs above them (modules with inGroups: true).
 * The church may call the menu entry something else (Settings → Terminology (Church Words): "groups"). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var PEOPLE = 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11a2.6 2.6 0 1 0 0-5.2M2.5 19c.5-3 2.6-5 5.5-5s5 2 5.5 5M15.5 14.2c2.6.2 4.4 2 4.9 4.8';

  /** What the menu calls it: "Groups", or the church's own word for it (in English; other languages translate "Groups"). */
  function label() {
    var w = I18n.get() === 'en' && window.Wording ? (Wording.words(S.settings() || {}).groups || []) : [];
    return w[1] || T('Groups');
  }
  /** How many groups this person is in: their Care Groups, Midweek Groups and leadership groups. */
  function count(u) {
    if (!u) return 0;
    var n = 0;
    if (H.isOn('care')) n += Care.groupsOf(S.list('careGroups'), u.id).length;
    if (H.isOn('life')) n += Care.groupsOf(S.list('lifeGroups'), u.id).length;
    if (H.isOn('leaders') && window.Leaders) n += Leaders.of(S.list('leaderBodies'), u.id).length;
    return n;
  }
  /** The tabs at the top of the Groups page and of each kind of group's page. */
  function tabs(active) {
    var t = [['groups', T('My groups')]].concat(H.groupMods().map(function (m) { return [m.id, T(m.name)]; }));
    return '<nav class="seg me-tabs groups-tabs" aria-label="' + esc(label()) + '">' + t.map(function (x) {
      var on = x[0] === active;
      return '<a href="#/' + x[0] + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x[1]) + '</a>';
    }).join('') + '</nav>';
  }
  function render() {
    var html = (window.CareUI ? CareUI.mePanel() : '') + (window.LifeUI ? LifeUI.mePanel() : '') + (window.LeadersUI && LeadersUI.mePanel ? LeadersUI.mePanel() : '');
    return tabs('groups') + '<div class="page-head"><div><h1>' + esc(label()) + '</h1><p class="lead">' + T('The groups you are in. The tabs above show every group you may see.') + '</p></div></div>' +
      (html || '<p class="empty">' + T('You’re not in a group yet.') + '</p>');
  }

  var mod = {
    id: 'groups', desc: 'Care Groups, Midweek Groups and Leadership in one place', icon: PEOPLE, tint: '#3E6E8E',
    show: function () { return H.groupMods().length > 0; },
    render: function () { return render(); },
    stat: function (u) { var n = count(u); return n ? TN('{n} group', '{n} groups', n) : T(this.desc); },
    tabs: tabs
  };
  Object.defineProperty(mod, 'name', { get: label, enumerable: true });   // the menu, Home and All apps show the church's word for it
  H.register(mod);
})();
