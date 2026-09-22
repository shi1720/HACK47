import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  DomainError,
  MAX_ANCESTRY_DEPTH,
  stockBalances,
  stockRemaining,
  traceRecall,
  validateWorkspace,
} from '../shared/domain';
import { createDemoWorkspace, createEmptyWorkspace } from '../shared/demo';
import type { Batch, Lot, Shipment, Workspace } from '../shared/types';

const NOW = '2026-09-22T09:00:00.000Z';
const lot = (overrides: Partial<Lot> = {}): Lot => ({
  id: 'lot-a',
  code: 'LOT-A',
  name: 'Ingredient',
  supplier: 'Supplier',
  receivedOn: '2026-09-15',
  quantity: 100,
  unit: 'kg',
  status: 'available',
  source: 'Delivery note 1',
  ...overrides,
});
const batch = (overrides: Partial<Batch> = {}): Batch => ({
  id: 'batch-a',
  code: 'BATCH-A',
  name: 'Finished batch',
  producedOn: '2026-09-16',
  quantity: 100,
  unit: 'units',
  inputs: [{ sourceId: 'lot-a', quantity: 10 }],
  recordsComplete: true,
  notes: '',
  source: 'Production sheet 1',
  ...overrides,
});
const shipment = (overrides: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-a',
  code: 'SHIP-A',
  batchId: 'batch-a',
  customer: 'Corner shop',
  contact: 'shop@example.com',
  quantity: 20,
  shippedOn: '2026-09-17',
  source: 'Dispatch note 1',
  ...overrides,
});
function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    ...createEmptyWorkspace('workspace-test', 'Test kitchen'),
    lots: [lot()],
    batches: [batch()],
    shipments: [],
    ...overrides,
  };
}
function failure(run: () => unknown, code: string) {
  try {
    run();
    throw new Error('Expected a DomainError');
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
}

describe('traceability with uncertainty', () => {
  it('traces the synthetic demonstration through a bulk intermediate, with exact jar totals', () => {
    const demo = createDemoWorkspace();
    const result = traceRecall(demo, 'lot-paprika-a', NOW);
    expect(result.affectedBatchIds).toEqual([
      'batch-base',
      'batch-smoky-1',
      'batch-smoky-2',
      'batch-smoky-3',
    ]);
    expect(result.paths['batch-smoky-3']).toEqual(['lot-paprika-a', 'batch-base', 'batch-smoky-3']);
    expect(result.affectedUnits).toBe(480);
    expect(result.shippedUnits).toBe(300);
    expect(result.onHandUnits).toBe(180);
    expect(result.customerCount).toBe(3);
    expect(result.investigationBatchIds).toEqual(['batch-uncertain']);
    expect(result.investigationShipmentIds).toEqual(['shipment-uncertain']);
    expect(result.unconnectedBatchIds).toEqual(['batch-separate']);
    expect(stockRemaining(demo, 'batch-base')).toBe(0);
    expect(stockRemaining(demo, 'lot-paprika-a')).toBe(7);
    expect(result.computedAt).toBe(NOW);
  });

  it('propagates uncertainty from a missing mapping through complete descendants and shipments', () => {
    const data = workspace({
      batches: [
        batch(),
        batch({ id: 'unknown', code: 'UNKNOWN', inputs: [], recordsComplete: false }),
        batch({
          id: 'child',
          code: 'CHILD',
          inputs: [{ sourceId: 'unknown', quantity: 50 }],
          producedOn: '2026-09-17',
        }),
        batch({
          id: 'grandchild',
          code: 'GRANDCHILD',
          inputs: [{ sourceId: 'child', quantity: 50 }],
          producedOn: '2026-09-18',
        }),
      ],
      shipments: [shipment({ batchId: 'grandchild', shippedOn: '2026-09-19' })],
    });
    const result = traceRecall(data, 'lot-a', NOW);
    expect(result.affectedBatchIds).toEqual(['batch-a']);
    expect(result.investigationBatchIds).toEqual(['unknown', 'child', 'grandchild']);
    expect(result.paths.grandchild).toEqual(['unknown', 'child', 'grandchild']);
    expect(result.investigationShipmentIds).toEqual(['ship-a']);
    expect(result.shippedUnits).toBe(0);
    expect(result.customerCount).toBe(0);
  });

  it('keeps recorded connection priority when a batch is incomplete or has uncertain inputs too', () => {
    const data = workspace({
      batches: [
        batch({ recordsComplete: false }),
        batch({ id: 'unknown', code: 'UNKNOWN', inputs: [], recordsComplete: false }),
        batch({
          id: 'child',
          code: 'CHILD',
          inputs: [
            { sourceId: 'batch-a', quantity: 10 },
            { sourceId: 'unknown', quantity: 10 },
          ],
          producedOn: '2026-09-17',
        }),
      ],
    });
    const result = traceRecall(data, 'lot-a', NOW);
    expect(result.affectedBatchIds).toEqual(['batch-a', 'child']);
    expect(result.investigationBatchIds).toEqual(['unknown']);
    expect(result.gaps.map((gap) => gap.batchId)).toEqual(['batch-a', 'unknown']);
    expect(result.paths.child).toEqual(['lot-a', 'batch-a', 'child']);
  });

  it('does not count an intermediate unit twice after it is consumed by another unit batch', () => {
    const data = workspace({
      batches: [
        batch({ quantity: 100 }),
        batch({
          id: 'repacked',
          code: 'REPACKED',
          quantity: 40,
          inputs: [{ sourceId: 'batch-a', quantity: 80 }],
          producedOn: '2026-09-17',
        }),
      ],
      shipments: [
        shipment({ quantity: 10 }),
        shipment({ id: 'ship-b', code: 'SHIP-B', batchId: 'repacked', quantity: 5, shippedOn: '2026-09-18' }),
      ],
    });
    const result = traceRecall(data, 'lot-a', NOW);
    expect(result.affectedUnits).toBe(60); // 20 original units + 40 repacked units.
    expect(result.onHandUnits).toBe(45);
    expect(result.shippedUnits).toBe(15);
    expect(result.customerCount).toBe(1);
  });

  it('never adds kilograms or litres into a unit count', () => {
    const data = workspace({ batches: [batch({ unit: 'kg' })], shipments: [shipment()] });
    const result = traceRecall(data, 'lot-a', NOW);
    expect(result.shipmentIds).toEqual(['ship-a']);
    expect(result.affectedUnits).toBe(0);
    expect(result.onHandUnits).toBe(0);
    expect(result.shippedUnits).toBe(0);
    expect(result.customerCount).toBe(1);
  });

  it('can start from a finished batch and does not incorrectly include its ancestors', () => {
    const result = traceRecall(createDemoWorkspace(), 'batch-smoky-2', NOW);
    expect(result.affectedBatchIds).toEqual(['batch-smoky-2']);
    expect(result.affectedUnits).toBe(180);
    expect(result.shippedUnits).toBe(120);
    expect(result.paths['batch-smoky-2']).toEqual(['batch-smoky-2']);
  });

  it('rejects an unknown trace source instead of producing an empty reassurance', () => {
    failure(() => traceRecall(workspace(), 'missing', NOW), 'MISSING_SOURCE');
  });

  it('handles source IDs resembling Object prototype fields without leaking inherited paths', () => {
    const data = workspace({
      lots: [lot({ id: 'constructor' })],
      batches: [batch({ id: 'toString', inputs: [{ sourceId: 'constructor', quantity: 1 }] })],
    });
    const result = traceRecall(data, 'constructor', NOW);
    expect(result.affectedBatchIds).toEqual(['toString']);
    expect(result.paths.toString).toEqual(['constructor', 'toString']);
    expect(Object.keys(result.paths)).toEqual(['constructor', 'toString']);
    expect(Object.prototype.hasOwnProperty.call(result.paths, 'valueOf')).toBe(false);
    failure(() => validateWorkspace(workspace({ lots: [lot({ id: '__proto__' })] })), 'INVALID_RECORD');
  });
});

describe('graph and stock invariants', () => {
  it('bounds path materialization at 128 production steps and rejects step 129 clearly', () => {
    const chain = workspace({ batches: [] });
    for (let index = 0; index < MAX_ANCESTRY_DEPTH; index++)
      chain.batches.push(
        batch({
          id: `step-${index}`,
          code: `STEP-${index}`,
          quantity: 1,
          unit: 'kg',
          inputs: [{ sourceId: index === 0 ? 'lot-a' : `step-${index - 1}`, quantity: 1 }],
        }),
      );
    expect(traceRecall(chain, 'lot-a').paths[`step-${MAX_ANCESTRY_DEPTH - 1}`]).toHaveLength(
      MAX_ANCESTRY_DEPTH + 1,
    );
    chain.batches.push(
      batch({
        id: 'too-deep',
        code: 'TOO-DEEP',
        inputs: [{ sourceId: `step-${MAX_ANCESTRY_DEPTH - 1}`, quantity: 1 }],
      }),
    );
    failure(() => validateWorkspace(chain), 'GRAPH_TOO_DEEP');
    expect(() => validateWorkspace(chain)).toThrow(/128 production steps.*Review its input links/);
  });

  it('provides all stock balances at once including zero balances and prototype-like IDs', () => {
    const data = createDemoWorkspace();
    const balances = stockBalances(data);
    expect(Object.keys(balances)).toHaveLength(data.lots.length + data.batches.length);
    expect(balances['lot-paprika-a']).toBe(7);
    expect(balances['batch-base']).toBe(0);
    expect(balances['batch-smoky-1']).toBe(60);
    const edge = workspace({
      lots: [lot({ id: 'constructor' })],
      batches: [batch({ inputs: [{ sourceId: 'constructor', quantity: 10 }] })],
    });
    expect(stockBalances(edge).constructor).toBe(90);
    failure(() => stockRemaining(data, 'missing'), 'MISSING_SOURCE');
  });

  it.each([0, -1, Infinity, -Infinity, NaN, 1_000_000_001, 0.0001, 1.2345])(
    'rejects invalid quantity %s',
    (quantity) => {
      failure(() => validateWorkspace(workspace({ lots: [lot({ quantity })] })), 'INVALID_RECORD');
    },
  );

  it('accounts for three decimal places exactly, without float over-allocation errors', () => {
    const data = workspace({
      lots: [lot({ quantity: 0.3 })],
      batches: [
        batch({ quantity: 0.2, inputs: [{ sourceId: 'lot-a', quantity: 0.1 }] }),
        batch({ id: 'b2', code: 'B2', inputs: [{ sourceId: 'lot-a', quantity: 0.2 }] }),
      ],
      shipments: [shipment({ quantity: 0.2 })],
    });
    expect(stockRemaining(data, 'lot-a')).toBe(0);
    expect(stockRemaining(data, 'batch-a')).toBe(0);
    expect(() => validateWorkspace(data)).not.toThrow();
  });

  it('validates maximum supported quantity without integer rounding problems', () => {
    const data = workspace({
      lots: [lot({ quantity: 999_999_999.999 })],
      batches: [batch({ inputs: [{ sourceId: 'lot-a', quantity: 999_999_999.998 }] })],
    });
    expect(stockRemaining(data, 'lot-a')).toBe(0.001);
  });

  it('rejects stock oversubscription across separate production records', () => {
    failure(
      () =>
        validateWorkspace(
          workspace({
            batches: [
              batch({ inputs: [{ sourceId: 'lot-a', quantity: 70 }] }),
              batch({ id: 'b2', code: 'B2', inputs: [{ sourceId: 'lot-a', quantity: 31 }] }),
            ],
          }),
        ),
      'STOCK_EXCEEDED',
    );
  });

  it('combines shipments and intermediate consumption when checking available stock', () => {
    failure(
      () =>
        validateWorkspace(
          workspace({
            batches: [
              batch(),
              batch({
                id: 'b2',
                code: 'B2',
                inputs: [{ sourceId: 'batch-a', quantity: 81 }],
                producedOn: '2026-09-17',
              }),
            ],
            shipments: [shipment()],
          }),
        ),
      'STOCK_EXCEEDED',
    );
  });

  it('rejects duplicate inputs, source codes across kinds, and global IDs', () => {
    failure(
      () =>
        validateWorkspace(
          workspace({
            batches: [
              batch({
                inputs: [
                  { sourceId: 'lot-a', quantity: 5 },
                  { sourceId: 'lot-a', quantity: 5 },
                ],
              }),
            ],
          }),
        ),
      'DUPLICATE_INPUT',
    );
    failure(() => validateWorkspace(workspace({ batches: [batch({ code: 'lot-a' })] })), 'DUPLICATE_CODE');
    failure(() => validateWorkspace(workspace({ shipments: [shipment({ id: 'lot-a' })] })), 'DUPLICATE_ID');
  });

  it('rejects dangling inputs, direct cycles, and cycles across several batches', () => {
    failure(
      () =>
        validateWorkspace(
          workspace({ batches: [batch({ inputs: [{ sourceId: 'missing', quantity: 1 }] })] }),
        ),
      'MISSING_SOURCE',
    );
    failure(
      () =>
        validateWorkspace(
          workspace({ batches: [batch({ inputs: [{ sourceId: 'batch-a', quantity: 1 }] })] }),
        ),
      'CYCLE',
    );
    failure(
      () =>
        validateWorkspace(
          workspace({
            batches: [
              batch({ inputs: [{ sourceId: 'b2', quantity: 1 }] }),
              batch({ id: 'b2', code: 'B2', inputs: [{ sourceId: 'batch-a', quantity: 1 }] }),
            ],
          }),
        ),
      'CYCLE',
    );
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-12', '2026-09-31', '2026-9-1', 'not-a-date'])(
    'rejects nonexistent or noncanonical calendar date %s',
    (receivedOn) => {
      failure(() => validateWorkspace(workspace({ lots: [lot({ receivedOn })] })), 'INVALID_RECORD');
    },
  );

  it('accepts leap day and rejects receipt/production/shipping chronology errors', () => {
    expect(() => validateWorkspace(workspace({ lots: [lot({ receivedOn: '2024-02-29' })] }))).not.toThrow();
    failure(
      () => validateWorkspace(workspace({ lots: [lot({ receivedOn: '2026-09-17' })] })),
      'INVALID_DATE_ORDER',
    );
    failure(
      () => validateWorkspace(workspace({ lots: [lot({ expiresOn: '2026-09-14' })] })),
      'INVALID_DATE_ORDER',
    );
    failure(
      () => validateWorkspace(workspace({ shipments: [shipment({ shippedOn: '2026-09-15' })] })),
      'INVALID_DATE_ORDER',
    );
    failure(
      () =>
        validateWorkspace(
          workspace({
            batches: [
              batch(),
              batch({
                id: 'b2',
                code: 'B2',
                producedOn: '2026-09-15',
                inputs: [{ sourceId: 'batch-a', quantity: 1 }],
              }),
            ],
          }),
        ),
      'INVALID_DATE_ORDER',
    );
  });

  it('only permits shipments from production batches', () => {
    failure(
      () => validateWorkspace(workspace({ shipments: [shipment({ batchId: 'lot-a' })] })),
      'MISSING_BATCH',
    );
  });

  it('requires records marked complete to contain at least one input', () => {
    failure(() => validateWorkspace(workspace({ batches: [batch({ inputs: [] })] })), 'MISSING_INPUTS');
    expect(() =>
      validateWorkspace(workspace({ batches: [batch({ inputs: [], recordsComplete: false })] })),
    ).not.toThrow();
  });

  it('rejects unsupported units and input unit overrides', () => {
    failure(
      () => validateWorkspace(workspace({ lots: [lot({ unit: 'pounds' as Lot['unit'] })] })),
      'INVALID_RECORD',
    );
    const data = workspace();
    Object.assign(data.batches[0].inputs[0], { unit: 'g' });
    failure(() => validateWorkspace(data), 'INVALID_RECORD');
  });

  it('requires source evidence on API writes as well as imported records', () => {
    failure(
      () =>
        applyCommand(createEmptyWorkspace('empty', 'Kitchen'), {
          type: 'lot.create',
          payload: lot({ source: '' }),
        }),
      'INVALID_RECORD',
    );
    failure(
      () =>
        applyCommand(workspace(), {
          type: 'batch.create',
          payload: batch({ id: 'b2', code: 'B2', source: '  ' }),
        }),
      'INVALID_RECORD',
    );
    failure(
      () => applyCommand(workspace(), { type: 'shipment.create', payload: shipment({ source: '' }) }),
      'INVALID_RECORD',
    );
  });
});

describe('atomic commands and immutable saved recalls', () => {
  it('accepts dependent records in reverse order within one atomic import', () => {
    const empty = createEmptyWorkspace('empty', 'Kitchen');
    const finalBatch = batch({
      id: 'final',
      code: 'FINAL',
      inputs: [{ sourceId: 'batch-a', quantity: 20 }],
      producedOn: '2026-09-17',
    });
    const next = applyCommand(empty, {
      type: 'workspace.import',
      payload: {
        lots: [lot()],
        batches: [finalBatch, batch()],
        shipments: [shipment({ batchId: 'final', shippedOn: '2026-09-18' })],
      },
    });
    expect(next.revision).toBe(1);
    expect(empty.batches).toHaveLength(0);
    expect(traceRecall(next, 'lot-a', NOW).affectedBatchIds).toEqual(['final', 'batch-a']);
  });

  it('does not partially apply a failing import or overwrite an existing record', () => {
    const initial = workspace();
    const before = structuredClone(initial);
    failure(
      () =>
        applyCommand(initial, {
          type: 'workspace.import',
          payload: { lots: [lot({ id: 'fresh', code: 'FRESH' })], batches: [batch()], shipments: [] },
        }),
      'DUPLICATE_ID',
    );
    expect(initial).toEqual(before);
  });

  it('rejects unknown command types and unrecognized fields', () => {
    failure(() => applyCommand(workspace(), { type: 'workspace.delete', payload: {} }), 'INVALID_RECORD');
    failure(
      () =>
        applyCommand(workspace(), { type: 'workspace.rename', payload: { name: 'Name', owner: 'attacker' } }),
      'INVALID_RECORD',
    );
  });

  it('deeply snapshots recall evidence and counts so later changes cannot rewrite history', () => {
    const initial = workspace();
    const saved = applyCommand(
      initial,
      {
        type: 'recall.create',
        payload: {
          id: 'recall-a',
          sourceId: 'lot-a',
          title: 'Monthly drill',
          reason: 'Synthetic exercise',
          mode: 'drill',
        },
      },
      NOW,
    );
    const originalRecall = structuredClone(saved.recalls[0]);
    const shipped = applyCommand(saved, { type: 'shipment.create', payload: shipment() });
    const held = applyCommand(shipped, { type: 'lot.status', payload: { id: 'lot-a', status: 'hold' } });
    expect(held.revision).toBe(3);
    expect(held.recalls[0]).toEqual(originalRecall);
    expect(held.recalls[0].result.shippedUnits).toBe(0);
    expect(traceRecall(held, 'lot-a', NOW).shippedUnits).toBe(20);
    expect(held.recalls[0].snapshot.lots[0].status).toBe('available');
    expect(initial.recalls).toEqual([]);
    held.lots[0].source = 'changed in returned working data';
    expect(held.recalls[0].snapshot.lots[0].source).toBe('Delivery note 1');
    expect(saved.lots[0].source).toBe('Delivery note 1');
  });

  it('rejects forged saved results that do not match evidence', () => {
    const saved = applyCommand(
      workspace(),
      {
        type: 'recall.create',
        payload: { id: 'r', sourceId: 'lot-a', title: 'Drill', reason: '', mode: 'drill' },
      },
      NOW,
    );
    saved.recalls[0].result.affectedUnits = 0;
    failure(() => validateWorkspace(saved), 'INVALID_SNAPSHOT');
  });

  it('closes a recall without modifying the computed snapshot', () => {
    const saved = applyCommand(
      workspace(),
      {
        type: 'recall.create',
        payload: { id: 'r', sourceId: 'lot-a', title: 'Drill', reason: '', mode: 'drill' },
      },
      new Date(NOW),
    );
    const closed = applyCommand(saved, { type: 'recall.close', payload: { id: 'r' } });
    expect(closed.recalls[0].status).toBe('closed');
    expect(closed.recalls[0].result).toEqual(saved.recalls[0].result);
    expect(closed.recalls[0].snapshot).toEqual(saved.recalls[0].snapshot);
    expect(saved.recalls[0].status).toBe('open');
    failure(() => applyCommand(closed, { type: 'recall.close', payload: { id: 'r' } }), 'ALREADY_CLOSED');
  });

  it('returns an independent demo workspace every time', () => {
    const first = createDemoWorkspace();
    first.lots[0].quantity = 0;
    expect(createDemoWorkspace().lots[0].quantity).toBe(10);
  });
});

describe('append-only ingredient record resolution', () => {
  const resolve = (sourceId = 'lot-paprika-b') => ({
    type: 'batch.resolve' as const,
    payload: {
      id: 'batch-uncertain',
      additionalInputs: [{ sourceId, quantity: 1 }],
      notes: 'Reviewed the original spice-label photograph and completed the omitted input.',
      source: 'Correction evidence IMG-1909-X, reviewed by the operator.',
    },
  });

  it('removes uncertainty when documented evidence identifies a separate ingredient lot', () => {
    const initial = createDemoWorkspace();
    const before = initial.batches.find((batch) => batch.id === 'batch-uncertain')!;
    const repaired = applyCommand(initial, resolve(), NOW);
    const after = repaired.batches.find((batch) => batch.id === 'batch-uncertain')!;
    const result = traceRecall(repaired, 'lot-paprika-a', NOW);
    expect(result.investigationBatchIds).toEqual([]);
    expect(result.investigationShipmentIds).toEqual([]);
    expect(result.unconnectedBatchIds).toContain('batch-uncertain');
    expect(result.affectedUnits).toBe(480);
    expect(result.gaps).toEqual([]);
    expect(after.inputs.slice(0, before.inputs.length)).toEqual(before.inputs);
    expect(after.inputs.at(-1)).toEqual({ sourceId: 'lot-paprika-b', quantity: 1 });
    expect(after.notes.startsWith(before.notes)).toBe(true);
    expect(after.source.startsWith(before.source)).toBe(true);
    expect(after.source).toContain(`Record review (${NOW})`);
    expect(after.recordsComplete).toBe(true);
    expect(before.recordsComplete).toBe(false);
    expect(repaired.revision).toBe(initial.revision + 1);
  });

  it('records historical use of a held suspect lot, changing uncertainty to a recorded connection', () => {
    const initial = createDemoWorkspace();
    expect(initial.lots.find((lot) => lot.id === 'lot-paprika-a')!.status).toBe('hold');
    const repaired = applyCommand(initial, resolve('lot-paprika-a'), NOW);
    const result = traceRecall(repaired, 'lot-paprika-a', NOW);
    expect(result.investigationBatchIds).toEqual([]);
    expect(result.affectedBatchIds).toContain('batch-uncertain');
    expect(result.shipmentIds).toContain('shipment-uncertain');
    expect(result.affectedUnits).toBe(600);
    expect(result.shippedUnits).toBe(348);
    expect(result.onHandUnits).toBe(252);
    expect(result.paths['batch-uncertain']).toEqual(['lot-paprika-a', 'batch-uncertain']);
  });

  it('updates all descendants when an incomplete upstream record is resolved', () => {
    const initial = createDemoWorkspace();
    initial.batches.push(
      batch({
        id: 'descendant',
        code: 'DESCENDANT',
        producedOn: '2026-09-21',
        quantity: 12,
        inputs: [{ sourceId: 'batch-uncertain', quantity: 24 }],
      }),
    );
    initial.shipments.push(
      shipment({
        id: 'descendant-shipment',
        code: 'DSHP',
        batchId: 'descendant',
        quantity: 6,
        shippedOn: '2026-09-22',
      }),
    );
    expect(traceRecall(initial, 'lot-paprika-a').investigationBatchIds).toContain('descendant');
    const separate = traceRecall(applyCommand(initial, resolve(), NOW), 'lot-paprika-a');
    expect(separate.investigationBatchIds).toEqual([]);
    expect(separate.unconnectedBatchIds).toContain('descendant');
    const connected = traceRecall(applyCommand(initial, resolve('lot-paprika-a'), NOW), 'lot-paprika-a');
    expect(connected.affectedBatchIds).toContain('descendant');
    expect(connected.shipmentIds).toContain('descendant-shipment');
    expect(connected.paths.descendant).toEqual(['lot-paprika-a', 'batch-uncertain', 'descendant']);
  });

  it('leaves an earlier saved recall exactly as it was, including the uncertainty', () => {
    const saved = applyCommand(
      createDemoWorkspace(),
      {
        type: 'recall.create',
        payload: {
          id: 'before-review',
          sourceId: 'lot-paprika-a',
          title: 'Before review',
          reason: 'Record original uncertainty',
          mode: 'drill',
        },
      },
      NOW,
    );
    const frozen = structuredClone(saved.recalls[0]);
    const repaired = applyCommand(saved, resolve('lot-paprika-a'), '2026-09-22T10:00:00.000Z');
    expect(repaired.recalls[0]).toEqual(frozen);
    expect(repaired.recalls[0].result.affectedUnits).toBe(480);
    expect(repaired.recalls[0].result.investigationBatchIds).toEqual(['batch-uncertain']);
    expect(traceRecall(repaired, 'lot-paprika-a').affectedUnits).toBe(600);
  });

  it('cannot replace old inputs, revise an existing input quantity, or resolve an already-complete record', () => {
    const initial = createDemoWorkspace();
    const original = structuredClone(initial);
    failure(
      () => applyCommand(initial, { type: 'batch.resolve', payload: { ...resolve().payload, inputs: [] } }),
      'INVALID_RECORD',
    );
    failure(
      () =>
        applyCommand(initial, {
          type: 'batch.resolve',
          payload: { ...resolve().payload, additionalInputs: [{ sourceId: 'lot-tomato', quantity: 1 }] },
        }),
      'DUPLICATE_INPUT',
    );
    failure(
      () =>
        applyCommand(initial, {
          type: 'batch.resolve',
          payload: { ...resolve().payload, id: 'batch-separate' },
        }),
      'ALREADY_COMPLETE',
    );
    expect(initial).toEqual(original);
  });

  it('allows a documented completeness review with no additional inputs', () => {
    const initial = workspace({ batches: [batch({ recordsComplete: false })] });
    const repaired = applyCommand(
      initial,
      {
        type: 'batch.resolve',
        payload: {
          id: 'batch-a',
          additionalInputs: [],
          notes: 'All recorded ingredients verified against the original signed production sheet.',
          source: 'Original sheet 1, reviewed in full.',
        },
      },
      NOW,
    );
    expect(repaired.batches[0].inputs).toEqual(initial.batches[0].inputs);
    expect(repaired.batches[0].recordsComplete).toBe(true);
  });

  it('requires nonempty review notes and source, and still enforces stock and date validation', () => {
    failure(
      () =>
        applyCommand(createDemoWorkspace(), {
          type: 'batch.resolve',
          payload: { ...resolve().payload, notes: '   ' },
        }),
      'INVALID_RECORD',
    );
    failure(
      () =>
        applyCommand(createDemoWorkspace(), {
          type: 'batch.resolve',
          payload: { ...resolve().payload, source: '' },
        }),
      'INVALID_RECORD',
    );
    failure(
      () =>
        applyCommand(createDemoWorkspace(), {
          type: 'batch.resolve',
          payload: { ...resolve().payload, additionalInputs: [{ sourceId: 'lot-paprika-a', quantity: 8 }] },
        }),
      'STOCK_EXCEEDED',
    );
    const future = createDemoWorkspace();
    future.lots.push(lot({ id: 'future', code: 'FUTURE', receivedOn: '2026-09-22' }));
    failure(() => applyCommand(future, resolve('future')), 'INVALID_DATE_ORDER');
  });
});
