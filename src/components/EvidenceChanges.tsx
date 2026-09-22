import { useMemo } from 'react';
import { ArrowUpRight, FileClock, Info } from 'lucide-react';
import {
  compareRecallEvidence,
  latestRecallForSource,
  type EvidenceClassification,
  type EvidenceVersion,
} from '../../shared/compare';
import type { TraceResult, Workspace } from '../../shared/types';
import { number } from '../lib/api';
import { Badge, Empty, ErrorBox } from './ui';

const labels: Record<EvidenceClassification, string> = {
  connected: 'Recorded connection',
  investigate: 'Needs investigation',
  unconnected: 'No recorded connection',
};
const tones = { connected: 'red', investigate: 'orange', unconnected: 'neutral' } as const;
function State({ value }: { value: EvidenceVersion }) {
  return (
    <div className="change-state">
      <Badge tone={tones[value.classification]}>{labels[value.classification]}</Badge>
      <small className="source-ref">
        {number(value.quantity)} {value.unit} produced
      </small>
    </div>
  );
}

export interface EvidenceChangesProps {
  workspace: Workspace;
  sourceId: string;
  result: TraceResult;
  onInspect: (id: string) => void;
}

export function EvidenceChanges({ workspace, sourceId, result, onInspect }: EvidenceChangesProps) {
  const view = useMemo(() => {
    const saved = latestRecallForSource(workspace, sourceId);
    if (!saved) return { saved: undefined, comparison: undefined, error: '' };
    try {
      if (result.sourceId !== sourceId)
        throw new Error('Recompute the selected source before comparing evidence.');
      return { saved, comparison: compareRecallEvidence(saved, workspace, result), error: '' };
    } catch (error) {
      return {
        saved,
        comparison: undefined,
        error: error instanceof Error ? error.message : 'The evidence comparison could not be computed.',
      };
    }
  }, [workspace, sourceId, result]);

  if (!view.saved)
    return (
      <section className="evidence-changes">
        <Empty
          icon={<FileClock size={30} />}
          title="Save a rehearsal to compare future evidence."
          description="Your next evidence review can then show what changed for this source, while preserving the original report."
        />
      </section>
    );
  if (!view.comparison)
    return (
      <section className="evidence-changes">
        <ErrorBox>{view.error}</ErrorBox>
      </section>
    );
  const comparison = view.comparison;
  const savedAt = new Date(view.saved.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <section className="evidence-changes" aria-label="Evidence changes since the last snapshot">
      <div className="panel-head">
        <div>
          <div className="eyebrow">EVIDENCE OVER TIME</div>
          <h2>New evidence. Original history.</h2>
          <p>
            Compared with “{view.saved.title}” · <time dateTime={view.saved.createdAt}>{savedAt}</time> ·
            Current revision {comparison.currentRevision}
          </p>
        </div>
        <FileClock size={25} aria-hidden="true" />
      </div>
      <div className="change-summary" role="status">
        <span>
          <strong>{comparison.classificationChangedCount}</strong>{' '}
          {comparison.classificationChangedCount === 1
            ? 'batch changed classification'
            : 'batches changed classification'}
        </span>
        <span>
          <strong>{comparison.evidenceOnlyChangedCount}</strong>{' '}
          {comparison.evidenceOnlyChangedCount === 1 ? 'evidence-only update' : 'evidence-only updates'}
        </span>
        <span>
          <strong>{comparison.addedCount}</strong> added after snapshot
        </span>
        <span>
          <strong>{comparison.unchangedCount}</strong> unchanged
        </span>
      </div>
      {comparison.changedRecords.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Batch classifications and production evidence before and after the selected source's latest
              saved snapshot.
            </caption>
            <thead>
              <tr>
                <th scope="col">Batch / product</th>
                <th scope="col">At the snapshot</th>
                <th scope="col">Current record</th>
                <th scope="col">Evidence added or updated</th>
              </tr>
            </thead>
            <tbody>
              {comparison.changedRecords.map((change) => (
                <tr key={change.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => onInspect(change.id)}
                      aria-label={`Inspect evidence for ${change.code}`}
                    >
                      <strong>{change.code}</strong>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                    <small className="source-ref">{change.name}</small>
                  </td>
                  <td>
                    {change.before ? (
                      <State value={change.before} />
                    ) : (
                      <Badge tone="blue">Added after snapshot</Badge>
                    )}
                  </td>
                  <td>
                    <State value={change.after} />
                    {change.kind === 'updated' && !change.classificationChanged && (
                      <small className="source-ref">Classification unchanged</small>
                    )}
                  </td>
                  <td>
                    {change.sourceReview && (
                      <p className="source-ref">
                        <strong>Source: </strong>
                        {change.sourceReview}
                      </p>
                    )}
                    {change.notesReview && (
                      <p className="source-ref">
                        <strong>Review: </strong>
                        {change.notesReview}
                      </p>
                    )}
                    {!change.evidenceChanged && (
                      <p className="source-ref">
                        Classification changed through upstream evidence. This batch's own record is
                        unchanged.
                      </p>
                    )}
                    {change.evidenceChanged && !change.sourceReview && !change.notesReview && (
                      <p className="source-ref">
                        Production record updated: {change.changedFields.join(', ')}.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <h3>No batch record changes since this snapshot.</h3>
          <p>Later evidence will appear here when a batch's classification or recorded inputs change.</p>
        </div>
      )}
      <div className="info-note">
        <Info size={19} aria-hidden="true" />
        <p>
          The original snapshot is unchanged. This view compares batch classifications and production records;
          review customer deliveries for current distribution. “No recorded connection” does not establish
          food safety.
        </p>
      </div>
    </section>
  );
}
