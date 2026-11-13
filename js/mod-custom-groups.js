/* Church Hub – the built-in Staff list and Administrator-managed custom groups, shown under Groups. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, G = CustomGroups;
  var draft = null;
  function admin() { return H.can('*') && !S.preview(); }
  function personId() { var u = H.user(); return u && u.id || ''; }
  function people(except) {
    return S.find('people', function (p) {
      return p.active !== false && p.category !== 'Deceased' && !p.binnedAt && !p.mergedInto && except.indexOf(p.id) < 0;
    }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
  }
  function staffSettings() {
    return Object.assign({ name: 'Staff Group', description: '' }, (S.settings() || {}).staffGroup || {});
  }
  function staffCard() {
    var st = staffSettings(), members = G.staff(S.list('people'));
    var mine = members.some(function (p) { return p.id === personId(); });
    if (!admin() && !mine) return '';
    return '<section class="panel custom-group"><div class="row"><span class="grow"><h3>' + esc(st.name) + '</h3>' +
      (st.description ? '<p class="hint">' + esc(st.description) + '</p>' : '') +
      '<small class="muted">' + T(admin() ? 'This built-in group updates automatically from People staff details.' : 'This group follows the staff details on your profile.') +
      (admin() ? ' · ' + TN('{n} person', '{n} people', members.length) : '') + '</small></span>' +
      (admin() ? '<button class="btn small" data-act="customgroups:staffsettings">' + T('Group settings') + '</button>' : '') + '</div>' +
      (admin() && members.length ? '<div class="list" style="margin-top:8px">' + members.map(function (p) {
        return '<div class="item"><span class="grow">' + esc(H.name(p)) + '</span><small class="muted">' + esc((p.staff && p.staff.category) || T('Staff')) + '</small></div>';
      }).join('') + '</div>' : admin() ? '<p class="empty">' + T('No staff have been marked in People yet.') + '</p>' : '') + '</section>';
  }
  function card(group) {
    var mine = (group.memberIds || []).indexOf(personId()) >= 0;
    return '<section class="panel custom-group"><div class="row"><span class="grow"><h3>' + esc(group.name) + '</h3>' +
      (group.description ? '<p class="hint">' + esc(group.description) + '</p>' : '') +
      '<small class="muted">' + T(group.visibility === 'church' ? 'Everyone who signs in can see this group.' : 'Only this group’s members can see it.') + '</small></span>' +
      (mine ? '<span class="tag ok">' + T('You are in this group') + '</span>' : '') +
      (admin() ? '<button class="icon-btn ghost" data-act="customgroups:edit" data-id="' + esc(group.id) + '" aria-label="' + esc(T('Edit {name}', { name: group.name })) + '">' + H.icon('M4 20h4L20 8l-4-4L4 16zM14 6l4 4', 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="customgroups:delete" data-id="' + esc(group.id) + '" aria-label="' + esc(T('Delete {name}', { name: group.name })) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</div>' +
      '<small class="muted">' + TN('{n} person', '{n} people', (group.memberIds || []).length) + '</small>' +
      (admin() && group.memberIds && group.memberIds.length ? '<div class="list" style="margin-top:8px">' + group.memberIds.map(function (id) {
        var p = S.get('people', id); return p ? '<div class="item"><span class="grow">' + esc(H.name(p)) + '</span></div>' : '';
      }).join('') + '</div>' : '') + '</section>';
  }
  function section() {
    var list = G.forPerson(S.list('customGroups'), personId(), admin()), html = list.map(card).join('');
    if (admin()) html = '<section class="panel"><div class="row"><span class="grow"><h2>' + T('Church groups') + '</h2><p class="hint">' + T('Create groups for ministries, committees and other church teams.') + '</p></span>' +
      '<button class="btn primary" data-act="customgroups:create">' + H.icon(H.ICON.plus, 16) + T('Create a group') + '</button></div></section>' + html;
    if (!html) return '';
    return '<h2 style="margin:22px 0 10px">' + T('Church groups') + '</h2><div class="grid2">' + html + '</div>';
  }
  function readDraft() {
    if (!draft) return;
    var name = document.getElementById('cg-name'), desc = document.getElementById('cg-description'), vis = document.getElementById('cg-visibility');
    if (name) draft.name = name.value;
    if (desc) draft.description = desc.value;
    if (vis) draft.visibility = vis.value;
  }
  function groupDialog(group) {
    draft = Object.assign({ id: S.uid('cg'), name: '', description: '', memberIds: [], visibility: 'members' }, G.clean(group), { id: group.id || S.uid('cg') });
    var selected = (draft.memberIds || []).map(function (id) {
      var p = S.get('people', id); return '<div class="item"><span class="grow">' + esc(p ? H.name(p) : T('Person no longer in People')) + '</span>' +
        '<button class="btn small" data-act="customgroups:remove" data-id="' + esc(id) + '">' + T('Remove') + '</button></div>';
    }).join('');
    var finder = window.CareUI && CareUI.finder ? CareUI.finder('cg-members', people(draft.memberIds), 'customgroups:add', { g: draft.id }, null, T('Add people from the People directory')) : '';
    H.modal(H.dialogHead(draft.name ? T('Edit {name}', { name: draft.name }) : T('Create a group')) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Name') + '<input id="cg-name" maxlength="80" value="' + esc(draft.name) + '"></label>' +
      '<label class="field">' + T('Description') + '<textarea id="cg-description" rows="2" maxlength="500">' + esc(draft.description) + '</textarea></label>' +
      '<label class="field">' + T('Who can see it') + '<select id="cg-visibility"><option value="members"' + (draft.visibility === 'members' ? ' selected' : '') + '>' + T('Only this group’s members') + '</option><option value="church"' + (draft.visibility === 'church' ? ' selected' : '') + '>' + T('Everyone who signs in') + '</option></select></label>' +
      '<h3>' + T('Members') + '</h3><div class="list">' + (selected || '<p class="empty">' + T('No one yet.') + '</p>') + '</div>' + finder +
      '<p id="cg-error" class="note bad" role="alert" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="customgroups:save" data-id="' + esc(draft.id) + '">' + T('Save') + '</button></div>', T('Group settings'));
  }
  function settingDialog() {
    var st = staffSettings();
    H.modal(H.dialogHead(T('Staff group settings')) + '<div class="dlg-body"><p class="hint">' + T('Membership stays in sync with people marked as staff in People.') + '</p>' +
      '<label class="field req">' + T('Name') + '<input id="cg-staff-name" maxlength="80" value="' + esc(st.name) + '"></label>' +
      '<label class="field">' + T('Description') + '<textarea id="cg-staff-description" rows="2" maxlength="500">' + esc(st.description) + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="customgroups:savestaff">' + T('Save') + '</button></div>', T('Staff group settings'));
  }
  H.register({
    id: 'customgroups', name: 'Church groups', show: function () { return false; }, render: function () { return ''; },
    actions: {
      create: function () { if (admin()) groupDialog({ id: S.uid('cg'), name: '', description: '', memberIds: [], visibility: 'members' }); },
      edit: function (el) { var g = S.get('customGroups', el.dataset.id); if (admin() && g) groupDialog(g); },
      add: function (el) {
        if (!admin() || !draft || el.dataset.g !== draft.id) return; readDraft();
        if (draft.memberIds.indexOf(el.dataset.id) < 0) draft.memberIds.push(el.dataset.id);
        groupDialog(draft);
      },
      remove: function (el) {
        if (!admin() || !draft) return; readDraft();
        draft.memberIds = draft.memberIds.filter(function (id) { return id !== el.dataset.id; });
        groupDialog(draft);
      },
      save: function (el) {
        if (!admin() || !draft || el.dataset.id !== draft.id) return;
        readDraft();
        var clean = G.clean(draft), err = document.getElementById('cg-error');
        if (!clean.name) { err.textContent = T('Give the group a name'); err.hidden = false; return; }
        if (S.find('customGroups', function (g) { return g.id !== draft.id && g.name.toLowerCase() === clean.name.toLowerCase(); }).length) {
          err.textContent = T('There is already a group with that name'); err.hidden = false; return;
        }
        clean.id = draft.id; S.put('customGroups', clean, 'Saved the church group ' + clean.name);
        draft = null; H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      delete: function (el) {
        var g = S.get('customGroups', el.dataset.id);
        if (!admin() || !g || !H.confirmBtn(el, '✕?')) return;
        S.remove('customGroups', g.id, 'Deleted the church group ' + g.name); H.render(); H.toast(T('Deleted'));
      },
      staffsettings: function () { if (admin()) settingDialog(); },
      savestaff: function () {
        if (!admin()) return;
        var name = document.getElementById('cg-staff-name').value.trim().slice(0, 80), description = document.getElementById('cg-staff-description').value.trim().slice(0, 500);
        if (!name) { H.toast(T('Give the group a name'), true); return; }
        S.setSettings({ staffGroup: { name: name, description: description } }, 'Changed the built-in Staff group settings');
        H.closeModal(); H.render(); H.toast(T('Saved'));
      }
    }
  });
  window.CustomGroupsUI = { section: section, show: function () {
    var p = S.get('people', personId());
    return admin() || S.list('customGroups').length > 0 || !!(p && G.staff([p]).length);
  }, staffVisible: function () { var p = S.get('people', personId()); return admin() || !!(p && G.staff([p]).length); },
    staffPage: staffCard };
  H.register({
    id: 'staffgroup', name: 'Staff Group', desc: 'This built-in group updates automatically from People staff details.', icon: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11a2.6 2.6 0 1 0 0-5.2M2.5 19c.5-3 2.6-5 5.5-5s5 2 5.5 5M15.5 14.2c2.6.2 4.4 2 4.9 4.8',
    tint: '#3E6E8E', inGroups: true,
    show: function () { return CustomGroupsUI.staffVisible(); },
    render: function () { return '<div class="page-head"><div><h1>' + T('Staff Group') + '</h1></div></div>' + CustomGroupsUI.staffPage(); }
  });
})();
