/*
 * Church Hub – keeping Elvanto's "Unavailable Volunteers" list in step with approved leave (as Leave Manager did).
 * Pure functions, tested with node: tests/elvanto-sync.test.js.
 *
 * Each leave request has at most one entry in the elvantoSync collection (same id as the request):
 *   { personId, name, start, end, want: 'Unavailable'|'Removed', have: 'yyyy-mm-dd to yyyy-mm-dd' | '', haveNote,
 *     status: 'Waiting'|'Done'|'Failed'|'Check', note }
 * "want" is what Elvanto should show; "have" is what the robot last put there; the robot (robot/robot.js) does every
 * Waiting entry and writes back status, note and have. Entries are marked in Elvanto with the note "Church Hub <id>"
 * (or "Leave Manager <id>" for leave that Leave Manager's robot entered before the switch-over).
 */
var ElvantoSync = (function () {
  'use strict';
  var NOTE = 'Church Hub ', LM_NOTE = 'Leave Manager ';

  function approved(r) { return !!r && r.status === 'Approved' && !r.synthetic; }

  /**
   * What the Elvanto entry for a request should become after a change, or null if nothing needs doing.
   * prev / now: the request before and after the change (prev null for new leave).
   * existing: its elvantoSync entry, if any.  opts: { name (as in Elvanto), today (yyyy-mm-dd) }.
   */
  function job(prev, now, existing, opts) {
    if (!now) return null;
    var want = approved(now) ? 'Unavailable' : 'Removed', ex = existing;
    if (!ex) {
      // Leave brought in from Leave Manager that was approved there is already in Elvanto (Leave Manager's robot put it there).
      var fromLM = prev && approved(prev) && prev.source === 'Leave Manager';
      if (want === 'Removed' && !fromLM) return null;                             // never was in Elvanto
      if (want === 'Unavailable' && fromLM && prev.start === now.start && prev.end === now.end) return null;   // unchanged
      if (want === 'Unavailable' && now.end < opts.today) return null;            // already over: nothing to block
      ex = { have: fromLM ? prev.start + ' to ' + prev.end : '', haveNote: fromLM ? LM_NOTE + now.id : '' };
    }
    var same = ex.want === want && (want === 'Removed' || (ex.start === now.start && ex.end === now.end));
    if (same) return null;
    if (want === 'Removed' && !ex.have && ex.status !== 'Waiting') return null;   // nothing in Elvanto to remove
    return {
      id: now.id, personId: now.staffId, name: opts.name || ex.name || '', start: now.start, end: now.end, want: want,
      have: ex.have || '', haveNote: ex.haveNote || '', status: 'Waiting',
      note: want === 'Unavailable' ? (ex.have ? 'Dates changed – the robot will update Elvanto.' : 'Approved – the robot will add it to Elvanto.')
        : 'Cancelled or no longer approved – the robot will remove it from Elvanto.'
    };
  }

  /** The note the robot writes on a new Elvanto entry. */
  function noteFor(id) { return NOTE + id; }

  /** Entries that need the Administrator: failed, to check by hand, or waiting too long (robot not running). */
  function problems(entries, nowMs) {
    return (entries || []).filter(function (e) {
      if (e.status === 'Failed' || e.status === 'Check') return true;
      if (e.status !== 'Waiting') return false;
      var t = Date.parse(String(e.updatedAt || '').replace(' ', 'T') + (/Z$|[+-]\d\d:?\d\d$/.test(e.updatedAt || '') ? '' : 'Z'));   // Store.now() is UTC
      return !isNaN(t) && nowMs - t > 2 * 3600 * 1000;
    });
  }

  return { job: job, noteFor: noteFor, problems: problems, NOTE: NOTE, LM_NOTE: LM_NOTE };
})();
if (typeof module !== 'undefined') module.exports = ElvantoSync;
