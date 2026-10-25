/*
 * Church Hub – reading a Leave Manager Google Sheet (downloaded as Excel, or its tabs as CSV files) and working out what to
 * import. Pure functions (no screen, no Store), so it can be tested with node: see tests/leave-import.test.js.
 *
 * Leave Manager's tabs and columns are fixed (leave-manager/apps-script/Code.gs, HEADERS). Each table is recognised by its
 * column headings, whatever the file or tab is called. The Staff tab's PIN column is dropped as soon as it is read.
 */
var LeaveImport = (function () {
  'use strict';
  var C = (typeof LeaveCore !== 'undefined') ? LeaveCore : require('./leave-core.js');

  /** Which Leave Manager tab a table is, from its headings. */
  var KINDS = [
    ['requests', ['ID', 'Staff ID', 'Type', 'Start', 'End', 'Status']],
    ['adjustments', ['Staff ID', 'Leave Year', 'Type', 'Days']],
    ['staff', ['ID', 'Name', 'Email', 'Category']],
    ['types', ['Code', 'Name', 'Deducts Balance']],
    ['levels', ['Category', 'Working Days']],
    ['terms', ['Term', 'Start', 'End']],
    ['holidays', ['Date', 'Name']],
    ['settings', ['Key', 'Value']],
    ['rules', ['Rule', 'Type', 'Minimum']],
    ['history', ['When', 'Action', 'Request ID']]
  ];
  var DATE_COLS = { Start: 1, End: 1, Date: 1, 'Start Date': 1, From: 0, To: 0 };
  var STAMP_COLS = { Submitted: 1, 'Decided On': 1, 'Cancelled On': 1 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** Excel day number → yyyy-mm-dd (and time, for stamps). */
  function serial(n, withTime) {
    var ms = Math.round((Number(n) - 25569) * 864e5), d = new Date(ms);
    var s = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    return withTime && (n % 1) ? s + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) : s;
  }
  /** A date as the sheet or Excel gives it → yyyy-mm-dd ('' if empty or unreadable). */
  function isoDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    if (typeof v === 'number') return serial(v);
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(s))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(s))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);   // dd/mm/yyyy (South Africa)
    return '';
  }
  function stamp(v) {
    if (typeof v === 'number') return serial(v, true);
    if (v instanceof Date) return isoDate(v) + ' ' + pad(v.getHours()) + ':' + pad(v.getMinutes());
    return String(v == null ? '' : v).trim();
  }
  function text(v) { return v instanceof Date ? isoDate(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v == null ? '' : v).trim(); }

  /** rows (array of arrays, first row = headings) → { kind, rows: [objects] } or null if not a Leave Manager tab. */
  function table(rows) {
    if (!rows || rows.length < 1) return null;
    var head = rows[0].map(function (h) { return String(h == null ? '' : h).trim(); });
    var kind = KINDS.filter(function (k) { return k[1].every(function (h) { return head.indexOf(h) >= 0; }); })[0];
    if (!kind) return null;
    var out = [];
    rows.slice(1).forEach(function (r) {
      if (!r || !r.some(function (x) { return String(x == null ? '' : x).trim() !== ''; })) return;
      var o = {};
      head.forEach(function (h, i) {
        if (!h || h === 'PIN') return;                    // never keep PINs
        var v = r[i];
        o[h] = DATE_COLS[h] ? (DATE_COLS[h] === 1 ? isoDate(v) : (typeof v === 'number' || v instanceof Date ? isoDate(v) : text(v))) : STAMP_COLS[h] ? stamp(v) : v;
      });
      out.push(o);
    });
    return { kind: kind[0], rows: out };
  }

  /** Several tables (from one Excel file or several CSV files) → { requests: [...], staff: [...], ... }. */
  function collect(listOfRowArrays) {
    var t = {};
    listOfRowArrays.forEach(function (rows) { var x = table(rows); if (x && !t[x.kind]) t[x.kind] = x.rows; });
    return t;
  }

  /** The sheet's tables in Leave Manager's own data shapes (as its loadData_ makes them). */
  function sheetData(t) {
    var B = C.truthy, out = {};
    if (t.settings) { out.settings = {}; t.settings.forEach(function (r) { var k = text(r.Key); if (k && !/^StandIn/.test(k)) out.settings[k] = text(r.Value); }); }
    if (t.types) out.types = t.types.filter(function (r) { return text(r.Code); }).map(function (r) {
      var useBy = r['Use By (next year)'];
      useBy = typeof useBy === 'number' || useBy instanceof Date ? isoDate(useBy).slice(5) : text(useBy);
      var unit = text(r['Counted In']) || 'Days';
      return { code: text(r.Code), name: text(r.Name), colour: text(r.Colour) || '#64748B', deducts: B(r['Deducts Balance']), halfDay: B(r['Half Days']),
        proRata: B(r['Pro Rata']), needsApproval: B(r['Needs Approval']), unit: unit, allowedDays: text(r['Allowed Days']), accumulates: B(r.Accumulates),
        carryMax: Number(r['Carry Over Max'] || 0), perTerm: Number(r['Per Term Max'] || 0) || (/weekend/i.test(unit) ? 1 : 0), maxBalance: Number(r['Max Balance'] || 0),
        useBy: useBy, active: r['In Use'] === undefined || text(r['In Use']) === '' ? true : B(r['In Use']) };
    });
    var codes = (out.types || []).map(function (x) { return x.code; });
    if (t.levels) out.levels = t.levels.filter(function (r) { return text(r.Category); }).map(function (r) {
      var ent = {};
      Object.keys(r).forEach(function (k) { if (k !== 'Category' && k !== 'Working Days' && (!codes.length || codes.indexOf(k) >= 0) && text(r[k]) !== '' && !isNaN(r[k])) ent[k] = Number(r[k]); });
      return { level: text(r.Category), label: text(r.Category), workDays: text(r['Working Days']), ent: ent };
    });
    if (t.holidays) out.holidays = t.holidays.filter(function (r) { return r.Date; }).map(function (r) { return { date: r.Date, name: text(r.Name) }; });
    if (t.terms) out.terms = t.terms.filter(function (r) { return r.Start && r.End; }).map(function (r) { return { name: text(r.Term), start: r.Start, end: r.End }; });
    if (t.rules) out.rules = t.rules.filter(function (r) { return text(r.Rule || r.Type); }).map(function (r) {
      return { name: text(r.Rule), kind: text(r.Type), category: text(r.Category), days: text(r.Days), from: text(r.From), to: text(r.To), min: Number(r.Minimum) || 0,
        action: text(r.Action) || 'Warn', message: text(r.Message), active: text(r.Active) === '' ? true : B(r.Active) };
    });
    if (t.staff) out.staff = t.staff.filter(function (r) { return text(r.ID); }).map(function (r) {
      return { id: text(r.ID), name: text(r.Name), email: text(r.Email).toLowerCase(), level: text(r.Category), workDays: text(r['Working Days']),
        start: isoDate(r['Start Date']), active: text(r.Active) === '' ? true : B(r.Active) };
    });
    if (t.requests) out.requests = t.requests.filter(function (r) { return text(r.ID); }).map(function (r) {
      return { id: text(r.ID), submitted: text(r.Submitted), staffId: text(r['Staff ID']), staffName: text(r['Staff Name']), type: text(r.Type), start: r.Start, end: r.End || r.Start,
        half: text(r['Half Day']) || 'None', reason: text(r.Reason), status: text(r.Status) || 'Pending', decidedBy: text(r['Decided By']), decidedOn: text(r['Decided On']),
        note: text(r['Manager Note']), source: 'Leave Manager', cancelledBy: text(r['Cancelled By']), cancelledOn: text(r['Cancelled On']) };
    });
    if (t.adjustments) {
      var seen = {};
      out.adjustments = t.adjustments.filter(function (r) { return text(r['Staff ID']); }).map(function (r) {
        var key = [text(r['Staff ID']), Number(r['Leave Year']), text(r.Type)].join('-');
        seen[key] = (seen[key] || 0) + 1;
        return { id: 'LMA-' + key + '-' + seen[key], staffId: text(r['Staff ID']), year: Number(r['Leave Year']), type: text(r.Type), days: Number(r.Days) || 0, note: text(r.Note) };
      });
    }
    return out;
  }

  /** CSV text → rows (handles quotes, commas and line breaks inside quotes). */
  function parseCSV(textIn) {
    var rows = [], row = [], cell = '', q = false, t = String(textIn || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); rows.push(row);
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function splitName(n) { var p = String(n || '').trim().split(/\s+/); return { firstName: p[0] || '', lastName: p.slice(1).join(' ') || '' }; }

  /**
   * What importing would do.
   * people: Church Hub people ([{id, firstName, lastName, preferredName, email, active, familyRole}]).
   * Returns { data, matches: [{lm, personId|null, by}], requests, adjustments, skipped: {requests, adjustments}, unknownTypes, missing }
   */
  function plan(tables, people) {
    var d = sheetData(tables), map = {}, matches = [];
    var adults = (people || []).filter(function (p) { return p.familyRole !== 'child' && p.firstName !== 'Deleted'; });
    (d.staff || []).forEach(function (s) {
      var by = '', hit = s.email ? adults.filter(function (p) { return norm(p.email) === s.email; })[0] : null;
      if (hit) by = 'email';
      else {
        hit = adults.filter(function (p) { return norm(p.firstName + ' ' + p.lastName) === norm(s.name) || (p.preferredName && norm(p.preferredName + ' ' + p.lastName) === norm(s.name)); })[0];
        if (hit) by = 'name';
      }
      matches.push({ lm: s, personId: hit ? hit.id : null, by: by });
      if (hit) map[s.id] = hit.id;
    });
    var typeCodes = {}; (d.types || []).forEach(function (t) { typeCodes[t.code] = 1; });
    var unknownTypes = {};
    var requests = [], skippedReq = [];
    (d.requests || []).forEach(function (r) {
      if (d.types && !typeCodes[r.type]) unknownTypes[r.type] = 1;
      if (!C.isISO(r.start) || !C.isISO(r.end)) { skippedReq.push({ r: r, why: 'dates unreadable' }); return; }
      requests.push(r);
    });
    var missing = ['staff', 'requests'].filter(function (k) { return !tables[k]; });
    return { data: d, matches: matches, map: map, requests: requests, adjustments: d.adjustments || [], skipped: { requests: skippedReq },
      unknownTypes: Object.keys(unknownTypes), missing: missing, splitName: splitName };
  }

  /** The import, applied to a leave object (Church Hub's Store.leave()) with a staff-ID map (sheet ID → person ID). Returns counts. */
  function applyLeave(lv, pl, idMap, withSettings) {
    var d = pl.data, n = { added: 0, updated: 0, adjustments: 0, skipped: 0 };
    if (withSettings) {
      if (d.settings) Object.keys(d.settings).forEach(function (k) { lv.settings[k] = d.settings[k]; });
      ['types', 'levels', 'holidays', 'terms', 'rules'].forEach(function (k) { if (d[k]) lv[k] = JSON.parse(JSON.stringify(d[k])); });
    }
    var byId = {}; lv.requests.forEach(function (r, i) { byId[r.id] = i; });
    pl.requests.forEach(function (r) {
      var pid = idMap[r.staffId]; if (!pid) { n.skipped++; return; }
      var x = JSON.parse(JSON.stringify(r)); x.staffId = pid; delete x.staffName;
      if (byId[x.id] !== undefined) { lv.requests[byId[x.id]] = x; n.updated++; } else { lv.requests.push(x); n.added++; }
    });
    lv.adjustments = lv.adjustments || [];
    var adjIdx = {}; lv.adjustments.forEach(function (a, i) { adjIdx[a.id] = i; });
    pl.adjustments.forEach(function (a) {
      var pid = idMap[a.staffId]; if (!pid) return;
      var x = JSON.parse(JSON.stringify(a)); x.staffId = pid;
      if (adjIdx[x.id] !== undefined) lv.adjustments[adjIdx[x.id]] = x; else lv.adjustments.push(x);
      n.adjustments++;
    });
    return n;
  }

  return { parseCSV: parseCSV, table: table, collect: collect, sheetData: sheetData, plan: plan, applyLeave: applyLeave, isoDate: isoDate, splitName: splitName };
})();
if (typeof module !== 'undefined') module.exports = LeaveImport;
