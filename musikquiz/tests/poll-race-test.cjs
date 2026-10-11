const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the production request handlers with controlled response ordering.
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const handlers = ['perform', 'poll'].map(name => {
  const line = source.split('\n').find(line => line.startsWith(` async function ${name}(`));
  assert(line, `Missing production handler: ${name}`);
  return line;
}).join('\n');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function client() {
  const requests = [], errors = [], received = [], elements = {error: {hidden: true}};
  const context = vm.createContext({
    room: {code: '123456'}, state: {choice: 0}, busy: false, pollBusy: false, actionRevision: 0,
    document: {hidden: false, createElement: () => ({})},
    app: {append: el => { elements[el.id] = el; }},
    $: id => elements[id], setDisabled: () => {},
    rpc: action => { const request = deferred(); requests.push({...request, action}); return request.promise; },
    receive: next => { received.push(next); context.state = next; context.room = {code: '123456'}; },
    error: err => errors.push(err),
    reset: () => { context.actionRevision++; context.room = null; context.state = null; }
  });
  vm.runInContext(handlers, context);
  return {context, requests, errors, received, elements};
}
(async () => {
  for (const outcome of ['success', 'forbidden', 'offline']) {
    for (const pendingAction of [true, false]) {
      const c = client(), poll = c.context.poll(), answer = c.context.perform('answer', {choice: 1});
      const fresh = {choice: 1};
      if (!pendingAction) { c.requests[1].resolve(fresh); await answer; }
      if (outcome === 'success') c.requests[0].resolve({choice: 0});
      else c.requests[0].reject(Object.assign(new Error('old request'), {status: outcome === 'forbidden' ? 403 : 503}));
      await poll;
      assert.equal(c.context.state.choice, pendingAction ? 0 : 1);
      assert.equal(c.errors.length, 0);
      assert.equal(c.elements.connection, undefined);
      assert(c.context.room);
      if (pendingAction) { c.requests[1].resolve(fresh); await answer; }
      assert.equal(c.context.state.choice, 1);
      assert.equal(c.received.length, 1);
      const nextPoll = c.context.poll();
      c.requests[2].resolve({choice: 2}); await nextPoll;
      assert.equal(c.context.state.choice, 2);
    }
  }
  const c = client(), poll = c.context.poll();
  c.context.reset(); c.requests[0].reject(Object.assign(new Error('old room'), {status: 403})); await poll;
  assert.equal(c.errors.length, 0);
  const live = client(), livePoll = live.context.poll();
  live.requests[0].reject(Object.assign(new Error('current room'), {status: 403})); await livePoll;
  assert.equal(live.errors.length, 1); assert.equal(live.context.room, null);
  console.log('PASS: stale poll success/errors ignored during and after actions; polling recovers; reset guarded; current errors handled');
})().catch(err => { console.error(err); process.exitCode = 1; });
