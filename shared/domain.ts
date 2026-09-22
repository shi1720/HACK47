import { z } from 'zod';
import type { Batch, Command, Lot, TraceResult, Workspace } from './types';

/** An actionable validation error safe to show to a person entering a record. */
export class DomainError extends Error {
  readonly code: string;
  constructor(message: string, code = 'INVALID_RECORD') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

const id = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    'Use letters, numbers, periods, underscores, colons or hyphens for an ID.',
  );
const label = z.string().trim().min(1).max(200);
const code = z.string().trim().min(1).max(80);
const note = z.string().max(4000);
const evidence = z.string().trim().min(1, 'A source reference is required.').max(4000);
const unit = z.enum(['kg', 'g', 'l', 'ml', 'units']);
const quantity = z
  .number()
  .finite()
  .positive()
  .max(1_000_000_000)
  .refine((value) => Number(value.toFixed(3)) === value, 'Use at most three decimal places.');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter an actual calendar date.');
const timestamp = z.string().datetime({ offset: true });
const lotSchema = z
  .object({
    id,
    code,
    name: label,
    supplier: label,
    receivedOn: date,
    expiresOn: date.optional(),
    quantity,
    unit,
    status: z.enum(['available', 'hold']),
    source: evidence,
  })
  .strict();
const batchSchema = z
  .object({
    id,
    code,
    name: label,
    producedOn: date,
    quantity,
    unit,
    inputs: z.array(z.object({ sourceId: id, quantity }).strict()).max(1000),
    recordsComplete: z.boolean(),
    notes: note,
    source: evidence,
  })
  .strict();
const shipmentSchema = z
  .object({
    id,
    code,
    batchId: id,
    customer: label,
    contact: z.string().trim().max(300),
    quantity,
    shippedOn: date,
    source: evidence,
  })
  .strict();
const snapshotSchema = z
  .object({
    lots: z.array(lotSchema).max(5000),
    batches: z.array(batchSchema).max(5000),
    shipments: z.array(shipmentSchema).max(20000),
  })
  .strict();
const resultSchema = z
  .object({
    sourceId: id,
    affectedBatchIds: z.array(id),
    investigationBatchIds: z.array(id),
    unconnectedBatchIds: z.array(id),
    shipmentIds: z.array(id),
    investigationShipmentIds: z.array(id),
    paths: z.record(id, z.array(id)),
    affectedUnits: z.number().finite().nonnegative(),
    shippedUnits: z.number().finite().nonnegative(),
    onHandUnits: z.number().finite().nonnegative(),
    customerCount: z.number().int().nonnegative(),
    gaps: z.array(z.object({ batchId: id, message: note }).strict()),
    computedAt: timestamp,
  })
  .strict();
const recallSchema = z
  .object({
    id,
    title: label,
    reason: note,
    sourceId: id,
    createdAt: timestamp,
    status: z.enum(['open', 'closed']),
    mode: z.enum(['drill', 'incident']),
    result: resultSchema,
    snapshot: snapshotSchema,
  })
  .strict();
const workspaceSchema = snapshotSchema
  .extend({
    id,
    name: label,
    revision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    recalls: z.array(recallSchema).max(1000),
  })
  .strict();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lot.create'), payload: lotSchema }).strict(),
  z
    .object({
      type: z.literal('lot.status'),
      payload: z.object({ id, status: z.enum(['available', 'hold']) }).strict(),
    })
    .strict(),
  z.object({ type: z.literal('batch.create'), payload: batchSchema }).strict(),
  z
    .object({
      type: z.literal('batch.resolve'),
      payload: z
        .object({
          id,
          additionalInputs: z.array(z.object({ sourceId: id, quantity }).strict()).max(1000),
          notes: z.string().trim().min(1).max(4000),
          source: z.string().trim().min(1).max(4000),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('shipment.create'), payload: shipmentSchema }).strict(),
  z
    .object({
      type: z.literal('recall.create'),
      payload: z
        .object({ id, sourceId: id, title: label, reason: note, mode: z.enum(['drill', 'incident']) })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('recall.close'), payload: z.object({ id }).strict() }).strict(),
  z.object({ type: z.literal('workspace.rename'), payload: z.object({ name: label }).strict() }).strict(),
  z.object({ type: z.literal('workspace.import'), payload: snapshotSchema }).strict(),
]);

type Records = Pick<Workspace, 'lots' | 'batches' | 'shipments'>;
type Graph = {
  sources: Map<string, Lot | Batch>;
  children: Map<string, string[]>;
  used: Map<string, number>;
};
export const MAX_ANCESTRY_DEPTH = 128;
const milli = (value: number) => Math.round(value * 1000);
const canonical = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('en-US');

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new DomainError(`${field}${issue.message}`);
  }
  return result.data;
}

