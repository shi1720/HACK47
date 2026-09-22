import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FlaskConical, Package, Plus, Search, Sprout, Truck } from 'lucide-react';
import { ResolveGap } from './ResolveGap';
import type { Batch } from '../../shared/types';
import { stockBalances } from '../../shared/domain';
import { useStore } from '../lib/store';
import { formatDate, number } from '../lib/api';
import { Badge, Empty, ErrorBox, PageHeading } from './ui';
export function Records({ kind, onAdd }: { kind: 'lot' | 'batch' | 'shipment'; onAdd: () => void }) {
  const { workspace: w, dispatch } = useStore();
  const [resolving, setResolving] = useState<Batch | null>(null);
  const [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const list = useMemo(() => {
    if (!w) return [];
    return (kind === 'lot' ? w.lots : kind === 'batch' ? w.batches : w.shipments).filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  }, [w, kind, query]);
  const balances = useMemo<Record<string, number>>(() => (w ? stockBalances(w) : {}), [w]);
  if (!w) return null;
  return (
    <>
      <PageHeading
        eyebrow="EVERY RECORD IS A CONNECTION"
        title={{ lot: 'Ingredient lots', batch: 'Production batches', shipment: 'Customer deliveries' }[kind]}
        description={
          {
            lot: 'The ingredients that started it all. Preserve each supplier’s original lot code.',
            batch: 'What went into every batch, and how much came out.',
            shipment: 'A finished batch is only half the story. Know where it went.',
          }[kind]
        }
        action={
          <button className="button primary" onClick={onAdd}>
            <Plus size={17} />
            {kind === 'lot' ? 'Receive a lot' : kind === 'batch' ? 'Record a batch' : 'Log a delivery'}
          </button>
        }
      />
      <div className="records-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search records"
            placeholder="Search codes, products, sources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span>
          {list.length} {list.length === 1 ? 'record' : 'records'}
        </span>
        <Link to="/app/import">
          Import a spreadsheet <ArrowUpRight size={15} />
        </Link>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="panel">
        <div className="table-wrap">
          {kind === 'lot' ? (
            <table>
              <thead>
                <tr>
                  <th>Ingredient / lot code</th>
                  <th>Supplier</th>
                  <th>Received</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {w.lots
                  .filter((l) => list.some((x) => x.id === l.id))
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="cell-product">
                          <div className="product-icon">
                            <Sprout size={18} />
                          </div>
                          <div>
                            <strong>{l.name}</strong>
                            <span>{l.code}</span>
                          </div>
                        </div>
                        <small className="source-ref">{l.source}</small>
                      </td>
                      <td>{l.supplier}</td>
                      <td>
                        {formatDate(l.receivedOn)}
                        {l.expiresOn && (
                          <small className="source-ref">Best before {formatDate(l.expiresOn)}</small>
                        )}
                      </td>
                      <td>
                        <strong>{number(balances[l.id])}</strong> {l.unit}
                        <small className="source-ref">of {number(l.quantity)} received</small>
                      </td>
                      <td>
                        <button
                          className="badge-button"
                          aria-label={`${l.status === 'hold' ? 'Release hold on' : 'Hold'} ${l.code}`}
                          onClick={async () => {
                            try {
                              await dispatch({
                                type: 'lot.status',
                                payload: { id: l.id, status: l.status === 'hold' ? 'available' : 'hold' },
                              });
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Badge tone={l.status === 'hold' ? 'orange' : 'green'}>
                            {l.status === 'hold' ? 'On hold' : 'Available'}
                          </Badge>
                        </button>
                      </td>
                      <td>
                        <Link
                          className="round-link"
                          to={`/app/trace?lot=${encodeURIComponent(l.id)}`}
                          aria-label={`Trace ${l.code}`}
                        >
                          <ArrowUpRight size={19} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : kind === 'batch' ? (
            <table>
              <thead>
                <tr>
                  <th>Batch / product</th>
                  <th>Produced</th>
                  <th>Input lots</th>
                  <th>Remaining</th>
                  <th>Record completeness</th>
                </tr>
              </thead>
              <tbody>
                {w.batches
                  .filter((b) => list.some((x) => x.id === b.id))
                  .map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="cell-product">
                          <div className="product-icon">
                            <FlaskConical size={18} />
                          </div>
                          <div>
                            <strong>{b.name}</strong>
                            <span>{b.code}</span>
                          </div>
                        </div>
                        <small className="source-ref">{b.source}</small>
                      </td>
                      <td>{formatDate(b.producedOn)}</td>
                      <td>
                        <div className="code-chips">
                          {b.inputs.map((i) => (
                            <span key={i.sourceId}>
                              {[...w.lots, ...w.batches].find((s) => s.id === i.sourceId)?.code} ·{' '}
                              {number(i.quantity)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{number(balances[b.id])}</strong> {b.unit}
                        <small className="source-ref">of {number(b.quantity)} made</small>
                      </td>
                      <td>
                        <Badge tone={b.recordsComplete ? 'green' : 'orange'}>
                          {b.recordsComplete ? 'Complete' : 'Needs investigation'}
                        </Badge>
                        {b.notes && <small className="source-ref notes">{b.notes}</small>}
                        {!b.recordsComplete && (
                          <button className="text-button" onClick={() => setResolving(b)}>
                            Resolve record gap <ArrowUpRight size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Customer / delivery</th>
                  <th>Batch</th>
                  <th>Shipped</th>
                  <th>Quantity</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {w.shipments
                  .filter((s) => list.some((x) => x.id === s.id))
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-product">
                          <div className="product-icon">
                            <Truck size={18} />
                          </div>
                          <div>
                            <strong>{s.customer}</strong>
                            <span>{s.code}</span>
                          </div>
                        </div>
                        <small className="source-ref">{s.source}</small>
                      </td>
                      <td>
                        <span className="mono">{w.batches.find((b) => b.id === s.batchId)?.code}</span>
                      </td>
                      <td>{formatDate(s.shippedOn)}</td>
                      <td>
                        <strong>{number(s.quantity)}</strong>{' '}
                        {w.batches.find((b) => b.id === s.batchId)?.unit}
                      </td>
                      <td>{s.contact}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
        {!list.length && (
          <Empty
            icon={<Package />}
            title={query ? 'No matching records.' : 'Start with one connection.'}
            description={
              query
                ? 'Try a different code, product or customer name.'
                : 'Add a record or import a spreadsheet to begin.'
            }
            action={
              !query && (
                <button className="button secondary" onClick={onAdd}>
                  Add your first {kind}
                </button>
              )
            }
          />
        )}
      </div>
      {resolving && <ResolveGap batch={resolving} onClose={() => setResolving(null)} onResolved={() => {}} />}
      <p className="table-footnote">
        Source references point to your original records. Keep those documents available for review.
      </p>
    </>
  );
}
