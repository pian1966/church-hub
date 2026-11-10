/*
 * Church Hub – Ask in your own words, with AI. The question goes to Google's Gemini (through the church's own Firebase
 * project: Firebase AI Logic) together with a description of the search: which fields this person may search on, how
 * each can be compared and, for choices, the allowed values. No records about anyone are sent – no names from the
 * church, no households, no contact details (docs/POPIA.md, "Ask in your own words").
 * Gemini answers with filters as JSON; check() then accepts only fields, comparisons and values that exist for this
 * person, so the AI can't widen what they may see. Anything it leaves out or gets wrong is listed, like the rules do.
 * If the AI can't be reached, Church Hub uses the built-in rules (js/ask.js) instead.
 *
 *   AskAI.request(question, fields, ctx) → the body to send to Gemini's generateContent
 *   AskAI.check(answer, fields, ctx)     → { kind, filters, match, logic, refused, unknown, said, q, noPerson, ai: true } (as Ask.parse)
 *   AskAI.read(response)                 → the JSON Gemini wrote, from its generateContent response (or null)
 * fields: [{ key, label (English), type, options }] – Advanced search's fields for this person (people/search.js).
 * ctx: as for Ask.parse (today, services, words, slots, positions, people, slotLabel).
 * Pure functions, tested with node: tests/ask-ai.test.js.
 */
