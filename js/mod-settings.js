/* Church Hub – Settings: church details, apps on/off, who has access, service times. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store;
  var MODS = [['people', 'People', 'Directory, households and consent'], ['rosters', 'Rosters', 'Serving rosters, teams and serving together'], ['leave', 'Leave', 'Staff leave (Leave Manager built in)'],
    ['care', 'Care groups', 'Small groups that care for one another'], ['privacy', 'Privacy', 'Privacy law tools (consent, requests, breaches)'], ['import', 'Import', 'Bring data across from Elvanto']];

  /** The number of people with an access level; point at it (or tap it) to see who they are. Long lists (e.g. "No access") stay a number. */
  function whoHas(ps, role) {
    if (!ps.length || ps.length > 40) return String(ps.length);
    ps = ps.slice().sort(function (a, b) { return (a.lastName + ' ' + a.firstName).localeCompare(b.lastName + ' ' + b.firstName); });
    return '<details class="who" data-role="' + role + '"><summary title="' + esc(ps.map(H.name).join(', ')) + '">' + ps.length + '</summary><div class="who-list">' +
      ps.map(function (p) { return '<a href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a>'; }).join('') + '</div></details>';
  }

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function slotText(x) { return DAYS[x.day || 0] + ' ' + x.label + (x.venue ? ' · ' + x.venue : ''); }
  /** The church's regular services: times and campuses/venues. Volunteers say which ones they serve at. */
  function renderSlots() {
    var sl = Serving.slots(S.settings()), used = {};
    S.list('skills').forEach(function (k) { (k.times || []).forEach(function (t) { used[t] = (used[t] || 0) + 1; }); });
    return '<section class="panel"><h2>Services and venues</h2><p class="hint" style="margin-top:0">The church’s regular services. Volunteers say which of these they can serve at, and rostering keeps to it. Add another time, or another campus or venue, when the church starts one.</p>' +
      '<div class="list">' + sl.map(function (x) {
        return '<div class="item"><span class="grow"><b>' + esc(x.label) + '</b><small>' + esc(DAYS[x.day || 0] + ' ' + x.time + (x.venue ? ' · ' + x.venue : '')) + (used[x.id] ? ' · ' + used[x.id] + ' volunteer place' + (used[x.id] === 1 ? '' : 's') : '') + '</small></span>' +
          (sl.length > 1 ? '<button class="icon-btn ghost" data-act="settings:delslot" data-id="' + esc(x.id) + '" aria-label="Remove ' + esc(x.label) + '">' + H.icon(H.ICON.trash, 18) + '</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="two" style="margin-top:12px"><label class="field">Day<select id="sl-day">' + DAYS.map(function (d, i) { return '<option value="' + i + '">' + d + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req">Time<input id="sl-time" type="time" value="09:30"></label></div>' +
      '<div class="two"><label class="field req">Name<input id="sl-label" placeholder="e.g. 9:30am, or Youth service"></label><label class="field">Campus or venue<input id="sl-venue" placeholder="Leave empty for the church itself"></label></div>' +
      '<button class="btn small" data-act="settings:addslot">' + H.icon(H.ICON.plus, 16) + 'Add a service</button></section>';
  }

  var allSvcs = false;   // show every upcoming service, not just the next few
  /** Services that need a roster: the upcoming ones (remove any you won't hold), regular ones for some weeks, and special ones. */
  function renderServices(st, svcs) {
    var sl = Serving.slots(st), shown = allSvcs ? svcs : svcs.slice(0, 8), year = +H.today().slice(0, 4);
    var specials = Serving.specials(year), groups = [];
    specials.forEach(function (x) { if (groups.indexOf(x.when) < 0) groups.push(x.when); });
    return '<section class="panel"><h2>Services that need a roster</h2>' +
      (svcs.length ? '<div class="list">' + shown.map(function (s) {
        return '<div class="item"><span class="grow"><b>' + esc(H.fmt(s.date, true)) + (s.special ? ' <span class="tag">Special</span>' : '') + '</b><small>' + esc(s.time + ' · ' + s.name + (s.venue && s.name.indexOf(s.venue) < 0 ? ' · ' + s.venue : '')) + '</small></span>' +
          '<button class="icon-btn ghost" data-act="settings:delsvc" data-id="' + s.id + '" aria-label="Remove the service on ' + esc(H.fmt(s.date, true)) + '" title="Remove this service (and its roster)">' + H.icon(H.ICON.trash, 18) + '</button></div>';
      }).join('') + '</div>' + (svcs.length > 8 ? '<p class="hint"><button class="link" data-act="settings:allsvc">' + (allSvcs ? 'Show fewer' : 'Show all ' + svcs.length) + '</button></p>' : '') : '<p class="muted">None planned.</p>') +
      (svcs.some(function (s) { return !s.special; }) ? '<details class="sub"><summary>Stop holding a regular service…</summary><p class="hint">Removes the upcoming ones (and their rosters) from a date. To stop adding it at all, remove it under “Services and venues”.</p>' +
        '<div class="two"><label class="field">Service<select id="sv-stop">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">From<input type="date" id="sv-stop-from" value="' + H.today() + '"></label></div><button class="btn small" data-act="settings:stopsvc">Remove these services</button></details>' : '') +
      '<h3 style="margin:16px 0 6px">Every week</h3><div class="two"><label class="field req">Service<select id="sv-slot">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select><small>Add more times or venues under “Services and venues”.</small></label>' +
      '<label class="field">For the next<select id="sv-n"><option value="4">4 weeks</option><option value="8" selected>8 weeks</option><option value="13">13 weeks</option></select></label></div>' +
      '<button class="btn small" data-act="settings:addsvc">Add these services</button>' +
      '<h3 style="margin:18px 0 6px">A special service</h3><p class="hint" style="margin-top:0">E.g. Maundy Thursday, Good Friday or Christmas Day. Choose one of the suggestions (the date is filled in) or type your own.</p>' +
      '<label class="field req">Name<input id="sp-name" list="sp-list" autocomplete="off" placeholder="e.g. Good Friday"><datalist id="sp-list">' + specials.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc((x.date ? H.fmt(Serving.specialDate(x.name, H.today()), true) + ' · ' : '') + (x.used || x.when)) + '</option>'; }).join('') + '</datalist></label>' +
      '<div class="two"><label class="field req">Date<input type="date" id="sp-date" min="' + H.today() + '"></label><label class="field req">Time<input type="time" id="sp-time" value="' + esc((sl[0] || {}).time || '09:00') + '"></label></div>' +
      '<div class="two"><label class="field">Campus or venue<input id="sp-venue" placeholder="Leave empty for the church itself"></label>' +
      '<label class="field">Teams like<select id="sp-like">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select><small>Positions that only serve some services follow this one.</small></label></div>' +
      '<button class="btn small" data-act="settings:addspecial">' + H.icon(H.ICON.plus, 16) + 'Add special service</button>' +
      '<details class="sub"><summary>Ideas by kind of church</summary><div class="hint">' + groups.map(function (g) {
        return '<p style="margin:8px 0 2px"><b>' + esc(g) + '</b></p><p style="margin:0">' + specials.filter(function (x) { return x.when === g; }).map(function (x) { return esc(x.name) + (x.used ? ' <span class="muted">(' + esc(x.used) + ')</span>' : ''); }).join(' · ') + '</p>';
      }).join('') + '</div></details></section>';
  }
  /** Church wording: a ready-made set for the kind of church, and any word renamed (js/wording.js). */
  function renderWording(st) {
    var w = st.wording || {}, cur = Wording.SETS[w.set] ? w.set : 'general', words = Wording.words(st);
    return '<section class="panel" data-own-words><h2>Church wording</h2><p class="hint" style="margin-top:0">The words your church uses for people and roles. ' +
      'The screens change (in English – the other languages keep their own words); everyone’s records stay as they are.</p>' +
      '<label class="field">Kind of church<select id="wd-set">' + Object.keys(Wording.SETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(Wording.SETS[k].name) + '</option>'; }).join('') + '</select><small>Choosing one fills in its words below; you can still change any of them.</small></label>' +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>Church Hub says</th><th>Your word</th><th>More than one</th></tr></thead><tbody>' +
      Wording.TERMS.map(function (t) {
        return '<tr><td><b>' + esc(t[1][0]) + '</b><br><span class="muted small">' + esc(t[2]) + '</span></td>' +
          '<td><input class="wd-1" data-k="' + t[0] + '" value="' + esc(words[t[0]][0]) + '" aria-label="Your word for ' + esc(t[1][0]) + '"></td>' +
          '<td><input class="wd-2" data-k="' + t[0] + '" value="' + esc(words[t[0]][1]) + '" aria-label="Your word for ' + esc(t[1][1]) + '"></td></tr>';
      }).join('') + '</tbody></table></div><button class="btn small" data-act="settings:savewords">Save wording</button></section>';
  }
  function render() {
    var st = S.settings(), on = st.modules || {};
    var byRole = {}; S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child'; }).forEach(function (p) { (byRole[p.appRole || 'member'] = byRole[p.appRole || 'member'] || []).push(p); });
    var svcs = S.list('services').filter(function (s) { return s.date >= H.today(); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return '<div class="page-head"><div><h1>Settings</h1><p class="lead">Church details, which apps are switched on, who can see what, and service times.</p></div></div><div class="grid2">' +
      '<section class="panel"><h2>Church</h2><label class="field req">Church name<input id="st-name" value="' + esc(st.churchName) + '"></label>' +
        '<label class="field req">Country<select id="st-country">' + Countries.grouped().map(function (g) {
          return '<optgroup label="' + esc(g.continent) + '">' + g.countries.map(function (x) { return '<option value="' + x.code + '"' + (x.code === Countries.church(st).code ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select><small>Sets the usual country for addresses (with its provinces, states or counties) and which privacy law the Privacy pages follow.</small></label>' +
        '<button class="btn small" data-act="settings:name">Save</button></section>' +
      renderWording(st) +
      '<section class="panel"><h2>Apps</h2><p class="hint" style="margin-top:0">Switch off what you don’t use – its card disappears for everyone. Nothing is deleted.</p>' + MODS.map(function (m) {
        return '<label class="check"><input type="checkbox" class="st-mod" value="' + m[0] + '"' + (on[m[0]] !== false ? ' checked' : '') + '><span><b>' + esc(m[1]) + '</b><br><span class="muted small">' + esc(m[2]) + '</span></span></label>';
      }).join('') + '<p class="hint">More apps (groups, check-in, messages, calendar) arrive in later phases.</p></section>' +
      '<section class="panel"><h2>Who can see what</h2><div class="table-wrap"><table class="simple"><thead><tr><th>Access</th><th>Can</th><th>People</th></tr></thead><tbody>' +
      [['admin', 'Everything, including Privacy, Import and Settings – except pastoral and medical notes'], ['pastor', 'People, households, pastoral notes, children'], ['rosters', 'Rosters and teams; names and contact details only'], ['kids', 'Children, guardians and medical notes'], ['member', 'Their own details, serving and leave; the church directory'], ['none', 'Can’t sign in (kept on the church records only)']].map(function (r) {
        return '<tr><td><b>' + esc(H.ROLES[r[0]].label) + '</b></td><td>' + esc(r[1]) + '</td><td>' + whoHas(byRole[r[0]] || [], r[0]) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">Change someone’s access from their profile (People → Edit details).</p></section>' +
      renderSlots() +
      renderServices(st, svcs) + '</div>';
  }

  H.register({
    id: 'settings', name: 'Settings', desc: 'Church details, apps and access', icon: H.ICON.settings, tint: '#6B625A', roles: ['admin'],
    render: function () { return H.can('*') ? render() : '<p class="empty">Only Administrators can change settings.</p>'; },
    after: function () {
      var sn = document.getElementById('sp-name'), sd = document.getElementById('sp-date');
      if (sn && sd) sn.addEventListener('input', function () { var d = Serving.specialDate(sn.value.trim(), H.today()); if (d) sd.value = d; });   // a suggestion fills in its date
      var ws = document.getElementById('wd-set');
      if (ws) ws.addEventListener('change', function () {   // fill in the set's words, to save or change
        var w = Wording.words({ wording: { set: ws.value } });
        document.querySelectorAll('.wd-1').forEach(function (i) { i.value = w[i.dataset.k][0]; });
        document.querySelectorAll('.wd-2').forEach(function (i) { i.value = w[i.dataset.k][1]; });
      });
      document.querySelectorAll('.st-mod').forEach(function (b) {
        b.addEventListener('change', function () { var m = Object.assign({}, S.settings().modules); m[b.value] = b.checked; S.setSettings({ modules: m }, (b.checked ? 'Switched on ' : 'Switched off ') + b.value); H.toast(b.checked ? 'Switched on' : 'Switched off – its card is hidden'); H.render(); });
      });
    },
    actions: {
      name: function () {
        var st = S.settings(), n = document.getElementById('st-name').value.trim(), c = document.getElementById('st-country').value, say = [];
        if (!n) { H.toast('Give the church a name', true); return; }
        if (n !== st.churchName) say.push('Renamed the church');
        if (c !== Countries.church(st).code) say.push('Country: ' + Countries.find(c).name);
        if (say.length) S.setSettings({ churchName: n, country: c }, say.join('; '));
        H.render(); H.toast('Saved');
      },
      savewords: function () {
        var set = document.getElementById('wd-set').value, base = Wording.words({ wording: { set: set } }), custom = {}, renamed = [];
        document.querySelectorAll('.wd-1').forEach(function (i) {
          var k = i.dataset.k, one = i.value.trim(), many = (document.querySelector('.wd-2[data-k="' + k + '"]').value || '').trim() || one;
          if (!one) { one = base[k][0]; many = base[k][1]; }
          if (one !== base[k][0] || many !== base[k][1]) { custom[k] = [one, many]; renamed.push(one); }
        });
        S.setSettings({ wording: { set: set, custom: custom } }, 'Church wording: ' + Wording.SETS[set].name + (renamed.length ? ' (own words: ' + renamed.join(', ') + ')' : ''));
        H.render(); H.toast('Wording saved');
      },
      addslot: function () {
        var sl = Serving.slots(S.settings()), time = document.getElementById('sl-time').value, label = document.getElementById('sl-label').value.trim(), venue = document.getElementById('sl-venue').value.trim(), day = +document.getElementById('sl-day').value;
        if (!time || !label) { H.toast('Give the service a time and a name', true); return; }
        if (sl.some(function (x) { return x.time === time && (x.day || 0) === day && (x.venue || '').toLowerCase() === venue.toLowerCase(); })) { H.toast('That service is already there', true); return; }
        sl.push({ id: Serving.newSlotId(time, venue, sl), label: label, day: day, time: time, venue: venue });
        S.setSettings({ serviceSlots: sl }, 'Added a regular service: ' + label + (venue ? ' at ' + venue : ''));
        H.render(); H.toast('Service added');
      },
      delslot: function (el) {
        var sl = Serving.slots(S.settings()), x = sl.filter(function (y) { return y.id === el.dataset.id; })[0]; if (!x) return;
        if (!H.confirmBtn(el, '✕?')) return;
        S.setSettings({ serviceSlots: sl.filter(function (y) { return y.id !== x.id; }) }, 'Removed the regular service ' + x.label + (x.venue ? ' at ' + x.venue : '') + ' (rosters already made stay)');
        H.render(); H.toast('Removed');
      },
      addsvc: function () {
        var x = Serving.slots(S.settings()).filter(function (y) { return y.id === document.getElementById('sv-slot').value; })[0]; if (!x) return;
        var day = x.day || 0, time = x.time, name = x.label + (x.venue ? ' · ' + x.venue : '') + ' service', n = +document.getElementById('sv-n').value;
        var d = LeaveCore.parse(H.today()); while (d.getDay() !== day) d = LeaveCore.addDays(d, 1);
        var added = 0;
        for (var i = 0; i < n; i++) {
          var iso = LeaveCore.iso(LeaveCore.addDays(d, i * 7));
          if (!S.find('services', function (s) { return s.date === iso && Serving.slotOf(s) === x.id; }).length) { S.put('services', { date: iso, time: time, name: name, slot: x.id, venue: x.venue || '' }); added++; }
        }
        S.audit('Added ' + added + ' services', 'services'); H.render(); H.toast(added + ' services added');
      },
      allsvc: function () { allSvcs = !allSvcs; H.render(); },
      stopsvc: function (el) {
        var id = document.getElementById('sv-stop').value, from = document.getElementById('sv-stop-from').value || H.today();
        var gone = S.find('services', function (s) { return !s.special && Serving.slotOf(s) === id && s.date >= from; });
        if (!gone.length) { H.toast('There are none of those from that date', true); return; }
        if (!H.confirmBtn(el, 'Remove ' + gone.length + '? Click again')) return;
        gone.forEach(function (sv) { S.find('assignments', function (x) { return x.serviceId === sv.id; }).forEach(function (x) { S.remove('assignments', x.id); }); S.remove('services', sv.id); });
        S.audit('Stopped ' + Serving.slotLabel(id, S.settings()) + ' services from ' + from + ': removed ' + gone.length + ' (with their rosters)', 'services');
        H.render(); H.toast(gone.length + ' services removed');
      },
      addspecial: function () {
        var g = function (id) { return document.getElementById(id).value.trim(); }, name = g('sp-name'), date = g('sp-date'), time = g('sp-time'), venue = g('sp-venue'), like = g('sp-like');
        if (!name || !date || !time) { H.toast('Give the service a name, a date and a time', true); return; }
        if (date < H.today()) { H.toast('Choose a date from today on', true); return; }
        if (S.find('services', function (s) { return s.date === date && s.time === time && (s.venue || '') === venue; }).length) { H.toast('There is already a service then', true); return; }
        S.put('services', { date: date, time: time, name: name, slot: like, venue: venue, special: true }, 'Added a special service: ' + name + ' on ' + date);
        H.render(); H.toast(name + ' added – make its roster under Rosters');
      },
      delsvc: function (el) { if (!H.confirmBtn(el, '✕?')) return; S.find('assignments', function (x) { return x.serviceId === el.dataset.id; }).forEach(function (x) { S.remove('assignments', x.id); }); S.remove('services', el.dataset.id, 'Removed a service'); H.render(); }
    }
  });
})();
