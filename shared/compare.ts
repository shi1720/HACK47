import { DomainError } from './domain';
import type { Batch, BatchInput, Recall, TraceResult, Unit, Workspace } from './types';

export type EvidenceClassification = 'connected' | 'investigate' | 'unconnected';
export interface EvidenceVersion {
  classification: EvidenceClassification;
  quantity: number;
  unit: Unit;
  code: string;
  name: string;
  producedOn: string;
  recordsComplete: boolean;
  inputs: BatchInput[];
  source: string;
  notes: string;
}
export interface EvidenceChange {
  id: string;
  code: string;
  name: string;
  kind: 'added' | 'updated';
  before: EvidenceVersion | null;
  after: EvidenceVersion;
  classificationChanged: boolean;
  evidenceChanged: boolean;
  changedFields: Array<Exclude<keyof Batch, 'id'>>;
  sourceReview: string;
  notesReview: string;
}
export interface EvidenceComparison {
  sourceId: string;
  snapshotId: string;
  snapshotCreatedAt: string;
  currentRevision: number;
  changedRecords: EvidenceChange[];
  unchangedCount: number;
  addedCount: number;
  classificationChangedCount: number;
  evidenceOnlyChangedCount: number;
}

/** Latest by record timestamp, with append order breaking equal-timestamp ties. */
export function latestRecallForSource(workspace: Workspace, sourceId: string): Recall | undefined {
  return workspace.recalls.reduce<Recall | undefined>((latest, recall) => {
    if (recall.sourceId !== sourceId) return latest;
    return !latest || Date.parse(recall.createdAt) >= Date.parse(latest.createdAt) ? recall : latest;
  }, undefined);
}

function classifications(result: TraceResult, batches: Batch[]): Map<string, EvidenceClassification> {
  const known = new Set(batches.map((batch) => batch.id));
  const map = new Map<string, EvidenceClassification>();
  const groups: Array<[EvidenceClassification, string[]]> = [
    ['connected', result.affectedBatchIds],
    ['investigate', result.investigationBatchIds],
    ['unconnected', result.unconnectedBatchIds],
  ];
  for (const [state, ids] of groups) {
    for (const id of ids) {
      if (!known.has(id) || map.has(id))
        throw new DomainError(
          'The comparison contains an unknown or multiply classified batch. Recompute the trace before comparing evidence.',
          'INVALID_COMPARISON',
        );
      map.set(id, state);
    }
  }
  if (map.size !== known.size)
    throw new DomainError(
      'Some batch classifications are missing. Recompute the complete trace before comparing evidence.',
      'INVALID_COMPARISON',
    );
  return map;
}

function version(batch: Batch, classification: EvidenceClassification): EvidenceVersion {
  return {
    classification,
    quantity: batch.quantity,
    unit: batch.unit,
    code: batch.code,
    name: batch.name,
    producedOn: batch.producedOn,
    recordsComplete: batch.recordsComplete,
    inputs: batch.inputs.map((input) => ({ ...input })),
    source: batch.source,
    notes: batch.notes,
  };
}

const fields: Array<Exclude<keyof Batch, 'id'>> = [
  'code',
  'name',
  'producedOn',
  'quantity',
  'unit',
  'inputs',
  'recordsComplete',
  'source',
  'notes',
];
function inputKey(inputs: BatchInput[]): string {
  return JSON.stringify(
    inputs
      .map((input) => [input.sourceId, input.quantity])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}
function addedText(before: string, after: string): string {
  if (before === after) return '';
  return after.startsWith(before) ? after.slice(before.length).trim() : after;
}

/** Compare batch records only. No quantities with different physical units are summed. */
export function compareRecallEvidence(
  saved: Recall,
  workspace: Workspace,
  result: TraceResult,
): EvidenceComparison {
  if (saved.sourceId !== result.sourceId || saved.result.sourceId !== saved.sourceId) {
    throw new DomainError(
      'Choose a saved rehearsal for the same ingredient or batch. Different sources cannot be compared.',
      'SOURCE_MISMATCH',
    );
  }
  const beforeStates = classifications(saved.result, saved.snapshot.batches);
  const afterStates = classifications(result, workspace.batches);
  const previous = new Map(saved.snapshot.batches.map((batch) => [batch.id, batch]));
  const liveIds = new Set(workspace.batches.map((batch) => batch.id));
  if (saved.snapshot.batches.some((batch) => !liveIds.has(batch.id))) {
    throw new DomainError(
      'A batch in the saved snapshot is missing from the current workspace. Load the complete workspace before comparing evidence.',
      'INCOMPLETE_COMPARISON',
    );
  }
  const changedRecords: EvidenceChange[] = [];
  let unchangedCount = 0;
  for (const batch of workspace.batches) {
    const earlier = previous.get(batch.id);
    const after = version(batch, afterStates.get(batch.id)!);
    if (!earlier) {
      changedRecords.push({
        id: batch.id,
        code: batch.code,
        name: batch.name,
        kind: 'added',
        before: null,
        after,
        classificationChanged: false,
        evidenceChanged: true,
        changedFields: [],
        sourceReview: batch.source,
        notesReview: batch.notes,
      });
      continue;
    }
    const before = version(earlier, beforeStates.get(batch.id)!);
    const classificationChanged = before.classification !== after.classification;
    const changedFields = fields.filter((field) =>
      field === 'inputs'
        ? inputKey(earlier.inputs) !== inputKey(batch.inputs)
        : earlier[field] !== batch[field],
    );
    const evidenceChanged = changedFields.length > 0;
    if (!classificationChanged && !evidenceChanged) {
      unchangedCount++;
      continue;
    }
    changedRecords.push({
      id: batch.id,
      code: batch.code,
      name: batch.name,
      kind: 'updated',
      before,
      after,
      classificationChanged,
      evidenceChanged,
      changedFields,
      sourceReview: addedText(earlier.source, batch.source),
      notesReview: addedText(earlier.notes, batch.notes),
    });
  }
  return {
    sourceId: result.sourceId,
    snapshotId: saved.id,
    snapshotCreatedAt: saved.createdAt,
    currentRevision: workspace.revision,
    changedRecords,
    unchangedCount,
    addedCount: changedRecords.filter((record) => record.kind === 'added').length,
    classificationChangedCount: changedRecords.filter((record) => record.classificationChanged).length,
    evidenceOnlyChangedCount: changedRecords.filter(
      (record) => record.kind === 'updated' && record.evidenceChanged && !record.classificationChanged,
    ).length,
  };
}