/** Quantities are integer thousandths internally; each input is in its source's unit. */
function buildGraph(records: Records): Graph {
  const sources = new Map<string, Lot | Batch>();
  const children = new Map<string, string[]>();
  const used = new Map<string, number>();
  const allIds = new Set<string>();
  const sourceCodes = new Set<string>();
  const shipmentCodes = new Set<string>();
  for (const source of [...records.lots, ...records.batches]) {
    if (allIds.has(source.id))
      throw new DomainError(
        `The record ID “${source.id}” is already in use. Import is additive; use a new ID.`,
        'DUPLICATE_ID',
      );
    if (sourceCodes.has(canonical(source.code)))
      throw new DomainError(`Lot or batch code “${source.code}” is already in use.`, 'DUPLICATE_CODE');
    allIds.add(source.id);
    sourceCodes.add(canonical(source.code));
    sources.set(source.id, source);
    children.set(source.id, []);
    used.set(source.id, 0);
    if ('receivedOn' in source && source.expiresOn && source.expiresOn < source.receivedOn)
      throw new DomainError(`Lot ${source.code}: expiry cannot be before receipt.`, 'INVALID_DATE_ORDER');
  }
  const indegree = new Map(records.batches.map((batch) => [batch.id, 0]));
  for (const batch of records.batches) {
    if (batch.recordsComplete && batch.inputs.length === 0)
      throw new DomainError(
        `Batch ${batch.code}: add at least one ingredient input, or mark the ingredient records incomplete.`,
        'MISSING_INPUTS',
      );
    const seen = new Set<string>();
    for (const input of batch.inputs) {
      const source = sources.get(input.sourceId);
      if (!source)
        throw new DomainError(
          `Batch ${batch.code}: input “${input.sourceId}” does not exist. Import its lot or batch first, or in the same import.`,
          'MISSING_SOURCE',
        );
      if (seen.has(input.sourceId))
        throw new DomainError(
          `Batch ${batch.code}: ${source.code} is listed twice. Combine its quantities into one input.`,
          'DUPLICATE_INPUT',
        );
      if (source.id === batch.id)
        throw new DomainError(`Batch ${batch.code} cannot consume itself.`, 'CYCLE');
      seen.add(input.sourceId);
      const sourceDate = 'receivedOn' in source ? source.receivedOn : source.producedOn;
      if (sourceDate > batch.producedOn)
        throw new DomainError(
          `Batch ${batch.code} was produced before input ${source.code} was available.`,
          'INVALID_DATE_ORDER',
        );
      children.get(source.id)!.push(batch.id);
      used.set(source.id, used.get(source.id)! + milli(input.quantity));
      if ('producedOn' in source) indegree.set(batch.id, indegree.get(batch.id)! + 1);
    }
  }
  // Kahn traversal avoids recursion limits on long chains and handles reverse-order imports.
  const queue = records.batches.filter((batch) => indegree.get(batch.id) === 0).map((batch) => batch.id);
  const depths = new Map(records.batches.map((batch) => [batch.id, 1]));
  for (let index = 0; index < queue.length; index++) {
    const depth = depths.get(queue[index])!;
    if (depth > MAX_ANCESTRY_DEPTH)
      throw new DomainError(
        `Batch ${sources.get(queue[index])!.code} exceeds the limit of ${MAX_ANCESTRY_DEPTH} production steps in one ancestry chain. Review its input links for accidental chaining.`,
        'GRAPH_TOO_DEEP',
      );
    for (const child of children.get(queue[index]) ?? []) {
      depths.set(child, Math.max(depths.get(child)!, depth + 1));
      const remaining = indegree.get(child)! - 1;
      indegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  if (queue.length !== records.batches.length) {
    const cyclic = records.batches.find((batch) => indegree.get(batch.id)! > 0)!;
    throw new DomainError(
      `Batch ${cyclic.code} belongs to a circular production chain. Inputs must only point to earlier production.`,
      'CYCLE',
    );
  }
  for (const shipment of records.shipments) {
    if (allIds.has(shipment.id))
      throw new DomainError(`The record ID “${shipment.id}” is already in use.`, 'DUPLICATE_ID');
    if (shipmentCodes.has(canonical(shipment.code)))
      throw new DomainError(`Shipment code “${shipment.code}” is already in use.`, 'DUPLICATE_CODE');
    allIds.add(shipment.id);
    shipmentCodes.add(canonical(shipment.code));
    const batch = sources.get(shipment.batchId);
    if (!batch || !('producedOn' in batch))
      throw new DomainError(
        `Shipment ${shipment.code}: select an existing production batch; ingredient lots cannot be shipped.`,
        'MISSING_BATCH',
      );
    if (shipment.shippedOn < batch.producedOn)
      throw new DomainError(
        `Shipment ${shipment.code} was shipped before batch ${batch.code} was produced.`,
        'INVALID_DATE_ORDER',
      );
    used.set(batch.id, used.get(batch.id)! + milli(shipment.quantity));
  }
  for (const [sourceId, consumed] of used) {
    const source = sources.get(sourceId)!;
    if (consumed > milli(source.quantity))
      throw new DomainError(
        `${source.code}: ${consumed / 1000} ${source.unit} is allocated, but only ${source.quantity} ${source.unit} was recorded. Reduce inputs or shipments.`,
        'STOCK_EXCEEDED',
      );
  }
  return { sources, children, used };
}

function iso(now: string | Date = new Date()): string {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime()))
    throw new DomainError('The operation timestamp is invalid.', 'INVALID_TIMESTAMP');
  return value.toISOString();
}

