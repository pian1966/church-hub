/*
 * A stand-in for the Firebase library, used only by tests/app.test.js to run Church Hub's live mode in a browser
 * without the internet. It keeps documents in memory and refuses every read and write that firestore.rules refuses,
 * using a copy of those rules written in JavaScript (POLICY below). Keep POLICY in step with firestore.rules;
 * the real rules are tested separately by tests/rules.test.mjs against Google's emulator.
 */
(function () {
  'use strict';
  var docs = {}, listeners = [], authCbs = [], currentUser = null;
  var F = window.__fake = { docs: docs, denied: [], sentLinks: [], credentials: [], linkSignIns: [], nextUser: null, pending: 0, kept: 0, wiped: 0, sources: [],
    seed: function (all) { Object.keys(all).forEach(function (k) { docs[k] = JSON.parse(JSON.stringify(all[k])); }); },
    setUser: function (u) { currentUser = u; } };

  /* ---------- the rules, in JavaScript ---------- */
  var ANY = ['admin', 'pastor', 'rosters', 'kids', 'member'], STAFF = ['admin', 'pastor', 'rosters', 'kids'];
  function ctx() {
    var email = currentUser ? String(currentUser.email).toLowerCase() : '', r = email ? docs['roles/' + email] : null;
    // A sign-in shared by several people (one email address): every role they have, and every one of them
    var ids = (r && r.personId ? [r.personId] : []).concat((r && r.also) || []);
    return { signedIn: !!(currentUser && currentUser.emailVerified), email: email, role: r ? r.role : '', roles: r ? r.roles || [r.role] : [], me: r && r.personId ? r.personId : '', ids: ids,
      robot: !!(currentUser && r && r.role === 'robot' && r.uid && r.uid === currentUser.uid), langs: (r && r.langs) || [], can: (r && r.can) || [],
      standIn: !!(r && (r.standInFrom || 0) <= Date.now() && Date.now() <= (r.standInTo || 0)) };
  }
  function is(c, list) { return c.signedIn && !!c.role && c.roles.some(function (x) { return list.indexOf(x) >= 0; }); }
  /** What Pastors can do: Administrators always; Pastors with the tick on their access-list entry. */
  function may(c, x) { return is(c, ['admin']) || (is(c, ['pastor']) && c.can.indexOf(x) >= 0); }
  function rosterer(c) { return is(c, ['admin', 'rosters']) || may(c, 'rosters'); }
  var SMALL = ['rosters', 'kids', 'member'];
  function smallRoles(d) { return SMALL.indexOf(d.role) >= 0 && (d.roles || [d.role]).every(function (x) { return SMALL.indexOf(x) >= 0; }); }
  function okRoles(d) { return (d.roles || []).every(function (x) { return ANY.indexOf(x) >= 0; }) && Array.isArray(d.also || []) && (d.also || []).length <= 3; }
  function isMe(c, pid) { return !!pid && c.ids.indexOf(pid) >= 0; }
  function meIn(c, list) { return c.ids.some(function (x) { return (list || []).indexOf(x) >= 0; }); }
  function mine(c, pid) { return is(c, ANY) && isMe(c, pid); }
  function onlyChanges(b, a, keys) {
    var all = {}; Object.keys(b || {}).concat(Object.keys(a || {})).forEach(function (k) { all[k] = 1; });
    return Object.keys(all).every(function (k) { return JSON.stringify((b || {})[k]) === JSON.stringify((a || {})[k]) || keys.indexOf(k) >= 0; });
  }
  function onlyKeys(a, keys) { return Object.keys(a || {}).every(function (k) { return keys.indexOf(k) >= 0; }); }
  var KIDS_CONSENTS = ['Children’s medical notes', 'Photos'];
  function inCare(c, gid) { return is(c, ANY) && meIn(c, docs['careGroups/' + gid].memberIds); }   // a missing group fails
  /** Settings -> Who can see what: Roster coordinators and Children's ministry may see every care group (settings seeCare). */
  function seesCare(c) { var on = (docs['settings/church'] || {}).seeCare || []; return ['rosters', 'kids'].some(function (r) { return is(c, [r]) && on.indexOf(r) >= 0; }); }
  function leadsCare(c, gid) { return is(c, ANY) && meIn(c, (docs['careGroups/' + gid].leaderIds || [])); }
  function checks(c, lang) { return is(c, ANY) && c.langs.indexOf(lang) >= 0; }   // checks translations in that language
  function child(id) { return docs['people/' + id].familyRole === 'child'; }   // a missing person fails, as get() does in the rules
  /** The Archive's keepers: Administrators and the Senior Pastor (settings seniorPastorId). */
  function keeper(c) { return is(c, ['admin']) || (is(c, ['pastor']) && isMe(c, (docs['settings/church'] || {}).seniorPastorId || '')); }
  function seesRecord(c, d) {
    return keeper(c) || (d.access === 'all' && is(c, ANY)) || (d.access === 'office' && is(c, ['admin', 'pastor']))
      || (!!(d.bodyId || '') && is(c, ANY) && meIn(c, docs['leaderBodies/' + d.bodyId].memberIds || [])) || mine(c, d.shownTo || '');
  }
  function librarian(c) { return is(c, ['admin']) || (is(c, ANY) && meIn(c, (docs['settings/church'] || {}).librarianIds || [])); }
  var POLICY = {
    roles: { read: function (c, id) { return c.signedIn && (id === c.email || may(c, 'access')); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin'])) return op === 'delete' || (ANY.concat(['robot']).indexOf(a.role) >= 0 && okRoles(a));
        if (op === 'update' && may(c, 'leave') && onlyChanges(b, a, ['standInFrom', 'standInTo'])) return true;   // the stand-in approver's dates
        if (!may(c, 'access')) return false;
        if (op === 'delete') return smallRoles(b);
        return (op === 'create' || smallRoles(b)) && smallRoles(a) && okRoles(a) && onlyKeys(a, ['role', 'personId', 'name', 'roles', 'also', 'people']);
      } },
    settings: { read: function (c) { return is(c, ANY) || c.robot; },
      write: function (c, op, id, b, a) { return is(c, ['admin']) || (op === 'update' && may(c, 'settings') && JSON.stringify(a.pastorCan || []) === JSON.stringify(b.pastorCan || []) && JSON.stringify(a.seniorCan || []) === JSON.stringify(b.seniorCan || []) && (a.seniorPastorId || '') === (b.seniorPastorId || ''))
        // the Senior Pastor may choose the librarians (at most two), and change nothing else here
        || (op === 'update' && is(c, ['pastor']) && isMe(c, (b || {}).seniorPastorId || '') && onlyChanges(b, a, ['librarianIds']) && Array.isArray(a.librarianIds || []) && (a.librarianIds || []).length <= 2); } },
    elvantoSync: { read: function (c, id, d) { return may(c, 'import') || c.robot || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (may(c, 'import')) return true;
        if (op === 'delete') return false;
        if (op === 'create') return (mine(c, a.personId) || c.standIn) && a.status === 'Waiting' && onlyKeys(a, ['personId', 'name', 'start', 'end', 'want', 'have', 'haveNote', 'status', 'note', 'createdAt', 'updatedAt']);
        if ((mine(c, b.personId) || c.standIn) && a.personId === b.personId && a.status === 'Waiting' && onlyChanges(b, a, ['name', 'start', 'end', 'want', 'status', 'note', 'updatedAt'])) return true;
        return c.robot && onlyChanges(b, a, ['status', 'note', 'have', 'haveNote', 'doneAt']);
      } },
    robotStatus: { read: function (c) { return may(c, 'import'); }, write: function (c) { return c.robot; } },
    elvantoFound: { read: function (c) { return may(c, 'import'); }, write: function (c, op) { return op === 'delete' ? may(c, 'import') : c.robot; } },
    guardians: { read: function (c, id, d) { return is(c, ['admin', 'pastor', 'kids']) || (!!d && mine(c, d.adultId)); }, write: function (c) { return is(c, ['admin', 'pastor', 'kids']); } },
    noCollect: { read: function (c) { return is(c, ['admin', 'pastor', 'kids']); }, write: function (c) { return is(c, ['admin', 'pastor', 'kids']); } },
    people: { read: function (c, id) { return is(c, STAFF) || mine(c, id); },
      write: function (c, op, id, b, a) {
        if (op === 'delete') return may(c, 'people');
        return is(c, ['admin', 'pastor']) || (op === 'update' && mine(c, id) && onlyChanges(b, a, ['firstName', 'lastName', 'preferredName', 'email', 'mobile', 'photo', 'updatedAt']))
          || (op === 'update' && is(c, ['kids']) && b.familyRole === 'child' && onlyChanges(b, a, ['photo', 'updatedAt']));
      } },
    details: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || mine(c, id) || (is(c, ['kids']) && !!d && d.familyRole === 'child'); },
      write: function (c) { return is(c, ['admin', 'pastor']); } },
    medical: { read: function (c) { return is(c, ['kids']); }, write: function (c, op) { return is(c, ['kids']) || (op === 'delete' && may(c, 'people')); } },
    notes: { read: function (c) { return is(c, ['pastor']); }, write: function (c, op) { return is(c, ['pastor']) || (op === 'delete' && may(c, 'people')); } },
    directory: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return (is(c, ['admin', 'pastor']) || mine(c, id)) && (op === 'delete' || onlyKeys(a, ['firstName', 'lastName', 'preferredName', 'mobile', 'email', 'shareAddress', 'shareSpouse', 'photo', 'care'])); } },
    contacts: { read: function (c) { return is(c, STAFF); },
      write: function (c, op, id, b, a) { return (is(c, ['admin', 'pastor']) || mine(c, id)) && (op === 'delete' || onlyKeys(a, ['shareAddress', 'shareSpouse'])); } },
    photos: { read: function (c, id) { return child(id) ? is(c, ['admin', 'pastor', 'kids']) : is(c, STAFF) || mine(c, id) || (is(c, ANY) && docs['directory/' + id] !== undefined); },
      write: function (c, op, id, b, a) {
        var who = is(c, ['admin', 'pastor']) || (child(id) ? is(c, ['kids']) : mine(c, id));
        return who && (op === 'delete' || (onlyKeys(a, ['data', 'updatedAt']) && typeof a.data === 'string' && a.data.length < 200000));
      } },
    officeNotes: { read: function (c) { return is(c, ['admin', 'pastor']); }, write: function (c) { return is(c, ['admin', 'pastor']); } },
    idNumbers: { read: function (c, id) { return may(c, 'idnumbers') || mine(c, id); },
      write: function (c, op, id, b, a) {
        if (op === 'delete') return may(c, 'idnumbers') || may(c, 'people');
        var ok = onlyKeys(a, ['value', 'updatedAt']) && typeof a.value === 'string' && a.value.length <= 20;
        return ok && (may(c, 'idnumbers') || (op === 'create' && mine(c, id)));   // applying to become a Church Partner: their own, once
      } },
    families: { read: function (c) { return is(c, STAFF); }, write: function (c) { return is(c, ['admin', 'pastor']); } },
    consents: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (!!d && mine(c, d.personId)) || (is(c, ['kids']) && !!d && KIDS_CONSENTS.indexOf(d.purpose) >= 0); },
      write: function (c, op, id, b, a) {
        if (op === 'delete') return may(c, 'people');
        if (is(c, ['admin', 'pastor'])) return true;
        return op === 'create' ? mine(c, a.personId) && a.method === 'Changed in the app' : mine(c, b.personId) && onlyChanges(b, a, ['withdrawnAt', 'updatedAt']);
      } },
    teams: 'catalogue', positions: 'catalogue', services: 'catalogue',
    skills: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); }, write: function (c) { return rosterer(c); } },
    assignments: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (rosterer(c)) return true;
        return op === 'update' && mine(c, b.personId) && onlyChanges(b, a, ['status', 'updatedAt']) && ['accepted', 'declined'].indexOf(a.status) >= 0;
      } },
    groups: { read: function (c, id, d) { return is(c, STAFF) || (is(c, ANY) && !!d && meIn(c, d.memberIds)); },
      write: function (c, op, id, b, a) {
        if (rosterer(c)) return true;
        if (!is(c, ANY)) return false;
        return (op === 'create' || meIn(c, b.memberIds)) && (op === 'delete' || meIn(c, a.memberIds));
      } },
    serveOffers: { read: function (c, id, d) { return rosterer(c) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (rosterer(c)) return true;
        if (op === 'delete') return mine(c, b.personId);
        return op === 'create' && mine(c, a.personId) && a.status === 'waiting' && ['join', 'change', 'stop'].indexOf(a.kind) >= 0
          && onlyKeys(a, ['personId', 'positionId', 'kind', 'frequency', 'times', 'note', 'status', 'createdAt', 'updatedAt']);
      } },
    detailChanges: { read: function (c, id, d) { return may(c, 'people') || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (may(c, 'people')) return true;
        if (op === 'delete') return mine(c, b.personId);
        return op === 'create' && mine(c, a.personId) && a.status === 'waiting'
          && onlyKeys(a, ['personId', 'maritalStatus', 'anniversary', 'spouse', 'children', 'note', 'status', 'createdAt', 'updatedAt']);
      } },
    partnerApps: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin', 'pastor'])) return true;
        if (op === 'delete') return mine(c, b.personId);
        return op === 'create' && mine(c, a.personId) && a.status === 'waiting'
          && onlyKeys(a, ['personId', 'spouse', 'anniversary', 'children', 'since', 'faith', 'story', 'otherChurch', 'otherWhich', 'classOk', 'study', 'questions', 'serve', 'declaration', 'loyalty', 'birthDate', 'directory', 'status', 'createdAt', 'updatedAt']);
      } },
    blockouts: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) { return rosterer(c) || mine(c, op === 'delete' ? b.personId : a.personId); } },
    away: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return may(c, 'leave') || (op === 'delete' ? mine(c, b.personId) : (mine(c, a.personId) || c.standIn) && onlyKeys(a, ['personId', 'from', 'to'])); } },
    leave: { read: function (c) { return is(c, ANY); }, write: function (c) { return may(c, 'leave'); } },
    leaveRequests: { read: function (c, id, d) { return may(c, 'leave') || c.standIn || (!!d && mine(c, d.staffId)); },
      write: function (c, op, id, b, a) {
        if (may(c, 'leave')) return true;
        if (op === 'create') return mine(c, a.staffId) && (a.status === 'Pending' || (a.status === 'Approved' && ((docs['leave/config'] || {}).autoApprove || []).indexOf(a.type) >= 0));
        if (op === 'update' && c.standIn && !isMe(c, b.staffId) && b.status === 'Pending' && ['Approved', 'Declined'].indexOf(a.status) >= 0 && onlyChanges(b, a, ['status', 'decidedBy', 'decidedOn'])) return true;
        return op === 'update' && mine(c, b.staffId) && a.status === 'Cancelled' && onlyChanges(b, a, ['status', 'cancelledBy']);
      } },
    leaveAdjustments: { read: function (c, id, d) { return may(c, 'leave') || (!!d && mine(c, d.staffId)); }, write: function (c) { return may(c, 'leave'); } },
    careGroups: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || seesCare(c) || (is(c, ANY) && !!d && meIn(c, (d.memberIds || []))); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin', 'pastor'])) return true;
        if (op !== 'update' || !is(c, ANY) || !meIn(c, (b.leaderIds || []))) return false;
        var life = b.type === 'life' && typeof a.name === 'string' && a.name.length > 0 && a.name.length <= 80;   // a life group's leaders may name it
        return onlyChanges(b, a, life ? ['name', 'memberIds', 'names', 'updatedAt'] : ['memberIds', 'names', 'updatedAt']) && meIn(c, a.memberIds) && (b.leaderIds || []).every(function (l) { return a.memberIds.indexOf(l) >= 0; });
      } },
    'careGroups/share': { read: function (c, pid, d, gid) {
        var own = (docs['settings/church'] || {}).seeCareOwn !== false;
        return is(c, ['admin', 'pastor']) || (inCare(c, gid) && (own || mine(c, pid) || leadsCare(c, gid) || (docs['careGroups/' + gid].leaderIds || []).indexOf(pid) >= 0));
      },
      write: function (c, op, pid, b, a, gid) {
        if (op === 'delete') return is(c, ['admin', 'pastor']) || mine(c, pid) || leadsCare(c, gid);
        return (is(c, ['admin', 'pastor']) || (mine(c, pid) && inCare(c, gid))) && onlyKeys(a, ['firstName', 'lastName', 'preferredName', 'ok', 'mobile', 'email', 'address', 'birthday', 'photo', 'leader', 'updatedAt', 'createdAt'])
          && (a.photo === undefined || (typeof a.photo === 'string' && a.photo.length < 40000));
      } },
    messages: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (is(c, ANY) && !!d && (meIn(c, (d.to || [])) || isMe(c, d.fromId))); },
      write: function (c, op, id, b, a) {
        var mgr = is(c, ['admin', 'pastor']);
        if (op === 'delete') return mgr || (is(c, ANY) && isMe(c, b.fromId));
        if (op === 'update') {
          if (!is(c, ANY) || !meIn(c, (b.to || [])) || !onlyChanges(b, a, ['readBy'])) return false;
          var was = b.readBy || [], now = a.readBy || [];
          return was.every(function (x) { return now.indexOf(x) >= 0; }) && now.filter(function (x) { return was.indexOf(x) < 0; }).every(function (x) { return isMe(c, x); });
        }
        if (!is(c, ANY) || !isMe(c, a.fromId)) return false;
        if (!onlyKeys(a, ['kind', 'groupId', 'audience', 'some', 'title', 'body', 'fromId', 'fromName', 'to', 'readBy', 'createdAt', 'updatedAt'])) return false;
        if (a.some !== undefined && typeof a.some !== 'boolean') return false;
        if (['care', 'life', 'group', 'staff', 'partners', 'people'].indexOf(a.kind) < 0 || typeof a.body !== 'string' || !a.body.length || a.body.length > 4000) return false;
        if (a.title !== undefined && (typeof a.title !== 'string' || a.title.length > 120)) return false;
        if (!Array.isArray(a.to) || !a.to.length || a.to.length > 3000 || !Array.isArray(a.readBy) || !a.readBy.every(function (x) { return isMe(c, x); })) return false;
        if (mgr) return true;
        var g = a.kind === 'care' || a.kind === 'life' ? docs['careGroups/' + a.groupId] : a.kind === 'group' ? docs['msgGroups/' + a.groupId] : null;
        if (!g || !meIn(c, (g.leaderIds || []))) return false;
        var ok = (g.memberIds || []).concat(a.kind === 'group' ? g.leaderIds || [] : []);
        return a.to.every(function (x) { return ok.indexOf(x) >= 0; });
      } },
    msgGroups: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (is(c, ANY) && !!d && meIn(c, (d.memberIds || []))); },
      write: function (c) { return is(c, ['admin', 'pastor']); } },
    words: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return (may(c, 'words') || checks(c, id)) && (op === 'delete' || (onlyKeys(a, ['words', 'updatedAt', 'createdAt', 'by']) && !!a.words && typeof a.words === 'object' && !Array.isArray(a.words))); } },
    wordIdeas: { read: function (c, id, d) { return may(c, 'words') || (!!d && (mine(c, d.personId) || checks(c, d.lang))); },
      write: function (c, op, id, b, a) {
        if (op === 'create') return mine(c, a.personId) && a.status === 'waiting' && onlyKeys(a, ['lang', 'en', 'text', 'note', 'personId', 'name', 'status', 'createdAt', 'updatedAt'])
          && typeof a.lang === 'string' && typeof a.en === 'string' && typeof a.text === 'string' && a.text.length <= 3000 && (a.note === undefined || (typeof a.note === 'string' && a.note.length <= 500));
        if (op === 'delete') return may(c, 'words') || checks(c, b.lang) || mine(c, b.personId);
        return (may(c, 'words') || checks(c, b.lang)) && onlyChanges(b, a, ['status', 'reply', 'reviewedBy', 'reviewedAt', 'updatedAt']) && ['used', 'declined'].indexOf(a.status) >= 0;
      } },
    // Leadership groups: Administrators and Pastors manage; an open group is read by everyone, any other by its members
    leaderBodies: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (is(c, ANY) && !!d && (d.open === true || meIn(c, d.memberIds || []))); },
      write: function (c, op, id, b, a) { return is(c, ['admin', 'pastor']) && (op === 'delete' || (typeof a.name === 'string' && a.name.length > 0 && a.name.length <= 80 && typeof a.open === 'boolean' && Array.isArray(a.memberIds))); } },
    // The Archive: Administrators and the Senior Pastor everything; others by the record's access (seesRecord in firestore.rules)
    archive: { read: function (c, id, d) { return !!d && seesRecord(c, d); },
      write: function (c, op, id, b, a) {
        if (!keeper(c)) return false;
        return op === 'delete' || (typeof a.title === 'string' && a.title.length > 0 && a.title.length <= 150 && ['all', 'body', 'office', 'private'].indexOf(a.access) >= 0
          && (a.access === 'body') === !!(a.bodyId || '') && (!(a.shownTo || '') || a.shownTo === (a.aboutId || '')));
      } },
    'archive/parts': { read: function (c, n, d, id) { return seesRecord(c, docs['archive/' + id]); },   // a missing record fails
      write: function (c, op, n, b, a) { return keeper(c) && (op === 'delete' || (onlyKeys(a, ['data']) && typeof a.data === 'string' && a.data.length <= 950000)); } },
    // The Library: everyone reads the books; librarians write; a loan is read by the librarians and its borrower
    books: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return librarian(c) && (op === 'delete' || (typeof a.title === 'string' && a.title.length > 0 && a.title.length <= 150)); } },
    loans: { read: function (c, id, d) { return librarian(c) || (!!d && mine(c, d.personId || '')); },
      write: function (c, op, id, b, a) {
        if (!librarian(c)) return false; if (op === 'delete') return true;
        var m = a.mobile === undefined ? '' : a.mobile, n = a.name === undefined ? '' : a.name;
        var ok = typeof a.bookId === 'string' && typeof a.personId === 'string' && typeof m === 'string' && m.length <= 30 &&
          (a.personId !== '' || (a.visitor === true && typeof n === 'string' && n.length > 0 && n.length <= 100));
        return ok && (op !== 'create' || m.length >= 7);
      } },
    covers: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return librarian(c) && (op === 'delete' || (onlyKeys(a, ['data', 'updatedAt']) && typeof a.data === 'string' && a.data.length < 200000)); } },
    libraryPolicy: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return (librarian(c) || keeper(c)) && (op === 'delete' || (id === 'policy' && onlyKeys(a, ['text', 'name', 'type', 'data', 'updatedAt', 'by']) && typeof (a.text || '') === 'string' && (a.text || '').length <= 20000 && typeof (a.data || '') === 'string' && (a.data || '').length <= 900000)); } },
    dsr: 'privacy', breaches: 'privacy', emailPrompts: 'settings',
    audit: { read: function (c) { return may(c, 'privacy'); },
      write: function (c, op, id, b, a) { return op === 'create' && is(c, ANY) && a.byEmail === c.email && a.ts && a.ts.__serverTs === true; } }
  };
  function policy(coll) {
    var p = POLICY[coll];
    if (p === 'catalogue') return { read: function (c) { return is(c, ANY); }, write: function (c) { return rosterer(c); } };
    if (typeof p === 'string' && p !== 'catalogue') return { read: function (c) { return may(c, p); }, write: function (c) { return may(c, p); } };   // an ability (Administrators always)
    return p || { read: function () { return false; }, write: function () { return false; } };
  }
  // A rule that looks at a missing document fails (as in Firestore), hence the try/catch.
  // careGroups/{gid}/share/{pid} is checked by POLICY['careGroups/share'] with the group's id last
  function canRead(path, data) { var s = path.split('/'); try { return s.length === 4 ? !!policy(s[0] + '/' + s[2]).read(ctx(), s[3], data, s[1]) : !!policy(s[0]).read(ctx(), s[1], data); } catch (e) { return false; } }
  function canWrite(op, path, before, after) { var s = path.split('/'); try { return s.length === 4 ? !!policy(s[0] + '/' + s[2]).write(ctx(), op, s[3], before, after, s[1]) : !!policy(s[0]).write(ctx(), op, s[1], before, after); } catch (e) { return false; } }
  function lastId(path) { return path.split('/').pop(); }
  function parentOf(path) { return path.slice(0, path.lastIndexOf('/')); }
  function denied(what) { F.denied.push(what); var e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; return e; }

  /* ---------- documents and queries ---------- */
  function serverTs(o) { Object.keys(o).forEach(function (k) { if (o[k] && o[k].__serverTs) o[k] = { seconds: Date.now() / 1000 }; }); return o; }
  function DocSnap(path) { var d = docs[path]; this.id = lastId(path); this.exists = d !== undefined; this.metadata = { hasPendingWrites: false }; this.data = function () { return d === undefined ? undefined : JSON.parse(JSON.stringify(d)); }; }
  function DocRef(path) { this.path = path; this.id = lastId(path); }
  DocRef.prototype.get = function (opts) {
    var p = this.path; F.sources.push((opts && opts.source) || 'default');
    return new Promise(function (res, rej) { setTimeout(function () { canRead(p, docs[p]) ? res(new DocSnap(p)) : rej(denied('get ' + p)); }, 0); });
  };
  DocRef.prototype.set = function (data) { return apply([{ path: this.path, data: data }]); };
  DocRef.prototype.delete = function () { return apply([{ path: this.path, data: null }]); };
  DocRef.prototype.update = function (data) { var p = this.path; if (docs[p] === undefined) return Promise.reject(denied('update ' + p + ' (no such document)')); return apply([{ path: p, data: Object.assign(JSON.parse(JSON.stringify(docs[p])), data) }]); };
  /** Firestore's update: merges the fields into a document that must exist (a missing one fails, as in Firestore). */
  DocRef.prototype.update = function (fields) {
    if (docs[this.path] === undefined) { var e = new Error('No document to update'); e.code = 'not-found'; return Promise.reject(e); }
    var was = JSON.parse(JSON.stringify(docs[this.path])), add = {};
    Object.keys(fields).forEach(function (k) {   // FieldValue.arrayUnion: add what isn't there yet
      var v = fields[k]; if (v && v.__union) { var cur = Array.isArray(was[k]) ? was[k].slice() : []; v.__union.forEach(function (x) { if (cur.indexOf(x) < 0) cur.push(x); }); add[k] = cur; } else add[k] = v;
    });
    return apply([{ path: this.path, data: Object.assign(was, add) }]);
  };
  DocRef.prototype.onSnapshot = function (cb, errCb) { return listen({ doc: this.path, cb: cb, err: errCb }); };
  function Query(coll, filters, order, lim) { this.coll = coll; this.filters = filters || []; this.order = order; this.lim = lim; }
  Query.prototype.where = function (f, op, v) { return new Query(this.coll, this.filters.concat([[f, op, v]]), this.order, this.lim); };
  Query.prototype.orderBy = function (f, dir) { return new Query(this.coll, this.filters, [f, dir], this.lim); };
  Query.prototype.limit = function (n) { return new Query(this.coll, this.filters, this.order, n); };
  Query.prototype.doc = function (id) { return new DocRef(this.coll + '/' + id); };
  Query.prototype.get = function () { try { return Promise.resolve(run(this)); } catch (e) { return Promise.reject(e); } };
  Query.prototype.onSnapshot = function (cb, errCb) { return listen({ query: this, cb: cb, err: errCb }); };
  function matches(q, d) {
    return q.filters.every(function (f) { var v = d[f[0]]; return f[1] === '==' ? v === f[2] : f[1] === 'array-contains' ? Array.isArray(v) && v.indexOf(f[2]) >= 0 : false; });
  }
  function run(q) {
    var out = Object.keys(docs).filter(function (k) { return parentOf(k) === q.coll && matches(q, docs[k]); });
    // Like Firestore, a query is refused if it could return anything the reader may not see.
    var bad = out.filter(function (k) { return !canRead(k, docs[k]); });
    if (bad.length) throw denied('list ' + q.coll + ' ' + JSON.stringify(q.filters) + ' (e.g. ' + bad[0] + ')');
    if (q.order) out.sort(function (a, b) { var x = (docs[a][q.order[0]] || {}).seconds || 0, y = (docs[b][q.order[0]] || {}).seconds || 0; return q.order[1] === 'desc' ? y - x : x - y; });
    if (q.lim) out = out.slice(0, q.lim);
    return { docs: out.map(function (k) { return { id: lastId(k), data: (function (d) { return function () { return JSON.parse(JSON.stringify(d)); }; })(docs[k]) }; }), metadata: { hasPendingWrites: false } };
  }
  function deliver(l) {
    try {
      if (l.doc) { if (!canRead(l.doc, docs[l.doc])) throw denied('listen ' + l.doc); l.cb(new DocSnap(l.doc)); }
      else l.cb(run(l.query));
    } catch (e) { if (e.code === 'permission-denied') { l.dead = true; if (l.err) l.err(e); } else throw e; }
  }
  function listen(l) { listeners.push(l); setTimeout(function () { if (!l.off) deliver(l); }, 0); return function () { l.off = true; }; }
  function apply(ops) {
    F.pending++;
    return new Promise(function (res, rej) {
      setTimeout(function () {
        setTimeout(function () { F.pending--; }, 0);
        for (var i = 0; i < ops.length; i++) {
          var o = ops[i], before = docs[o.path], after = o.data ? JSON.parse(JSON.stringify(o.data, function (k, v) { return v && v.__serverTs ? { __serverTs: true } : v; })) : null;
          var op = !o.data ? 'delete' : before === undefined ? 'create' : 'update';
          if (op === 'delete' && before === undefined && canWrite('delete', o.path, {}, null)) continue;
          if (!canWrite(op, o.path, before, after)) return rej(denied(op + ' ' + o.path));
        }
        ops.forEach(function (o) { if (o.data) docs[o.path] = serverTs(JSON.parse(JSON.stringify(o.data, function (k, v) { return v && v.__serverTs ? { __serverTs: true } : v; }))); else delete docs[o.path]; });
        res();
        listeners.forEach(function (l) { if (!l.off && !l.dead) deliver(l); });
      }, 0);
    });
  }

  /* ---------- the firebase global (compat API, only what Church Hub uses) ---------- */
  var fs = { doc: function (p) { return new DocRef(p); }, collection: function (c) { return new Query(c); },
    waitForPendingWrites: function () { return new Promise(function (r) { setTimeout(r, 20); }); },
    // The copy kept on the device for offline use (js/store.js): counted, so the tests can see it is made and wiped
    enablePersistence: function () { F.kept++; return Promise.resolve(); },
    terminate: function () { return Promise.resolve(); },
    clearPersistence: function () { F.wiped++; return Promise.resolve(); },
    batch: function () { var ops = []; return { set: function (ref, data) { ops.push({ path: ref.path, data: data }); }, commit: function () { return apply(ops); } }; } };
  function notifyAuth() { authCbs.forEach(function (cb) { setTimeout(function () { cb(currentUser); }, 0); }); }
  var auth = {
    isSignInWithEmailLink: function (link) { return /[?&]mode=signIn(&|$)/.test(link || '') && /[?&]oobCode=/.test(link || ''); },
    signInWithCredential: function (cred) { F.credentials.push(cred && cred.idToken); currentUser = F.nextUser; notifyAuth(); return Promise.resolve({ user: currentUser }); },
    onAuthStateChanged: function (cb) { authCbs.push(cb); setTimeout(function () { cb(currentUser); }, 0); return function () {}; },
    signInWithPopup: function () { currentUser = F.nextUser; notifyAuth(); return Promise.resolve({ user: currentUser }); },
    signInWithRedirect: function () { return auth.signInWithPopup(); },
    sendSignInLinkToEmail: function (email) { F.sentLinks.push(email); return Promise.resolve(); },
    signInWithEmailLink: function (email, link) { F.linkSignIns.push([email, link]); if (F.nextUser) { currentUser = F.nextUser; notifyAuth(); } return Promise.resolve(); },
    signOut: function () { currentUser = null; notifyAuth(); return Promise.resolve(); }
  };
  function GoogleAuthProvider() {} GoogleAuthProvider.prototype.setCustomParameters = function () {};
  GoogleAuthProvider.credential = function (idToken) { return { providerId: 'google.com', idToken: idToken }; };
  var firestoreFn = function () { return fs; }; firestoreFn.FieldValue = { serverTimestamp: function () { return { __serverTs: true }; }, arrayUnion: function () { return { __union: Array.prototype.slice.call(arguments) }; } };
  var authFn = function () { return auth; }; authFn.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = { apps: [], initializeApp: function (c) { this.apps.push(c); return {}; }, auth: authFn, firestore: firestoreFn };
})();
