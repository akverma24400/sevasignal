import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { createDatabase } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/migrate.js';
import { seed } from '../src/seed.js';
import { createApp } from '../src/app.js';

const password = 'IntegrationDemo2026!';
const config = loadConfig({
  mode: 'test',
  databaseMode: 'embedded',
  dataDir: 'memory://',
  showDemoHelp: true,
});
let db, app;
before(async () => {
  db = await createDatabase(config);
  await migrate(db);
  await seed(db, password);
  app = createApp(db, config);
});
after(async () => {
  await db?.close();
});
async function login(email = 'roorkee@sevasignal.demo') {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return { agent, response };
}
async function service(agent, serviceId = 'pan-assistance') {
  const { body } = await agent.get('/api/operator/dashboard').expect(200);
  return body.centre.services.find((s) => s.service_id === serviceId);
}
async function update(agent, s, status, extra = {}) {
  return agent.patch(`/api/operator/services/${s.id}/status`).send({
    status,
    reason: status === 'unavailable' ? 'network' : '',
    note: 'Integration test update',
    ttlMinutes: 60,
    version: s.version,
    ...extra,
  });
}

test('health, catalogue and public filters use persisted data', async () => {
  await request(app).get('/api/health').expect(200, { status: 'ok', service: 'sevasignal' });
  const cfg = await request(app).get('/api/config').expect(200);
  assert.equal(cfg.body.catalog.length, 6);
  const found = await request(app).get('/api/centres?q=247667').expect(200);
  assert.equal(found.body.total, 3);
  assert.ok(found.body.centres.every((c) => c.city === 'Roorkee' && c.is_demo));
  const filtered = await request(app)
    .get('/api/centres?city=Roorkee&service=certificate-printing&status=unavailable')
    .expect(200);
  assert.ok(filtered.body.centres.length > 0);
  assert.ok(
    filtered.body.centres.every((c) =>
      c.services.some((s) => s.service_id === 'certificate-printing' && s.status === 'unavailable'),
    ),
  );
  const injection = await request(app).get('/api/centres').query({ q: "' OR 1=1; --" }).expect(200);
  assert.equal(injection.body.total, 0);
  const last = await request(app).get('/api/centres?page=999').expect(200);
  assert.equal(last.body.total, 8);
  assert.equal(last.body.centres.length, 0);
  await request(app).get('/api/centres?status=broken').expect(400);
  await request(app).get('/api/centres/does-not-exist').expect(404);
});

test('available alternatives exclude the source and match the requested service', async () => {
  const { body } = await request(app)
    .get('/api/centres/roorkee-civil-lines/alternatives?service=certificate-printing')
    .expect(200);
  assert.ok(body.centres.length > 0);
  assert.ok(body.serverTime);
  for (const c of body.centres) {
    assert.notEqual(c.id, 'roorkee-civil-lines');
    assert.ok(
      c.services.some((s) => s.service_id === 'certificate-printing' && s.status === 'available'),
    );
  }
});

test('login uses an HttpOnly session and never returns a password hash', async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'missing@example.com', password })
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'roorkee@sevasignal.demo', password: 'wrong' })
    .expect(401);
  const { agent, response } = await login();
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(response.body.operator.password_hash, undefined);
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.operator.centre_id, 'roorkee-civil-lines');
  assert.equal(me.body.operator.password_hash, undefined);
  const stored = (await db.query('SELECT token_hash FROM sessions LIMIT 1')).rows[0];
  assert.ok(!response.headers['set-cookie'][0].includes(stored.token_hash));
});

