import { describe, expect, it } from 'vitest';
import { createSerialExecutor, recallSyncConflict } from '../src/lib/store';
import { createDemoWorkspace } from '../shared/demo';
import { applyCommand } from '../shared/domain';
import type { QueuedCommand } from '../shared/types';

const recall = (baseRevision = 0): QueuedCommand => ({
  id: 'queued-recall',
  baseRevision,
  createdAt: '2026-09-22T12:00:00.000Z',
  command: {
    type: 'recall.create',
    payload: {
      id: 'offline-recall',
      sourceId: 'lot-paprika-a',
      title: 'Offline review',
      reason: 'Preserve the reviewed scope.',
      mode: 'drill',
    },
  },
});

describe('serialized device writes', () => {
  it('does not lose a second command submitted while the first persistence is still in flight', async () => {
    const serial = createSerialExecutor();
    let release!: () => void;
    const pendingWrite = new Promise<void>((resolve) => {
      release = resolve;
    });
    let state = 0;
    const events: string[] = [];
    const first = serial.run(async () => {
      const before = state;
      events.push('first-start');
      await pendingWrite;
      state = before + 1;
      events.push('first-end');
    });
    const second = serial.run(async () => {
      events.push('second-start');
      const before = state;
      await Promise.resolve();
      state = before + 1;
      events.push('second-end');
    });
    await Promise.resolve();
    expect(events).toEqual(['first-start']);
    release();
    await Promise.all([first, second]);
    expect(state).toBe(2);
    expect(events).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('lets later work proceed after a rejected network or validation operation', async () => {
    const serial = createSerialExecutor();
    const first = serial.run(async () => {
      throw new Error('Network unavailable');
    });
    const second = serial.run(async () => 'saved locally');
    await expect(first).rejects.toThrow('Network unavailable');
    await expect(second).resolves.toBe('saved locally');
    await expect(serial.settled()).resolves.toBeUndefined();
  });

  it('waits for persistence to settle before releasing tab ownership', async () => {
    const serial = createSerialExecutor();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = serial.run(() => wait);
    let settled = false;
    const cleanup = serial.settled().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await Promise.all([pending, cleanup]);
    expect(settled).toBe(true);
  });
});

describe('offline rehearsal revision protection', () => {
  it('accepts an unchanged graph and preserves the device review timestamp', () => {
    const server = createDemoWorkspace();
    const item = recall(server.revision);
    expect(recallSyncConflict(item, server)).toBeUndefined();
    const accepted = applyCommand(server, item.command, item.createdAt);
    expect(accepted.recalls[0].createdAt).toBe(item.createdAt);
    expect(accepted.recalls[0].result.computedAt).toBe(item.createdAt);
  });

  it('pauses when another device changes the graph instead of recomputing saved scope', () => {
    const original = createDemoWorkspace();
    const item = recall(original.revision);
    const local = applyCommand(original, item.command, item.createdAt);
    const updated = applyCommand(original, {
      type: 'batch.resolve',
      payload: {
        id: 'batch-uncertain',
        additionalInputs: [{ sourceId: 'lot-paprika-a', quantity: 1 }],
        notes: 'Spice label confirmed.',
        source: 'Review photograph.',
      },
    });
    expect(recallSyncConflict(item, updated)).toContain('will not silently recompute');
    expect(local.recalls[0].result.affectedUnits).toBe(480);
    expect(local.recalls[0].result.investigationBatchIds).toContain('batch-uncertain');
  });

  it('permits idempotent retry of a rehearsal already accepted before a lost response', () => {
    const server = createDemoWorkspace();
    const item = recall(server.revision);
    const alreadySaved = applyCommand(server, item.command, item.createdAt);
    expect(alreadySaved.revision).not.toBe(item.baseRevision);
    expect(recallSyncConflict(item, alreadySaved)).toBeUndefined();
  });

  it('fails closed for old cached rehearsals without captured revisions', () => {
    const oldItem = recall();
    delete (oldItem as Partial<QueuedCommand>).baseRevision;
    expect(recallSyncConflict(oldItem, createDemoWorkspace())).toContain('original snapshot remains');
  });

  it('lets ordinary record writes rebase and rely on current stock validation', () => {
    const item: QueuedCommand = {
      id: 'rename',
      baseRevision: 0,
      createdAt: '2026-09-22T12:00:00.000Z',
      command: { type: 'workspace.rename', payload: { name: 'Renamed' } },
    };
    const server = createDemoWorkspace();
    server.revision = 5;
    expect(recallSyncConflict(item, server)).toBeUndefined();
  });
});