function computeTrace(records: Records, sourceId: string, computedAt: string, graph: Graph): TraceResult {
  const source = graph.sources.get(sourceId);
  if (!source)
    throw new DomainError(
      'Select an existing ingredient lot or production batch to trace.',
      'MISSING_SOURCE',
    );
  const affected = new Set<string>();
  const paths: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
  paths[sourceId] = [sourceId];
  if ('producedOn' in source) affected.add(sourceId);
  const queue = [sourceId];
  for (let index = 0; index < queue.length; index++) {
    for (const child of graph.children.get(queue[index]) ?? []) {
      if (affected.has(child)) continue;
      affected.add(child);
      paths[child] = [...paths[queue[index]], child];
      queue.push(child);
    }
  }
  const investigation = new Set<string>();
  const uncertainQueue: string[] = [];
  for (const batch of records.batches) {
    if (!batch.recordsComplete && !affected.has(batch.id)) {
      investigation.add(batch.id);
      paths[batch.id] = [batch.id];
      uncertainQueue.push(batch.id);
    }
  }
  for (let index = 0; index < uncertainQueue.length; index++) {
    for (const child of graph.children.get(uncertainQueue[index]) ?? []) {
      if (affected.has(child) || investigation.has(child)) continue;
      investigation.add(child);
      paths[child] = [...paths[uncertainQueue[index]], child];
      uncertainQueue.push(child);
    }
  }
  const affectedShipments = records.shipments.filter((shipment) => affected.has(shipment.batchId));
  const shipped = affectedShipments.reduce(
    (total, shipment) =>
      total + (graph.sources.get(shipment.batchId)!.unit === 'units' ? milli(shipment.quantity) : 0),
    0,
  );
  const onHand = records.batches
    .filter((batch) => affected.has(batch.id) && batch.unit === 'units')
    .reduce((total, batch) => total + milli(batch.quantity) - graph.used.get(batch.id)!, 0);
  return {
    sourceId,
    affectedBatchIds: records.batches.filter((batch) => affected.has(batch.id)).map((batch) => batch.id),
    investigationBatchIds: records.batches
      .filter((batch) => investigation.has(batch.id))
      .map((batch) => batch.id),
    unconnectedBatchIds: records.batches
      .filter((batch) => !affected.has(batch.id) && !investigation.has(batch.id))
      .map((batch) => batch.id),
    shipmentIds: affectedShipments.map((shipment) => shipment.id),
    investigationShipmentIds: records.shipments
      .filter((shipment) => investigation.has(shipment.batchId))
      .map((shipment) => shipment.id),
    paths,
    affectedUnits: (onHand + shipped) / 1000,
    shippedUnits: shipped / 1000,
    onHandUnits: onHand / 1000,
    customerCount: new Set(affectedShipments.map((shipment) => canonical(shipment.customer))).size,
    gaps: records.batches
      .filter((batch) => !batch.recordsComplete)
      .map((batch) => ({
        batchId: batch.id,
        message: affected.has(batch.id)
          ? 'A recorded connection exists, and this batch also has incomplete ingredient records. Review any missing inputs.'
          : 'Ingredient records are incomplete. A connection to the selected source cannot be ruled out; investigate this batch and its descendants.',
      })),
    computedAt,
  };
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJSON(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Validate the entire graph. Returns a clone; it never repairs, overwrites or mutates records. */
export function validateWorkspace(input: unknown): Workspace {
  const workspace = parse(workspaceSchema, input);
  buildGraph(workspace);
  const ids = new Set(
    [...workspace.lots, ...workspace.batches, ...workspace.shipments].map((record) => record.id),
  );
  for (const recall of workspace.recalls) {
    if (ids.has(recall.id))
      throw new DomainError(`The record ID “${recall.id}” is already in use.`, 'DUPLICATE_ID');
    ids.add(recall.id);
    const snapshotGraph = buildGraph(recall.snapshot);
    const result = computeTrace(recall.snapshot, recall.sourceId, recall.createdAt, snapshotGraph);
    if (stableJSON(result) !== stableJSON(recall.result))
      throw new DomainError(
        `Saved rehearsal “${recall.title}” does not match its recorded snapshot.`,
        'INVALID_SNAPSHOT',
      );
  }
  return workspace;
}

/** Compute all source balances with one validation and one graph construction. */
export function stockBalances(workspace: Workspace): Record<string, number> {
  const records = parse(snapshotSchema, {
    lots: workspace.lots,
    batches: workspace.batches,
    shipments: workspace.shipments,
  });
  const graph = buildGraph(records);
  const balances = Object.create(null) as Record<string, number>;
  for (const [id, source] of graph.sources)
    balances[id] = (milli(source.quantity) - graph.used.get(id)!) / 1000;
  return balances;
}

export function stockRemaining(workspace: Workspace, sourceId: string): number {
  const balances = stockBalances(workspace);
  if (!Object.prototype.hasOwnProperty.call(balances, sourceId))
    throw new DomainError('This ingredient lot or batch does not exist.', 'MISSING_SOURCE');
  return balances[sourceId];
}

export function traceRecall(workspace: Workspace, sourceId: string, now?: string | Date): TraceResult {
  const records = parse(snapshotSchema, {
    lots: workspace.lots,
    batches: workspace.batches,
    shipments: workspace.shipments,
  });
  return computeTrace(records, sourceId, iso(now), buildGraph(records));
}

/** Pure transaction: either the complete command is accepted, or the caller's state is untouched. */
export function applyCommand(workspace: Workspace, input: Command | unknown, now?: string | Date): Workspace {
  const next = validateWorkspace(workspace);
  const command = parse(commandSchema, input);
  switch (command.type) {
    case 'lot.create':
      next.lots.push(command.payload);
      break;
    case 'lot.status': {
      const lot = next.lots.find((item) => item.id === command.payload.id);
      if (!lot) throw new DomainError('The ingredient lot could not be found.', 'MISSING_SOURCE');
      lot.status = command.payload.status;
      break;
    }
    case 'batch.create':
      next.batches.push(command.payload);
      break;
    case 'batch.resolve': {
      const batch = next.batches.find((item) => item.id === command.payload.id);
      if (!batch) throw new DomainError('The production batch could not be found.', 'MISSING_BATCH');
      if (batch.recordsComplete)
        throw new DomainError(
          `Batch ${batch.code} already has complete ingredient records. A record review cannot replace or modify its inputs.`,
          'ALREADY_COMPLETE',
        );
      const reviewedAt = iso(now);
      const notes = `${batch.notes}${batch.notes ? '\n\n' : ''}Record review (${reviewedAt}): ${command.payload.notes}`;
      const source = `${batch.source}${batch.source ? '\n\n' : ''}Record review (${reviewedAt}): ${command.payload.source}`;
      if (notes.length > 4000 || source.length > 4000)
        throw new DomainError(
          `Batch ${batch.code}: combined original and review evidence exceeds 4,000 characters. Use a shorter review and cite the supporting document.`,
          'REVIEW_TOO_LONG',
        );
      // This corrects historical evidence. A currently held source must remain
      // recordable here; hiding its earlier use would make the trace incomplete.
      batch.inputs.push(...command.payload.additionalInputs);
      batch.recordsComplete = true;
      batch.notes = notes;
      batch.source = source;
      break;
    }
    case 'shipment.create':
      next.shipments.push(command.payload);
      break;
    case 'workspace.import':
      next.lots.push(...command.payload.lots);
      next.batches.push(...command.payload.batches);
      next.shipments.push(...command.payload.shipments);
      break;
    case 'workspace.rename':
      next.name = command.payload.name;
      break;
    case 'recall.create': {
      const createdAt = iso(now);
      const snapshot = structuredClone({ lots: next.lots, batches: next.batches, shipments: next.shipments });
      next.recalls.push({
        ...command.payload,
        createdAt,
        status: 'open',
        snapshot,
        result: computeTrace(snapshot, command.payload.sourceId, createdAt, buildGraph(snapshot)),
      });
      break;
    }
    case 'recall.close': {
      const recall = next.recalls.find((item) => item.id === command.payload.id);
      if (!recall)
        throw new DomainError('The saved rehearsal or incident could not be found.', 'MISSING_RECALL');
      if (recall.status === 'closed')
        throw new DomainError('This rehearsal or incident is already closed.', 'ALREADY_CLOSED');
      recall.status = 'closed';
      break;
    }
  }
  next.revision++;
  return validateWorkspace(next);
}
