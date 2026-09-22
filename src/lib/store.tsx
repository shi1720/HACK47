import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Command, QueuedCommand, SessionResponse, User, Workspace } from '../../shared/types';
import { applyCommand } from '../../shared/domain';
import { createDemoWorkspace } from '../../shared/demo';
import { api, ApiError, uid } from './api';
import { clearCache, readCache, writeCache } from './storage';

interface Cached {
  user: User;
  workspace: Workspace;
  queue: QueuedCommand[];
  local: boolean;
}
interface Store {
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;
  online: boolean;
  local: boolean;
  readOnly: boolean;
  queue: QueuedCommand[];
  syncing: boolean;
  syncError: string;
  recoveryCode: string;
  csrfToken: string;
  authenticate: (mode: string, values: Record<string, string>) => Promise<void>;
  startLocal: () => Promise<void>;
  logout: () => Promise<void>;
  dispatch: (command: Command) => Promise<void>;
  sync: () => Promise<void>;
  discardPending: () => Promise<void>;
  clearRecovery: () => void;
}
const Context = createContext<Store>(null!);
const OTHER_TAB = 'This workspace is open in another tab. Close the other tab and reload to make changes.';
const UNSUPPORTED =
  'This browser cannot safely coordinate device storage. Use a current browser over HTTPS (or localhost) to make changes. Existing records remain available for export.';
const WRONG_ACCOUNT =
  'This device has pending records from a different account. They have been preserved. Sign in to the original account to sync, or export them before reconciling.';

/** A rejected operation must not poison the queue or permit two state writes at once. */
export function createSerialExecutor() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task);
      tail = next.catch(() => undefined);
      return next;
    },
    settled: () => tail.then(() => undefined),
  };
}

