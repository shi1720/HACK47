import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { applyCommand, DomainError, MAX_ANCESTRY_DEPTH, stockBalances, traceRecall, validateWorkspace } from '../shared/domain';
import { createEmptyWorkspace } from '../shared/demo';
import type { Workspace } from '../shared/types';

/** Reproduce with: npx tsx scripts/benchmark.ts. No services, accounts or network required. */
function fixture(count: number, deep: boolean): Workspace {
  const workspace = createEmptyWorkspace('benchmark', 'Synthetic benchmark');
  workspace.lots.push({ id: 'source', code: 'SOURCE', name: 'Synthetic ingredient', supplier: 'Synthetic supplier', receivedOn: '2026-09-01', quantity: count, unit: 'kg', status: 'available', source: 'Synthetic benchmark fixture' });
  for (let index = 0; index < count; index++) {
    const intermediate = deep && index < count - 1;
    workspace.batches.push({ id: `batch-${index}`, code: `B-${index}`, name: 'Synthetic batch', producedOn: '2026-09-02', quantity: intermediate ? 1 : 100, unit: intermediate ? 'kg' : 'units', inputs: [{ sourceId: deep && index > 0 ? `batch-${index - 1}` : 'source', quantity: 1 }], recordsComplete: true, notes: '', source: 'Synthetic benchmark fixture' });
    if (!deep || index === count - 1) workspace.shipments.push({ id: `shipment-${index}`, code: `S-${index}`, batchId: `batch-${index}`, customer: `Customer ${index % 100}`, contact: 'synthetic@example.invalid', quantity: 40, shippedOn: '2026-09-03', source: 'Synthetic benchmark fixture' });
  }
  return workspace;
}
const round = (value: number) => Number(value.toFixed(2));
function summarize(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  return { medianMs: round((sorted[4] + sorted[5]) / 2), maxMs: round(sorted.at(-1)!), runsMs: times.map(round) };
}

const scenarios = [
  { name: 'wide-5000', count: 5000, deep: false },
  { name: 'deep-128-supported-limit', count: MAX_ANCESTRY_DEPTH, deep: true },
].map(({ name, count, deep }) => {
  const workspace = fixture(count, deep);
  const times: number[] = [];
  const balanceTimes: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  for (let run = 0; run < 10; run++) {
    const started = performance.now();
    const valid = validateWorkspace(workspace);
    const result = traceRecall(valid, 'source', '2026-09-22T00:00:00.000Z');
    times.push(performance.now() - started);
    if (result.affectedUnits !== (deep ? 100 : count * 100)) throw new Error('Incorrect affected-unit aggregate.');
    if (result.shippedUnits !== (deep ? 40 : count * 40)) throw new Error('Incorrect shipped-unit aggregate.');
    const balanceStarted = performance.now();
    const balances = stockBalances(workspace);
    balanceTimes.push(performance.now() - balanceStarted);
    if (balances[`batch-${count - 1}`] !== 60) throw new Error('Incorrect stock balance.');
  }
  const started = performance.now();
  const saved = applyCommand(workspace, { type: 'recall.create', payload: { id: 'benchmark-recall', title: 'Synthetic benchmark', reason: 'Performance exercise', sourceId: 'source', mode: 'drill' } }, '2026-09-22T00:00:00.000Z');
  const saveRecallMs = round(performance.now() - started);
  return {
    name, sourceLots: workspace.lots.length, batches: workspace.batches.length, shipments: workspace.shipments.length,
    ancestryDepth: deep ? count : 1, iterations: 10,
    validateAndTrace: summarize(times), allStockBalances: summarize(balanceTimes), saveRecallMs,
    originalJsonBytes: Buffer.byteLength(JSON.stringify(workspace)), savedJsonBytes: Buffer.byteLength(JSON.stringify(saved)),
    observedHeapDeltaMiB: round((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024),
    verifiedAffectedUnits: saved.recalls[0].result.affectedUnits, verifiedShippedUnits: saved.recalls[0].result.shippedUnits,
  };
});
const rejectedAt = performance.now();
let rejectedCode = '';
try { validateWorkspace(fixture(MAX_ANCESTRY_DEPTH + 1, true)); }
catch (error) { if (error instanceof DomainError) rejectedCode = error.code; else throw error; }
if (rejectedCode !== 'GRAPH_TOO_DEEP') throw new Error('The ancestry-depth guard did not reject an unsupported graph.');
const report = {
  measuredAt: new Date().toISOString(),
  scope: 'Local synthetic domain-engine benchmark. These are observed measurements, not deployment performance guarantees or browser-rendering benchmarks.',
  method: 'Ten sequential iterations per fixture in one process, without forced garbage collection. Each validation/trace iteration validates the workspace then calls traceRecall, which validates its record graph again. Stock balances validate and build once. Save timing includes snapshot creation and validation. Wide shape exercises the domain maximum of 5,000 batches; its 10,001 total records exceed the separate 5,000-record per-import limit.',
  memoryCaveat: 'Observed heap delta is the end-minus-start JavaScript heap measurement; garbage collection and prior scenarios affect it. It is not peak memory. Process maximum RSS includes Node, tooling and every scenario in this run.',
  environment: { node: process.version, platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model ?? 'unknown' },
  limits: { maxAncestryDepth: MAX_ANCESTRY_DEPTH, maxBatches: 5000, maxLots: 5000, maxShipments: 20000, maxImportRows: 5000 },
  scenarios,
  rejectedDepth129: { errorCode: rejectedCode, elapsedMs: round(performance.now() - rejectedAt) },
  processMaxRssMiB: round(process.resourceUsage().maxRSS / 1024),
};
const directory = join(process.cwd(), 'artifacts');
mkdirSync(directory, { recursive: true });
const target = join(directory, 'benchmark.json');
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`Saved measured results to ${target}`);
