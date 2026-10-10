import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { backendRoot, loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { createApp } from '../src/app.js';

function runCli(script, dataDir, answers = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(backendRoot, 'scripts', script)], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_MODE: 'embedded',
        EMBEDDED_DATA_DIR: dataDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let index = 0,
      output = '',
      errors = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${script}`));
    }, 20000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      while (index < answers.length && output.includes(answers[index][0])) {
        const [prompt, value] = answers[index++];
        output = output.slice(output.indexOf(prompt) + prompt.length);
        child.stdin.write(value + '\n');
      }
    });
    child.stderr.on('data', (chunk) => {
      errors += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${script} failed: ${errors}`));
      else if (index !== answers.length)
        reject(new Error(`Not all prompts were answered: ${script}`));
      else resolve();
    });
  });
}

test('clean onboarding commands create a centre and a working assigned operator', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'sevasignal-onboarding-'));
  const dataDir = path.join(folder, 'data');
  const config = loadConfig({ mode: 'test', databaseMode: 'embedded', dataDir });
  let db;
  try {
    db = await createDatabase(config);
    await migrate(db);
    await db.close();
    db = null;
    await runCli('seed-catalog.js', dataDir);
    await runCli('create-centre.js', dataDir, [
      ['Unique centre ID (for example, my-city-seva): ', 'onboarding-demo'],
      ['Centre name: ', 'Onboarding Sample Centre'],
      ['Name in Hindi (optional): ', ''],
      ['Area: ', 'Sample Area'],
      ['City: ', 'Roorkee'],
      ['PIN code: ', '247667'],
      ['Public address: ', 'Fictional address for the automated test'],
      ['Opening hours (informational only): ', 'Mon–Sat, 9 am–6 pm'],
      ['Is this fictional sample data? [Y/n]: ', 'y'],
    ]);
    await runCli('create-operator.js', dataDir, [
      ['Centre ID from the table above: ', 'onboarding-demo'],
      ['Operator name: ', 'Sample Operator'],
      ['Email: ', 'operator@example.test'],
      ['Password (at least 12 characters; hidden): ', 'OnboardingTest2026!'],
    ]);
    db = await createDatabase(config);
    const app = createApp(db, config);
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'operator@example.test', password: 'OnboardingTest2026!' })
      .expect(200);
    const dashboard = await agent.get('/api/operator/dashboard').expect(200);
    assert.equal(dashboard.body.centre.id, 'onboarding-demo');
    assert.equal(dashboard.body.centre.is_demo, true);
    assert.equal(dashboard.body.centre.services.length, 0);
    await agent.post('/api/operator/services').send({ serviceId: 'pan-assistance' }).expect(201);
    const listing = await request(app).get('/api/centres/onboarding-demo').expect(200);
    assert.equal(listing.body.centre.services[0].status, 'unknown');
    assert.equal((await db.query('SELECT COUNT(*) AS n FROM centres')).rows[0].n, 1);
  } finally {
    await db?.close();
    await rm(folder, { recursive: true, force: true });
  }
});
