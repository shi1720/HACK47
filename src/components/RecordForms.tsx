import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BatchInput, Unit } from '../../shared/types';
import { stockBalances } from '../../shared/domain';
import { useStore } from '../lib/store';
import { today, uid, number } from '../lib/api';
import { ErrorBox, Field, Modal, Spinner } from './ui';
export function RecordForm({ kind, onClose }: { kind: 'lot' | 'batch' | 'shipment'; onClose: () => void }) {
  const { workspace: w, dispatch } = useStore();
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [inputs, setInputs] = useState<BatchInput[]>([{ sourceId: '', quantity: 1 }]);
  const balances = useMemo<Record<string, number>>(() => (w ? stockBalances(w) : {}), [w]);
  if (!w) return null;
  const sources = [...w.lots, ...w.batches].filter(
    (s) => balances[s.id] > 0 && (!('status' in s) || s.status !== 'hold'),
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const d = new FormData(e.currentTarget),
      s = (key: string) => String(d.get(key) || '').trim(),
      n = (key: string) => Number(d.get(key));
    try {
      const common = { id: uid(), code: s('code'), quantity: n('quantity'), source: s('source') };
      if (kind === 'lot')
        await dispatch({
          type: 'lot.create',
          payload: {
            ...common,
            name: s('name'),
            supplier: s('supplier'),
            receivedOn: s('date'),
            expiresOn: s('expires') || undefined,
            unit: s('unit') as Unit,
            status: 'available',
          },
        });
      if (kind === 'batch')
        await dispatch({
          type: 'batch.create',
          payload: {
            ...common,
            name: s('name'),
            producedOn: s('date'),
            unit: s('unit') as Unit,
            inputs: inputs.filter((i) => i.sourceId),
            recordsComplete: d.get('complete') === 'on',
            notes: s('notes'),
          },
        });
      if (kind === 'shipment')
        await dispatch({
          type: 'shipment.create',
          payload: {
            ...common,
            batchId: s('batchId'),
            customer: s('customer'),
            contact: s('contact'),
            shippedOn: s('date'),
          },
        });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      wide={kind === 'batch'}
      title={
        {
          lot: 'Receive an ingredient lot',
          batch: 'Record a production batch',
          shipment: 'Record a shipment',
        }[kind]
      }
      description={
        {
          lot: 'Keep the supplier lot code exactly as it appears on the delivery.',
          batch: 'Connect what went in with what came out. Quantities use the source’s unit.',
          shipment: 'Connect a finished batch to the customer who received it.',
        }[kind]
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field
            label={
              kind === 'lot' ? 'Supplier lot code' : kind === 'batch' ? 'Batch code' : 'Shipment reference'
            }
          >
            <input
              name="code"
              placeholder={
                kind === 'lot' ? 'e.g. PAP-2409' : kind === 'batch' ? 'e.g. SMK-022' : 'e.g. SHP-016'
              }
              required
              maxLength={80}
            />
          </Field>
          <Field label={kind === 'lot' ? 'Received on' : kind === 'batch' ? 'Produced on' : 'Shipped on'}>
            <input type="date" name="date" defaultValue={today()} required />
          </Field>
          {kind !== 'shipment' && (
            <>
              <Field label={kind === 'lot' ? 'Ingredient name' : 'Product name'}>
                <input
                  name="name"
                  placeholder={kind === 'lot' ? 'e.g. Smoked paprika' : 'e.g. Smoked chilli sauce'}
                  required
                  maxLength={160}
                />
              </Field>
              {kind === 'lot' ? (
                <Field label="Supplier">
                  <input name="supplier" placeholder="Supplier or grower name" required maxLength={160} />
                </Field>
              ) : (
                <Field label="Output unit">
                  <select name="unit" defaultValue="units">
                    <option value="units">Units (jars, bottles, packs)</option>
                    <option value="kg">Kilograms</option>
                    <option value="g">Grams</option>
                    <option value="l">Litres</option>
                    <option value="ml">Millilitres</option>
                  </select>
                </Field>
              )}
            </>
          )}
          {kind === 'shipment' && (
            <>
              <Field label="Production batch">
                <select name="batchId" required defaultValue="">
                  <option value="" disabled>
                    Select a batch
                  </option>
                  {w.batches
                    .filter((b) => balances[b.id] > 0)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · {number(balances[b.id])} {b.unit} left
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Customer / retailer">
                <input name="customer" placeholder="e.g. Corner Pantry" required maxLength={160} />
              </Field>
              <Field label="Contact email or phone">
                <input name="contact" placeholder="Where to reach this customer" required maxLength={200} />
              </Field>
            </>
          )}
          <Field
            label={
              kind === 'lot'
                ? 'Quantity received'
                : kind === 'batch'
                  ? 'Quantity produced'
                  : 'Quantity shipped'
            }
          >
            <input name="quantity" type="number" min="0.001" step="0.001" required placeholder="0" />
          </Field>
          {kind === 'lot' && (
            <>
              <Field label="Unit">
                <select name="unit" defaultValue="kg">
                  <option value="kg">Kilograms</option>
                  <option value="g">Grams</option>
                  <option value="l">Litres</option>
                  <option value="ml">Millilitres</option>
                  <option value="units">Units</option>
                </select>
              </Field>
              <Field label="Best before (optional)">
                <input name="expires" type="date" />
              </Field>
            </>
          )}
          <Field
            label="Source reference"
            hint="A delivery note, production sheet or dispatch record you can retrieve."
          >
            <input name="source" placeholder="e.g. Delivery note DN-014, page 1" required maxLength={300} />
          </Field>
        </div>
        {kind === 'batch' && (
          <>
            <div className="input-list">
              <div className="section-line">
                <h3>Ingredients & intermediate batches</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setInputs([...inputs, { sourceId: '', quantity: 1 }])}
                >
                  <Plus size={15} /> Add input
                </button>
              </div>
              {inputs.map((item, index) => (
                <div className="input-row" key={index}>
                  <select
                    aria-label={`Input ${index + 1}`}
                    value={item.sourceId}
                    onChange={(e) =>
                      setInputs(inputs.map((v, i) => (i === index ? { ...v, sourceId: e.target.value } : v)))
                    }
                  >
                    <option value="">Select a source lot or batch</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name} ({number(balances[s.id])} {s.unit} left)
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Input ${index + 1} quantity`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) =>
                      setInputs(
                        inputs.map((v, i) => (i === index ? { ...v, quantity: Number(e.target.value) } : v)),
                      )
                    }
                  />
                  <span>{sources.find((s) => s.id === item.sourceId)?.unit || 'qty'}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove input ${index + 1}`}
                    onClick={() => setInputs(inputs.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <label className="check-row">
              <input name="complete" type="checkbox" />
              <span>
                <strong>Every ingredient lot is recorded</strong>
                <small>
                  Leave unchecked if any input is missing. This batch will need investigation in a drill.
                </small>
              </span>
            </label>
            <Field label="Production notes / missing information">
              <textarea
                name="notes"
                rows={2}
                placeholder="e.g. One spice lot is still missing from the production sheet"
                maxLength={1000}
              />
            </Field>
          </>
        )}
        <ErrorBox>{error}</ErrorBox>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? <Spinner /> : <Plus size={16} />}Save {kind}
          </button>
        </div>
      </form>
    </Modal>
  );
}
