import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import type { Command, SessionResponse, Workspace } from '../shared/types.js';

const origin = 'http://localhost:5173';
const password = 'Test-password-long-1720';
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ databasePath: ':memory:', appOrigin: origin, rateLimit: false });
});
afterEach(() => {
  app.locals.db.close();
});

async function register(email = 'maker@example.com') {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({ name: 'Mira Shah', email, password, workspaceName: 'Mira Foods' });
  expect(response.status).toBe(201);
  return { agent, session: response.body as SessionResponse, response };
}
const lotCommand = (id = 'lot-001'): Command => ({
  type: 'lot.create',
  payload: {
    id,
    code: 'PEPPER-001',
    name: 'Black pepper',
    supplier: 'Test supplier',
    receivedOn: '2026-09-15',
    quantity: 10,
    unit: 'kg',
    status: 'available',
    source: 'Supplier invoice TEST-001',
  },
});
function commandFor(
  agent: ReturnType<typeof request.agent>,
  session: SessionResponse,
  command: Command,
  expectedRevision = session.workspace.revision,
  id = 'command-001',
) {
  return agent
    .post('/api/commands')
    .set('Origin', origin)
    .set('X-CSRF-Token', session.csrfToken)
    .send({ id, command, expectedRevision });
}

describe('authentication and tenant boundaries', () => {
  it('requires HTTPS configuration in production and sends Secure cookies with restrictive headers', async () => {
    expect(() => createApp({ databasePath: ':memory:', production: true, appOrigin: origin })).toThrow(
      'production requires HTTPS',
    );
    const production = createApp({
      databasePath: ':memory:',
      production: true,
      appOrigin: 'https://batchlight.example',
      rateLimit: false,
    });
    try {
      const response = await request(production)
        .post('/api/auth/demo')
        .set('Origin', 'https://batchlight.example');
      expect(response.status).toBe(201);
      expect(response.headers['set-cookie'][0]).toContain('Secure');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['content-security-policy']).toContain("script-src 'self'");
      expect(response.headers['content-security-policy']).not.toContain('unsafe-eval');
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    } finally {
      production.locals.db.close();
    }
  });

  it('registers a hashed account with an opaque HttpOnly session and one-time recovery code', async () => {
    const { session, response, agent } = await register('MAKER@example.com');
    expect(session.user.email).toBe('maker@example.com');
    expect(session.workspace.name).toBe('Mira Foods');
    expect(session.recoveryCode).toHaveLength(43);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    const stored = app.locals.db.prepare('SELECT password_hash,recovery_hash FROM users').get();
    expect(stored.password_hash).toMatch(/^scrypt:/);
    expect(stored.password_hash).not.toContain(password);
    expect(stored.recovery_hash).not.toEqual(session.recoveryCode);
    const loaded = await agent.get('/api/auth/session');
    expect(loaded.status).toBe(200);
    expect(loaded.body.csrfToken).toBe(session.csrfToken);
    expect(loaded.body).not.toHaveProperty('recoveryCode');
  });

  it('requires a strong password, valid input and correct sign-in credentials', async () => {
    const invalid = await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ name: 'A', email: 'a@example.com', password: 'short', workspaceName: 'A' });
    expect(invalid.status).toBe(400);
    await register();
    const wrong = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: 'maker@example.com', password: 'wrong' });
    expect(wrong.status).toBe(401);
    const login = await request
      .agent(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: 'maker@example.com', password });
    expect(login.status).toBe(200);
    expect(login.body).not.toHaveProperty('recoveryCode');
    const duplicate = await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ name: 'Other', email: 'maker@example.com', password, workspaceName: 'Other' });
    expect(duplicate.status).toBe(409);
    expect(app.locals.db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n).toBe(1);
  });

  it('enforces same-origin checks before login and CSRF on authenticated mutations', async () => {
    const absentOrigin = await request(app).post('/api/auth/demo');
    expect(absentOrigin.status).toBe(403);
    const hostileOrigin = await request(app).post('/api/auth/demo').set('Origin', 'https://attacker.example');
    expect(hostileOrigin.status).toBe(403);
    const { agent, session } = await register();
    const noToken = await agent
      .post('/api/commands')
      .set('Origin', origin)
      .send({ id: 'command-001', command: lotCommand(), expectedRevision: 0 });
    expect(noToken.status).toBe(403);
    const wrongToken = await agent
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', 'wrong');
    expect(wrongToken.status).toBe(403);
    const logout = await agent
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.csrfToken);
    expect(logout.status).toBe(204);
    expect((await agent.get('/api/workspace')).status).toBe(401);
  });

  it('keeps workspaces, commands, exports, audit and recall IDs isolated between users', async () => {
    const one = await register('one@example.com');
    const two = await register('two@example.com');
    const created = await commandFor(one.agent, one.session, lotCommand());
    expect(created.status).toBe(200);
    const other = await two.agent.get(`/api/workspace?workspaceId=${one.session.workspace.id}`);
    expect(other.body.id).toBe(two.session.workspace.id);
    expect(other.body.lots).toHaveLength(0);
    const foreignStatus = await commandFor(two.agent, two.session, {
      type: 'lot.status',
      payload: { id: 'lot-001', status: 'hold' },
    });
    expect(foreignStatus.status).toBe(400);
    const recall = await commandFor(
      one.agent,
      one.session,
      {
        type: 'recall.create',
        payload: {
          id: 'recall-001',
          sourceId: 'lot-001',
          title: 'Pepper drill',
          reason: 'Synthetic exercise',
          mode: 'drill',
        },
      },
      1,
      'command-002',
    );
    expect(recall.status).toBe(200);
    expect((await two.agent.get('/api/recalls/recall-001/pdf')).status).toBe(404);
    const exported = await two.agent.get('/api/export');
    expect(exported.body.id).toBe(two.session.workspace.id);
    expect(exported.body.lots).toHaveLength(0);
    const audit = await two.agent.get('/api/audit');
    expect(audit.body).toHaveLength(1);
    // Idempotency keys are tenant-scoped; the same key is valid for another tenant.
    expect((await commandFor(two.agent, two.session, lotCommand())).status).toBe(200);
  });

  it('rotates recovery codes atomically and revokes all old sessions', async () => {
    const { agent, session } = await register();
    const recoveryAgent = request.agent(app);
    const recovered = await recoveryAgent
      .post('/api/auth/recover')
      .set('Origin', origin)
      .send({
        email: session.user.email,
        recoveryCode: session.recoveryCode,
        password: 'Replacement-password-1720',
      });
    expect(recovered.status).toBe(200);
    expect(recovered.body.recoveryCode).not.toBe(session.recoveryCode);
    expect((await agent.get('/api/auth/session')).status).toBe(401);
    expect((await recoveryAgent.get('/api/auth/session')).status).toBe(200);
    const reused = await request(app)
      .post('/api/auth/recover')
      .set('Origin', origin)
      .send({ email: session.user.email, recoveryCode: session.recoveryCode, password });
    expect(reused.status).toBe(401);
    const oldPassword = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: session.user.email, password });
    expect(oldPassword.status).toBe(401);
    const newPassword = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: session.user.email, password: 'Replacement-password-1720' });
    expect(newPassword.status).toBe(200);
  });

  it('creates isolated synthetic demos that expire and cannot be signed into by email', async () => {
    const first = request.agent(app);
    const second = request.agent(app);
    const a = await first.post('/api/auth/demo').set('Origin', origin);
    const b = await second.post('/api/auth/demo').set('Origin', origin);
    expect(a.status).toBe(201);
    expect(a.body.user.isDemo).toBe(true);
    expect(a.body.workspace.id).not.toBe(b.body.workspace.id);
    const stored = app.locals.db.prepare('SELECT expires_at FROM users WHERE id = ?').get(a.body.user.id);
    expect(stored.expires_at - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    app.locals.db.prepare('UPDATE users SET expires_at = 1 WHERE id = ?').run(a.body.user.id);
    expect((await first.get('/api/auth/session')).status).toBe(401);
    expect((await second.get('/api/auth/session')).status).toBe(200);
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: b.body.user.email, password });
    expect(login.status).toBe(401);
  });

  it('deletes only the authenticated account and cascades its private data', async () => {
    const one = await register('one@example.com');
    const two = await register('two@example.com');
    await commandFor(one.agent, one.session, lotCommand());
    const wrong = await one.agent
      .post('/api/account/delete')
      .set('Origin', origin)
      .set('X-CSRF-Token', one.session.csrfToken)
      .send({ password: 'wrong' });
    expect(wrong.status).toBe(401);
    const removed = await one.agent
      .post('/api/account/delete')
      .set('Origin', origin)
      .set('X-CSRF-Token', one.session.csrfToken)
      .send({ password });
    expect(removed.status).toBe(204);
    expect((await one.agent.get('/api/auth/session')).status).toBe(401);
    expect((await two.agent.get('/api/auth/session')).status).toBe(200);
    expect(app.locals.db.prepare('SELECT COUNT(*) AS n FROM commands').get().n).toBe(0);
    expect(app.locals.db.prepare('SELECT COUNT(*) AS n FROM audit').get().n).toBe(1);
  });
});

