import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ClipboardCopy, Download, FileCheck2, FileJson, Mail, Table2 } from 'lucide-react';
import type { Recall } from '../../shared/types';
import { useStore } from '../lib/store';
import { downloadFile, formatDate } from '../lib/api';
import { contactDraft, exportRecallCsv, exportRecallPdf } from '../lib/export';
import { Badge, Empty, ErrorBox, Modal, PageHeading, Spinner } from './ui';
export function Recalls() {
  const { workspace: w, user, dispatch, local, online, queue } = useStore();
  const [selected, setSelected] = useState<Recall | null>(null),
    [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false);
  if (!w) return null;
  const pdf = async (r: Recall) => {
    setBusy(r.id);
    setError('');
    try {
      if (
        !local &&
        online &&
        !queue.some((q) => q.command.type === 'recall.create' && q.command.payload.id === r.id)
      ) {
        const response = await fetch(`/api/recalls/${encodeURIComponent(r.id)}/pdf`, {
          credentials: 'same-origin',
        });
        if (!response.ok)
          throw new Error('Unable to download the saved report. Retry when your workspace is synchronized.');
        downloadFile(`batchlight-${r.mode}-${r.id}.pdf`, await response.blob(), 'application/pdf');
      } else {
        await exportRecallPdf(r, w.name, Boolean(user?.isDemo));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="PREPARATION YOU CAN POINT TO"
        title="Rehearsals & reports"
        description="Dated snapshots of your records, ready to review and share."
        action={
          <Link className="button primary" to="/app/trace">
            <FileCheck2 size={17} />
            New recall drill
          </Link>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      {!w.recalls.length ? (
        <div className="panel">
          <Empty
            icon={<FileCheck2 size={31} />}
            title="Your first rehearsal is waiting."
            description="Choose an ingredient, inspect its connections, then save a dated snapshot of what you found."
            action={
              <Link className="button primary" to="/app/trace">
                Start a recall drill
                <ArrowRight size={16} />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="recall-list">
          {w.recalls
            .slice()
            .reverse()
            .map((r) => (
              <article className="recall-card" key={r.id}>
                <div className="recall-card-top">
                  <div className="report-icon">
                    <FileCheck2 size={25} />
                  </div>
                  <div>
                    <div className="report-badges">
                      {queue.some(
                        (q) => q.command.type === 'recall.create' && q.command.payload.id === r.id,
                      ) && <Badge tone="orange">Pending server confirmation</Badge>}
                      <Badge tone={r.mode === 'drill' ? 'blue' : 'orange'}>
                        {r.mode === 'drill' ? 'Rehearsal' : 'Incident review'}
                      </Badge>
                      <Badge tone={r.status === 'closed' ? 'neutral' : 'green'}>
                        {r.status === 'closed' ? 'Archived' : 'Open for review'}
                      </Badge>
                    </div>
                    <h2>{r.title}</h2>
                    <p>Saved {formatDate(r.createdAt)} · Records frozen at the time of review</p>
                  </div>
                </div>
                <div className="recall-summary">
                  <div>
                    <strong>{r.result.affectedUnits}</strong>
                    <span>finished units connected</span>
                  </div>
                  <div>
                    <strong>{r.result.customerCount}</strong>
                    <span>recorded customers</span>
                  </div>
                  <div>
                    <strong>{r.result.investigationBatchIds.length}</strong>
                    <span>batches to investigate</span>
                  </div>
                  <p>{r.reason}</p>
                </div>
                <div className="recall-actions">
                  <button className="button primary" onClick={() => pdf(r)} disabled={busy === r.id}>
                    {busy === r.id ? <Spinner /> : <Download size={16} />}Download evidence pack
                  </button>
                  <button className="button secondary" onClick={() => setSelected(r)}>
                    Review snapshot <ArrowRight size={15} />
                  </button>
                  <button className="text-button" onClick={() => exportRecallCsv(r)}>
                    <Table2 size={15} />
                    CSV
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      downloadFile(`batchlight-snapshot-${r.id}.json`, JSON.stringify(r, null, 2))
                    }
                  >
                    <FileJson size={15} />
                    JSON
                  </button>
                  {r.status === 'open' && (
                    <button
                      className="text-button archive-button"
                      onClick={async () => {
                        try {
                          await dispatch({ type: 'recall.close', payload: { id: r.id } });
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Archive rehearsal
                    </button>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
      <div className="info-note">
        <FileCheck2 size={19} />
        <p>
          Reports preserve the original snapshot. Later records do not rewrite past reports. Archiving is
          administrative and does not clear products for sale.
        </p>
      </div>
      {selected && (
        <Modal
          wide
          title={selected.title}
          description={`Saved ${formatDate(selected.createdAt)} · ${selected.mode === 'drill' ? 'Rehearsal only' : 'Incident review'}`}
          onClose={() => setSelected(null)}
        >
          <div className="snapshot-body">
            <p>{selected.reason}</p>
            <h3>Batch scope at the time of review</h3>
            <div className="snapshot-batches">
              {selected.snapshot.batches.map((b) => (
                <div key={b.id}>
                  <div>
                    <strong>{b.code}</strong>
                    <span>{b.name}</span>
                  </div>
                  <Badge
                    tone={
                      selected.result.affectedBatchIds.includes(b.id)
                        ? 'red'
                        : selected.result.investigationBatchIds.includes(b.id)
                          ? 'orange'
                          : 'neutral'
                    }
                  >
                    {selected.result.affectedBatchIds.includes(b.id)
                      ? 'Connected'
                      : selected.result.investigationBatchIds.includes(b.id)
                        ? 'Investigate'
                        : 'No recorded connection'}
                  </Badge>
                </div>
              ))}
            </div>
            <h3>Customer contact drafts</h3>
            <p className="muted">Review every draft before use. Batchlight never sends messages.</p>
            {[
              ...new Set(
                selected.snapshot.shipments
                  .filter(
                    (s) =>
                      selected.result.shipmentIds.includes(s.id) ||
                      selected.result.investigationShipmentIds.includes(s.id),
                  )
                  .map((s) => s.customer),
              ),
            ].map((customer) => (
              <button
                className="contact-draft-button"
                key={customer}
                onClick={() => {
                  setDraft(contactDraft(selected, customer));
                  setCopied(false);
                }}
              >
                <Mail size={17} />
                {customer}
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {draft && (
        <Modal
          title="Customer contact draft"
          description="An editable starting point. Nothing has been sent."
          onClose={() => setDraft('')}
        >
          <textarea
            className="draft-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Contact draft"
            rows={15}
          />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => downloadFile('batchlight-contact-draft.txt', draft, 'text/plain')}
            >
              Download text
            </button>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft);
                  setCopied(true);
                } catch {
                  setError('Clipboard unavailable. Select the draft text to copy it.');
                }
              }}
            >
              {copied ? <Check size={16} /> : <ClipboardCopy size={16} />} {copied ? 'Copied' : 'Copy draft'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
