import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyCommand, commandSchema as domainCommandSchema } from '../shared/domain.js';
import { createDemoWorkspace, createEmptyWorkspace } from '../shared/demo.js';
import type { AuditEntry, Command, SessionResponse, User, Workspace } from '../shared/types.js';
import { openDatabase, type AppDatabase } from './database.js';
import {
  canonicalJson,
  checkPassword,
  equalToken,
  hashPassword,
  hashToken,
  randomToken,
} from './security.js';
import { createRecallPdf } from './pdf.js';
import { PdfTextError } from '../shared/pdf-text.js';

const COOKIE = 'batchlight_session';
const DAY = 86_400_000;
type UserRow = {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  password_hash: string;
  recovery_hash: string;
  is_demo: number;
  expires_at: number | null;
};
type SessionRow = { token_hash: string; user_id: string; csrf_token: string; expires_at: number };
type Auth = { user: UserRow; session: SessionRow };
type AuthRequest = Request & { auth?: Auth };
export interface AppOptions {
  databasePath?: string;
  appOrigin?: string;
  production?: boolean;
  rateLimit?: boolean;
  trustProxy?: boolean;
}

const passwordSchema = z.string().min(12, 'Use at least 12 characters for your password.').max(128);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const nameSchema = z.string().trim().min(1).max(100);
const registerSchema = z
  .object({ name: nameSchema, email: emailSchema, password: passwordSchema, workspaceName: nameSchema })
  .strict();
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
const recoverySchema = z
  .object({ email: emailSchema, recoveryCode: z.string().min(1).max(100), password: passwordSchema })
  .strict();
const commandSchema = z
  .object({
    id: z
      .string()
      .min(8)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    expectedRevision: z.number().int().min(0),
    command: domainCommandSchema,
    createdAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

function workspaceFor(db: AppDatabase, id: string): Workspace {
  const row = db.prepare('SELECT data FROM workspaces WHERE id = ?').get(id) as { data: string } | undefined;
  if (!row) throw new Error('Workspace not found.');
  return JSON.parse(row.data) as Workspace;
}
function publicUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, isDemo: Boolean(row.is_demo) };
}

function commandDetail(command: Command, before: Workspace): string {
  switch (command.type) {
    case 'lot.create':
      return `Received lot ${command.payload.code}: ${command.payload.quantity} ${command.payload.unit} from ${command.payload.supplier}.`;
    case 'lot.status':
      return `${command.payload.status === 'hold' ? 'Placed a hold on' : 'Released the recorded hold on'} lot ${before.lots.find((lot) => lot.id === command.payload.id)?.code || command.payload.id}.`;
    case 'batch.create':
      return `Recorded batch ${command.payload.code}: ${command.payload.quantity} ${command.payload.unit}, ${command.payload.inputs.length} input connections; records marked ${command.payload.recordsComplete ? 'complete' : 'incomplete'}.`;
    case 'batch.resolve':
      return `Resolved missing input records for batch ${before.batches.find((batch) => batch.id === command.payload.id)?.code || command.payload.id}; added ${command.payload.additionalInputs.length} source connections. Evidence reference: ${command.payload.source.slice(0, 300)}. Prior saved snapshots remain unchanged.`;
    case 'shipment.create':
      return `Recorded shipment ${command.payload.code}: ${command.payload.quantity} to ${command.payload.customer}.`;
    case 'recall.create':
      return `Saved ${command.payload.mode === 'drill' ? 'a rehearsal' : 'an incident review'}: ${command.payload.title}. Trace and source records frozen in the snapshot.`;
    case 'recall.close':
      return `Archived review ${before.recalls.find((recall) => recall.id === command.payload.id)?.title || command.payload.id}. This does not clear products for sale.`;
    case 'workspace.rename':
      return `Renamed workspace to ${command.payload.name}.`;
    case 'workspace.import':
      return `Imported and validated ${command.payload.lots.length} lots, ${command.payload.batches.length} batches and ${command.payload.shipments.length} shipments.`;
  }
}

function audit(db: AppDatabase, workspace: Workspace, action: string, detail: string): void {
  const previous = db
    .prepare('SELECT hash FROM audit WHERE workspace_id = ? ORDER BY sequence DESC LIMIT 1')
    .get(workspace.id) as { hash: string } | undefined;
  const record = {
    id: randomUUID(),
    workspaceId: workspace.id,
    action,
    detail,
    revision: workspace.revision,
    createdAt: new Date().toISOString(),
    previousHash: previous?.hash || '0'.repeat(64),
  };
  const hash = hashToken(canonicalJson(record));
  db.prepare(
    'INSERT INTO audit (id,workspace_id,action,detail,revision,created_at,previous_hash,hash) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    record.id,
    workspace.id,
    action,
    detail,
    workspace.revision,
    record.createdAt,
    record.previousHash,
    hash,
  );
}

