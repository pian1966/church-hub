/* Church Hub – Settings: church details, apps on/off, who has access, service times. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store;
  var MODS = [['people', 'People', 'Directory, households and consent'], ['rosters', 'Rosters', 'Serving rosters, teams and serving together'], ['leave', 'Leave', 'Staff leave (Leave Manager built in)'],
    ['privacy', 'Privacy', 'POPIA tools'], ['import', 'Import', 'Bring data across from Elvanto']];

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
      '<section class="panel"><h2>Apps</h2><p class="hint" style="margin-top:0">Switch off what you don’t use – its card disappears for everyone. Nothing is deleted.</p>' + MODS.map(function (m) {
        return '<label class="check"><input type="checkbox" class="st-mod" value="' + m[0] + '"' + (on[m[0]] !== false ? ' checked' : '') + '><span><b>' + esc(m[1]) + '</b><br><span class="muted small">' + esc(m[2]) + '</span></span></label>';
      }).join('') + '<p class="hint">More apps (groups, check-in, messages, calendar) arrive in later phases.</p></section>' +
      '<section class="panel"><h2>Who can see what</h2><div class="table-wrap"><table class="simple"><thead><tr><th>Access</th><th>Can</th><th>People</th></tr></thead><tbody>' +
      [['admin', 'Everything, including Privacy, Import and Settings – except pastoral and medical notes'], ['pastor', 'People, households, pastoral notes, children'], ['rosters', 'Rosters and teams; names and contact details only'], ['kids', 'Children, guardians and medical notes'], ['member', 'Their own details, serving and leave; the church directory'], ['none', 'Can’t sign in (kept on the church records only)']].map(function (r) {
        return '<tr><td><b>' + esc(H.ROLES[r[0]].label) + '</b></td><td>' + esc(r[1]) + '</td><td>' + whoHas(byRole[r[0]] || [], r[0]) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">Change someone’s access from their profile (People → Edit details).</p></section>' +
      renderSlots() +
      '<section class="panel"><h2>Services that need a roster</h2>' + (svcs.length ? '<div class="list">' + svcs.slice(0, 6).map(function (s) { return '<div class="item"><span class="grow"><b>' + esc(H.fmt(s.date, true)) + '</b><small>' + esc(s.time + ' · ' + s.name + (s.venue ? ' · ' + s.venue : '')) + '</small></span><button class="icon-btn ghost" data-act="settings:delsvc" data-id="' + s.id + '" aria-label="Remove this service">' + H.icon(H.ICON.trash, 18) + '</button></div>'; }).join('') + '</div>' + (svcs.length > 6 ? '<p class="hint">…and ' + (svcs.length - 6) + ' more.</p>' : '') : '<p class="muted">None planned.</p>') +
      '<div class="two" style="margin-top:12px"><label class="field req">Service<select id="sv-slot">' + Serving.slots(st).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select><small>Add more times or venues under “Services and venues”.</small></label>' +
      '<label class="field">For the next<select id="sv-n"><option value="4">4 weeks</option><option value="8" selected>8 weeks</option><option value="13">13 weeks</option></select></label></div>' +
      '<button class="btn small" data-act="settings:addsvc">Add these services</button></section></div>';
  }

  H.register({
    id: 'settings', name: 'Settings', desc: 'Church details, apps and access', icon: H.ICON.settings, tint: '#6B625A', roles: ['admin'],
    render: function () { return H.can('*') ? render() : '<p class="empty">Only Administrators can change settings.</p>'; },
    after: function () {
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
      delsvc: function (el) { if (!H.confirmBtn(el, '✕?')) return; S.find('assignments', function (x) { return x.serviceId === el.dataset.id; }).forEach(function (x) { S.remove('assignments', x.id); }); S.remove('services', el.dataset.id, 'Removed a service'); H.render(); }
    }
  });
})();
