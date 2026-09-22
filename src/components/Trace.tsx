import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileCheck2,
  GitBranch,
  Info,
  Save,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { traceRecall, stockRemaining } from '../../shared/domain';
import { useStore } from '../lib/store';
import { number, uid } from '../lib/api';
import { Badge, Empty, ErrorBox, Field, Modal, PageHeading, Spinner } from './ui';
import { TraceMap } from './TraceMap';
import { ResolveGap } from './ResolveGap';
import { EvidenceChanges } from './EvidenceChanges';
import type { Batch } from '../../shared/types';
export function Trace() {
  const { workspace: w, dispatch } = useStore();
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const [source, setSource] = useState(params.get('lot') || w?.lots[0]?.id || '');
  const [selected, setSelected] = useState('');
  const [resolving, setResolving] = useState<Batch | null>(null);
  const [resolved, setResolved] = useState(false);
  const [tab, setTab] = useState<'map' | 'batches' | 'customers' | 'changes'>('map');
  const [save, setSave] = useState(false),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const result = useMemo(() => (w && source ? traceRecall(w, source) : null), [w, source]);
  if (!w) return null;
  const lot = w.lots.find((l) => l.id === source);
  const record = [...w.lots, ...w.batches, ...w.shipments].find((r) => r.id === selected);
  const saveRecall = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      await dispatch({
        type: 'recall.create',
        payload: {
          id: uid(),
          sourceId: source,
          title: String(d.get('title')),
          reason: String(d.get('reason')),
          mode: d.get('mode') as 'drill' | 'incident',
        },
      });
      navigate('/app/recalls');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="A FIRE DRILL FOR YOUR FOOD BUSINESS"
        title="Follow the ingredient."
        description="See where a lot went, and where your records need a closer look."
        action={
          <button className="button primary" disabled={!result} onClick={() => setSave(true)}>
            <Save size={16} />
            Save this rehearsal
          </button>
        }
      />
      {!w.lots.length ? (
        <Empty
          icon={<GitBranch />}
          title="Every story starts with an ingredient."
          description="Receive your first ingredient lot to begin tracing."
          action={
            <Link className="button primary" to="/app/lots">
              Go to ingredient lots
              <ArrowRight size={16} />
            </Link>
          }
        />
      ) : (
        <>
          {resolved && (
            <div className="success-box" role="status">
              <Check size={18} />
              Evidence saved. The live trace has been recalculated. Previous reports preserve their original
              findings.
            </div>
          )}
          <div className="trace-selector">
            <div className="selector-icon">
              <Search size={23} />
            </div>
            <div>
              <label htmlFor="trace-source">Which ingredient are we following?</label>
              <select
                id="trace-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setSelected('');
                }}
              >
                {w.lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.code} · {l.supplier}
                  </option>
                ))}
              </select>
            </div>
            <Badge tone="blue">Live record analysis</Badge>
          </div>
          {result && (
            <>
              <div className="trace-stats">
                <div>
                  <span className="dot coral" />
                  <small>Recorded connection</small>
                  <strong>
                    {number(result.affectedUnits)}
                    <span>finished units</span>
                  </strong>
                  <p>{result.affectedBatchIds.length} batch records, including intermediates</p>
                </div>
                <div>
                  <small>Already delivered</small>
                  <strong>
                    {number(result.shippedUnits)}
                    <span>units</span>
                  </strong>
                  <p>Across {result.customerCount} recorded customers</p>
                </div>
                <div>
                  <small>Still in your kitchen</small>
                  <strong>
                    {number(result.onHandUnits)}
                    <span>units</span>
                  </strong>
                  <p>Based on recorded stock movements</p>
                </div>
                <div className="investigation-stat">
                  <span className="dot amber" />
                  <small>Needs investigation</small>
                  <strong>
                    {result.investigationBatchIds.length}
                    <span>batch records</span>
                  </strong>
                  <p>Incomplete inputs or uncertain upstream records</p>
                </div>
              </div>
              <div className="trace-workspace">
                <div className="panel-head">
                  <div className="tabs" role="tablist" aria-label="Trace view">
                    {(['map', 'batches', 'customers', 'changes'] as const).map((t) => (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={tab === t}
                        onClick={() => setTab(t)}
                        className={tab === t ? 'active' : ''}
                      >
                        {t === 'map' ? (
                          <GitBranch size={15} />
                        ) : t === 'batches' ? (
                          <FileCheck2 size={15} />
                        ) : null}
                        {t === 'map'
                          ? 'Traceability map'
                          : t === 'batches'
                            ? 'Batch scope'
                            : t === 'customers'
                              ? 'Customer deliveries'
                              : 'Evidence changes'}
                      </button>
                    ))}
                  </div>
                  <div className="map-legend">
                    <span>
                      <i className="dot coral" />
                      Connected
                    </span>
                    <span>
                      <i className="dot amber" />
                      Investigate
                    </span>
                    <span>
                      <i className="dot sage" />
                      No recorded connection
                    </span>
                  </div>
                </div>
                {tab === 'map' ? (
                  <TraceMap workspace={w} result={result} onSelect={setSelected} />
                ) : tab === 'batches' ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Batch / product</th>
                          <th>Classification</th>
                          <th>Output</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.batches.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.name}</strong>
                              <small className="source-ref mono">{b.code}</small>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  result.affectedBatchIds.includes(b.id)
                                    ? 'red'
                                    : result.investigationBatchIds.includes(b.id)
                                      ? 'orange'
                                      : 'neutral'
                                }
                              >
                                {result.affectedBatchIds.includes(b.id)
                                  ? 'Recorded connection'
                                  : result.investigationBatchIds.includes(b.id)
                                    ? 'Needs investigation'
                                    : 'No recorded connection'}
                              </Badge>
                            </td>
                            <td>
                              {number(b.quantity)} {b.unit}
                            </td>
                            <td>
                              <button className="text-button" onClick={() => setSelected(b.id)}>
                                Inspect record <ArrowUpRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : tab === 'changes' ? (
                  <EvidenceChanges workspace={w} sourceId={source} result={result} onInspect={setSelected} />
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Batch</th>
                          <th>Quantity</th>
                          <th>Connection</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.shipments
                          .filter(
                            (s) =>
                              result.shipmentIds.includes(s.id) ||
                              result.investigationShipmentIds.includes(s.id),
                          )
                          .map((s) => (
                            <tr key={s.id}>
                              <td>
                                <strong>{s.customer}</strong>
                                <small className="source-ref">{s.code}</small>
                              </td>
                              <td className="mono">{w.batches.find((b) => b.id === s.batchId)?.code}</td>
                              <td>
                                {number(s.quantity)} {w.batches.find((b) => b.id === s.batchId)?.unit}
                              </td>
                              <td>
                                <Badge tone={result.shipmentIds.includes(s.id) ? 'red' : 'orange'}>
                                  {result.shipmentIds.includes(s.id) ? 'Recorded connection' : 'Investigate'}
                                </Badge>
                              </td>
                              <td>{s.contact}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="trace-bottom">
                <section className="evidence-note">
                  <ShieldAlert size={23} />
                  <div>
                    <h3>Missing information stays visible.</h3>
                    <p>
                      {result.gaps.length
                        ? `${result.gaps.length} record ${result.gaps.length === 1 ? 'gap needs' : 'gaps need'} review. `
                        : ''}
                      No recorded connection is not a food safety clearance. Unrecorded movement,
                      cross-contact and labelling errors can change the scope.
                    </p>
                    {result.gaps.slice(0, 3).map((g) => (
                      <button key={g.batchId} className="text-button" onClick={() => setSelected(g.batchId)}>
                        {w.batches.find((b) => b.id === g.batchId)?.code}: {g.message}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="save-prompt">
                  <FileCheck2 size={24} />
                  <h3>Leave with something useful.</h3>
                  <p>Save a dated snapshot with source references and customer contact drafts.</p>
                  <button className="text-button" onClick={() => setSave(true)}>
                    Save & prepare the pack
                    <ArrowRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
        </>
      )}
      {record && (
        <Modal
          title={'name' in record ? record.name : record.customer}
          description={`Evidence record · ${record.code}`}
          onClose={() => setSelected('')}
        >
          <div className="record-detail">
            <div>
              <span>Source reference</span>
              <p>{record.source || 'No reference entered.'}</p>
            </div>
            {'notes' in record && (
              <div>
                <span>Production notes</span>
                <p>{record.notes || 'No additional notes.'}</p>
              </div>
            )}
            {result?.paths[record.id] && (
              <div>
                <span>Recorded path from the selected ingredient</span>
                <ol className="path-list">
                  {result.paths[record.id].map((id) => (
                    <li key={id}>
                      <GitBranch size={15} />
                      {[...w.lots, ...w.batches].find((r) => r.id === id)?.code || id}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {'unit' in record && (
              <div>
                <span>Remaining stock</span>
                <p>
                  {number(stockRemaining(w, record.id))} {record.unit}
                </p>
              </div>
            )}
            {'inputs' in record && (
              <div>
                <span>Recorded input quantities</span>
                {record.inputs.map((input) => {
                  const s = [...w.lots, ...w.batches].find((r) => r.id === input.sourceId);
                  return (
                    <p key={input.sourceId}>
                      {s?.code} <ArrowRight size={13} /> {input.quantity} {s?.unit}
                    </p>
                  );
                })}
              </div>
            )}
            {'recordsComplete' in record && !record.recordsComplete && (
              <button
                className="button primary full"
                onClick={() => {
                  setSelected('');
                  setResolving(record);
                }}
              >
                <FileCheck2 size={16} />
                Resolve record gap
              </button>
            )}
            <div className="info-note">
              <Info size={18} />
              <p>
                References are entered by your team. Batchlight preserves connections; it does not
                independently verify source documents.
              </p>
            </div>
          </div>
        </Modal>
      )}
      {resolving && (
        <ResolveGap
          batch={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => setResolved(true)}
        />
      )}
      {save && (
        <Modal
          title="Save this rehearsal"
          description="Keep a snapshot of the records as they stand today."
          onClose={() => setSave(false)}
        >
          <form onSubmit={saveRecall}>
            <Field label="Title">
              <input name="title" required defaultValue={`${lot?.code} · recall rehearsal`} maxLength={200} />
            </Field>
            <Field label="Reason for the review">
              <textarea
                name="reason"
                required
                rows={3}
                defaultValue={`Practice tracing ${lot?.name.toLowerCase()} from supplier lot ${lot?.code}. Confirm customer reach and investigate incomplete records.`}
                maxLength={2000}
              />
            </Field>
            <Field label="Record type">
              <select name="mode" defaultValue="drill">
                <option value="drill">Rehearsal / drill (no real incident)</option>
                <option value="incident">Incident review (requires responsible lead)</option>
              </select>
            </Field>
            <div className="info-note">
              <Check size={18} />
              <p>
                This creates an internal record. It sends no customer messages and does not initiate a recall.
              </p>
            </div>
            <ErrorBox>{error}</ErrorBox>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setSave(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? <Spinner /> : <Save size={16} />}Save snapshot
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
