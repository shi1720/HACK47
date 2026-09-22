import { useRef, useState } from 'react';
import { Check, Download, FileSpreadsheet, FileText, Plus, UploadCloud, X } from 'lucide-react';
import type { Command } from '../../shared/types';
import { parseImport } from '../../shared/import';
import { useStore } from '../lib/store';
import { ErrorBox, PageHeading, Spinner } from './ui';
export function ImportRecords() {
  const { workspace: w, dispatch } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]),
    [preview, setPreview] = useState<ReturnType<typeof parseImport> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState('');
  if (!w) return null;
  const read = async (newFiles: File[]) => {
    setError('');
    setPreview(null);
    setSuccess('');
    const all = [...files, ...newFiles.filter((f) => !files.some((x) => x.name === f.name))];
    setFiles(all);
    setBusy(true);
    try {
      if (all.reduce((sum, file) => sum + file.size, 0) > 5 * 1024 * 1024)
        throw new Error('Selected files must be under 5 MB in total.');
      const text = await Promise.all(all.map(async (f) => ({ name: f.name, text: await f.text() })));
      setPreview(parseImport(text, w));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await dispatch({ type: 'workspace.import', payload: preview.payload } as Command);
      setSuccess(
        `Added ${preview.payload.lots.length} ingredient lots, ${preview.payload.batches.length} batches and ${preview.payload.shipments.length} deliveries.`,
      );
      setFiles([]);
      if (input.current) input.current.value = '';
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPREADSHEETS HAVE A PLACE HERE"
        title="Bring your records together."
        description="Import ingredient lots, production batches and deliveries in one checked transaction."
      />
      <div className="import-grid">
        <section>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void read(Array.from(e.dataTransfer.files));
            }}
          >
            <div className="upload-icon">
              <UploadCloud size={31} />
            </div>
            <h2>Start with your files.</h2>
            <p>
              Drop CSV files or a Batchlight JSON export here.
              <br />
              Select related files together to preserve their connections.
            </p>
            <input
              ref={input}
              type="file"
              multiple
              accept=".csv,.json"
              aria-label="Import files"
              onChange={(e) => void read(Array.from(e.target.files || []))}
            />
            <button className="button primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Spinner /> : <Plus size={17} />}Choose files
            </button>
            <small>CSV or JSON · up to 5 MB total · validated before saving</small>
          </div>
          {files.length > 0 && (
            <div className="import-files">
              {files.map((f) => (
                <div key={f.name}>
                  <FileText size={19} />
                  <span>
                    {f.name}
                    <small>{(f.size / 1024).toFixed(1)} KB</small>
                  </span>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() => {
                  setFiles([]);
                  setPreview(null);
                  setError('');
                  if (input.current) input.current.value = '';
                }}
              >
                <X size={14} />
                Clear selection
              </button>
            </div>
          )}
          <ErrorBox>{error}</ErrorBox>
          {success && (
            <div className="success-box" role="status">
              <Check size={20} />
              {success}
            </div>
          )}
          {preview && (
            <div className="import-preview">
              <div className="section-line">
                <h3>Ready to add</h3>
                <Check size={20} />
              </div>
              <div>
                <span>
                  <strong>{preview.payload.lots.length}</strong>Ingredient lots
                </span>
                <span>
                  <strong>{preview.payload.batches.length}</strong>Production batches
                </span>
                <span>
                  <strong>{preview.payload.shipments.length}</strong>Deliveries
                </span>
              </div>
              {preview.warnings.map((s, i) => (
                <p key={i} className="import-warning">
                  {s}
                </p>
              ))}
              <p>
                Checked for duplicate codes, missing references, dates and stock allocation. Existing records
                will remain.
              </p>
              <button className="button primary full" onClick={commit} disabled={busy}>
                {busy ? <Spinner /> : <Check size={17} />}Import these records
              </button>
            </div>
          )}
        </section>
        <aside className="import-help">
          <div className="eyebrow">A LITTLE STRUCTURE HELPS</div>
          <h2>
            Connected files.
            <br />
            <em>Connected records.</em>
          </h2>
          <p>
            Use the templates below, then replace the sample rows with your own. Codes connect the files, so
            keep them consistent.
          </p>
          {[
            {
              file: 'lots.csv',
              title: '01 · Ingredient lots',
              text: 'What arrived, from whom, and under which lot code.',
            },
            {
              file: 'batches.csv',
              title: '02 · Production batches',
              text: 'What you made, and the source lots used for each batch.',
            },
            {
              file: 'shipments.csv',
              title: '03 · Customer deliveries',
              text: 'Which batch went to each customer and how much.',
            },
          ].map((t) => (
            <a
              className="template-link"
              key={t.file}
              href={`${import.meta.env.BASE_URL}samples/${t.file}`}
              download
            >
              <FileSpreadsheet size={20} />
              <span>
                <strong>{t.title}</strong>
                <small>{t.text}</small>
              </span>
              <Download size={17} />
            </a>
          ))}
          <div className="import-instructions">
            <h3>Before you import</h3>
            <ul>
              <li>
                Quantities use each source’s recorded unit. Batch inputs can use{' '}
                <code>PAP-2409:2; TOM-1609:10</code> or the JSON format in the template.
              </li>
              <li>
                Use <code>true</code> or <code>false</code> for <code>recordsComplete</code>. Missing inputs
                must stay visible.
              </li>
              <li>Include a retrievable source reference for every record.</li>
              <li>Imports add records. Exported account metadata and historical reports are not imported.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
