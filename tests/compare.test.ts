import { describe, expect, it } from 'vitest';
import { compareRecallEvidence, latestRecallForSource } from '../shared/compare';
import { applyCommand, traceRecall } from '../shared/domain';
import { createDemoWorkspace } from '../shared/demo';
import type { Batch, Command, Workspace } from '../shared/types';

const NOW = '2026-09-22T08:00:00.000Z';
function save(workspace = createDemoWorkspace(), sourceId = 'lot-paprika-a', id = 'snapshot', date = NOW) {
  return applyCommand(
    workspace,
    {
      type: 'recall.create',
      payload: { id, sourceId, title: 'Original evidence', reason: 'Synthetic review', mode: 'drill' },
    },
    date,
  );
}
const resolution = (sourceId: string): Command => ({
  type: 'batch.resolve',
  payload: {
    id: 'batch-uncertain',
    additionalInputs: [{ sourceId, quantity: 1 }],
    notes: 'Confirmed the original spice label.',
    source: 'Photograph LABEL-1909-X.',
  },
});

describe('evidence comparisons preserve history', () => {
  it('shows the uncertainty-to-no-recorded-connection transition after separate-lot evidence', () => {
    const before = save();
    const after = applyCommand(before, resolution('lot-paprika-b'), '2026-09-22T09:00:00.000Z');
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    expect(comparison.classificationChangedCount).toBe(1);
    expect(comparison.unchangedCount).toBe(5);
    expect(comparison.changedRecords[0]).toMatchObject({
      id: 'batch-uncertain',
      kind: 'updated',
      before: { classification: 'investigate', quantity: 120, unit: 'units' },
      after: { classification: 'unconnected', quantity: 120, unit: 'units' },
      classificationChanged: true,
      evidenceChanged: true,
    });
    expect(comparison.changedRecords[0].sourceReview).toContain('Photograph LABEL-1909-X.');
    expect(comparison.changedRecords[0].sourceReview).not.toContain('spice lot box left blank');
    expect(comparison.changedRecords[0].changedFields).toEqual([
      'inputs',
      'recordsComplete',
      'source',
      'notes',
    ]);
  });

  it('shows the uncertainty-to-connected transition after suspect-lot evidence', () => {
    const before = save();
    const after = applyCommand(before, resolution('lot-paprika-a'));
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    expect(comparison.changedRecords[0].before?.classification).toBe('investigate');
    expect(comparison.changedRecords[0].after.classification).toBe('connected');
    expect(comparison.evidenceOnlyChangedCount).toBe(0);
  });

  it('does not mutate or retain mutable references to the original saved snapshot', () => {
    const before = save();
    const frozen = structuredClone(before.recalls[0]);
    const after = applyCommand(before, resolution('lot-paprika-a'));
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    comparison.changedRecords[0].before!.inputs[0].quantity = 999;
    comparison.changedRecords[0].after.inputs[0].quantity = 999;
    expect(before.recalls[0]).toEqual(frozen);
    expect(after.recalls[0]).toEqual(frozen);
    expect(after.batches.find((batch) => batch.id === 'batch-uncertain')!.inputs[0].quantity).toBe(25);
  });

  it('categorizes a new batch separately and keeps its own physical unit', () => {
    const before = save();
    const batch: Batch = {
      id: 'new-bulk',
      code: 'BULK-NEW',
      name: 'New bulk sauce',
      producedOn: '2026-09-22',
      quantity: 2.5,
      unit: 'kg',
      inputs: [{ sourceId: 'lot-paprika-a', quantity: 0.25 }],
      recordsComplete: true,
      notes: '',
      source: 'Production sheet new.',
    };
    const after = applyCommand(before, { type: 'batch.create', payload: batch });
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    expect(comparison.addedCount).toBe(1);
    expect(comparison.classificationChangedCount).toBe(0);
    expect(comparison.changedRecords[0]).toMatchObject({
      kind: 'added',
      before: null,
      after: { classification: 'connected', quantity: 2.5, unit: 'kg' },
    });
    expect(comparison.unchangedCount).toBe(6);
  });

  it('shows record-only evidence updates even when the classification stays connected', () => {
    const initial = createDemoWorkspace();
    initial.batches.find((batch) => batch.id === 'batch-base')!.recordsComplete = false;
    const before = save(initial);
    const after = applyCommand(before, {
      type: 'batch.resolve',
      payload: {
        id: 'batch-base',
        additionalInputs: [],
        notes: 'All inputs rechecked and confirmed.',
        source: 'Signed production sheet.',
      },
    });
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    expect(comparison.evidenceOnlyChangedCount).toBe(1);
    expect(comparison.classificationChangedCount).toBe(0);
    expect(comparison.changedRecords[0].before?.unit).toBe('kg');
    expect(comparison.changedRecords[0].after.classification).toBe('connected');
    expect(comparison.changedRecords[0].evidenceChanged).toBe(true);
  });

  it('distinguishes downstream classification changes from direct record edits', () => {
    const initial = createDemoWorkspace();
    initial.batches.push({
      id: 'downstream',
      code: 'DOWNSTREAM',
      name: 'Repacked relish',
      producedOn: '2026-09-21',
      quantity: 12,
      unit: 'units',
      inputs: [{ sourceId: 'batch-uncertain', quantity: 24 }],
      recordsComplete: true,
      notes: '',
      source: 'Repacking log.',
    });
    const before = save(initial);
    const after = applyCommand(before, resolution('lot-paprika-a'));
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    const indirect = comparison.changedRecords.find((record) => record.id === 'downstream')!;
    expect(comparison.classificationChangedCount).toBe(2);
    expect(indirect.classificationChanged).toBe(true);
    expect(indirect.evidenceChanged).toBe(false);
    expect(indirect.sourceReview).toBe('');
    expect(indirect.changedFields).toEqual([]);
  });

  it('rejects cross-source comparisons and incomplete or contradictory classifications', () => {
    const workspace = save();
    expect(() =>
      compareRecallEvidence(workspace.recalls[0], workspace, traceRecall(workspace, 'lot-paprika-b')),
    ).toThrow(/Different sources cannot be compared/);
    const partial = traceRecall(workspace, 'lot-paprika-a');
    partial.investigationBatchIds = [];
    expect(() => compareRecallEvidence(workspace.recalls[0], workspace, partial)).toThrow(
      /classifications are missing/,
    );
    const conflicting = traceRecall(workspace, 'lot-paprika-a');
    conflicting.affectedBatchIds.push('batch-uncertain');
    expect(() => compareRecallEvidence(workspace.recalls[0], workspace, conflicting)).toThrow(
      /multiply classified/,
    );
  });

  it('selects the latest snapshot for this source even if a different source was saved later', () => {
    let workspace = save(createDemoWorkspace(), 'lot-paprika-a', 'a-old', '2026-09-22T08:00:00.000Z');
    workspace = save(workspace, 'lot-paprika-a', 'a-new', '2026-09-22T09:00:00.000Z');
    workspace = save(workspace, 'lot-paprika-b', 'b-newest', '2026-09-22T10:00:00.000Z');
    expect(latestRecallForSource(workspace, 'lot-paprika-a')?.id).toBe('a-new');
    expect(latestRecallForSource(workspace, 'lot-paprika-b')?.id).toBe('b-newest');
    expect(latestRecallForSource(workspace, 'lot-tomato')).toBeUndefined();
  });

  it('reports unchanged records honestly and does not treat a new delivery as a batch edit', () => {
    const before = save();
    const after = applyCommand(before, {
      type: 'shipment.create',
      payload: {
        id: 'new-delivery',
        code: 'NEW-DELIVERY',
        batchId: 'batch-smoky-1',
        customer: 'New customer',
        contact: 'customer@example.invalid',
        quantity: 12,
        shippedOn: '2026-09-22',
        source: 'New dispatch note.',
      },
    });
    const comparison = compareRecallEvidence(before.recalls[0], after, traceRecall(after, 'lot-paprika-a'));
    expect(comparison.changedRecords).toEqual([]);
    expect(comparison.unchangedCount).toBe(6);
  });
});
