import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { applyCommand, DomainError, traceRecall } from '../shared/domain';
import { createDemoWorkspace, createEmptyWorkspace } from '../shared/demo';
import { parseImport } from '../shared/import';
import type { Lot } from '../shared/types';

const empty = () => createEmptyWorkspace('import-test', 'Import kitchen');
const sampleFile = (name: string) => ({
  name,
  text: readFileSync(new URL(`../public/samples/${name}`, import.meta.url), 'utf8'),
});
const baseLot: Lot = {
  id: 'lot-a',
  code: 'PAP-2409',
  name: 'Smoked paprika',
  supplier: 'Spice supplier',
  receivedOn: '2026-09-16',
  quantity: 10,
  unit: 'kg',
  status: 'available',
  source: 'Delivery note 1',
};
const lotCSV = (overrides: Record<string, unknown> = {}) => ({
  name: 'lots.csv',
  text: Papa.unparse([{ ...baseLot, ...overrides }]),
});
const batchCSV = (overrides: Record<string, unknown> = {}) => ({
  name: 'batches.csv',
  text: Papa.unparse([
    {
      code: 'SAUCE-01',
      name: 'Smoky sauce',
      producedOn: '2026-09-17',
      quantity: 100,
      unit: 'units',
      inputs: 'PAP-2409:2',
      recordsComplete: true,
      source: 'Production sheet 1',
      ...overrides,
    },
  ]),
});
const shipmentCSV = (overrides: Record<string, unknown> = {}) => ({
  name: 'shipments.csv',
  text: Papa.unparse([
    {
      code: 'DISPATCH-01',
      batchId: 'SAUCE-01',
      customer: 'Corner shop',
      quantity: 50,
      shippedOn: '2026-09-18',
      source: 'Dispatch note 1',
      ...overrides,
    },
  ]),
});

