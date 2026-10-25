/* Church Hub – Import from Elvanto (People export as CSV). Later: direct import through the Elvanto API (server side). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store;
  var FIELDS = [
    ['id', 'Elvanto ID', /^(person\s*)?id$|elvanto/i],
    ['firstName', 'First name *', /^first|given/i],
    ['lastName', 'Last name *', /^last|surname|family name$/i],
    ['preferredName', 'Known as', /prefer|nick/i],
    ['email', 'Email', /e-?mail/i],
    ['mobile', 'Mobile', /mobile|cell/i],
    ['phone', 'Other phone', /^(home\s*)?phone|telephone/i],
    ['birthDate', 'Birthday', /birth/i],
    ['family', 'Family (ID or name)', /family\s*(id|name)?$/i],
    ['relationship', 'Family relationship', /relationship|family\s*role/i],
    ['maritalStatus', 'Marital status', /marital/i],
    ['category', 'Category', /categor|^status$|member\s*type/i]
  ];
  var st = { rows: null, head: null, map: {}, fileName: '', done: null };

  /** CSV with quotes, commas and line breaks inside quotes. */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }
  function guess(head) {
    var m = {};
    FIELDS.forEach(function (f) { var i = head.findIndex(function (h) { return f[2].test(h.trim()); }); if (i >= 0 && Object.keys(m).map(function (k) { return m[k]; }).indexOf(i) < 0) m[f[0]] = i; });
    return m;
  }
  function toISO(v) {
    v = String(v || '').trim(); if (!v) return '';
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(v))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);   // dd/mm/yyyy (South African)
    var d = new Date(v); return isNaN(d) ? '' : LeaveCore.iso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  }
  function records() {
    return st.rows.map(function (r) {
      var o = {}; FIELDS.forEach(function (f) { o[f[0]] = st.map[f[0]] != null && st.map[f[0]] !== '' ? String(r[st.map[f[0]]] || '').trim() : ''; });
      o.birthDate = toISO(o.birthDate);
      var age = o.birthDate ? (new Date().getFullYear() - +o.birthDate.slice(0, 4)) : 99;
      o.child = /child|son|daughter/i.test(o.relationship) || age < 18;
      return o;
    }).filter(function (o) { return o.firstName || o.lastName; });
  }
  function matchExisting(o) {
    return S.find('people', function (p) {
      return (o.id && p.elvantoId === o.id) || (o.email && p.email && p.email.toLowerCase() === o.email.toLowerCase()) ||
        (!o.email && (p.firstName + ' ' + p.lastName).toLowerCase() === (o.firstName + ' ' + o.lastName).toLowerCase());
    })[0];
  }

  function tabs(active) {
    return '<nav class="seg" aria-label="Import from" style="margin-bottom:18px"><a href="#/import" class="' + (active === 'elvanto' ? 'on' : '') + '">From Elvanto</a><a href="#/import/leave" class="' + (active === 'leave' ? 'on' : '') + '">From Leave Manager</a></nav>';
  }

  function render() {
    var h = '<div class="page-head"><div><h1>Import from Elvanto</h1><p class="lead">Bring your people and families across from Elvanto. Nothing is changed in Elvanto.</p></div></div>' + tabs('elvanto');
    if (st.done) {
      return h + '<div class="note ok"><b>Imported.</b> ' + st.done.added + ' added, ' + st.done.updated + ' updated, ' + st.done.families + ' families created.' + (st.done.noConsent ? ' ' + st.done.noConsent + ' people need consent recorded – see the to-do list on Home.' : '') + '</div><div class="btns"><a class="btn primary" href="#/people">Open People</a><button class="btn" data-act="import:again">Import another file</button></div>';
    }
    if (!st.rows) {
      return h + '<div class="grid2"><section class="panel"><h2>1. Export from Elvanto</h2><ol style="margin:0;padding-left:20px;line-height:1.7"><li>In Elvanto, open <b>People</b>.</li><li>Select everyone, then choose <b>Export</b> (as a CSV file).</li><li>Include name, email, mobile, birthday, family and family relationship.</li></ol>' +
        '<p class="hint">Keep the file safe and delete it once imported – it contains personal information.</p></section>' +
        '<section class="panel"><h2>2. Choose the file</h2><label class="field">Elvanto export (.csv)<input type="file" id="im-file" accept=".csv,text/csv"></label><p class="hint">Or <button class="link" data-act="import:sample">try it with a made-up sample file</button>.</p></section></div>' +
        '<section class="panel" style="margin-top:16px"><h2>Coming later: direct import</h2><p class="muted" style="margin:0">Once Church Hub runs on its own secure server, it can read Elvanto directly with your API key (groups, departments and families too), without a file.</p></section>';
    }
    var recs = records(), adds = 0, ups = 0, kids = recs.filter(function (r) { return r.child; }).length;
    recs.forEach(function (r) { if (matchExisting(r)) ups++; else adds++; });
    var fams = {}; recs.forEach(function (r) { if (r.family) fams[r.family] = 1; });
    h += '<div class="note info">File: <b>' + esc(st.fileName) + '</b> – ' + st.rows.length + ' rows. Check the matching below, then import.</div>';
    h += '<div class="grid2"><section class="panel"><h2>Match the columns</h2>' + FIELDS.map(function (f) {
      return '<label class="field">' + esc(f[1]) + '<select class="im-map" data-f="' + f[0] + '"><option value="">— not in the file —</option>' + st.head.map(function (c, i) { return '<option value="' + i + '"' + (st.map[f[0]] === i ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>';
    }).join('') + '</section>' +
      '<section class="panel"><h2>What will happen</h2><div class="stats"><div class="stat"><span>New people</span><b>' + adds + '</b></div><div class="stat"><span>Already here (updated)</span><b>' + ups + '</b></div><div class="stat"><span>Children</span><b>' + kids + '</b></div><div class="stat"><span>Families</span><b>' + Object.keys(fams).length + '</b></div></div>' +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>Name</th><th>Email</th><th>Family</th></tr></thead><tbody>' + recs.slice(0, 8).map(function (r) { return '<tr><td>' + esc(r.firstName + ' ' + r.lastName) + (r.child ? ' <span class="tag" style="--c:#0E7490">Child</span>' : '') + '</td><td>' + esc(r.email) + '</td><td>' + esc(r.family) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (recs.length > 8 ? '<p class="hint">…and ' + (recs.length - 8) + ' more.</p>' : '') +
      '<label class="check" style="margin-top:10px"><input type="checkbox" id="im-consent"><span>Elvanto records show these people agreed to the church keeping their details. <span class="muted small">Only tick if that’s true – otherwise you’ll be reminded to ask them (POPIA).</span></span></label>' +
      '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="import:go"' + (st.map.firstName == null || st.map.lastName == null ? ' disabled' : '') + '>Import ' + recs.length + ' people</button><button class="btn" data-act="import:again">Start again</button></div></section></div>';
    return h;
  }

  function load(name, text) {
    var rows = parseCSV(text);
    if (rows.length < 2) { H.toast('That file has no rows to import', true); return; }
    st.head = rows[0]; st.rows = rows.slice(1); st.map = guess(st.head); st.fileName = name; st.done = null; H.render();
  }

  /* ================= Leave Manager (its Google Sheet, downloaded) ================= */
  var LI = LeaveImport, lst = { tables: null, files: [], choice: {}, opt: { settings: true, details: true }, done: null, busy: false };
  var KIND_NAMES = { staff: 'Staff', requests: 'Requests', adjustments: 'Adjustments', levels: 'Categories', types: 'Leave Types', terms: 'School Terms', holidays: 'Public Holidays', settings: 'Settings', rules: 'Cover Rules', history: 'History (not needed)' };

  function adults() { return S.find('people', function (p) { return p.familyRole !== 'child' && p.firstName !== 'Deleted'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function currentPlan() {
    var pl = LI.plan(lst.tables, adults());
    pl.matches.forEach(function (m) { if (lst.choice[m.lm.id] === undefined) lst.choice[m.lm.id] = m.personId || '__new'; });
    return pl;
  }
  /** The sheet's staff as Church Hub staff (for previewing balances) – new people get a stand-in id. */
  function previewData(pl) {
    var lv = JSON.parse(JSON.stringify(S.leave())), map = {};
    pl.matches.forEach(function (m) { var c = lst.choice[m.lm.id]; if (c && c !== '__skip') map[m.lm.id] = c === '__new' ? 'new-' + m.lm.id : c; });
    LI.applyLeave(lv, pl, map, lst.opt.settings);
    var staff = pl.matches.filter(function (m) { return map[m.lm.id]; }).map(function (m) {
      var p = map[m.lm.id].indexOf('new-') === 0 ? null : S.get('people', map[m.lm.id]), useSheet = lst.opt.details || !p || !p.staff;
      return { id: map[m.lm.id], name: p ? H.name(p) : m.lm.name, level: useSheet ? m.lm.level : p.staff.category, workDays: useSheet ? m.lm.workDays : (p.staff.workDays || ''),
        start: useSheet ? m.lm.start : p.staff.start, active: m.lm.active, role: 'Staff' };
    });
    return { data: Object.assign(lv, { staff: staff }), map: map };
  }

  function renderLeave() {
    var h = '<div class="page-head"><div><h1>Import from Leave Manager</h1><p class="lead">Bring staff leave across from the Leave Manager Google Sheet: booked and past leave, carried-over days and the leave settings. Nothing is changed in the sheet.</p></div></div>' + tabs('leave');
    if (lst.done) {
      var d = lst.done;
      return h + '<div class="note ok"><b>Imported.</b> ' + d.added + ' leave requests added, ' + d.updated + ' updated, ' + d.adjustments + ' adjustments' + (d.newPeople ? ', ' + d.newPeople + ' new staff added to People' : '') + (d.skipped ? '. ' + d.skipped + ' requests skipped (staff not brought across).' : '.') + '</div>' +
        '<p>Check <a href="#/leave/team">Leave → Team balances</a> against Leave Manager. You can run the import again just before switching over: leave already brought in is updated, not doubled.</p>' +
        '<div class="btns"><a class="btn primary" href="#/leave/team">Team balances</a><button class="btn" data-act="import:lagain">Import again</button></div>';
    }
    if (!lst.tables) {
      return h + '<div class="grid2"><section class="panel"><h2>1. Download the sheet</h2><ol style="margin:0;padding-left:20px;line-height:1.7">' +
        '<li>Open the <b>Leave Manager</b> Google Sheet.</li><li>Click <b>File → Download → Microsoft Excel (.xlsx)</b>.</li><li>Come back here and choose that file.</li></ol>' +
        '<p class="hint">Or download each tab as <b>CSV</b> (File → Download → Comma-separated values) and choose them all at once. PINs are never brought across.</p>' +
        '<p class="hint">The file holds staff leave and reasons – keep it on the church computer and delete it once imported.</p></section>' +
        '<section class="panel"><h2>2. Choose the file</h2><label class="field">Leave Manager download (.xlsx or .csv files)<input type="file" id="lm-file" accept=".xlsx,.csv,text/csv" multiple></label>' +
        (lst.busy ? '<p class="muted">Reading…</p>' : '') + '<p class="hint">Or <button class="link" data-act="import:lsample">try it with a made-up Leave Manager sheet</button>.</p></section></div>';
    }
    var pl = currentPlan(), pv = previewData(pl), lv = pv.data, kinds = Object.keys(lst.tables);
    var y = LeaveCore.lyOf(H.today(), LeaveCore.ctx(lv).S), ded = (lv.types || []).filter(function (t) { return t.deducts && t.active !== false; });
    var status = {}; pl.requests.forEach(function (r) { status[r.status] = (status[r.status] || 0) + 1; });
    h += '<div class="note info">Read: <b>' + esc(lst.files.join(', ')) + '</b> – found ' + kinds.map(function (k) { return esc(KIND_NAMES[k] || k); }).join(', ') + '.</div>';
    if (pl.missing.length) h += '<p class="note bad">The ' + pl.missing.map(function (k) { return KIND_NAMES[k]; }).join(' and ') + ' tab' + (pl.missing.length > 1 ? 's are' : ' is') + ' missing. Download the whole sheet as Excel, or include those CSV files.</p>';
    if (pl.unknownTypes.length) h += '<p class="note warn">Some leave uses kinds of leave that aren’t in the Leave Types tab: ' + esc(pl.unknownTypes.join(', ')) + '.</p>';
    if (pl.skipped.requests.length) h += '<p class="note warn">' + pl.skipped.requests.length + ' request(s) have dates that can’t be read and will be left out.</p>';
    var people = adults();
    h += '<section class="panel"><h2>Staff</h2><p class="hint" style="margin-top:0">Each Leave Manager staff member is matched to their person in Church Hub (by email, then by name). Check the matches; people not found can be added as new people (without app access).</p>' +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>In Leave Manager</th><th>Category</th><th>Church Hub person</th></tr></thead><tbody>' + pl.matches.map(function (m) {
        var c = lst.choice[m.lm.id];
        return '<tr><td><b>' + esc(m.lm.name) + '</b><br><span class="muted small">' + esc(m.lm.email || 'no email') + (m.lm.active ? '' : ' · not active') + '</span></td><td>' + esc(m.lm.level) + '</td><td>' +
          '<select class="lm-who" data-id="' + esc(m.lm.id) + '" aria-label="Church Hub person for ' + esc(m.lm.name) + '"><option value="__new"' + (c === '__new' ? ' selected' : '') + '>+ Add as a new person</option><option value="__skip"' + (c === '__skip' ? ' selected' : '') + '>Don’t bring across</option>' +
          people.map(function (p) { return '<option value="' + p.id + '"' + (c === p.id ? ' selected' : '') + '>' + esc(H.name(p)) + '</option>'; }).join('') + '</select>' +
          (m.personId && c === m.personId ? '<br><span class="muted small">Matched by ' + m.by + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    h += '<div class="grid2" style="margin-top:16px"><section class="panel"><h2>What will happen</h2><div class="stats">' +
      '<div class="stat"><span>Leave requests</span><b>' + pl.requests.length + '</b></div><div class="stat"><span>Approved</span><b>' + (status.Approved || 0) + '</b></div><div class="stat"><span>Waiting</span><b>' + (status.Pending || 0) + '</b></div><div class="stat"><span>Adjustments</span><b>' + pl.adjustments.length + '</b></div></div>' +
      '<label class="check" style="margin-top:10px"><input type="checkbox" id="lm-set"' + (lst.opt.settings ? ' checked' : '') + '><span>Use the sheet’s settings: kinds of leave, categories and allowances, school terms, public holidays and cover rules <span class="muted small">(replaces what’s in Leave → Settings)</span></span></label>' +
      '<label class="check"><input type="checkbox" id="lm-det"' + (lst.opt.details ? ' checked' : '') + '><span>Update staff details (category, start date, working days) from the sheet</span></label>' +
      '<p class="hint">Leave already in Church Hub stays. Running this again later updates what was brought in, without doubling it.</p>' +
      '<div class="btns"><button class="btn primary" data-act="import:lgo"' + (pl.missing.length ? ' disabled' : '') + '>Import leave</button><button class="btn" data-act="import:lagain">Start again</button></div></section>' +
      '<section class="panel"><h2>Balances after importing (' + esc(LeaveCore.lyLabel(y, LeaveCore.ctx(lv).S)) + ')</h2><p class="hint" style="margin-top:0">Compare these with <b>Team</b> in Leave Manager – they should be the same, apart from any leave already booked in Church Hub itself.</p><div class="table-wrap"><table class="simple"><thead><tr><th>Staff</th>' +
      ded.map(function (t) { return '<th title="' + esc(t.name) + '">' + esc(t.code) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lv.staff.filter(function (st) { return LeaveCore.tracksLeave({ level: st.level }); }).map(function (st) {
        var b = LeaveCore.balances(lv, st.id, y);
        return '<tr><td>' + esc(st.name) + '</td>' + ded.map(function (t) { var x = b[t.code]; return '<td>' + (x && x.entitled != null ? LeaveCore.fmtDays(x.available) : '<span class="muted">–</span>') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></section></div>';
    return h;
  }

  function readFiles(files) {
    lst.busy = true; H.render();
    var lists = [], names = [];
    Promise.all(files.map(function (f) {
      names.push(f.name);
      return new Promise(function (res, rej) {
        var rd = new FileReader();
        rd.onerror = function () { rej(new Error('Could not read ' + f.name)); };
        if (/\.xlsx$/i.test(f.name)) {
          rd.onload = function () { XlsxLite.read(rd.result).then(function (sheets) { sheets.forEach(function (x) { lists.push(x); }); res(); }, rej); };
          rd.readAsArrayBuffer(f);
        } else { rd.onload = function () { lists.push(LI.parseCSV(rd.result)); res(); }; rd.readAsText(f); }
      });
    })).then(function () { loaded(lists, names); })
      .catch(function (e) { lst.busy = false; H.render(); H.toast(e.message + '. You can also download the tabs as CSV files instead.', true); });
  }
  function loaded(lists, names) {
    lst.busy = false;
    var t = LI.collect(lists);
    if (!Object.keys(t).length) { H.render(); H.toast('That doesn’t look like a Leave Manager sheet – no Leave Manager tabs found.', true); return; }
    lst.tables = t; lst.files = names; lst.choice = {}; lst.done = null; H.render();
  }

  function applyLeaveImport() {
    var pl = currentPlan(), map = {}, newPeople = 0;
    pl.matches.forEach(function (m) {
      var c = lst.choice[m.lm.id], sd = { category: m.lm.level, start: m.lm.start, workDays: m.lm.workDays };
      if (!c || c === '__skip') return;
      if (c === '__new') {
        var nm = LI.splitName(m.lm.name);
        var p = S.put('people', { firstName: nm.firstName, lastName: nm.lastName, preferredName: '', email: m.lm.email, mobile: '', familyId: '', familyRole: 'adult', category: 'Staff',
          active: m.lm.active, appRole: S.defaultRole() === 'none' ? 'none' : 'member', keyDates: [], source: 'leave-manager', staff: sd }, 'Added ' + m.lm.name + ' from Leave Manager');
        map[m.lm.id] = p.id; newPeople++;
      } else {
        map[m.lm.id] = c;
        var q = S.get('people', c);
        if (q && (lst.opt.details || !q.staff)) { q = JSON.parse(JSON.stringify(q)); q.staff = sd; if (q.category !== 'Deceased') q.category = 'Staff'; S.put('people', q); }
      }
    });
    var n = LI.applyLeave(S.leave(), pl, map, lst.opt.settings);
    S.saveLeave('Imported leave from Leave Manager (' + lst.files.join(', ') + '): ' + n.added + ' added, ' + n.updated + ' updated, ' + n.adjustments + ' adjustments' + (lst.opt.settings ? ', settings replaced' : ''));
    n.newPeople = newPeople; lst.done = n; lst.tables = null; H.render(); H.toast('Leave imported');
  }

  H.register({
    id: 'import', name: 'Import', desc: 'Bring people across from Elvanto, and leave from Leave Manager', icon: H.ICON.import, tint: '#A16207', roles: ['admin'],
    render: function (parts) { return !H.can('*') ? '<p class="empty">Only Administrators can import.</p>' : parts && parts[0] === 'leave' ? renderLeave() : render(); },
    after: function () {
      var lf = document.getElementById('lm-file');
      if (lf) lf.addEventListener('change', function () { if (lf.files.length) readFiles(Array.prototype.slice.call(lf.files)); });
      document.querySelectorAll('.lm-who').forEach(function (s) { s.addEventListener('change', function () { lst.choice[s.dataset.id] = s.value; H.render(); }); });
      ['lm-set', 'lm-det'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('change', function () { lst.opt[id === 'lm-set' ? 'settings' : 'details'] = b.checked; H.render(); }); });
      var f = document.getElementById('im-file');
      if (f) f.addEventListener('change', function () { var file = f.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { load(file.name, rd.result); }; rd.readAsText(file); });
      document.querySelectorAll('.im-map').forEach(function (s) { s.addEventListener('change', function () { st.map[s.dataset.f] = s.value === '' ? null : +s.value; H.render(); }); });
    },
    actions: {
      lgo: function (el) { if (!H.confirmBtn(el, 'Click again to import')) return; applyLeaveImport(); },
      lagain: function () { lst = { tables: null, files: [], choice: {}, opt: { settings: true, details: true }, done: null, busy: false }; H.render(); },
      lsample: function () {
        var names = ['Staff', 'Requests', 'Adjustments', 'Categories', 'Leave Types', 'School Terms', 'Public Holidays', 'Settings'];
        Promise.all(names.map(function (n) { return fetch('tests/fixtures/leave-manager/' + encodeURIComponent(n) + '.csv').then(function (r) { if (!r.ok) throw new Error(); return r.text(); }); }))
          .then(function (texts) { loaded(texts.map(LI.parseCSV), ['made-up Leave Manager sheet']); })
          .catch(function () { H.toast('Couldn’t load the made-up sheet', true); });
      },
      sample: function () {
        load('elvanto-people-sample.csv', 'Person ID,First Name,Last Name,Preferred Name,Email,Mobile,Birthday,Family ID,Family Relationship,Marital Status,Category\n' +
          'E-101,Brian,Fourie,,brian.fourie@example.com,083 111 2222,1975-03-12,FAM-9,Primary Contact,Married,Member\n' +
          'E-102,Karen,Fourie,,karen.fourie@example.com,083 111 3333,1978-07-01,FAM-9,Spouse,Married,Member\n' +
          'E-103,Mia,Fourie,,,,12/05/2014,FAM-9,Child,,Member\n' +
          'E-104,"Sipho","Mahlangu",Sips,sipho.m@example.com,072 555 1234,,,,Single,Visitor\n' +
          'E-105,Jason,Naidoo,,jason.naidoo@example.com,082 000 1370,,FAM-2,Primary Contact,Married,Visitor\n');
      },
      again: function () { st = { rows: null, head: null, map: {}, fileName: '', done: null }; H.render(); },
      go: function () {
        var recs = records(), famIds = {}, out = { added: 0, updated: 0, families: 0, noConsent: 0 };
        var consent = document.getElementById('im-consent').checked;
        recs.forEach(function (r) {
          var fid = '';
          if (r.family) {
            if (!famIds[r.family]) {
              var ex = S.find('families', function (f) { return f.elvantoId === r.family || f.name === r.family; })[0];
              if (!ex) { ex = S.put('families', { name: (/^[A-Z]+-?\d+$/i.test(r.family) ? r.lastName : r.family.replace(/ family$/i, '')) + ' family', custom: false, elvantoId: r.family }); out.families++; }
              famIds[r.family] = ex.id;
            }
            fid = famIds[r.family];
          }
          var p = matchExisting(r), isNew = !p;
          p = p ? JSON.parse(JSON.stringify(p)) : { active: true, appRole: Store.defaultRole(), keyDates: [], source: 'elvanto' };
          ['firstName', 'lastName', 'preferredName', 'email', 'mobile', 'birthDate'].forEach(function (k) { if (r[k]) p[k] = r[k]; });
          if (r.maritalStatus && !r.child) p.maritalStatus = (['Single', 'Engaged', 'Married', 'Separated', 'Divorced', 'Widowed'].filter(function (m) { return m.toLowerCase() === r.maritalStatus.toLowerCase(); })[0]) || 'Not known';
          if (!p.mobile && r.phone) p.mobile = r.phone;
          if (r.id) p.elvantoId = r.id;
          if (fid) p.familyId = fid;
          p.familyRole = r.child ? 'child' : 'adult';
          if (r.category) p.category = /visit/i.test(r.category) ? 'Visitor' : /staff/i.test(r.category) ? 'Staff' : 'Member'; else p.category = p.category || 'Member';
          S.put('people', p);
          if (consent && !PeopleHelpers.hasConsent(p.id, 'Church records')) S.put('consents', { personId: p.id, purpose: 'Church records', given: true, date: H.today(), method: 'Carried over from Elvanto', recordedBy: H.name(H.user()), guardianId: '' });
          if (!PeopleHelpers.hasConsent(p.id, 'Church records')) out.noConsent++;
          if (isNew) out.added++; else out.updated++;
        });
        S.audit('Imported ' + recs.length + ' people from Elvanto (' + st.fileName + ')', 'people');
        st.done = out; st.rows = null; H.render(); H.toast('Import finished');
      }
    }
  });
})();
