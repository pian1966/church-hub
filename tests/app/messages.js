/* Church Hub – browser test, part: Messages (sending to the staff, a care group and a message group; reading them).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s, t;
  console.log('Messages:');

  // An Administrator sets up a message group and writes to the staff
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('messages/groups');
  await s.page.fill('#mg-new', 'Welcome team'); await s.page.click('[data-act="messages:addgroup"]'); await s.settle(); docs = await s.docsNow();
  const mg = Object.keys(docs).find(k => /^msgGroups\//.test(k) && docs[k].name === 'Welcome team').split('/')[1];
  await s.page.fill('.cg-q[data-for="m-' + mg + '"]', 'tim jac'); await s.page.press('.cg-q[data-for="m-' + mg + '"]', 'Enter'); await s.settle(); await s.page.waitForTimeout(200);
  await s.page.click('[data-act="messages:lead"][data-g="' + mg + '"][data-id="p14"]'); await s.settle();
  await s.page.fill('.cg-q[data-for="m-' + mg + '"]', 'clare'); await s.page.press('.cg-q[data-for="m-' + mg + '"]', 'Enter'); await s.settle(); await s.page.waitForTimeout(200); docs = await s.docsNow();
  check(docs['msgGroups/' + mg].memberIds.join() === 'p14,p15' && docs['msgGroups/' + mg].leaderIds.join() === 'p14', 'an Administrator sets up a message group with a leader and members');
  await s.go('messages/send');
  const opts = await s.page.$$eval('#ms-to option', o => o.map(x => x.value));
  check(opts[0] === 'people' && opts.includes('staff') && opts.includes('partners') && opts.includes('group/' + mg), 'they can write to people they choose, the staff, the Church Partners and every group');
  await s.page.selectOption('#ms-to', 'staff'); await s.page.waitForSelector('#ms-some');
  check((await s.page.textContent('#ms-reach')).includes('Goes to 8 people'), 'it says how many people a message goes to');
  await s.page.click('[data-act="messages:send"]');
  check(!(await s.page.isHidden('#ms-err')) && !(await s.page.$('#modal .overlay')), 'an empty message isn’t sent');
  await s.page.fill('#ms-title', 'Staff meeting'); await s.page.fill('#ms-body', 'Thursday at 9, in the hall. Agenda: https://example.com/agenda');
  await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('It goes to 7 people.'), 'they are asked to confirm, with how many it goes to');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  const sent = Object.keys(docs).filter(k => /^messages\//.test(k)).map(k => docs[k]);
  check(sent.length === 1 && sent[0].kind === 'staff' && sent[0].to.length === 8 && sent[0].to.includes('p01') && !sent[0].to.includes('p14') && sent[0].readBy.join() === 'p01' && sent[0].fromName === 'Linda Pillay', 'the message is saved with everyone on the staff, read by its sender');
  t = await s.text();
  check(t.includes('Staff meeting') && t.includes('Read by 0 of 7') && !!(await s.page.$('.msg-body a[href="https://example.com/agenda"]')), 'Sent shows it, how many have read it, and web addresses as links');
  check(Object.values(docs).some(d => d.action && /Sent a message to the staff \(8 people\)/.test(d.action)), 'sending is in the audit log (not what it says)');
  // To one person, from their page; then to people ticked on a checklist
  await s.go('people/p/p14'); await s.page.click('a[href="#/messages/send/people/p14"]'); await s.page.waitForSelector('.ms-pick');
  check(await s.page.$eval('#ms-to', e => e.value) === 'people' && (await s.page.$$eval('.ms-pick:checked', c => c.map(x => x.value).join())) === 'p14' && (await s.page.textContent('#ms-reach')).includes('Goes to 1 person'), '“Send a message” on a person’s page: a message to them, ticked on the checklist');
  await s.page.fill('#ms-body', 'Thank you for Sunday.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('Tim Jacobs'), 'the confirmation names the person');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'people' && d.to.join() === 'p14' && d.audience === 'Tim Jacobs'), 'it goes to that one person');
  await s.go('messages/send'); await s.page.selectOption('#ms-to', 'people'); await s.page.waitForSelector('#ms-find');
  await s.page.fill('#ms-body', 'Planning meeting?'); await s.page.click('[data-act="messages:send"]');
  check((await s.page.textContent('#ms-err')).includes('Tick who should get it'), 'nobody ticked: it asks who should get it');
  await s.page.fill('#ms-find', 'jacobs'); await s.page.waitForTimeout(400);
  check(await s.page.$$eval('.ms-row:not([hidden])', r => r.length === 2), 'typing part of a name narrows the checklist');
  await s.page.click('[data-act="messages:tick"][data-on="1"]');
  await s.page.fill('#ms-find', 'megan'); await s.page.waitForTimeout(400); await s.page.check('.ms-row:not([hidden]) .ms-pick');
  check((await s.page.textContent('#ms-reach')).includes('Goes to 3 people'), '“Tick all” ticks the people shown; the count follows');
  await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay'); await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'people' && d.to.slice().sort().join() === 'p14,p15,p17' && d.body === 'Planning meeting?'), 'the message goes to the three people ticked');
  await s.go('messages/sent'); check((await s.text()).includes('To 3 people'), 'Sent says how many people it went to');
  await finish(s);

  // A member: their message group's messages, unread until opened; the leader writes to their own group
  const seed = seedDocs();
  seed['msgGroups/mgW'] = { name: 'Welcome team', leaderIds: ['p14'], memberIds: ['p14', 'p15', 'p17'] };
  seed['careGroups/cgM'] = { name: 'Hilton', leaderIds: ['p15'], memberIds: ['p15', 'p17'], names: { p15: 'Clare Jacobs', p17: 'Megan Smith' } };
  seed['messages/m1'] = { kind: 'staff', groupId: '', audience: 'Staff', title: 'Staff only', body: 'Not for members', fromId: 'p01', fromName: 'Linda Pillay', to: ['p01', 'p03'], readBy: ['p01'], createdAt: '2026-11-01 08:00', updatedAt: '2026-11-01 08:00' };
  seed['messages/m2'] = { kind: 'group', groupId: 'mgW', audience: 'Welcome team', title: 'Sunday', body: 'Please be at the door by 9:15.', fromId: 'p01', fromName: 'Linda Pillay', to: ['p14', 'p15', 'p17'], readBy: ['p01'], createdAt: '2026-11-02 08:00', updatedAt: '2026-11-02 08:00' };
  s = await session('tim.jacobs@example.com', seed); await s.go('home');
  check(await s.page.evaluate(() => Store.list('messages').map(m => m.id).join() === 'm2'), 'a member loads only the messages sent to them');
  check((await s.page.textContent('.tabbar')).includes('Messages') && (await s.page.textContent('.tabbar a[href="#/messages"] .badge')).trim() === '1', 'Messages is on the phone menu, with the number of new messages');
  check((await s.text()).includes('1 new message'), 'and in the Home to-do list');
  await s.go('messages'); await s.page.waitForTimeout(500); await s.settle(); docs = await s.docsNow();
  t = await s.text();
  check(t.includes('Please be at the door by 9:15.') && t.includes('From Linda Pillay') && t.includes('To Welcome team') && !!(await s.page.$('.msg.new')), 'the inbox shows the message, who it is from and to, marked as new');
  check(docs['messages/m2'].readBy.join() === 'p01,p14' && !(await s.page.$('a[href="#/messages"] .badge')), 'opening the inbox marks it read (for the sender to see) and the count goes');
  await s.go('messages/send');
  check(await s.page.$$eval('#ms-to option', o => o.map(x => x.value).join()) === 'group/mgW', 'a group leader can write only to their own group');
  await s.page.fill('#ms-body', 'Thanks, all!'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  const tm = Object.keys(docs).filter(k => /^messages\//.test(k) && docs[k].fromId === 'p14').map(k => docs[k]);
  check(tm.length === 1 && tm[0].to.join() === 'p14,p15,p17' && tm[0].kind === 'group', 'their message goes to the group');
  const tries = await s.page.evaluate(async () => {
    const fs = firebase.firestore(), base = { groupId: '', audience: 'Staff', title: '', body: 'x', fromId: 'p14', fromName: 'Tim Jacobs', readBy: ['p14'] };
    const r = p => p.then(() => 'saved', e => e.code);
    const out = [await r(fs.doc('messages/x1').set(Object.assign({ kind: 'staff', to: ['p01'] }, base))),
      await r(fs.doc('messages/x2').set(Object.assign({}, base, { kind: 'group', groupId: 'mgW', to: ['p14', 'p01'] }))),
      await r(fs.doc('messages/m2').update({ body: 'changed' }))];
    window.__fake.denied.length = 0; return out.join();
  });
  check(tries === 'permission-denied,permission-denied,permission-denied', 'the database refuses a member writing to the staff, adding people who aren’t in their group, or changing a message they received');
  await finish(s);

  // A carer writes to their care group from the Me page
  s = await session('clare.jacobs@example.com', seed); await s.go('me');
  await s.page.click('#my-care a[href="#/messages/send/care/cgM"]'); await s.page.waitForSelector('#ms-to');
  check(await s.page.$eval('#ms-to', e => e.value) === 'care/cgM' && (await s.page.$$eval('#ms-to option', o => o.length)) === 1, 'a carer: “Send the group a message” on the Me page opens a message to their care group (the only group they lead)');
  await s.page.fill('#ms-body', 'Prayer meeting moved to Wednesday.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'care' && d.groupId === 'cgM' && d.fromId === 'p15' && d.to.join() === 'p15,p17'), 'their message goes to the care group');
  await s.go('messages/send/care/cgM'); await s.page.check('#ms-some'); await s.page.waitForSelector('.ms-pick');
  check(await s.page.$$eval('.ms-pick', c => c.length === 2 && c.every(x => x.checked)) && (await s.page.textContent('.ms-list')).includes('Megan Smith'), '“Only some of them”: the group’s people, all ticked, named even for a carer who isn’t staff');
  await s.page.uncheck('.ms-pick[value="p15"]');
  await s.page.fill('#ms-body', 'Just for you, Megan.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'care' && d.some === true && d.to.join() === 'p17' && d.body === 'Just for you, Megan.'), 'only the ticked people get it');
  check(!(await s.page.$('#ms-to option[value="people"]')), 'a carer can’t choose people outside their group');
  await s.go('messages/sent');
  check(!(await s.text()).includes('Not for members') && (await s.text()).includes('Prayer meeting moved'), 'Sent shows only their own messages');
  await finish(s);
};
