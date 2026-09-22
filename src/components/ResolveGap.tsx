import { useMemo, useState, type FormEvent } from 'react';
import { Check, FileCheck2, Plus, Trash2 } from 'lucide-react';
import type { Batch, BatchInput } from '../../shared/types';
import { useStore } from '../lib/store';
import { number } from '../lib/api';
import { stockBalances } from '../../shared/domain';
import { ErrorBox, Field, Modal, Spinner } from './ui';
export function ResolveGap({
  batch,
  onClose,
  onResolved,
}: {
  batch: Batch;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { workspace: w, dispatch } = useStore();
  const [inputs, setInputs] = useState<BatchInput[]>([{ sourceId: '', quantity: 1 }]),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const balances = useMemo<Record<string, number>>(() => (w ? stockBalances(w) : {}), [w]);
  if (!w) return null;
  const sources = [...w.lots, ...w.batches].filter(
    (s) => s.id !== batch.id && !batch.inputs.some((i) => i.sourceId === s.id),
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      await dispatch({
        type: 'batch.resolve',
        payload: {
          id: batch.id,
          additionalInputs: inputs.filter((i) => i.sourceId),
          notes: String(d.get('notes')),
          source: String(d.get('source')),
        },
      });
      onResolved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      wide
      title="Resolve the record gap"
      description={`${batch.code} · Add the evidence you found. Existing input records and saved reports remain unchanged.`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="gap-context">
          <FileCheck2 size={23} />
          <div>
            <strong>{batch.name}</strong>
            <p>{batch.notes || 'This batch is marked as having incomplete ingredient records.'}</p>
          </div>
        </div>
        <div className="input-list">
          <div className="section-line">
            <h3>Missing inputs you can now document</h3>
            <button
              type="button"
              className="text-button"
              onClick={() => setInputs([...inputs, { sourceId: '', quantity: 1 }])}
            >
              <Plus size={15} />
              Add input
            </button>
          </div>
          {inputs.map((input, index) => (
            <div className="input-row" key={index}>
              <select
                aria-label={`Recovered input ${index + 1}`}
                value={input.sourceId}
                onChange={(e) =>
                  setInputs(inputs.map((v, i) => (i === index ? { ...v, sourceId: e.target.value } : v)))
                }
              >
                <option value="">Select the lot shown in the recovered record</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name} ({number(balances[s.id])} {s.unit} unallocated)
                    {'status' in s && s.status === 'hold' ? ' · ON HOLD' : ''}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Recovered quantity ${index + 1}`}
                type="number"
                min="0.001"
                step="0.001"
                value={input.quantity}
                onChange={(e) =>
                  setInputs(
                    inputs.map((v, i) => (i === index ? { ...v, quantity: Number(e.target.value) } : v)),
                  )
                }
              />
              <span>{sources.find((s) => s.id === input.sourceId)?.unit || 'qty'}</span>
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove recovered input ${index + 1}`}
                onClick={() => setInputs(inputs.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <Field
          label="Recovered source reference"
          hint="Where someone else can check the correction, such as a receiving note or photographed label."
        >
          <input
            name="source"
            required
            placeholder="e.g. Recovered spice label on production sheet EEO-1909-X"
            maxLength={1000}
          />
        </Field>
        <Field label="What did you verify?">
          <textarea
            name="notes"
            required
            rows={3}
            placeholder="e.g. The production sheet identifies PAP-2410, 0.5 kg. Reviewed all remaining ingredient entries."
            maxLength={2000}
          />
        </Field>
        <label className="check-row">
          <input type="checkbox" required />
          <span>
            <strong>I reviewed the original evidence and all input lots are now recorded.</strong>
            <small>
              This records historical use. It does not release held ingredients or certify the finished food.
            </small>
          </span>
        </label>
        <ErrorBox>{error}</ErrorBox>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? <Spinner /> : <Check size={16} />}Save evidence & recheck
          </button>
        </div>
      </form>
    </Modal>
  );
}
