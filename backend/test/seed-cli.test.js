import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { backendRoot } from '../src/config.js';

function runSeed(overrides = {}) {
  return spawnSync(process.execPath, [path.join(backendRoot, 'scripts/seed.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_MODE: 'postgres',
      // A successful skip must not attempt to connect to this unavailable database.
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/sevasignal',
      DATABASE_SSL: 'false',
      ENABLE_DEMO_SEED: '',
      DEMO_PASSWORD: '',
      ...overrides,
    },
    encoding: 'utf8',
    timeout: 10000,
  });
}

test('production seed skips without explicit opt-in and does not connect to the database', () => {
  for (const flag of ['', 'false', 'TRUE']) {
    const result = runSeed({ ENABLE_DEMO_SEED: flag });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Demo seeding skipped/);
  }
});

test('production seed rejects missing or short passwords instead of using the local default', () => {
  for (const password of ['', 'too-short']) {
    const result = runSeed({ ENABLE_DEMO_SEED: 'true', DEMO_PASSWORD: password });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DEMO_PASSWORD must contain at least 12 characters/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|connection timeout/);
  }
});