describe('atomic commands and exports', () => {
  it('preserves sessions, reports and command receipts across restart and a SQLite backup restore', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'batchlight-persistence-'));
    const file = join(directory, 'records.sqlite');
    const first = createApp({ databasePath: file, appOrigin: origin, rateLimit: false });
    let restarted: ReturnType<typeof createApp> | undefined;
    let restored: ReturnType<typeof createApp> | undefined;
    try {
      const registration = await request(first)
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({
          name: 'Persistent Maker',
          email: 'persistent@example.com',
          password,
          workspaceName: 'Persistent Kitchen',
        });
      expect(registration.status).toBe(201);
      const cookie = (registration.headers['set-cookie'] as unknown as string[])
        .map((value) => value.split(';')[0])
        .join('; ');
      const session = registration.body as SessionResponse;
      const write = (command: Command, revision: number, id: string) =>
        request(first)
          .post('/api/commands')
          .set('Origin', origin)
          .set('Cookie', cookie)
          .set('X-CSRF-Token', session.csrfToken)
          .send({ id, command, expectedRevision: revision });
      expect((await write(lotCommand(), 0, 'persistent-lot')).status).toBe(200);
      const recall: Command = {
        type: 'recall.create',
        payload: {
          id: 'persistent-recall',
          sourceId: 'lot-001',
          title: 'Persistent rehearsal',
          reason: 'Synthetic persistence exercise',
          mode: 'drill',
        },
      };
      expect((await write(recall, 1, 'persistent-recall-command')).status).toBe(200);
      first.locals.db.close();
      restarted = createApp({ databasePath: file, appOrigin: origin, rateLimit: false });
      const loaded = await request(restarted).get('/api/auth/session').set('Cookie', cookie);
      expect(loaded.status).toBe(200);
      expect(loaded.body.workspace.revision).toBe(2);
      expect(loaded.body.workspace.recalls).toHaveLength(1);
      const retry = await request(restarted)
        .post('/api/commands')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-CSRF-Token', session.csrfToken)
        .send({ id: 'persistent-lot', command: lotCommand(), expectedRevision: 0 });
      expect(retry.status).toBe(200);
      expect(retry.body.lots).toHaveLength(1);
      const backup = join(directory, 'backup.sqlite');
      await restarted.locals.db.backup(backup);
      restored = createApp({ databasePath: backup, appOrigin: origin, rateLimit: false });
      const report = await request(restored).get('/api/recalls/persistent-recall/pdf').set('Cookie', cookie);
      expect(report.status).toBe(200);
      expect(Buffer.from(report.body).subarray(0, 5).toString()).toBe('%PDF-');
      const activity = await request(restored).get('/api/audit').set('Cookie', cookie);
      expect(activity.body).toHaveLength(3);
      expect(activity.body.at(-1).action).toBe('recall.create');
    } finally {
      if (first.locals.db.open) first.locals.db.close();
      restarted?.locals.db.close();
      restored?.locals.db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('preserves device record time, separately audits acceptance, and binds time to retries', async () => {
    const { agent, session } = await register();
    await commandFor(agent, session, lotCommand());
    const command: Command = {
      type: 'recall.create',
      payload: {
        id: 'dated-recall',
        sourceId: 'lot-001',
        title: 'Offline rehearsal',
        reason: 'Synthetic timestamp test',
        mode: 'drill',
      },
    };
    const createdAt = '2026-09-15T08:00:00.000Z';
    const send = (time: string) =>
      agent
        .post('/api/commands')
        .set('Origin', origin)
        .set('X-CSRF-Token', session.csrfToken)
        .send({ id: 'dated-command', command, expectedRevision: 1, createdAt: time });
    const saved = await send(createdAt);
    expect(saved.status).toBe(200);
    expect(saved.body.recalls[0].createdAt).toBe(createdAt);
    expect((await send(createdAt)).status).toBe(200);
    expect((await send('2026-09-16T08:00:00.000Z')).status).toBe(409);
    const activity = (await agent.get('/api/audit')).body.at(-1);
    expect(activity.detail).toContain(`Device record time: ${createdAt}`);
    expect(activity.createdAt).not.toBe(createdAt);
  });

  it('records an evidence-backed gap resolution without rewriting a previous rehearsal', async () => {
    const { agent, session } = await register();
    await commandFor(agent, session, lotCommand());
    const batch: Command = {
      type: 'batch.create',
      payload: {
        id: 'batch-gap',
        code: 'GAP-001',
        name: 'Uncertain sauce',
        producedOn: '2026-09-16',
        quantity: 20,
        unit: 'units',
        inputs: [],
        recordsComplete: false,
        notes: 'Ingredient sheet missing',
        source: 'Production log E2E-gap',
      },
    };
    expect((await commandFor(agent, session, batch, 1, 'command-002')).status).toBe(200);
    const recall: Command = {
      type: 'recall.create',
      payload: {
        id: 'gap-recall',
        sourceId: 'lot-001',
        title: 'Before evidence arrived',
        reason: 'Synthetic exercise',
        mode: 'drill',
      },
    };
    expect((await commandFor(agent, session, recall, 2, 'command-003')).status).toBe(200);
    const resolved = await commandFor(
      agent,
      session,
      {
        type: 'batch.resolve',
        payload: {
          id: 'batch-gap',
          additionalInputs: [{ sourceId: 'lot-001', quantity: 2 }],
          notes: 'Found supplier lot on original sheet',
          source: 'Recovered sheet GAP-001 page 2',
        },
      },
      3,
      'command-004',
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body.batches[0].recordsComplete).toBe(true);
    expect(resolved.body.recalls[0].snapshot.batches[0].recordsComplete).toBe(false);
    expect(resolved.body.recalls[0].result.investigationBatchIds).toContain('batch-gap');
    const activity = (await agent.get('/api/audit')).body.at(-1);
    expect(activity.action).toBe('batch.resolve');
    expect(activity.detail).toContain('GAP-001');
    expect(activity.detail).toContain('Recovered sheet');
  });

  it('deduplicates retries and refuses reused IDs with different payloads', async () => {
    const { agent, session } = await register();
    const first = await commandFor(agent, session, lotCommand());
    const retry = await commandFor(agent, session, lotCommand());
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body.revision).toBe(1);
    expect(retry.body.lots).toHaveLength(1);
    const different = await commandFor(
      agent,
      session,
      { type: 'workspace.rename', payload: { name: 'Different' } },
      1,
    );
    expect(different.status).toBe(409);
    expect(different.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(different.body.workspace.revision).toBe(1);
    expect((await agent.get('/api/audit')).body).toHaveLength(2);
  });

  it('rejects stale revisions and returns latest state; concurrent writers cannot lose updates', async () => {
    const { agent, session } = await register();
    const responses = await Promise.all([
      commandFor(agent, session, { type: 'workspace.rename', payload: { name: 'First' } }, 0, 'command-001'),
      commandFor(agent, session, { type: 'workspace.rename', payload: { name: 'Second' } }, 0, 'command-002'),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const rejected = responses.find((r) => r.status === 409)!;
    expect(rejected.body.code).toBe('REVISION_CONFLICT');
    expect(rejected.body.workspace.revision).toBe(1);
  });

  it('rejects oversubscribed stock and unknown commands without partial writes', async () => {
    const { agent, session } = await register();
    await commandFor(agent, session, lotCommand());
    const invalid: Command = {
      type: 'batch.create',
      payload: {
        id: 'batch-001',
        code: 'SAUCE-001',
        name: 'Sauce',
        producedOn: '2026-09-16',
        quantity: 20,
        unit: 'units',
        inputs: [{ sourceId: 'lot-001', quantity: 11 }],
        recordsComplete: true,
        notes: '',
        source: 'Test log',
      },
    };
    const response = await commandFor(agent, session, invalid, 1, 'command-002');
    expect(response.status).toBe(400);
    const unknown = await commandFor(
      agent,
      session,
      { type: 'superuser.delete' } as unknown as Command,
      1,
      'command-003',
    );
    expect(unknown.status).toBe(400);
    const missing = await agent
      .post('/api/commands')
      .set('Origin', origin)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ id: 'command-004', expectedRevision: 1 });
    expect(missing.status).toBe(400);
    const workspace = (await agent.get('/api/workspace')).body as Workspace;
    expect(workspace.revision).toBe(1);
    expect(workspace.batches).toHaveLength(0);
    expect((await agent.get('/api/audit')).body).toHaveLength(2);
  });

  it('exports an actual PDF from saved trace records and chains audit entries', async () => {
    const { agent, session } = await register();
    await commandFor(agent, session, lotCommand());
    const recalled = await commandFor(
      agent,
      session,
      {
        type: 'recall.create',
        payload: {
          id: 'recall-001',
          sourceId: 'lot-001',
          title: 'Pepper trace rehearsal',
          reason: 'Synthetic exercise only',
          mode: 'drill',
        },
      },
      1,
      'command-002',
    );
    expect(recalled.status).toBe(200);
    await commandFor(
      agent,
      session,
      { type: 'lot.status', payload: { id: 'lot-001', status: 'hold' } },
      2,
      'command-003',
    );
    const workspace = (await agent.get('/api/workspace')).body as Workspace;
    expect(workspace.lots[0].status).toBe('hold');
    expect(workspace.recalls[0].snapshot.lots[0].status).toBe('available');
    const pdf = await agent.get('/api/recalls/recall-001/pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('attachment');
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(4000);
    const entries = (await agent.get('/api/audit')).body;
    expect(entries[0].previousHash).toBe('0'.repeat(64));
    for (let i = 1; i < entries.length; i++) expect(entries[i].previousHash).toBe(entries[i - 1].hash);
    expect(new Set(entries.map((e: { hash: string }) => e.hash)).size).toBe(entries.length);
  });

  it('fails gracefully on invalid JSON, oversized input and unknown routes', async () => {
    const invalid = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_JSON');
    const huge = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ blob: 'a'.repeat(6_350_000) });
    expect(huge.status).toBe(413);
    expect((await request(app).get('/api/does-not-exist')).status).toBe(404);
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['cache-control']).toBe('no-store');
  });
});