var AskAI = (function () {
  'use strict';
  var PS = typeof PeopleSearch !== 'undefined' ? PeopleSearch : require('./people-search.js');
  var AskR = typeof Ask !== 'undefined' ? Ask : require('./ask.js');
  /** The model: Gemini's low-cost, high-volume one, available without billing (Settings can name another). */
  var MODEL = 'gemini-3.5-flash-lite';
  // Lists of names that are safe to send (no one's name or household): their values help the AI spell them as the church does
  var SAFE_LISTS = ['positions', 'teams', 'serviceTimes', 'consents', 'receive', 'careGroup', 'midweekGroup', 'country'];
  var UNITS = ['days', 'weeks', 'months', 'years'];

  function opsOf(type) { return (PS.OPS[type] || []).map(function (o) { return o[0]; }); }

  /** What the AI is told about the search: each field, its comparisons, and its choices where they're safe to share. */
  function describe(fields) {
    return fields.filter(function (f) { return !f.noAsk; }).map(function (f) {
      var d = { key: f.key, label: f.en || f.label, type: f.type, ops: opsOf(f.type) };
      if ((f.type === 'choice' || SAFE_LISTS.indexOf(f.key) >= 0) && f.options && f.options.length) d.options = f.options.slice(0, 80);
      return d;
    });
  }

  var RULES = [
    'You turn a question from a church office (staff or a leader) into a search for Church Hub, a church membership app. Reply with JSON only.',
    'kind: "people" for questions about people; "services" for questions about church services and the serving roster.',
    'For people: filters is a list of { field, op, value, value2, unit } using ONLY the fields and ops given. Never invent a field.',
    'Choice and list values must be copied exactly from that field\'s options. Text values are lower case, as typed (e.g. "m" for "names beginning with M" with op "starts").',
    'Dates are yyyy-mm-dd. Ops "next" and "last" need value (a number, as text) and unit (days, weeks, months or years). Anniversary op "month" takes the month number (1-12). "between" needs value and value2.',
    'Ops "empty", "nempty", "yes" and "no" take no value. "Has no X" / "without X" / "doesn\'t belong to a X" is op "empty" on that field; "has a X" is "nempty".',
    'Questions about someone\'s husband, wife, spouse or partner use the fields whose key starts with "spouse". If a spouse "is not" something, also add { field: "spouse", op: "nempty" } so only people with a spouse are found.',
    'Category means church membership (e.g. Church Partner, Attender). "Members", "partners" and the church\'s own word for Church Partner mean category Church Partner, unless the question is about a husband or wife.',
    'match: "all" (every filter), "any" (at least one) or "logic" with logic like "(1 OR 2) AND 3", where the numbers are filter positions starting at 1.',
    'For services: services = { from, to, slots (labels from the services list), part (morning, afternoon or evening), gaps ("some" = not all positions filled, "none" = all filled), personName, sameDay ("morning-evening" or "twice"), missingPos (position names) }. With no dates, leave from and to empty (Church Hub then shows services from today).',
    'notUnderstood: the words of the question you could not turn into filters (empty when everything was used). understood: one short line saying what you searched for.',
    'If the question needs something no field covers, leave it out and put those words in notUnderstood. Never guess a value.'
  ].join('\n');

  var SCHEMA = {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['people', 'services'] },
      filters: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, op: { type: 'string' }, value: { type: 'string' }, value2: { type: 'string' }, unit: { type: 'string' } }, required: ['field', 'op'] } },
      match: { type: 'string', enum: ['all', 'any', 'logic'] },
      logic: { type: 'string' },
      services: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, slots: { type: 'array', items: { type: 'string' } }, part: { type: 'string' }, gaps: { type: 'string' },
        personName: { type: 'string' }, sameDay: { type: 'string' }, missingPos: { type: 'array', items: { type: 'string' } } } },
      notUnderstood: { type: 'array', items: { type: 'string' } },
      understood: { type: 'string' }
    },
    required: ['kind']
  };

  /** The request for Gemini's generateContent: the rules, then the search's description and the question. */
  function request(question, fields, ctx) {
    ctx = ctx || {};
    var W = ctx.words || {}, own = [];
    if (W.partner && W.partner[0] && W.partner[0] !== 'Church Partner') own.push('Church Partner is called "' + W.partner[0] + '" here');
    if (W.attender && W.attender[0] && W.attender[0] !== 'Attender') own.push('Attender is called "' + W.attender[0] + '" here');
    var about = {
      today: ctx.today, country: ctx.country || '', churchWords: own,
      fields: describe(fields),
      services: ctx.services ? (ctx.slots || []).map(function (s) { return { label: s.label, time: s.time || '' }; }) : 'not allowed – this person can\'t see the rosters',
      positions: ctx.services ? (ctx.positions || []).slice(0, 120) : []
    };
    return {
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [{ role: 'user', parts: [{ text: 'The search:\n' + JSON.stringify(about) + '\n\nThe question:\n' + String(question || '').slice(0, 500) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 1200 }
    };
  }

  /** The JSON Gemini wrote, from a generateContent response. */
  function read(resp) {
    try {
      var parts = resp.candidates[0].content.parts, t = parts.map(function (p) { return p.text || ''; }).join('');
      t = t.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '');
      return JSON.parse(t);
    } catch (e) { return null; }
  }

  function isoDay(v) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(v || '').trim()); if (!m) return '';
    var d = new Date(+m[1], m[2] - 1, +m[3]); return d.getMonth() === m[2] - 1 && d.getDate() === +m[3] ? m[0] : '';
  }
  function isNum(v) { return /^-?\d+(\.\d+)?$/.test(String(v == null ? '' : v).trim()); }

  /** One filter from the AI, made safe: the field must be one this person has, the op one of its ops, the value fit for both. */
  function oneFilter(x, byKey) {
    if (!x || typeof x !== 'object') return { bad: 'something' };
    var f = byKey[x.field];
    if (!f) return { refused: String(x.field || '') };
    var op = String(x.op || ''), ops = opsOf(f.type), name = f.label || f.en || f.key;
    if (ops.indexOf(op) < 0) return { bad: name };
    var out = { field: f.key, op: op, value: '', value2: '', unit: '' }, v = x.value == null ? '' : String(x.value).trim(), v2 = x.value2 == null ? '' : String(x.value2).trim();
    if ({ empty: 1, nempty: 1, yes: 1, no: 1 }[op]) return { f: out };
    if (f.type === 'choice' || f.type === 'list') {
      var opt = (f.options || []).filter(function (o) { return String(o).toLowerCase() === v.toLowerCase(); })[0];
      if (opt === undefined) return { bad: name + ' “' + v + '”' };
      out.value = opt; return { f: out };
    }
    if (op === 'next' || op === 'last' || op === 'nnext' || op === 'nlast') {
      if (!isNum(v) || UNITS.indexOf(String(x.unit || '')) < 0) return { bad: name };
      out.value = String(Math.abs(Math.round(+v))); out.unit = x.unit; return { f: out };
    }
    if (f.type === 'anniv' && op === 'month') {
      if (!isNum(v) || +v < 1 || +v > 12) return { bad: name };
      out.value = String(+v); return { f: out };
    }
    if (f.type === 'date' || f.type === 'anniv') {
      out.value = isoDay(v); if (!out.value) return { bad: name };
      if (op === 'between') { out.value2 = isoDay(v2); if (!out.value2) return { bad: name }; }
      return { f: out };
    }
    if (f.type === 'number') {
      if (!isNum(v)) return { bad: name };
      out.value = String(+v);
      if (op === 'between') { if (!isNum(v2)) return { bad: name }; out.value2 = String(+v2); }
      return { f: out };
    }
    if (!v) return { bad: name };
    out.value = v.slice(0, 100); return { f: out };
  }

  /** "(1 OR 2) AND 3": only filter numbers that exist, AND / OR / NOT and brackets. */
  function okLogic(s, n) {
    s = String(s || '').trim(); if (!s || /[^0-9()\sANDORT]/i.test(s)) return '';
    var nums = s.match(/\d+/g) || []; if (!nums.length || nums.some(function (x) { return +x < 1 || +x > n; })) return '';
    var r = PS.parseLogic(s, n); if (!r || r.error || (r.unused && r.unused.length)) return '';
    return s.toUpperCase().replace(/\s+/g, ' ');
  }

  /** The AI's answer → the same shape as Ask.parse, keeping only what is allowed. */
  function check(ans, fields, ctx) {
    ctx = ctx || {};
    var out = { kind: ans && ans.kind === 'services' ? 'services' : 'people', filters: [], match: 'all', logic: '', refused: [], unknown: [], ai: true };
    if (!ans || typeof ans !== 'object') { out.failed = true; return out; }
    var notU = (Array.isArray(ans.notUnderstood) ? ans.notUnderstood : []).map(String).filter(Boolean).slice(0, 12);
    out.unknown = notU;
    if (ans.understood) out.understood = String(ans.understood).slice(0, 200);
    if (out.kind === 'services') {
      if (!ctx.services) { out.refused.push('services'); return out; }
      var sv = ans.services || {}, q = { from: isoDay(sv.from), to: isoDay(sv.to), slots: [], part: '', gaps: '', personId: '', personName: '', sameDay: '', missingPos: [] };
      (sv.slots || []).forEach(function (l) {
        var s = (ctx.slots || []).filter(function (x) { return String(x.label).toLowerCase() === String(l).toLowerCase() || String(x.id).toLowerCase() === String(l).toLowerCase(); })[0];
        if (s) { if (q.slots.indexOf(s.id) < 0) q.slots.push(s.id); } else out.unknown.push(String(l));
      });
      if (['morning', 'afternoon', 'evening'].indexOf(sv.part) >= 0) q.part = sv.part;
      if (sv.gaps === 'some' || sv.gaps === 'none') q.gaps = sv.gaps;
      if (sv.sameDay === 'morning-evening' || sv.sameDay === 'twice') q.sameDay = sv.sameDay;
      (sv.missingPos || []).forEach(function (n) {
        var p = (ctx.positions || []).filter(function (x) { return String(x).toLowerCase() === String(n).toLowerCase(); })[0];
        if (p) q.missingPos.push(p); else out.unknown.push(String(n));
      });
      if (sv.personName) {   // matched here, against the church's own list (never sent to the AI)
        var want = String(sv.personName).toLowerCase().trim(), hit = (ctx.people || []).filter(function (p) { return (p.names || []).some(function (n) { return String(n).toLowerCase() === want; }); })[0];
        if (hit) { q.personId = hit.id; q.personName = hit.names[0]; } else out.noPerson = String(sv.personName).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      }
      if (!q.from && !q.to) q.from = ctx.today;
      out.q = q; out.said = AskR.sayServices(q, ctx.slotLabel || function (id) { return id; });
      return out;
    }
    var byKey = {}; fields.forEach(function (f) { byKey[f.key] = f; });
    var kept = [];   // positions of the AI's filters that were kept, for its logic
    (Array.isArray(ans.filters) ? ans.filters : []).slice(0, 12).forEach(function (x, i) {
      var r = oneFilter(x, byKey);
      if (r.f) { out.filters.push(r.f); kept.push(i + 1); }
      else if (r.refused) { if (out.refused.indexOf(r.refused) < 0) out.refused.push(r.refused); }
      else if (r.bad) out.unknown.push(r.bad);
    });
    if (ans.match === 'any') out.match = 'any';
    if (ans.match === 'logic' && kept.length === (ans.filters || []).length) {
      var lg = okLogic(ans.logic, out.filters.length);
      if (lg) { out.match = 'logic'; out.logic = lg; }
    }
    return out;
  }

  return { MODEL: MODEL, request: request, read: read, check: check, describe: describe };
})();
if (typeof module !== 'undefined') module.exports = AskAI;
