/*
 * Church & Trellis – names from a paper sign-up sheet. Someone on the staff takes a photo of a handwritten list (or types the
 * names); the photo goes to Google's Gemini (through the church's own Firebase project: Firebase AI Logic, as for Ask in your
 * own words) which only *reads* the handwriting and sends back the names as written. Nothing from the church is sent with it –
 * no names, no records. Matching the names to people is done here, on the phone, against the people this person may see,
 * and they check every match before anyone is added (js/mod-events.js). POPIA: docs/POPIA.md "Events".
 *
 *   NameList.request(image, ctx)      → the body for Gemini's generateContent (image = { data: base64, mimeType })
 *   NameList.read(response)           → the JSON Gemini wrote (or null)
 *   NameList.rows(answer)             → [{ written, first, last, title, family, guests, mobile?, email? }] – tidied, crossed-out names left out
 *   NameList.fromText(text)           → the same rows from typed or pasted names (one per line; "John & Mary Smith" is two)
 *   NameList.match(rows, people)      → [{ row, status: 'sure' | 'maybe' | 'none', ids, options: [[ids]…] }]
 *   NameList.group(chosen, people)    → [{ lead, people: [ids], guests }] – one sign-up per household
 * Pure functions, tested with node: tests/name-list.test.js.
 */