export function createApp(options: AppOptions = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = options.appOrigin || process.env.APP_ORIGIN || 'http://localhost:5180';
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.origin !== origin || (production && parsedOrigin.protocol !== 'https:'))
    throw new Error('APP_ORIGIN must be an exact origin; production requires HTTPS.');
  const db = openDatabase(options.databasePath || process.env.DATABASE_PATH || './data/batchlight.sqlite');
  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  if (options.trustProxy ?? process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Browser mutations must come from our own application, including login and registration.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== origin) {
      res.status(403).json({ error: 'Request origin is not allowed.', code: 'ORIGIN_REJECTED' });
      return;
    }
    next();
  });
  const limit = (windowMs: number, count: number) =>
    rateLimit({
      windowMs,
      limit: count,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many attempts. Please wait and try again.', code: 'RATE_LIMITED' },
      skip: () => options.rateLimit === false,
    });
  app.use('/api', limit(60_000, 300));
  const authLimit = limit(15 * 60_000, 30);
  const demoLimit = limit(60 * 60_000, 20);
  let lastCleanup = 0;
  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    db.transaction(() => {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      db.prepare(
        'DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM users WHERE is_demo = 1 AND expires_at <= ?)',
      ).run(now);
    })();
    lastCleanup = now;
  }
  app.use('/api', (_req, _res, next) => {
    cleanup();
    next();
  });

  function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.[COOKIE];
    const session =
      typeof token === 'string' && token.length <= 100
        ? (db
            .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
            .get(hashToken(token), Date.now()) as SessionRow | undefined)
        : undefined;
    const user = session
      ? (db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as UserRow | undefined)
      : undefined;
    if (!session || !user || (user.expires_at && user.expires_at <= Date.now())) {
      res.status(401).json({ error: 'Please sign in to continue.', code: 'UNAUTHENTICATED' });
      return;
    }
    req.auth = { session, user };
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !equalToken(req.get('X-CSRF-Token') || '', session.csrf_token)
    ) {
      res.status(403).json({
        error: 'Your security token is missing or expired. Refresh and try again.',
        code: 'CSRF_REJECTED',
      });
      return;
    }
    next();
  }
  function issueSession(res: Response, user: UserRow, recoveryCode?: string): SessionResponse {
    const raw = randomToken();
    const csrfToken = randomToken();
    const expiresAt = Math.min(Date.now() + 7 * DAY, user.expires_at ?? Infinity);
    db.prepare(
      'INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)',
    ).run(hashToken(raw), user.id, csrfToken, expiresAt, new Date().toISOString());
    res.cookie(COOKIE, raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      path: '/',
      maxAge: expiresAt - Date.now(),
    });
    return {
      user: publicUser(user),
      workspace: workspaceFor(db, user.workspace_id),
      csrfToken,
      ...(recoveryCode ? { recoveryCode } : {}),
    };
  }
  function clearSession(res: Response) {
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: production, path: '/' });
  }

  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', version: '1.0.0' });
  });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const recoveryCode = randomToken();
    const workspace = createEmptyWorkspace(randomUUID(), input.workspaceName);
    const userId = randomUUID();
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO workspaces (id,data,revision,created_at) VALUES (?,?,?,?)').run(
          workspace.id,
          JSON.stringify(workspace),
          workspace.revision,
          new Date().toISOString(),
        );
        db.prepare(
          'INSERT INTO users (id,workspace_id,name,email,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)',
        ).run(
          userId,
          workspace.id,
          input.name,
          input.email,
          passwordHash,
          hashToken(recoveryCode),
          new Date().toISOString(),
        );
        audit(db, workspace, 'workspace.created', 'Created a new workspace.');
      })();
    } catch (error) {
      if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
        return;
      }
      throw error;
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    res.status(201).json(issueSession(res, user, recoveryCode));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(input.email) as
      | UserRow
      | undefined;
    const valid = await checkPassword(input.password, user?.password_hash || '');
    if (!user || !valid) {
      res.status(401).json({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow | undefined;
    if (!currentUser || currentUser.password_hash !== user.password_hash) {
      res.status(401).json({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    res.json(issueSession(res, user));
  });
  app.post('/api/auth/demo', demoLimit, (_req, res) => {
    const workspace = createDemoWorkspace(randomUUID());
    const userId = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO workspaces (id,data,revision,created_at) VALUES (?,?,?,?)').run(
        workspace.id,
        JSON.stringify(workspace),
        workspace.revision,
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO users (id,workspace_id,name,email,password_hash,recovery_hash,is_demo,created_at,expires_at) VALUES (?,?,?,?,?,?,1,?,?)',
      ).run(
        userId,
        workspace.id,
        'Demo maker',
        `demo-${userId}@example.invalid`,
        '',
        '',
        new Date().toISOString(),
        Date.now() + DAY,
      );
      audit(
        db,
        workspace,
        'demo.created',
        'Created an isolated workspace with synthetic demonstration records. Expires in 24 hours.',
      );
    })();
    res
      .status(201)
      .json(issueSession(res, db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow));
  });
  app.post('/api/auth/recover', authLimit, async (req, res) => {
    const input = recoverySchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(input.email) as
      | UserRow
      | undefined;
    const suppliedHash = hashToken(input.recoveryCode);
    // Password hashing is intentionally performed for invalid recovery attempts, too.
    const passwordHash = await hashPassword(input.password);
    if (!user || !equalToken(suppliedHash, user.recovery_hash)) {
      res.status(401).json({ error: 'Email or recovery code is incorrect.', code: 'INVALID_RECOVERY' });
      return;
    }
    const recoveryCode = randomToken();
    const updated = db.transaction(() => {
      const changed = db
        .prepare('UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?')
        .run(passwordHash, hashToken(recoveryCode), user.id, suppliedHash);
      if (!changed.changes) return false;
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      audit(
        db,
        workspaceFor(db, user.workspace_id),
        'account.recovered',
        'Password and recovery code rotated; all previous sessions revoked.',
      );
      return true;
    })();
    if (!updated) {
      res.status(401).json({ error: 'Email or recovery code is incorrect.', code: 'INVALID_RECOVERY' });
      return;
    }
    res.json(issueSession(res, user, recoveryCode));
  });
  app.get('/api/auth/session', requireAuth, (req: AuthRequest, res) => {
    const { user, session } = req.auth!;
    res.json({
      user: publicUser(user),
      workspace: workspaceFor(db, user.workspace_id),
      csrfToken: session.csrf_token,
    } satisfies SessionResponse);
  });
  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.auth!.session.token_hash);
    clearSession(res);
    res.status(204).end();
  });
  app.get('/api/workspace', requireAuth, (req: AuthRequest, res) =>
    res.json(workspaceFor(db, req.auth!.user.workspace_id)),
  );

  app.post('/api/commands', requireAuth, (req: AuthRequest, res) => {
    const input = commandSchema.parse(req.body);
    const workspaceId = req.auth!.user.workspace_id;
    const payloadHash = hashToken(
      canonicalJson(input.createdAt ? { command: input.command, createdAt: input.createdAt } : input.command),
    );
    const result = db.transaction(() => {
      const current = workspaceFor(db, workspaceId);
      const previous = db
        .prepare('SELECT payload_hash FROM commands WHERE workspace_id = ? AND id = ?')
        .get(workspaceId, input.id) as { payload_hash: string } | undefined;
      if (previous) {
        if (previous.payload_hash !== payloadHash)
          return {
            status: 409,
            body: {
              error: 'This command ID was already used for different data.',
              code: 'IDEMPOTENCY_CONFLICT',
              workspace: current,
            },
          };
        return { status: 200, body: current };
      }
      if (current.revision !== input.expectedRevision)
        return {
          status: 409,
          body: {
            error: 'This workspace changed in another tab. Review the latest records and try again.',
            code: 'REVISION_CONFLICT',
            workspace: current,
          },
        };
      let updated: Workspace;
      try {
        updated = applyCommand(current, input.command as Command, input.createdAt);
      } catch (error) {
        return {
          status: 400,
          body: {
            error: error instanceof Error ? error.message : 'Invalid command.',
            code: 'INVALID_COMMAND',
          },
        };
      }
      if (updated.id !== workspaceId || updated.revision !== current.revision + 1)
        throw new Error('Domain revision invariant failed.');
      const serialized = JSON.stringify(updated);
      if (Buffer.byteLength(serialized) > 32_000_000)
        return {
          status: 413,
          body: {
            error: 'Workspace size limit reached (32 MB). Export your records before adding more history.',
            code: 'WORKSPACE_LIMIT',
          },
        };
      db.prepare('UPDATE workspaces SET data = ?, revision = ? WHERE id = ?').run(
        serialized,
        updated.revision,
        workspaceId,
      );
      const command = input.command as Command;
      const timing =
        input.createdAt && (command.type === 'recall.create' || command.type === 'batch.resolve')
          ? ` Device record time: ${input.createdAt}; audit time records server acceptance.`
          : '';
      audit(db, updated, command.type, commandDetail(command, current) + timing);
      db.prepare(
        'INSERT INTO commands (id,workspace_id,payload_hash,revision,created_at) VALUES (?,?,?,?,?)',
      ).run(input.id, workspaceId, payloadHash, updated.revision, new Date().toISOString());
      return { status: 200, body: updated };
    })();
    res.status(result.status).json(result.body);
  });
  app.get('/api/audit', requireAuth, (req: AuthRequest, res) => {
    const rows = db
      .prepare(
        'SELECT id,action,detail,revision,created_at AS createdAt,previous_hash AS previousHash,hash FROM audit WHERE workspace_id = ? ORDER BY sequence ASC',
      )
      .all(req.auth!.user.workspace_id) as AuditEntry[];
    res.json(rows);
  });
  app.get('/api/export', requireAuth, (req: AuthRequest, res) => {
    const workspace = workspaceFor(db, req.auth!.user.workspace_id);
    res.attachment(`batchlight-records-${new Date().toISOString().slice(0, 10)}.json`);
    res.type('application/json').send(JSON.stringify(workspace, null, 2));
  });
  app.get('/api/recalls/:id/pdf', requireAuth, limit(60_000, 10), async (req: AuthRequest, res) => {
    const workspace = workspaceFor(db, req.auth!.user.workspace_id);
    const recall = workspace.recalls.find((item) => item.id === req.params.id);
    if (!recall) {
      res.status(404).json({ error: 'Recall record not found.', code: 'NOT_FOUND' });
      return;
    }
    try {
      const pdf = await createRecallPdf(workspace.name, recall, Boolean(req.auth!.user.is_demo));
      res
        .attachment(`batchlight-${recall.mode}-${recall.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.pdf`)
        .type('application/pdf')
        .send(pdf);
    } catch (error) {
      if (!(error instanceof PdfTextError)) throw error;
      res.status(422).json({ error: error.message, code: error.code });
    }
  });
  app.post('/api/account/delete', requireAuth, authLimit, async (req: AuthRequest, res) => {
    const input = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const user = req.auth!.user;
    if (user.is_demo || !(await checkPassword(input.password, user.password_hash))) {
      res.status(401).json({ error: 'Your password is incorrect.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    const stillAuthorized = db
      .prepare(
        'SELECT 1 FROM users u JOIN sessions s ON s.user_id = u.id WHERE u.id = ? AND u.password_hash = ? AND s.token_hash = ? AND s.expires_at > ?',
      )
      .get(user.id, user.password_hash, req.auth!.session.token_hash, Date.now());
    if (!stillAuthorized) {
      res.status(401).json({ error: 'Your session changed. Please sign in again.', code: 'UNAUTHENTICATED' });
      return;
    }
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(user.workspace_id);
    clearSession(res);
    res.status(204).end();
  });
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.', code: 'NOT_FOUND' });
  });
  if (production) {
    const dist = resolve(process.cwd(), 'dist');
    if (existsSync(dist)) {
      app.use(
        express.static(dist, {
          maxAge: '1h',
          setHeaders: (res, file) => {
            if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
          },
        }),
      );
      app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
    }
  }
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: error.issues
          .map((issue) => `${issue.path.join('.') || 'Request'}: ${issue.message}`)
          .join('; '),
        code: 'INVALID_INPUT',
      });
      return;
    }
    const bodyError = error as { type?: string };
    if (bodyError.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: 'Request is too large. Maximum request size is 6 MB.', code: 'REQUEST_TOO_LARGE' });
      return;
    }
    if (bodyError.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' });
      return;
    }
    // Never log request bodies, credentials, tokens, or customer records.
    console.error('Batchlight request failed:', error instanceof Error ? error.name : 'UnknownError');
    res
      .status(500)
      .json({ error: 'The request could not be completed. Please try again.', code: 'INTERNAL_ERROR' });
  });
  return app;
}
