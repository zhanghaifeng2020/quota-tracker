import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the page's actual state helpers without starting a browser or server.
function pageState(preview = false) {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\ninitApp\(\);\s*$/, '');
  const context = vm.createContext({
    URLSearchParams, location: { search: preview ? '?preview=1' : '' },
    document: { addEventListener() {} }, window: { addEventListener() {} },
    setInterval() {}, console,
    fetch() { throw new Error('Unexpected network access'); }
  });
  vm.runInContext(script + '\nthis.page = {state, normalize, counts, matchesCategory, discardDraft, apiFetch, previewItems};', context);
  return context.page;
}

test('editing an existing subscription retains its persistence marker', () => {
  const p = pageState();
  const saved = p.normalize({ id: 'existing', name: 'Saved', createdAt: '2026-10-26T12:00:00Z' });
  assert.equal(saved.createdAt, '2026-10-26T12:00:00Z');
  assert.equal(p.normalize({ name: 'Draft' }).createdAt, null);
});

test('reset filters include exhausted subscriptions and honor the seven-day boundary', () => {
  const p = pageState();
  const today = new Date(2026, 9, 27);
  const imminent = p.normalize({ kind: 'cycle', mode: 'interval', anchor: '2026-11-03', quotaUsed: 100 });
  const later = p.normalize({ kind: 'cycle', mode: 'interval', anchor: '2026-11-04' });
  assert.equal(p.matchesCategory(imminent, 'soon', today), true);
  assert.equal(p.matchesCategory(imminent, 'empty', today), true);
  assert.equal(p.matchesCategory(later, 'soon', today), false);
  const counts = p.counts([imminent, later], today);
  assert.equal(counts.soon, 1);
  assert.equal(counts.empty, 1);
});

test('expiry filtering includes expired subscriptions and stops after 21 days', () => {
  const p = pageState();
  const today = new Date(2026, 9, 27);
  for (const [due, expected] of [['2026-10-26', true], ['2026-11-17', true], ['2026-11-18', false]]) {
    assert.equal(p.matchesCategory(p.normalize({ kind: 'once', due }), 'unused', today), expected);
  }
});

test('cancelling a new item removes only the unsaved draft', () => {
  const p = pageState();
  p.state.items = [{ id: 'saved' }, { id: 'draft' }];
  p.state.draftId = 'draft';
  p.discardDraft();
  assert.deepEqual(p.state.items.map(item => item.id), ['saved']);
  assert.equal(p.state.draftId, null);
});

test('read-only preview rejects API access before making a request', async () => {
  const p = pageState(true);
  await assert.rejects(p.apiFetch('/api/subscriptions', { method: 'POST', body: {} }), /只读示例/);
  await assert.rejects(p.apiFetch('/api/subscriptions'), /只读示例/);
  assert.equal(p.state.token, null);
  assert.equal(p.previewItems().length, 13);
});