test('centre ownership, request origin and validation protect writes', async () => {
  const { agent } = await login();
  const own = await service(agent);
  const other = (await request(app).get('/api/centres/dehradun-rajpur')).body.centre.services[0];
  await request(app).get('/api/operator/dashboard').expect(401);
  assert.equal((await update(request(app), own, 'available')).status, 401);
  assert.equal((await update(agent, other, 'available')).status, 404);
  await agent.delete(`/api/operator/services/${other.id}`).expect(404);
  await agent
    .patch(`/api/operator/services/${own.id}/status`)
    .set('Origin', 'https://untrusted.example')
    .send({ status: 'available', ttlMinutes: 60, version: own.version })
    .expect(403);
  assert.equal((await update(agent, own, 'unavailable', { reason: '' })).status, 400);
  assert.equal((await update(agent, own, 'available', { ttlMinutes: 999 })).status, 400);
  assert.equal((await update(agent, own, 'available', { note: 'x'.repeat(241) })).status, 400);
  assert.equal((await service(agent)).version, own.version);
});

test('updates reach the public page, audit log and incident lifecycle atomically', async () => {
  const { agent } = await login();
  let s = await service(agent);
  const id = s.id;
  assert.equal(
    (await update(agent, s, 'unavailable', { note: 'Network interruption' })).status,
    200,
  );
  let centre = (await request(app).get('/api/centres/roorkee-civil-lines')).body;
  assert.equal(centre.centre.services.find((s) => s.id === id).status, 'unavailable');
  assert.equal(centre.history[0].note, 'Network interruption');
  assert.equal(centre.history[0].operator_id, undefined);
  let open = (
    await db.query('SELECT * FROM incidents WHERE centre_service_id=$1 AND resolved_at IS NULL', [
      id,
    ])
  ).rows;
  assert.equal(open.length, 1);
  for (const state of ['unavailable', 'unknown', 'closed']) {
    s = await service(agent);
    assert.equal((await update(agent, s, state)).status, 200);
    open = (
      await db.query('SELECT * FROM incidents WHERE centre_service_id=$1 AND resolved_at IS NULL', [
        id,
      ])
    ).rows;
    assert.equal(open.length, 1, `${state} must not resolve or duplicate the report`);
  }
  s = await service(agent);
  assert.equal((await update(agent, s, 'available', { note: 'Network restored' })).status, 200);
  assert.equal(
    (
      await db.query('SELECT * FROM incidents WHERE centre_service_id=$1 AND resolved_at IS NULL', [
        id,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query('SELECT resolution_note FROM incidents WHERE id=$1', [open[0].id])).rows[0]
      .resolution_note,
    'Network restored',
  );
});

test('expired confirmations become Unknown without resolving an interruption', async () => {
  const { agent } = await login();
  let s = await service(agent);
  assert.equal((await update(agent, s, 'unavailable')).status, 200);
  await db.query("UPDATE centre_services SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [
    s.id,
  ]);
  const current = (
    await request(app).get('/api/centres/roorkee-civil-lines')
  ).body.centre.services.find((x) => x.id === s.id);
  assert.equal(current.status, 'unknown');
  assert.equal(current.stale, true);
  const fresh = await request(app).get('/api/centres?service=pan-assistance&status=available');
  assert.ok(!fresh.body.centres.some((c) => c.id === 'roorkee-civil-lines'));
  const unknown = await request(app).get('/api/centres?service=pan-assistance&status=unknown');
  assert.ok(unknown.body.centres.some((c) => c.id === 'roorkee-civil-lines'));
  assert.equal(
    (
      await db.query(
        'SELECT id FROM incidents WHERE centre_service_id=$1 AND resolved_at IS NULL',
        [s.id],
      )
    ).rows.length,
    1,
  );
});

test('concurrent versions reject lost updates and do not append a false event', async () => {
  const { agent } = await login();
  const s = await service(agent);
  const first = await update(agent, s, 'available', { note: 'First writer' });
  assert.equal(first.status, 200);
  const count = Number(
    (await db.query('SELECT COUNT(*) AS n FROM status_events WHERE centre_service_id=$1', [s.id]))
      .rows[0].n,
  );
  const stale = await update(agent, s, 'closed', { note: 'Stale writer' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
  assert.equal((await service(agent)).note, 'First writer');
  assert.equal(
    Number(
      (await db.query('SELECT COUNT(*) AS n FROM status_events WHERE centre_service_id=$1', [s.id]))
        .rows[0].n,
    ),
    count,
  );
});

test('removing and re-adding a service preserves history and requires confirmation', async () => {
  const { agent } = await login();
  const s = await service(agent, 'pension-support');
  const beforeCount = (
    await db.query('SELECT COUNT(*) AS n FROM status_events WHERE centre_service_id=$1', [s.id])
  ).rows[0].n;
  await agent.delete(`/api/operator/services/${s.id}`).expect(204);
  assert.equal(await service(agent, 'pension-support'), undefined);
  await agent.post('/api/operator/services').send({ serviceId: 'pension-support' }).expect(201);
  const restored = await service(agent, 'pension-support');
  assert.equal(restored.id, s.id);
  assert.equal(restored.status, 'unknown');
  assert.equal(
    (await db.query('SELECT COUNT(*) AS n FROM status_events WHERE centre_service_id=$1', [s.id]))
      .rows[0].n,
    beforeCount,
  );
  await agent.post('/api/operator/services').send({ serviceId: 'pension-support' }).expect(409);
});

test('profile edits persist only for the signed-in centre', async () => {
  const { agent } = await login();
  const c = (await agent.get('/api/operator/dashboard')).body.centre;
  const profile = Object.fromEntries(
    [
      'name',
      'name_hi',
      'area',
      'city',
      'pincode',
      'address',
      'opening_hours',
      'description',
      'phone',
    ].map((k) => [k, c[k]]),
  );
  await agent
    .patch('/api/operator/centre')
    .send({ ...profile, pincode: '123' })
    .expect(400);
  await agent
    .patch('/api/operator/centre')
    .send({
      ...profile,
      description: 'A revised sample description.',
      centre_id: 'dehradun-rajpur',
    })
    .expect(200);
  assert.equal(
    (await request(app).get('/api/centres/roorkee-civil-lines')).body.centre.description,
    'A revised sample description.',
  );
  assert.notEqual(
    (await request(app).get('/api/centres/dehradun-rajpur')).body.centre.description,
    'A revised sample description.',
  );
});

test('re-running migrations and seed preserves operator edits', async () => {
  const before = (await db.query("SELECT description FROM centres WHERE id='roorkee-civil-lines'"))
    .rows[0].description;
  const count = (await db.query('SELECT COUNT(*) AS n FROM status_events')).rows[0].n;
  await migrate(db);
  await seed(db, password);
  assert.equal(
    (await db.query("SELECT description FROM centres WHERE id='roorkee-civil-lines'")).rows[0]
      .description,
    before,
  );
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM status_events')).rows[0].n, count);
});

test('password change revokes other sessions; logout invalidates the current token', async () => {
  const a = await login('dehradun@sevasignal.demo'),
    b = await login('dehradun@sevasignal.demo');
  await a.agent
    .post('/api/auth/password')
    .send({ currentPassword: 'wrong', newPassword: 'ChangedPassword2026!' })
    .expect(400);
  await a.agent
    .post('/api/auth/password')
    .send({ currentPassword: password, newPassword: 'ChangedPassword2026!' })
    .expect(200);
  await b.agent.get('/api/auth/me').expect(401);
  await a.agent.get('/api/auth/me').expect(200);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'dehradun@sevasignal.demo', password })
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'dehradun@sevasignal.demo', password: 'ChangedPassword2026!' })
    .expect(200);
  const cookie = a.response.headers['set-cookie'][0].split(';')[0];
  await a.agent.post('/api/auth/logout').send({}).expect(204);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
});

test('embedded records survive closing and reopening the database', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'sevasignal-persistence-'));
  const diskConfig = { ...config, dataDir: path.join(folder, 'data') };
  let disk;
  try {
    disk = await createDatabase(diskConfig);
    await disk.exec('CREATE TABLE persistence_probe(value TEXT NOT NULL)');
    await disk.query('INSERT INTO persistence_probe(value) VALUES($1)', ['saved']);
    await disk.close();
    disk = await createDatabase(diskConfig);
    assert.equal((await disk.query('SELECT value FROM persistence_probe')).rows[0].value, 'saved');
  } finally {
    await disk?.close();
    await rm(folder, { recursive: true, force: true });
  }
});