describe('atomic file import', () => {
  it('imports the actual three sample CSV files in reverse order and reproduces the demo result', () => {
    const existing = empty();
    const result = parseImport(['shipments.csv', 'batches.csv', 'lots.csv'].map(sampleFile), existing);
    expect(result.warnings).toEqual([]);
    const imported = applyCommand(existing, { type: 'workspace.import', payload: result.payload });
    const trace = traceRecall(imported, 'lot-paprika-a');
    expect(trace.affectedUnits).toBe(480);
    expect(trace.shippedUnits).toBe(300);
    expect(trace.onHandUnits).toBe(180);
    expect(trace.customerCount).toBe(3);
    expect(existing.lots).toHaveLength(0);
    expect(existing.revision).toBe(0);
  });

  it('accepts the actual atomic JSON bundle with the same graph', () => {
    const imported = parseImport([sampleFile('workspace.json')], empty());
    expect(imported.payload.batches).toHaveLength(6);
    expect(imported.payload.shipments).toHaveLength(4);
    expect(imported.warnings).toHaveLength(0);
  });

  it('imports the readable sample set using only record codes and friendly inputs', () => {
    const result = parseImport(
      ['friendly-shipments.csv', 'friendly-batches.csv', 'friendly-lots.csv'].map(sampleFile),
      empty(),
    );
    const imported = applyCommand(empty(), { type: 'workspace.import', payload: result.payload });
    expect(traceRecall(imported, 'PAP-2409').affectedUnits).toBe(480);
    expect(result.warnings).toEqual([]);
  });

  it('supports friendly code-based inputs and defaults missing IDs to codes', () => {
    const result = parseImport([shipmentCSV(), batchCSV(), lotCSV()], empty());
    expect(result.payload.batches[0].id).toBe('SAUCE-01');
    expect(result.payload.batches[0].inputs).toEqual([{ sourceId: 'lot-a', quantity: 2 }]);
    expect(result.payload.shipments[0].id).toBe('DISPATCH-01');
    expect(result.payload.shipments[0].batchId).toBe('SAUCE-01');
    expect(result.payload.batches[0].notes).toBe('');
    expect(result.payload.shipments[0].contact).toBe('');
  });

  it('resolves input codes from both existing and newly imported records', () => {
    const existing = applyCommand(empty(), { type: 'lot.create', payload: baseLot });
    const result = parseImport(
      [
        batchCSV({ inputs: 'pap-2409:1.125; TOM-01:2.5' }),
        lotCSV({ id: 'lot-t', code: 'TOM-01', name: 'Tomato' }),
      ],
      existing,
    );
    expect(result.payload.batches[0].inputs).toEqual([
      { sourceId: 'lot-a', quantity: 1.125 },
      { sourceId: 'lot-t', quantity: 2.5 },
    ]);
  });

  it('resolves JSON sourceCode and code values in sourceId fields', () => {
    const result = parseImport(
      [batchCSV({ inputs: JSON.stringify([{ sourceCode: 'PAP-2409', quantity: 1.5 }]) }), lotCSV()],
      empty(),
    );
    expect(result.payload.batches[0].inputs).toEqual([{ sourceId: 'lot-a', quantity: 1.5 }]);
    const second = parseImport(
      [batchCSV({ inputs: JSON.stringify([{ sourceId: 'PAP-2409', quantity: 1 }]) }), lotCSV()],
      empty(),
    );
    expect(second.payload.batches[0].inputs[0].sourceId).toBe('lot-a');
  });

  it('normalizes useful header aliases and detects records from headers despite arbitrary filenames', () => {
    const file = {
      name: 'September delivery.csv',
      text: Papa.unparse([
        {
          'Lot ID': 'lot-a',
          'Lot Code': 'PAP-2409',
          'Ingredient Name': 'Paprika',
          'Supplier Name': 'Supplier',
          'Received Date': '2026-09-16',
          Qty: '10',
          UOM: 'KG',
          'Source Reference': 'Delivery sheet 1',
        },
      ]),
    };
    const result = parseImport([file], empty());
    expect(result.payload.lots[0]).toEqual({
      ...baseLot,
      name: 'Paprika',
      supplier: 'Supplier',
      source: 'Delivery sheet 1',
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns about unknown columns and JSON fields instead of silently discarding them', () => {
    const result = parseImport([lotCSV({ internalRating: 'excellent' })], empty());
    expect(result.warnings[0]).toContain('internalRating');
    expect(result.warnings[0]).toContain('not imported');
    expect(result.payload.lots[0]).not.toHaveProperty('internalRating');
    const json = parseImport(
      [{ name: 'data.json', text: JSON.stringify({ lots: [{ ...baseLot, internalRating: 'excellent' }] }) }],
      empty(),
    );
    expect(json.warnings[0]).toContain('lots row 1');
  });

  it('excludes all workspace identity, auth and saved result metadata from JSON exports', () => {
    const demo = createDemoWorkspace();
    const full = applyCommand(demo, {
      type: 'recall.create',
      payload: { id: 'saved', sourceId: 'lot-paprika-a', title: 'Saved exercise', reason: '', mode: 'drill' },
    });
    const result = parseImport(
      [
        {
          name: 'export.json',
          text: JSON.stringify({ ...full, csrfToken: 'do-not-import', user: { id: 'other-account' } }),
        },
      ],
      empty(),
    );
    expect(Object.keys(result.payload).sort()).toEqual(['batches', 'lots', 'shipments']);
    expect(result.warnings[0]).toContain('recalls');
    expect(result.warnings[0]).toContain('csrfToken');
    expect(result.warnings.join(' ')).not.toContain('do-not-import');
    expect(result.payload).not.toHaveProperty('id');
  });
});

describe('invalid data remains atomic with actionable locations', () => {
  it.each(['12kg', 'NaN', 'Infinity', '1e3', '1,000', '=1+2', '', '0', '-2', '1.1234', '0x10', '1 000'])(
    'rejects malformed numeric input %s',
    (quantity) => {
      expect(() => parseImport([lotCSV({ quantity })], empty())).toThrow(/lots\.csv, row 2:.*quantity/);
    },
  );

  it('rejects JSON strings masquerading as booleans or numbers', () => {
    expect(() => parseImport([batchCSV({ recordsComplete: 'yes' }), lotCSV()], empty())).toThrow(
      /batches\.csv, row 2:.*true or false/,
    );
    expect(() => parseImport([batchCSV({ recordsComplete: 1 }), lotCSV()], empty())).toThrow(/true or false/);
    expect(() =>
      parseImport(
        [{ name: 'data.json', text: JSON.stringify({ lots: [{ ...baseLot, quantity: null }] }) }],
        empty(),
      ),
    ).toThrow(/data\.json, lots row 1:.*quantity/);
  });

  it('requires evidence source references for every record kind', () => {
    expect(() => parseImport([lotCSV({ source: '' })], empty())).toThrow(
      /lots\.csv, row 2:.*source.*required/,
    );
    expect(() => parseImport([lotCSV(), batchCSV({ source: '  ' })], empty())).toThrow(
      /batches\.csv, row 2:.*source.*required/,
    );
    expect(() => parseImport([lotCSV(), batchCSV(), shipmentCSV({ source: '' })], empty())).toThrow(
      /shipments\.csv, row 2:.*source.*required/,
    );
  });

  it('rejects duplicate or aliased duplicate headers before reading records', () => {
    expect(() => parseImport([{ name: 'lots.csv', text: 'code,code\nA,B' }], empty())).toThrow(
      /lots\.csv, row 1: Duplicate header/,
    );
    expect(() => parseImport([{ name: 'lots.csv', text: 'qty,quantity\n1,2' }], empty())).toThrow(
      /Duplicate header/,
    );
  });

  it('rejects duplicate existing IDs/codes and leaves existing state untouched', () => {
    const existing = applyCommand(empty(), { type: 'lot.create', payload: baseLot });
    const before = structuredClone(existing);
    expect(() => parseImport([lotCSV()], existing)).toThrow(/lots\.csv, row 2: ID.*already exists/);
    expect(() => parseImport([lotCSV({ id: 'new-id', code: 'pap-2409' })], existing)).toThrow(
      /already exists/,
    );
    expect(existing).toEqual(before);
  });

  it('rejects missing source references and shipping an ingredient lot with row context', () => {
    expect(() => parseImport([batchCSV()], empty())).toThrow(/batches\.csv, row 2: Source.*does not exist/);
    expect(() => parseImport([lotCSV(), shipmentCSV({ batchId: 'PAP-2409' })], empty())).toThrow(
      /shipments\.csv, row 2:.*ingredient lot/,
    );
  });

  it('enforces the same domain graph rules before returning any proposed import', () => {
    expect(() => parseImport([lotCSV(), batchCSV({ inputs: 'PAP-2409:11' })], empty())).toThrow(
      /lots\.csv, row 2:.*allocated/,
    );
    expect(() => parseImport([lotCSV(), batchCSV({ producedOn: '2026-09-15' })], empty())).toThrow(
      /batches\.csv, row 2:.*before input/,
    );
    expect(() => parseImport([lotCSV(), batchCSV({ inputs: 'PAP-2409:1; PAP-2409:1' })], empty())).toThrow(
      /batches\.csv, row 2:.*listed twice/,
    );
    expect(() => parseImport([lotCSV({ receivedOn: '2026-02-29' })], empty())).toThrow(
      /lots\.csv, row 2: receivedOn/,
    );
  });

  it('reports physical CSV rows correctly after blank lines and quoted multiline cells', () => {
    const csv = Papa.unparse([
      { ...baseLot, source: 'First line\nSecond line' },
      { ...baseLot, id: 'next-lot', code: 'NEXT', quantity: 'not-a-number' },
    ]);
    expect(() => parseImport([{ name: 'lots.csv', text: '\n' + csv }], empty())).toThrow(
      /lots\.csv, row 5:.*quantity/,
    );
  });

  it('rejects malformed CSV quotes, ragged rows, malformed JSON and unknown file types', () => {
    expect(() => parseImport([{ name: 'lots.csv', text: 'code,name\nA,"missing close' }], empty())).toThrow(
      /Malformed CSV/,
    );
    expect(() => parseImport([{ name: 'lots.csv', text: 'code,name\nA,B,C' }], empty())).toThrow(
      /row 2: Expected 2 columns/,
    );
    expect(() => parseImport([{ name: 'data.json', text: '{lots: []}' }], empty())).toThrow(
      /data\.json, row 1: Invalid JSON/,
    );
    expect(() => parseImport([{ name: 'data.xlsx', text: 'binary' }], empty())).toThrow(
      /Unsupported file type/,
    );
  });

  it('rejects malformed input structures and unit overrides rather than dropping values', () => {
    expect(() => parseImport([lotCSV(), batchCSV({ inputs: '[broken]' })], empty())).toThrow(/invalid JSON/);
    expect(() => parseImport([lotCSV(), batchCSV({ inputs: 'PAP-2409' })], empty())).toThrow(
      /Input 1 must look/,
    );
    expect(() =>
      parseImport(
        [lotCSV(), batchCSV({ inputs: '[{"sourceId":"lot-a","quantity":1,"unit":"g"}]' })],
        empty(),
      ),
    ).toThrow(/unit override/);
  });

  it('enforces aggregate byte and row limits', () => {
    expect(() => parseImport([{ name: 'large.csv', text: 'é'.repeat(3 * 1024 * 1024) }], empty())).toThrow(
      /5 MB/,
    );
    const lots = Array.from({ length: 5001 }, (_, index) => ({
      ...baseLot,
      id: `lot-${index}`,
      code: `LOT-${index}`,
    }));
    expect(() => parseImport([{ name: 'large.json', text: JSON.stringify({ lots }) }], empty())).toThrow(
      /lots row 5001:.*5,000 records/,
    );
  });

  it('does not interpret spreadsheet formula-like text as executable input', () => {
    const formula = '=HYPERLINK("https://example.test","Supplier")';
    const result = parseImport([lotCSV({ name: formula, source: '+CMD|anything' })], empty());
    expect(result.payload.lots[0].name).toBe(formula);
    expect(result.payload.lots[0].source).toBe('+CMD|anything');
  });

  it('allows explicitly incomplete batches with no mappings, but not falsely complete batches', () => {
    const result = parseImport([batchCSV({ recordsComplete: false, inputs: '' })], empty());
    expect(result.payload.batches[0].inputs).toEqual([]);
    expect(result.payload.batches[0].recordsComplete).toBe(false);
    expect(() => parseImport([batchCSV({ recordsComplete: true, inputs: '' })], empty())).toThrow(
      /mark the ingredient records incomplete/,
    );
  });

  it('throws DomainError for an empty import', () => {
    expect(() => parseImport([], empty())).toThrow(DomainError);
    expect(() => parseImport([{ name: 'nothing.json', text: '{"lots":[]}' }], empty())).toThrow(
      /No lot, batch or shipment records/,
    );
  });
});