var NameList = (function () {
  'use strict';
  var MAX_ROWS = 150, MAX_GUESTS = 20;

  var RULES = [
    'You read a photo of a handwritten sign-up sheet from a church (people writing their names down for an event). Reply with JSON only.',
    'List every name written on the sheet, top to bottom, in names. Leave out headings, column titles, dates, phone numbers, email addresses and anything that is not a person\'s name.',
    'written: the name exactly as written (fix nothing). first and last: your best reading of the first name and surname; leave one empty if it is not written. title: Mr, Mrs, Ms, Dr, Rev and so on, if written.',
    'Several people on one line ("John & Mary Smith", "Mr & Mrs Smith", "Peter and Jane Brown") are separate entries, each with the shared surname.',
    'A whole household ("The Smiths", "Smith family", "Naidoo x4") is ONE entry with last set and family true.',
    'guests: a number of extra people written next to a name ("+2", "x3" means 2 more, "and 2 friends") – otherwise 0.',
    'crossed: true if the name is crossed or scribbled out. unsure: true if the handwriting is hard to read.',
    'If the photo is not a list of names, reply with names empty and notAList true. Never invent a name.'
  ].join('\n');
  // Visitor cards and welcome sheets (People → Add from a photo): the mobile number and email address written by a name too
  var CONTACTS = 'mobile and email: the phone number and email address written with that name, exactly as written (empty if none). Leave out other phone numbers and addresses.';

  var SCHEMA = {
    type: 'object',
    properties: {
      names: { type: 'array', items: { type: 'object', properties: { written: { type: 'string' }, first: { type: 'string' }, last: { type: 'string' }, title: { type: 'string' },
        family: { type: 'boolean' }, guests: { type: 'integer' }, mobile: { type: 'string' }, email: { type: 'string' }, crossed: { type: 'boolean' }, unsure: { type: 'boolean' } }, required: ['written'] } },
      notAList: { type: 'boolean' }
    },
    required: ['names']
  };

  /** The request for Gemini: the rules, the photo, and the country (for the spelling of names). Nothing about anyone at church.
   *  ctx.contacts: also read the mobile number and email address written with each name (visitor cards). */
  function request(image, ctx) {
    ctx = ctx || {};
    return {
      systemInstruction: { parts: [{ text: ctx.contacts ? RULES.replace(', phone numbers and email addresses', '') + '\n' + CONTACTS : RULES }] },
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: (image && image.mimeType) || 'image/jpeg', data: (image && image.data) || '' } },
        { text: 'The sheet is from a church in ' + (ctx.country || 'South Africa') + '. Read the names.' }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 4000 }
    };
  }

  /** The JSON Gemini wrote, from a generateContent response. */
  function read(resp) {
    try {
      var t = resp.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
      return JSON.parse(t.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
    } catch (e) { return null; }
  }

  /* ---------- tidying names ---------- */
  function line(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 80); }
  /** Lower case, no accents or punctuation: "O’Brien-Smit" → "obrien smit". */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’'`.]/g, '').replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var TITLES = /^(mr|mrs|ms|miss|mx|dr|rev|revd|prof|pastor|ps|fr|sr|br|ds|mnr|mev|me|mej|ds)\.?$/i;
  function okEmail(s) { s = line(s, 120).replace(/\s+/g, ''); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s.toLowerCase() : ''; }
  function okMobile(s) { s = line(s, 30); return (s.match(/\d/g) || []).length >= 9 ? s.replace(/[^\d+ ()-]/g, '').trim() : ''; }
  function guestsOf(v) { var n = Math.round(+v || 0); return n > 0 ? Math.min(n, MAX_GUESTS) : 0; }

  /** Gemini's answer → tidy rows (crossed-out names and empty lines left out). */
  function rows(answer) {
    var list = answer && Array.isArray(answer.names) ? answer.names : [];
    return list.filter(function (x) { return x && typeof x === 'object' && !x.crossed && (line(x.written) || line(x.first) || line(x.last)); }).slice(0, MAX_ROWS).map(function (x) {
      var first = line(x.first, 40), last = line(x.last, 60);
      if (TITLES.test(first)) first = '';
      var r = { written: line(x.written) || line(first + ' ' + last), first: first, last: last, title: line(x.title, 10), family: !!x.family && !!last, guests: guestsOf(x.guests), unsure: !!x.unsure };
      if (okMobile(x.mobile)) r.mobile = okMobile(x.mobile);
      if (okEmail(x.email)) r.email = okEmail(x.email);
      return r;
    });
  }

  /** One typed name → its rows. "Smith, John" · "John & Mary Smith" · "Mr & Mrs Smith" · "The Smiths" · "Ann Lee +2". */
  function fromLine(raw) {
    var s = line(raw, 160).replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, ''), guests = 0, m, extra = {};
    if ((m = /\S+@\S+\.\S+/.exec(s)) && okEmail(m[0])) { extra.email = okEmail(m[0]); s = s.replace(m[0], ' '); }
    if ((m = /(\+?\d[\d ()-]{7,}\d)/.exec(s)) && okMobile(m[1])) { extra.mobile = okMobile(m[1]); s = s.replace(m[1], ' '); }
    s = s.replace(/[,;:\s]+$/, '').replace(/\s+/g, ' ').trim();
    return lineRows(s, extra.email || extra.mobile ? s : raw, guests).map(function (r, i) { if (i === 0) Object.assign(r, extra); return r; });
  }
  function lineRows(s, raw, guests) {
    var m;
    if ((m = /\s*(?:\+|x\s*)(\d{1,2})\s*$/i.exec(s))) { guests = guestsOf(m[1]); s = s.slice(0, m.index).trim(); }
    if (!s) return [];
    var written = line(raw, 80), fam;
    if ((fam = /^(?:the\s+)?(.+?)\s+(?:family|household|familie)$/i.exec(s) || /^the\s+(.+s)$/i.exec(s))) {
      return [{ written: written, first: '', last: fam[1], title: '', family: true, guests: guests, unsure: false }];
    }
    if ((m = /^([^,]+),\s*(.+)$/.exec(s))) s = m[2] + ' ' + m[1];        // "Smith, John"
    var parts = s.split(/\s*(?:&|\band\b|\ben\b|\+|\/)\s*/i).filter(Boolean);
    var lastWords = parts[parts.length - 1].split(' ').filter(function (w) { return !TITLES.test(w); });
    var shared = lastWords.length > 1 ? lastWords.slice(1).join(' ') : '';
    if (parts.length === 1) {
      var w = parts[0].split(' '), title = TITLES.test(w[0]) ? w.shift().replace('.', '') : '';
      if (title && w.length === 1) return [{ written: written, first: '', last: w[0], title: title, family: false, guests: guests, unsure: false }];
      return [{ written: written, first: w.length > 1 ? w[0] : w.join(' '), last: w.length > 1 ? w.slice(1).join(' ') : '', title: title, family: false, guests: guests, unsure: false }];
    }
    return parts.map(function (p, i) {
      var w = p.split(' '), title = TITLES.test(w[0]) ? w.shift().replace('.', '') : '';
      if (i === parts.length - 1) return { written: written, first: title && lastWords.length === 1 ? '' : w[0] || '', last: title && lastWords.length === 1 ? w.join(' ') : w.slice(1).join(' '), title: title, family: false, guests: i === 0 ? guests : 0, unsure: false };
      // an earlier person on the line: "John" (& Mary Smith) takes the shared surname; "Mr" (& Mrs Smith) too
      return { written: written, first: w.length ? w[0] : '', last: w.length > 1 ? w.slice(1).join(' ') : shared || (title ? lastWords.join(' ') : ''), title: title, family: false, guests: i === 0 ? guests : 0, unsure: false };
    }).map(function (r, i, all) { if (!r.last && r.title) r.last = all[all.length - 1].last; if (i > 0) r.guests = 0; return r; })
      .map(function (r, i) { if (i === 0) r.guests = guests; return r; });
  }
  /** Typed or pasted names, one per line (or separated by ; ), → rows. */
  function fromText(text) {
    var out = [];
    String(text || '').split(/\r?\n|;/).forEach(function (l) { fromLine(l).forEach(function (r) { if (out.length < MAX_ROWS) out.push(r); }); });
    return out;
  }

  /* ---------- matching names to people (on the phone) ---------- */
  /** How many letters must change to turn a into b. */
  function dist(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur, i, j;
    if (Math.abs(m - n) > 3) return 9;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  /** A name as it sounds, roughly: "Thabo" and "Tabo", "Nkosi" and "Kosi", "Phillips" and "Filips" sound the same. For names
   *  heard by speech recognition (or written by ear): silent h's, doubled letters, c/k/q, ph/f, v/w, z/s, y/i, a leading n or m
   *  before a consonant (Nkosi, Mthembu, Ndlovu). */
  function sound(s) {
    return norm(s).replace(/ /g, '').replace(/ph/g, 'f').replace(/([bcdgkpt])h/g, '$1').replace(/^h/, '').replace(/ck|q|c/g, 'k')
      .replace(/v/g, 'w').replace(/z/g, 's').replace(/y/g, 'i').replace(/^[nm](?=[^aeiou])/, '').replace(/(.)\1+/g, '$1').replace(/e$/, '');
  }
  /** How alike two names are, 0–1: the same, a slip of the pen, sounding the same, or a short form ("Tom" / "Thomas"). */
  function alike(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.replace(/ /g, '') === b.replace(/ /g, '')) return 0.95;            // "Van der Merwe" / "Vandermerwe"
    var sa = sound(a), sb = sound(b);
    if (sa.length >= 3 && sa === sb) return 0.85;
    var d = dist(a, b), L = Math.max(a.length, b.length);
    if (L >= 4 && d === 1) return 0.85;
    if (L >= 7 && d === 2) return 0.75;
    var s = a.length < b.length ? a : b, l = s === a ? b : a;
    if (s.length >= 3 && l.indexOf(s) === 0) return 0.7;                       // "Tom" for "Thomas"
    var k = 0; while (k < s.length && s[k] === l[k]) k++;
    if (k >= 3 && k >= 0.75 * s.length) return 0.65;                           // "Dave" for "David"
    return 0;
  }
  function firstNames(p) {
    var out = [norm(p.firstName), norm(p.preferredName)].filter(Boolean);
    out.slice().forEach(function (f) { var w = f.split(' ')[0]; if (out.indexOf(w) < 0) out.push(w); });
    return out;
  }
  function lastNames(p) {
    var l = norm(p.lastName), out = l ? [l, l.replace(/ /g, '')] : [];
    var w = l.split(' '); if (w.length > 1) out.push(w[w.length - 1]);            // "van der Merwe" written as "Merwe"
    if (p.maidenName) out.push(norm(p.maidenName));
    return out;
  }
  function best(xs, ys) { var b = 0; xs.forEach(function (x) { ys.forEach(function (y) { b = Math.max(b, alike(x, y)); }); }); return b; }
  /** How well a written row fits a person, 0–1. */
  function score(r, p) {
    var f = norm(r.first), l = norm(r.last);
    var ls = l ? Math.max(best([l, l.replace(/ /g, '')], lastNames(p))) : 0;
    var fs = f ? (f.length === 1 ? (firstNames(p).some(function (x) { return x[0] === f; }) ? 0.6 : 0) : best([f, f.split(' ')[0]], firstNames(p))) : 0;
    if (f && l) {
      if (ls < 0.7 || fs < 0.6) {
        // written the other way round ("Smith John")?
        var swapL = best([f], lastNames(p)), swapF = best([l], firstNames(p));
        return swapL >= 0.85 && swapF >= 0.85 ? (swapL + swapF) / 2 - 0.05 : 0;
      }
      return (ls + fs) / 2;
    }
    if (l) return ls >= 0.85 ? 0.55 * ls : 0;                                   // only a surname ("Mrs Smith")
    if (f) {                                                                    // only a first name: a surname written as one word?
      var asLast = best([f], lastNames(p)), asFirst = fs;
      return Math.max(asFirst >= 0.85 ? 0.6 * asFirst : 0, asLast >= 0.85 ? 0.5 * asLast : 0);
    }
    return 0;
  }
  /** Households, for "The Smiths": the people sharing a surname and a household. */
  function households(r, people) {
    var l = norm(r.last).replace(/s$/, ''), byFam = {};
    people.forEach(function (p) {
      var hit = lastNames(p).some(function (x) { return x === l || x === norm(r.last); });
      if (!hit) return;
      var k = p.familyId || ('_' + p.id); (byFam[k] = byFam[k] || []).push(p.id);
    });
    return Object.keys(byFam).map(function (k) { return byFam[k]; });
  }
  /**
   * Each row → who it is. 'sure': one person fits well and clearly better than anyone else (ids is them); 'maybe': a few
   * could fit (options, best first – the person chooses); 'none': nobody fits. people = the people this person may see.
   */
  function match(rowsIn, people) {
    people = (people || []).filter(function (p) { return p && p.id; });
    return (rowsIn || []).map(function (r) {
      if (r.family) {
        var fams = households(r, people);
        return { row: r, status: fams.length === 1 ? 'sure' : fams.length ? 'maybe' : 'none', ids: fams.length === 1 ? fams[0] : [], options: fams.slice(0, 4) };
      }
      var hits = people.map(function (p) { return { id: p.id, s: score(r, p) }; }).filter(function (h) { return h.s >= 0.45; })
        .sort(function (a, b) { return b.s - a.s; });
      var top = hits[0], next = hits[1];
      var sure = top && top.s >= 0.8 && !r.unsure && (!next || top.s - next.s >= 0.15);
      return { row: r, status: sure ? 'sure' : hits.length ? 'maybe' : 'none', ids: sure ? [top.id] : [], options: hits.slice(0, 4).map(function (h) { return [h.id]; }) };
    });
  }

  /**
   * The people chosen (with the guests written next to their names) → one sign-up per household, as staff add them by hand:
   * chosen = [{ ids: [...], guests }]; people = everyone (for households); max = the guests the event allows each sign-up.
   * The lead is the first adult chosen in the household (else the first chosen). Someone chosen twice counts once.
   */
  function group(chosen, people, max) {
    var byId = {}, seen = {}, fams = {}, order = [];
    (people || []).forEach(function (p) { byId[p.id] = p; });
    (chosen || []).forEach(function (c) {
      var g = guestsOf(c.guests);
      (c.ids || []).forEach(function (id, i) {
        var p = byId[id]; if (!p || seen[id]) return; seen[id] = 1;
        var k = p.familyId || ('_' + id);
        if (!fams[k]) { fams[k] = { ids: [], guests: 0 }; order.push(k); }
        fams[k].ids.push(id);
        if (i === 0) fams[k].guests += g;
      });
    });
    return order.map(function (k) {
      var f = fams[k], adults = f.ids.filter(function (id) { return byId[id].familyRole !== 'child'; });
      var lead = adults[0] || f.ids[0];
      return { lead: lead, people: [lead].concat(f.ids.filter(function (id) { return id !== lead; })), guests: Math.min(f.guests, Math.max(0, +max || 0)) };
    });
  }

  /**
   * The people whose names fit what was typed or said, best first: [{ id, s }] with s at least min (0.5). spoken = the text, or
   * several things speech recognition thought it heard, joined by "|". For lists of names that come from words only
   * (a dropdown), people can be { id, firstName, lastName } made from the words.
   */
  function rank(spoken, people, min) {
    var tries = [];
    String(spoken || '').split('|').forEach(function (t) {
      var r = fromText(t)[0]; if (!r) return;
      tries.push(r);
      if (r.first && r.last) tries.push({ first: '', last: r.first + ' ' + r.last }, { first: r.first, last: '' });   // one long surname, or a first name heard as two words
    });
    if (!tries.length) return [];
    min = min || 0.5;
    return (people || []).map(function (p) {
      var b = 0; tries.forEach(function (r) { b = Math.max(b, score(r, p)); });
      return { id: p.id, s: b };
    }).filter(function (h) { return h.s >= min; }).sort(function (a, b) { return b.s - a.s; });
  }
  /** "Thabo Nkosi" → { firstName: 'Thabo', lastName: 'Nkosi' } (for lists of names as words). */
  function asPerson(id, text) { var w = String(text || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/); return { id: id, firstName: w[0] || '', lastName: w.slice(1).join(' ') }; }

  var api = { rank: rank, asPerson: asPerson, sound: sound, okEmail: okEmail, okMobile: okMobile, request: request, read: read, rows: rows, fromText: fromText, match: match, group: group, norm: norm, score: score, MAX_ROWS: MAX_ROWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
