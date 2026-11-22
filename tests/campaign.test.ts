import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishOperation, formatTime, readProgress } from '../src/game/campaign.ts';

test('legacy Salt Relay best migrates without inventing a Ghost clear', () => {
  const progress = readProgress('{corrupt', '91.25');
  assert.deepEqual(progress, { 'salt-relay': { best: 91.25, ghost: false } });
  assert.equal(formatTime(progress['salt-relay']!.best), '1:31.2');
  assert.deepEqual(readProgress(JSON.stringify(progress), '79'), progress);
});

test('operation records keep Ghost status and the fastest time independently', () => {
  const progress = readProgress(null, null);
  assert.deepEqual(finishOperation(progress, 'salt-relay', 71.5, 0), { best: true, newGhost: true });
  assert.deepEqual(finishOperation(progress, 'blackwater-lock', 122, 2), { best: true, newGhost: false });
  assert.deepEqual(finishOperation(progress, 'blackwater-lock', 128, 0), { best: false, newGhost: true });
  assert.deepEqual(finishOperation(progress, 'blackwater-lock', 105, 1), { best: true, newGhost: false });
  assert.deepEqual(readProgress(JSON.stringify(progress), null), {
    'salt-relay': { best: 71.5, ghost: true }, 'blackwater-lock': { best: 105, ghost: true },
  });
});
