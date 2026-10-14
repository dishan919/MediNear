import test from 'node:test';
import assert from 'node:assert/strict';
import { trackBackToTop, scrollBackToTop } from '../src/utils/backToTop.js';

function browser() {
  const listeners = new Map();
  return {
    scrollY: 0, calls: [], reduced: false,
    addEventListener(event, callback, options) {
      if (event === 'scroll') assert.equal(options.passive, true);
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    removeEventListener(event, callback) { listeners.get(event).delete(callback); },
    emit(event) { for (const callback of listeners.get(event) || []) callback(); },
    count(event) { return listeners.get(event)?.size || 0; },
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: this.reduced }; },
    scrollTo(options) { this.calls.push(options); },
  };
}

test('visibility starts hidden, tracks thresholds without redundant updates, handles resize and restored scroll', () => {
  const target = browser(), changes = [];
  const cleanup = trackBackToTop(target, value => changes.push(value));
  assert.deepEqual(changes, []);
  for (const y of [1, 300, 400, 401, 600, 399, 301, 300, 0]) {
    target.scrollY = y; target.emit('scroll');
  }
  assert.deepEqual(changes, [true, false]);
  target.scrollY = 900; target.emit('resize');
  target.scrollY = 0; target.emit('resize');
  assert.deepEqual(changes, [true, false, true, false]);
  cleanup();
  target.scrollY = 800;
  const restored = [];
  trackBackToTop(target, value => restored.push(value))();
  assert.deepEqual(restored, [true]);
});

test('unmount removes both listeners and repeated remounts never duplicate subscriptions', () => {
  const target = browser();
  let updates = 0;
  for (let i = 0; i < 5; i++) {
    const cleanup = trackBackToTop(target, () => updates++);
    assert.equal(target.count('scroll'), 1);
    assert.equal(target.count('resize'), 1);
    cleanup();
    assert.equal(target.count('scroll'), 0);
    assert.equal(target.count('resize'), 0);
  }
  target.scrollY = 1000; target.emit('scroll');
  assert.equal(updates, 0);
});

test('click scrolls to top smoothly, checks current motion preference each time, and tolerates repeated clicks', () => {
  const target = browser();
  scrollBackToTop(target);
  assert.deepEqual(target.calls[0], { top: 0, behavior: 'smooth' });
  target.reduced = true;
  scrollBackToTop(target); scrollBackToTop(target);
  assert.deepEqual(target.calls.slice(1), [{ top: 0, behavior: 'instant' }, { top: 0, behavior: 'instant' }]);
  target.matchMedia = undefined;
  assert.doesNotThrow(() => scrollBackToTop(target));
});