/** A retry already present on the server is safe: the API checks its idempotency key. */
export function recallSyncConflict(item: QueuedCommand, server: Workspace): string | undefined {
  if (item.command.type !== 'recall.create') return;
  const recallId = item.command.payload.id;
  if (server.recalls.some((recall) => recall.id === recallId)) return;
  if (!Number.isSafeInteger(item.baseRevision) || item.baseRevision !== server.revision) {
    return 'The records changed after this pending rehearsal was saved. Its original snapshot remains on this device. Export the report and pending changes, then reconcile with the server copy and create a new rehearsal. Batchlight will not silently recompute its scope.';
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [local, setLocal] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const current = useRef<Cached | null>(null);
  const csrf = useRef('');
  const executor = useRef(createSerialExecutor());
  const runningSync = useRef<Promise<void> | null>(null);
  const cleanupComplete = useRef<Promise<void>>(Promise.resolve());
  const lifecycle = useRef<{ active: boolean; ownsLock: boolean; controller: AbortController } | null>(null);
  const lockMessage = useRef(OTHER_TAB);

  const assertWriter = useCallback(() => {
    if (!lifecycle.current?.active || !lifecycle.current.ownsLock) throw new Error(lockMessage.current);
  }, []);
  const showCached = useCallback((cached: Cached | null) => {
    current.current = cached;
    setUser(cached?.user ?? null);
    setWorkspace(cached?.workspace ?? null);
    setQueue(cached?.queue ?? []);
    setLocal(cached?.local ?? false);
  }, []);
  const persist = useCallback(
    async (cached: Cached) => {
      assertWriter();
      await writeCache('session', cached);
      assertWriter();
      showCached(cached);
    },
    [assertWriter, showCached],
  );
  const setSecurityToken = useCallback((token: string) => {
    csrf.current = token;
    setCsrfToken(token);
  }, []);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      assertWriter();
      const life = lifecycle.current!;
      const controller = new AbortController();
      const abort = () => controller.abort();
      life.controller.signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 15_000);
      try {
        const result = await api<T>(path, { ...options, signal: controller.signal });
        assertWriter();
        return result;
      } finally {
        clearTimeout(timer);
        life.controller.signal.removeEventListener('abort', abort);
      }
    },
    [assertWriter],
  );

  // Runs only inside the shared serial executor. Mutations submitted during a
  // network request wait here, so an old response cannot overwrite newer work.
  const synchronize = useCallback(async () => {
    assertWriter();
    if (!navigator.onLine || !current.current || current.current.local) return;
    const session = await request<SessionResponse>('/auth/session');
    if (session.user.id !== current.current.user.id) throw new Error(WRONG_ACCOUNT);
    setSecurityToken(session.csrfToken);
    let server = session.workspace;
    while (current.current.queue.length) {
      const item = current.current.queue[0];
      const conflict = recallSyncConflict(item, server);
      if (conflict) throw new Error(conflict);
      server = await request<Workspace>('/commands', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf.current },
        body: JSON.stringify({
          id: item.id,
          command: item.command,
          expectedRevision: server.revision,
          createdAt: item.createdAt,
        }),
      });
      const rest = current.current.queue.slice(1);
      let optimistic = server;
      // If a later command conflicts after rebase, keep the original pending
      // copy rather than lose it. The accepted command is retried idempotently.
      for (const pending of rest) {
        const scopeConflict = recallSyncConflict(pending, optimistic);
        if (scopeConflict) throw new Error(scopeConflict);
        optimistic = applyCommand(optimistic, pending.command, pending.createdAt);
      }
      await persist({ ...current.current, workspace: optimistic, queue: rest });
    }
    await persist({ ...current.current, workspace: server });
  }, [assertWriter, persist, request, setSecurityToken]);

  const sync = useCallback(async () => {
    if (runningSync.current) return runningSync.current;
    if (!lifecycle.current?.active || !lifecycle.current.ownsLock) {
      setSyncError(lockMessage.current);
      return;
    }
    if (!navigator.onLine || !current.current || current.current.local) return;
    setSyncing(true);
    setSyncError('');
    const operation = executor.current
      .run(synchronize)
      .catch((error) => {
        if (lifecycle.current?.active)
          setSyncError(
            error instanceof Error ? error.message : 'Unable to sync. Pending records remain on this device.',
          );
      })
      .finally(() => {
        runningSync.current = null;
        if (lifecycle.current?.active) setSyncing(false);
      });
    runningSync.current = operation;
    return operation;
  }, [synchronize]);

  useEffect(() => {
    const life = { active: true, ownsLock: false, controller: new AbortController() };
    lifecycle.current = life;
    const precedingCleanup = cleanupComplete.current;
    let lockTask: Promise<void> | undefined;
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const readOnlyLoad = async (message: string) => {
      lockMessage.current = message;
      try {
        const cached = await readCache<Cached>('session');
        if (life.active) showCached(cached ?? null);
      } catch {
        /* Storage errors do not enable an unsafe fallback writer. */
      }
      if (life.active) {
        setReadOnly(true);
        setSyncError(message);
        setLoading(false);
      }
    };
    const initialize = async () => {
      try {
        const cached = await readCache<Cached>('session');
        assertWriter();
        if (cached) showCached(cached);
        if (cached?.local || !navigator.onLine || import.meta.env.VITE_STATIC_DEMO === 'true') return;
        try {
          const session = await request<SessionResponse>('/auth/session');
          if (cached?.queue.length) {
            if (cached.user.id !== session.user.id) throw new Error(WRONG_ACCOUNT);
            await synchronize();
          } else {
            setSecurityToken(session.csrfToken);
            await persist({ user: session.user, workspace: session.workspace, queue: [], local: false });
          }
        } catch (error) {
          if (!life.active) return;
          if (error instanceof ApiError && error.status === 401 && !cached?.queue.length) {
            await clearCache();
            assertWriter();
            showCached(null);
            setSecurityToken('');
          } else if (cached) {
            setSyncError(
              error instanceof Error
                ? error.message
                : 'Working from the saved device copy. Pending records are preserved.',
            );
          } else if (!(error instanceof ApiError && error.status === 401))
            setSyncError('The server is unavailable. Please retry when connected.');
        }
      } catch (error) {
        if (life.active)
          setSyncError(
            error instanceof Error
              ? error.message
              : 'Device storage is unavailable. Enable browser storage to use Batchlight.',
          );
      } finally {
        if (life.active) setLoading(false);
      }
    };
    if (!navigator.locks?.request) void readOnlyLoad(UNSUPPORTED);
    else {
      lockTask = precedingCleanup
        .then(async () => {
          await navigator.locks.request(
            'batchlight-workspace-writer-v1',
            { mode: 'exclusive', ifAvailable: true },
            async (lock) => {
              if (!life.active) return;
              if (!lock) {
                await readOnlyLoad(OTHER_TAB);
                return;
              }
              life.ownsLock = true;
              setReadOnly(false);
              await executor.current.run(initialize);
              await held;
              life.ownsLock = false;
            },
          );
        })
        .catch(() => {
          if (life.active) void readOnlyLoad(UNSUPPORTED);
        });
    }
    return () => {
      life.active = false;
      life.controller.abort();
      // Never release ownership while an IndexedDB write is still settling.
      cleanupComplete.current = executor.current
        .settled()
        .then(() => {
          release?.();
        })
        .then(() => lockTask)
        .then(() => undefined);
    };
  }, [assertWriter, persist, request, setSecurityToken, showCached, synchronize]);

  useEffect(() => {
    const connected = () => {
      setOnline(true);
      void sync();
    };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [sync]);

  const authenticate = async (mode: string, values: Record<string, string>) => {
    await executor.current.run(async () => {
      assertWriter();
      if (import.meta.env.VITE_STATIC_DEMO === 'true')
        throw new Error(
          'This public demo stores records only in your browser. Account login requires the hosted server application.',
        );
      const pending = current.current?.queue.length ? current.current : null;
      if (
        pending &&
        (!['login', 'recover'].includes(mode) ||
          values.email?.trim().toLowerCase() !== pending.user.email.toLowerCase())
      )
        throw new Error(WRONG_ACCOUNT);
      const session = await request<SessionResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      if (pending && session.user.id !== pending.user.id) throw new Error(WRONG_ACCOUNT);
      setSecurityToken(session.csrfToken);
      setRecoveryCode(session.recoveryCode || '');
      setSyncError('');
      await persist(
        pending
          ? { ...pending, user: session.user }
          : { user: session.user, workspace: session.workspace, queue: [], local: false },
      );
    });
    if (current.current?.queue.length) void sync();
  };
  const startLocal = () =>
    executor.current.run(async () => {
      assertWriter();
      if (current.current?.queue.length)
        throw new Error('Sync pending records before opening the local demo.');
      setSyncError('');
      setSecurityToken('');
      setRecoveryCode('');
      await persist({
        user: { id: 'local-demo', name: 'Demo maker', email: 'demo@batchlight.local', isDemo: true },
        workspace: createDemoWorkspace('local-demo'),
        queue: [],
        local: true,
      });
    });
  const logout = () =>
    executor.current.run(async () => {
      assertWriter();
      if (current.current?.queue.length)
        throw new Error('Sync or export and discard pending records before signing out.');
      if (!current.current?.local)
        await request('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf.current } });
      await clearCache();
      assertWriter();
      showCached(null);
      setSecurityToken('');
      setRecoveryCode('');
      setSyncError('');
    });
  const dispatch = async (command: Command) => {
    await executor.current.run(async () => {
      assertWriter();
      const cached = current.current;
      if (!cached) throw new Error('Sign in to save records.');
      const createdAt = new Date().toISOString();
      const updated = applyCommand(cached.workspace, command, createdAt);
      const pending = cached.local
        ? []
        : [...cached.queue, { id: uid(), command, createdAt, baseRevision: cached.workspace.revision }];
      await persist({ ...cached, workspace: updated, queue: pending });
    });
    if (!current.current?.local) void sync();
  };
  const discardPending = () =>
    executor.current.run(async () => {
      assertWriter();
      if (!current.current) return;
      const session = await request<SessionResponse>('/auth/session');
      if (session.user.id !== current.current.user.id)
        throw new Error(
          'Sign in to the original account before resolving these records. Pending changes were preserved.',
        );
      setSecurityToken(session.csrfToken);
      await persist({ ...current.current, workspace: session.workspace, queue: [] });
      setSyncError('');
    });
  return (
    <Context.Provider
      value={{
        user,
        workspace,
        loading,
        online,
        local,
        readOnly,
        queue,
        syncing,
        syncError,
        recoveryCode,
        authenticate,
        startLocal,
        logout,
        dispatch,
        sync,
        discardPending,
        clearRecovery: () => setRecoveryCode(''),
        csrfToken,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
