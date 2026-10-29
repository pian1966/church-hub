/* Church Hub – Import: people from Elvanto (People export as CSV; rules in js/elvanto-import.js) and leave from Leave Manager (js/leave-import.js). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store;
  var E = ElvantoImport;
  var st = { rows: null, head: null, map: {}, fileName: '', done: null, cats: {} };
  /* ---------- photos from Elvanto: downloaded one at a time after the import, for people who have none yet ---------- */
  var pics = null;   // { todo, done, failed, running }
  function photoNote() {
    if (!pics || !pics.todo) return '';
    return '<div class="note ' + (pics.running ? 'info' : 'ok') + '" id="im-pics" role="status">' + (pics.running
      ? '<svg class="busy-cross" viewBox="0 0 48 48" aria-hidden="true"><rect x="22.6" y="3" width="2.8" height="42" rx="1.4"/><rect x="11" y="15.6" width="26" height="2.8" rx="1.4"/></svg>Bringing in photos from Elvanto: ' + (pics.done + pics.failed) + ' of ' + pics.todo + '. Please keep this page open.'
      : '<b>Photos:</b> ' + pics.done + ' brought in from Elvanto' + (pics.failed ? ', ' + pics.failed + ' couldn’t be downloaded (they can be added by hand on each person’s page)' : '') + '.') + '</div>';
  }
  function fetchPhotos(queue) {
    pics = { todo: queue.length, done: 0, failed: 0, running: true };
    var show = function () { var el = document.getElementById('im-pics'); if (el) el.outerHTML = photoNote(); };
    var next = function (i) {
      if (i >= queue.length) {
        pics.running = false; show();
        S.audit('Imported ' + pics.done + ' photos from Elvanto' + (pics.failed ? ' (' + pics.failed + ' could not be downloaded)' : ''), 'people');
        return;
      }
      var q = queue[i];
      fetch(q.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .catch(function () { if (q.url.indexOf('_thumb') >= 0 || !q.thumb) throw new Error('no picture'); return fetch(q.thumb).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }); })
        .then(H.shrinkPhoto)
        .then(function (data) { var p = S.get('people', q.pid); if (p && !p.photo) return S.setPhoto(q.pid, data); })
        .then(function () { pics.done++; }, function () { pics.failed++; })
        .then(function () { show(); next(i + 1); });
    };
    next(0);
  }
  /** Elvanto's department positions ("10:00 Reading") → this person's serving, with the services they serve at.
   *  Adds to what they already have; never takes anything away. */
  function servingFrom(pid, list, out) {
    var want = {}, sl = Serving.slots(S.settings()), nSlots = sl.length;
    var slotFor = function (time) { var x = sl.filter(function (y) { return y.time === time && !y.venue; })[0] || sl.filter(function (y) { return y.time === time; })[0]; return x ? x.id : time; };
    list.forEach(function (x) {
      var pos = Serving.findPosition(x.name, S.list('positions'));
      if (!pos) { out.unknown[x.name] = 1; return; }
      var w = want[pos.id] = want[pos.id] || {};
      if (/^\d\d:\d\d$/.test(x.time)) w[slotFor(x.time)] = 1;
    });
    Object.keys(want).forEach(function (posId) {
      var times = Object.keys(want[posId]).sort(), k = S.find('skills', function (s) { return s.personId === pid && s.positionId === posId; })[0];
      if (k) {
        if (!k.times || !k.times.length) return;   // already serves at any service
        var u = k.times.concat(times).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
        if (u.length === k.times.length) return;
        k = JSON.parse(JSON.stringify(k)); k.times = u.length >= nSlots ? [] : u;
      } else k = { personId: pid, positionId: posId, frequency: 'fortnightly', times: times.length >= nSlots ? [] : times };
      S.put('skills', k); out.serving++;
    });
  }
  /* ---------- unavailable dates the robot read in Elvanto (Leave → Elvanto: "Read Elvanto's unavailable dates") ---------- */
  var un = { pick: {}, skip: {} };   // choices for names that need one; entries left out
  function unKey(x, i) { return i + '|' + x.from; }
  function renderUnavailable() {
    var h = '<div class="page-head"><div><h1>Unavailable dates from Elvanto</h1><p class="lead">Who is unavailable in Elvanto, read by the robot every night. Check them and add them to Church Hub as away dates, so rosters here know too. Nothing is changed in Elvanto.</p></div></div>' + tabs('unavailable');
    var f = S.get('elvantoFound', 'unavailable'), el = (S.settings() || {}).elvanto || {};
    if (!f) return h + '<p class="empty">' + (el.read ? 'The robot hasn’t read Elvanto yet – it does so every night at about 3am.' : 'Switch this on under <a href="#/leave/elvanto">Leave → Elvanto</a> (“Read Elvanto’s unavailable dates every night”). The robot needs to be set up first – see the guide in docs/ELVANTO-ROBOT.md.') + '</p>';
    var rows = E.matchFound(f.entries || [], S.list('people'), S.list('blockouts'));
    var name = function (id) { var p = S.get('people', id); return p ? H.name(p) : ''; };
    var when = function (x) { return H.fmt(x.from, true) + (x.to && x.to !== x.from ? ' – ' + H.fmt(x.to, true) : ''); };
    var groups = { new: [], pick: [], have: [], leave: [] };
    rows.forEach(function (x, i) { x.key = unKey(x, i); if (x.status === 'new') groups.new.push(x); else if (x.status === 'several' || x.status === 'nomatch') groups.pick.push(x); else groups[x.status].push(x); });
    var ready = groups.new.filter(function (x) { return !un.skip[x.key]; }).length + groups.pick.filter(function (x) { return un.pick[x.key] && !un.skip[x.key]; }).length;
    h += '<p class="muted small">Read ' + esc(f.readAt ? new Date(f.readAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '') + ' · ' + (f.entries || []).length + ' entries from today on' + (f.unread ? ' · ' + f.unread + ' row(s) the robot couldn’t read – check those in Elvanto' : '') + '</p>';
    if (groups.new.length || groups.pick.length) h += '<div class="btns" style="margin:0 0 14px"><button class="btn primary" data-act="import:unapply"' + (ready ? '' : ' disabled') + '>Add ' + ready + ' away date' + (ready === 1 ? '' : 's') + '</button></div>';
    var tick = function (x) { return '<input type="checkbox" class="un-on" data-k="' + esc(x.key) + '"' + (un.skip[x.key] ? '' : ' checked') + ' aria-label="Add this">'; };
    if (groups.new.length) h += '<section class="panel"><h2>Ready to add (' + groups.new.length + ')</h2><div class="list">' + groups.new.map(function (x) {
      return '<label class="item">' + tick(x) + '<span class="grow"><b>' + esc(name(x.personId)) + '</b><small>' + esc(when(x)) + (x.name.toLowerCase() !== name(x.personId).toLowerCase() ? ' · in Elvanto: ' + esc(x.name) : '') + '</small></span></label>';
    }).join('') + '</div></section>';
    if (groups.pick.length) h += '<section class="panel"><h2>Choose who it is (' + groups.pick.length + ')</h2><p class="hint" style="margin-top:0">The name in Elvanto matches more than one person in Church Hub, or no one exactly.</p><div class="list">' + groups.pick.map(function (x) {
      return '<div class="item" style="flex-wrap:wrap">' + tick(x) + '<span class="grow" style="min-width:180px"><b>' + esc(x.name) + '</b><small>' + esc(when(x)) + ' · ' + (x.status === 'several' ? 'several people with this name' : 'no one with this exact name') + '</small></span>' +
        '<select class="un-pick" data-k="' + esc(x.key) + '" aria-label="Who is ' + esc(x.name) + '"><option value="">Choose…</option>' + x.choices.map(function (id) { return '<option value="' + id + '"' + (un.pick[x.key] === id ? ' selected' : '') + '>' + esc(name(id)) + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div></section>';
    if (groups.have.length || groups.leave.length) h += '<details class="panel"><summary><b>Already in Church Hub (' + (groups.have.length + groups.leave.length) + ')</b></summary><p class="small muted">' +
      groups.have.map(function (x) { return esc(name(x.personId) + ', ' + when(x)); }).concat(groups.leave.map(function (x) { return esc(x.name + ', ' + when(x) + ' (leave)'); })).join('<br>') + '</p></details>';
    if (!rows.length) h += '<p class="empty">No one is unavailable in Elvanto from today on.</p>';
    return h;
  }
  function recs() { return E.records(st.rows, st.map, H.today()); }
  /** A short, stable family reference from Elvanto's family key (which may be names). */
  function famRef(key) { var h = 5381; for (var i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0; return /^[\w-]{1,40}$/.test(key) && !/\s/.test(key) ? key : 'EF-' + h.toString(36); }
  function fromElvanto() { return S.find('people', function (p) { return p.source === 'elvanto' && p.firstName !== 'Deleted'; }); }

  function tabs(active) {
    return '<nav class="seg" aria-label="Import from" style="margin-bottom:18px"><a href="#/import" class="' + (active === 'elvanto' ? 'on' : '') + '">From Elvanto</a><a href="#/import/leave" class="' + (active === 'leave' ? 'on' : '') + '">From Leave Manager</a><a href="#/import/unavailable" class="' + (active === 'unavailable' ? 'on' : '') + '">Unavailable dates from Elvanto</a></nav>';
  }

  function render() {
    var h = '<div class="page-head"><div><h1>Import from Elvanto</h1><p class="lead">Bring your people and households (Elvanto’s “families”) across from Elvanto. Nothing is changed in Elvanto.</p></div></div>' + tabs('elvanto');
    var already = fromElvanto().length;
    if (st.done) {
      h += photoNote() + '<div class="note ok"><b>Imported.</b> ' + st.done.added + ' added, ' + st.done.updated + ' updated, ' + st.done.families + ' families created.' + (st.done.serving ? ' ' + st.done.serving + ' volunteering positions.' : '') + (st.done.receive ? ' ' + st.done.receive + ' “would like to receive” choices.' : '') +
        (st.done.unknown && st.done.unknown.length ? ' Positions Church Hub doesn’t have (left out): ' + esc(st.done.unknown.join(', ')) + '.' : '') + (st.done.links ? ' ' + st.done.links + ' children linked to their parents – please confirm them (see Home).' : '') + (st.done.noConsent ? ' ' + st.done.noConsent + ' people need consent recorded – see the to-do list on Home.' : '') + '</div><div class="btns"><a class="btn primary" href="#/people">Open People</a><button class="btn" data-act="import:again">Import another file</button></div>';
      return h;
    }
    if (!st.rows) {
      return h + '<div class="grid2"><section class="panel"><h2>1. Export from Elvanto</h2><ol style="margin:0;padding-left:20px;line-height:1.7"><li>In Elvanto, open <b>People</b> and clear the filters so everyone is listed.</li><li>Choose <b>Export</b> → <b>CSV</b>.</li></ol>' +
        '<p class="hint">Church Hub reads only: <b>Member ID</b> (please include it – it stops people being doubled when you import again), Date Added, names (with Middle Name), Email Address, Cellphone Number, Date of Birth, Gender, Family Relationship, Primary &amp; Spouse Full Names, Marital Status, Anniversary, People Category, Membership Date and Membership last renewed on, Archived, Deceased, <b>Photo</b> (downloaded from Elvanto and made small), ID Number (Administrators only), Notes (church office notes), Checklist of what to receive, Department Positions (volunteering) and the home address. Everything else (groups, giving, security codes…) is ignored – but it’s safer to leave those columns out of the export.</p>' +
        '<p class="hint">Keep the file on the church computer and delete it once imported – it contains personal information.</p></section>' +
        '<section class="panel"><h2>2. Choose the file</h2><label class="field">Elvanto export (.csv)<input type="file" id="im-file" accept=".csv,text/csv"></label><p class="hint">Or <button class="link" data-act="import:sample">try it with a made-up sample file</button>.</p></section></div>' +
        (already ? '<section class="panel" style="margin-top:16px"><h2>Start again</h2><p style="margin-top:0">' + already + ' ' + (already === 1 ? 'person was' : 'people were') + ' brought in from Elvanto. If an import went wrong, remove them and import again. People who have been given app access, are staff, or are you, are kept.</p>' +
          '<button class="btn" data-act="import:unimport">Remove everyone brought in from Elvanto</button></section>' : '');
    }
    var r = recs(), pl = E.plan(r, S.list('people'));
    Object.keys(pl.categories).forEach(function (c) { if (!st.cats[c]) st.cats[c] = E.guessCategory(c); });
    h += '<div class="note info">File: <b>' + esc(st.fileName) + '</b> – ' + st.rows.length + ' rows. Check the matching below, then import.</div>';
    h += '<div class="grid2"><section class="panel"><h2>Match the columns</h2>' + E.FIELDS.map(function (f) {
      return '<label class="field">' + esc(f[1]) + '<select class="im-map" data-f="' + f[0] + '"><option value="">— not in the file —</option>' + st.head.map(function (c, i) { return '<option value="' + i + '"' + (st.map[f[0]] === i ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>';
    }).join('') + '</section><div>' +
      '<section class="panel"><h2>What will happen</h2><div class="stats"><div class="stat"><span>New people</span><b>' + pl.added + '</b></div><div class="stat"><span>Already here (updated)</span><b>' + pl.updated + '</b></div><div class="stat"><span>Children</span><b>' + pl.children + '</b></div><div class="stat"><span>Households</span><b>' + pl.families + '</b></div></div>' +
      (pl.sharedEmails ? '<p class="hint">' + pl.sharedEmails + ' email address' + (pl.sharedEmails === 1 ? ' is' : 'es are') + ' shared by more than one person (e.g. a couple). They stay separate people.</p>' : '') +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>Name</th><th>Email</th><th>In Church Hub</th></tr></thead><tbody>' + pl.items.slice(0, 8).map(function (x) {
        var o = x.rec; return '<tr><td>' + esc(o.firstName + ' ' + o.lastName) + (o.child ? ' <span class="tag" style="--c:#0E7490">Child</span>' : '') + '</td><td>' + esc(o.email) + '</td><td>' + (x.personId ? 'Update (matched by ' + esc(x.how) + ')' : 'New') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (r.length > 8 ? '<p class="hint">…and ' + (r.length - 8) + ' more.</p>' : '') + '</section>' +
      '<section class="panel"><h2>Categories</h2><p class="hint" style="margin-top:0">What each Elvanto category becomes in Church Hub.</p>' + Object.keys(pl.categories).map(function (c) {
        return '<label class="field">' + esc(c || '(no category)') + ' <small>(' + pl.categories[c] + ')</small><select class="im-cat" data-c="' + esc(c) + '">' + E.CATEGORIES.map(function (x) { return '<option' + (st.cats[c] === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</section>' +
      '<section class="panel"><label class="check"><input type="checkbox" id="im-consent"><span>Elvanto records show these people agreed to the church keeping their details. <span class="muted small">Only tick if that’s true – otherwise you’ll be reminded to ask them (' + esc(PrivacyLaw.forChurch(S.settings()).short) + ').</span></span></label>' +
      '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="import:go"' + (st.map.firstName == null || st.map.lastName == null ? ' disabled' : '') + '>Import ' + r.length + ' people</button><button class="btn" data-act="import:again">Start again</button></div></section></div></div>';
    return h;
  }

  function load(name, text) {
    var rows = E.parseCSV(text);
    if (rows.length < 2) { H.toast('That file has no rows to import', true); return; }
    st.head = rows[0]; st.rows = rows.slice(1); st.map = E.guess(st.head); st.fileName = name; st.done = null; st.cats = {}; H.render();
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
    var y = LeaveCore.lyOf(H.today(), LeaveCore.ctx(lv).S), ded = (lv.types || []).filter(function (t) { return t.deducts && t.active !== false && lv.staff.some(function (st) { var x = LeaveCore.balances(lv, st.id, y)[t.code]; return x && x.entitled != null; }); });
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
      ded.map(function (t) { return '<th class="lt">' + esc(t.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lv.staff.filter(function (st) { return LeaveCore.tracksLeave({ level: st.level }); }).map(function (st) {
        var b = LeaveCore.balances(lv, st.id, y);
        return '<tr><td>' + esc(st.name) + '</td>' + ded.map(function (t) { var x = b[t.code]; return '<td class="lt">' + (x && x.entitled != null ? LeaveCore.fmtDays(x.available) : '<span class="muted">–</span>') + '</td>'; }).join('') + '</tr>';
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
        if (q && (lst.opt.details || !q.staff)) { q = JSON.parse(JSON.stringify(q)); q.staff = sd; if (!q.category) q.category = 'Staff'; /* a Church Partner who works for the church stays a Church Partner */ S.put('people', q); }
      }
    });
    var n = LI.applyLeave(S.leave(), pl, map, lst.opt.settings);
    S.saveLeave('Imported leave from Leave Manager (' + lst.files.join(', ') + '): ' + n.added + ' added, ' + n.updated + ' updated, ' + n.adjustments + ' adjustments' + (lst.opt.settings ? ', settings replaced' : ''), { quiet: true });   // Leave Manager already put its approved leave into Elvanto
    n.newPeople = newPeople; lst.done = n; lst.tables = null; H.render(); H.toast('Leave imported');
  }

  H.register({
    id: 'import', name: 'Import', desc: 'Bring people across from Elvanto, and leave from Leave Manager', icon: H.ICON.import, tint: '#A16207', roles: ['admin'],
    render: function (parts) { return !H.can('*') ? '<p class="empty">Only Administrators can import.</p>' : parts && parts[0] === 'leave' ? renderLeave() : parts && parts[0] === 'unavailable' ? renderUnavailable() : render(); },
    after: function () {
      document.querySelectorAll('.un-on').forEach(function (b) { b.addEventListener('change', function () { if (b.checked) delete un.skip[b.dataset.k]; else un.skip[b.dataset.k] = 1; H.render(); }); });
      document.querySelectorAll('.un-pick').forEach(function (s) { s.addEventListener('change', function () { if (s.value) un.pick[s.dataset.k] = s.value; else delete un.pick[s.dataset.k]; H.render(); }); });
      var lf = document.getElementById('lm-file');
      if (lf) lf.addEventListener('change', function () { if (lf.files.length) readFiles(Array.prototype.slice.call(lf.files)); });
      document.querySelectorAll('.lm-who').forEach(function (s) { s.addEventListener('change', function () { lst.choice[s.dataset.id] = s.value; H.render(); }); });
      ['lm-set', 'lm-det'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('change', function () { lst.opt[id === 'lm-set' ? 'settings' : 'details'] = b.checked; H.render(); }); });
      var f = document.getElementById('im-file');
      if (f) f.addEventListener('change', function () { var file = f.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { load(file.name, rd.result); }; rd.readAsText(file); });
      document.querySelectorAll('.im-map').forEach(function (s) { s.addEventListener('change', function () { st.map[s.dataset.f] = s.value === '' ? null : +s.value; H.render(); }); });
      document.querySelectorAll('.im-cat').forEach(function (s) { s.addEventListener('change', function () { st.cats[s.dataset.c] = s.value; }); });
    },
    actions: {
      unapply: function () {
        var f = S.get('elvantoFound', 'unavailable'); if (!f) return;
        var rows = E.matchFound(f.entries || [], S.list('people'), S.list('blockouts')), todo = [];
        rows.forEach(function (x, i) {
          var k = unKey(x, i); if (un.skip[k]) return;
          var pid = x.status === 'new' ? x.personId : (x.status === 'several' || x.status === 'nomatch') ? un.pick[k] : '';
          if (pid && !S.find('blockouts', function (b) { return b.personId === pid && b.from === x.from && (b.to || b.from) === x.to; }).length) todo.push({ personId: pid, from: x.from, to: x.to });
        });
        if (!todo.length) return;
        H.busy('Adding ' + todo.length + ' away dates…', function () {
          todo.forEach(function (b) { S.put('blockouts', { personId: b.personId, from: b.from, to: b.to, reason: 'Unavailable in Elvanto', source: 'elvanto' }); });
          S.audit('Added ' + todo.length + ' away dates from Elvanto’s Unavailable Volunteers', 'blockouts');
          un = { pick: {}, skip: {} }; H.render(); H.toast(todo.length + ' away date' + (todo.length === 1 ? '' : 's') + ' added');
        });
      },
      lgo: function (el) { if (!H.confirmBtn(el, 'Click again to import')) return; H.busy('Importing from Leave Manager…', applyLeaveImport); },
      lagain: function () { lst = { tables: null, files: [], choice: {}, opt: { settings: true, details: true }, done: null, busy: false }; H.render(); },
      lsample: function () {
        var names = ['Staff', 'Requests', 'Adjustments', 'Categories', 'Leave Types', 'School Terms', 'Public Holidays', 'Settings'];
        Promise.all(names.map(function (n) { return fetch('tests/fixtures/leave-manager/' + encodeURIComponent(n) + '.csv').then(function (r) { if (!r.ok) throw new Error(); return r.text(); }); }))
          .then(function (texts) { loaded(texts.map(LI.parseCSV), ['made-up Leave Manager sheet']); })
          .catch(function () { H.toast('Couldn’t load the made-up sheet', true); });
      },
      sample: function () {
        load('elvanto-people-sample.csv', 'Member ID,First Name,Last Name,Preferred Name,Email Address,Cellphone Number,Date of Birth,Primary & Spouse Full Names,Family Relationship,Marital Status,People Category,Archived,Deceased\n' +
          'e101,Brian,Fourie,,fourie.family@example.com,083 111 2222,"12 March, 1975",Brian & Karen Fourie,Primary,Married,Member,No,No\n' +
          'e102,Karen,Fourie,,fourie.family@example.com,083 111 3333,"1 July, 1978",Brian & Karen Fourie,Spouse,Married,Member,No,No\n' +
          'e103,Mia,Fourie,,fourie.family@example.com,,"12 May, 2014",Brian & Karen Fourie,Child,,Member,No,No\n' +
          'e104,Sipho,Mahlangu,Sips,sipho.m@example.com,072 555 1234,4 June,Sipho Mahlangu,,Single,Regular attender,No,No\n' +
          'e105,Jason,Naidoo,,jason.naidoo@example.com,082 000 1370,,Jason & Priya Naidoo,Primary,Married,Visiting Preacher,No,No\n');
      },
      again: function () { st = { rows: null, head: null, map: {}, fileName: '', done: null, cats: {} }; H.render(); },
      go: function (el) {
        if (!H.confirmBtn(el, 'Click again to import')) return;
        H.busy('Importing people from Elvanto…', function () {
        var r = recs(), pl = E.plan(r, S.list('people')), famIds = {}, ids = {}, out = { added: 0, updated: 0, families: 0, noConsent: 0, links: 0, ids: 0, notes: 0, receive: 0, serving: 0, unknown: {} };
        // Volunteering needs the church's departments and positions: add any that are missing first
        if (r.some(function (o) { return o.positions && o.positions.length; }) && window.Serving) {
          var addD = Serving.missing(S.list('teams'), S.list('positions'));
          if (addD.positions.length) {
            addD.teams.forEach(function (t) { S.put('teams', t); }); addD.positions.forEach(function (x) { S.put('positions', x); });
            S.audit('Set up the church’s departments for the Elvanto import: ' + addD.teams.length + ' departments and ' + addD.positions.length + ' positions added', 'teams');
          }
        }
        var consent = document.getElementById('im-consent').checked, today = H.today(), photoQueue = [];
        pl.items.forEach(function (x) {
          var o = x.rec, fid = '';
          if (o.family) {
            var ref = famRef(o.family);
            if (!famIds[ref]) {
              var ex = S.find('families', function (f) { return f.elvantoId === ref; })[0];
              if (!ex) { ex = S.put('families', { name: o.lastName + ' family', custom: false, elvantoId: ref }); out.families++; }
              famIds[ref] = ex.id;
            }
            fid = famIds[ref];
          }
          var p = E.toPerson(o, x.personId ? S.get('people', x.personId) : null, st.cats, fid, today);
          if (!x.personId) p.appRole = Store.defaultRole();
          S.put('people', p);
          if (consent && !PeopleHelpers.hasConsent(p.id, 'Church records')) S.put('consents', { personId: p.id, purpose: 'Church records', given: true, date: today, method: 'Carried over from Elvanto', recordedBy: H.name(H.user()), guardianId: '' });
          if (!PeopleHelpers.hasConsent(p.id, 'Church records')) out.noConsent++;
          if (x.personId) out.updated++; else out.added++;
          ids[o.row] = p.id;
          if (o.photo && !p.photo && !p.mergedInto) photoQueue.push({ pid: p.id, url: o.photo, thumb: o.photoThumb });
          if (o.idNumber) { Store.setIdNumber(p.id, o.idNumber); out.ids++; }
          if (o.notes && !S.find('officeNotes', function (n) { return n.personId === p.id && n.text === o.notes; }).length) {
            S.put('officeNotes', { personId: p.id, text: o.notes, by: 'Elvanto', at: today }); out.notes++;
          }
          (o.receive || []).forEach(function (pur) {   // what they'd like to receive, into the consent register
            if (PeopleHelpers.consentFor(p.id, pur)) return;
            S.put('consents', { personId: p.id, purpose: pur, given: true, date: today, method: 'Carried over from Elvanto', recordedBy: H.name(H.user()), guardianId: '' }); out.receive++;
          });
          servingFrom(p.id, o.positions || [], out);
        });
        // Children's parents from Elvanto's family relationships (unconfirmed, so someone checks them)
        E.guardianLinks(r, ids).forEach(function (l) {
          if (!S.find('guardians', function (g) { return g.childId === l.childId && g.adultId === l.adultId; }).length) { S.put('guardians', l); out.links++; }
        });
        S.audit('Imported ' + r.length + ' people from Elvanto (' + st.fileName + '): ' + out.added + ' added, ' + out.updated + ' updated' + (out.ids ? ', ' + out.ids + ' ID numbers' : '') + (out.notes ? ', ' + out.notes + ' notes' : '') +
          (out.receive ? ', ' + out.receive + ' “would like to receive” choices' : '') + (out.serving ? ', ' + out.serving + ' volunteering positions' : ''), 'people');
        out.unknown = Object.keys(out.unknown);
        st.done = out; st.rows = null; pics = null; H.render(); H.toast('Import finished');
        if (photoQueue.length) { fetchPhotos(photoQueue); H.render(); }
        });
      },
      unimport: function (el) {
        var me = H.user(), all = fromElvanto();
        var keep = all.filter(function (p) { return p.id === me.id || p.staff || ['admin', 'pastor', 'rosters', 'kids'].indexOf(p.appRole) >= 0; });
        var go = all.filter(function (p) { return keep.indexOf(p) < 0; });
        if (!H.confirmBtn(el, 'Click again: remove ' + go.length + ' people')) return;
        H.busy('Removing ' + go.length + ' people…', function () {
        go.forEach(function (p) {
          S.find('consents', function (c) { return c.personId === p.id; }).forEach(function (c) { S.remove('consents', c.id); });
          ['skills', 'blockouts', 'serveOffers'].forEach(function (c) { S.find(c, function (x) { return x.personId === p.id; }).forEach(function (x) { S.remove(c, x.id); }); });
          S.find('assignments', function (a) { return a.personId === p.id; }).forEach(function (a) { S.remove('assignments', a.id); });
          S.purge(p.id);
          S.find('guardians', function (l) { return l.childId === p.id || l.adultId === p.id; }).forEach(function (l) { S.remove('guardians', l.id); });
          S.find('noCollect', function (x) { return x.childId === p.id || x.personId === p.id; }).forEach(function (x) { S.remove('noCollect', x.id); });
          S.remove('people', p.id);
        });
        var gone = {}; go.forEach(function (p) { gone[p.id] = 1; });
        S.list('groups').slice().forEach(function (g) { if (g.memberIds.some(function (m) { return gone[m]; })) { var left = g.memberIds.filter(function (m) { return !gone[m]; }); if (left.length < 2) S.remove('groups', g.id); else { g = JSON.parse(JSON.stringify(g)); g.memberIds = left; S.put('groups', g); } } });
        S.find('families', function (f) { return f.elvantoId && !S.find('people', function (p) { return p.familyId === f.id; }).length; }).forEach(function (f) { S.remove('families', f.id); });
        S.audit('Removed ' + go.length + ' people brought in from Elvanto, to import again' + (keep.length ? ' (kept ' + keep.length + ' with app access or staff details)' : ''), 'people');
        H.render(); H.toast(go.length + ' removed' + (keep.length ? ', ' + keep.length + ' kept' : '') + ' – now import the file again');
        });
      }
    }
  });
})();
