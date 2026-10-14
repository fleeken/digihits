const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('./fullscreen.js');

function setup(kind = 'standard', standalone = false) {
  const attributes = {}, events = {}, messages = [];
  const button = { setAttribute: (k, v) => attributes[k] = v };
  const doc = { documentElement: {}, getElementById: () => button, addEventListener: (k, fn) => events[k] = fn };
  const win = { navigator: { standalone }, matchMedia: () => ({ matches: false }), screen: { orientation: { lock: async () => { throw Error('unsupported'); } } } };
  const prop = kind === 'webkit' ? 'webkitFullscreenElement' : 'fullscreenElement';
  if (kind !== 'unsupported') {
    doc.documentElement[kind === 'webkit' ? 'webkitRequestFullscreen' : 'requestFullscreen'] = function () { assert.equal(this, doc.documentElement); doc[prop] = this; };
    doc[kind === 'webkit' ? 'webkitExitFullscreen' : 'exitFullscreen'] = function () { assert.equal(this, doc); doc[prop] = null; };
  }
  return { doc, attributes, events, messages, control: create(doc, win, text => messages.push(text)) };
}
for (const kind of ['standard', 'webkit']) test(`${kind}: enter, automatic enter preserves fullscreen, exit`, async () => {
  const s = setup(kind);
  await s.control.toggle();
  assert.equal(s.attributes['aria-pressed'], 'true');
  assert.equal(s.attributes['aria-label'], 'Lämna helskärm');
  await s.control.enter();
  assert.equal(s.attributes['aria-pressed'], 'true');
  await s.control.toggle();
  assert.equal(s.attributes['aria-pressed'], 'false');
  assert.equal(s.messages.length, 0);
});
test('Escape and Safari fullscreen events update button', async () => {
  const s = setup(); await s.control.enter();
  s.doc.fullscreenElement = null; s.events.fullscreenchange();
  assert.equal(s.attributes['aria-pressed'], 'false');
  s.doc.webkitFullscreenElement = s.doc.documentElement; s.events.webkitfullscreenchange();
  assert.equal(s.attributes['aria-pressed'], 'true');
});
test('unsupported browser: automatic start stays quiet, button explains', async () => {
  const s = setup('unsupported'); await s.control.enter();
  assert.equal(s.messages.length, 0); await s.control.toggle();
  assert.match(s.messages[0], /Safari/);
});
test('request rejection is reported; orientation rejection is harmless', async () => {
  const s = setup(); s.doc.documentElement.requestFullscreen = () => Promise.reject(Error('denied'));
  await s.control.toggle(); assert.equal(s.messages.length, 1);
  assert.equal(s.attributes['aria-pressed'], 'false');
});
test('installed web app is recognized without trying to exit', async () => {
  const s = setup('unsupported', true); await s.control.toggle();
  assert.equal(s.attributes['aria-pressed'], 'true');
  assert.match(s.messages[0], /redan/);
});
