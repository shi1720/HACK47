import { Link } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Check, Download, Fingerprint, LogOut, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import type { AuditEntry } from '../../shared/types';
import { useStore } from '../lib/store';
import { api, downloadFile } from '../lib/api';
import { exportWorkspace } from '../lib/export';
import { ErrorBox, Field, Modal, PageHeading, Spinner } from './ui';
export function Settings() {
  const {
    workspace: w,
    user,
    local,
    queue,
    syncError,
    sync,
    syncing,
    dispatch,
    discardPending,
    logout,
  } = useStore();
  const [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [audit, setAudit] = useState<AuditEntry[]>([]),
    [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (!local)
      api<AuditEntry[]>('/audit')
        .then(setAudit)
        .catch(() => {});
  }, [local, w?.revision]);
  if (!w) return null;
  const rename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await dispatch({
        type: 'workspace.rename',
        payload: { name: String(new FormData(e.currentTarget).get('name')) },
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE YOU CAN TRUST"
        title="Workspace & data"
        description="Your account, your records, and a clear view of what is saved."
      />
      <ErrorBox>{error}</ErrorBox>
      <div className="settings-grid">
        <section className="settings-card">
          <div className="section-line">
            <h2>Your kitchen</h2>
            <ShieldCheck size={22} />
          </div>
          <form onSubmit={rename}>
            <Field label="Workspace name">
              <input name="name" defaultValue={w.name} key={w.id} required maxLength={120} />
            </Field>
            <button className="button primary" type="submit">
              {saved ? <Check size={16} /> : null}
              {saved ? 'Saved' : 'Save name'}
            </button>
          </form>
          <dl className="account-details">
            <div>
              <dt>Account</dt>
              <dd>{user?.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>{local ? 'This browser only' : 'Private server workspace + device copy'}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{w.revision}</dd>
            </div>
          </dl>
          <button className="text-button" onClick={() => void logout().catch((e) => setError(e.message))}>
            <LogOut size={15} />
            Sign out and clear this device
          </button>
        </section>
        <section className="settings-card">
          <div className="section-line">
            <h2>Your data stays yours</h2>
            <Download size={22} />
          </div>
          <p>
            Download all ingredient lots, batches, shipments and saved reports. Keep a backup somewhere you
            control.
          </p>
          <button className="button secondary" onClick={() => exportWorkspace(w)}>
            <Download size={16} />
            Export all records (JSON)
          </button>
          <div className="settings-divider" />
          <h3>Offline & synchronization</h3>
          <p>
            {local
              ? 'You are using an isolated browser demo. Changes stay on this device and do not sync to a server.'
              : `${queue.length} pending ${queue.length === 1 ? 'change' : 'changes'}. Offline changes are checked again against server stock before they are accepted.`}
          </p>
          {!local && (
            <button className="button secondary" disabled={syncing} onClick={() => void sync()}>
              {syncing ? <Spinner /> : <RefreshCw size={16} />}Sync now
            </button>
          )}
          <ErrorBox>{syncError}</ErrorBox>
          {syncError && (
            <Link className="text-button" to="/login">
              Sign in again to synchronize
            </Link>
          )}
          {queue.length > 0 && (
            <>
              <button
                className="text-button"
                onClick={() =>
                  downloadFile('batchlight-pending-changes.json', JSON.stringify(queue, null, 2))
                }
              >
                Download pending changes
              </button>
              <button className="text-button danger" onClick={() => setDiscard(true)}>
                Resolve by keeping the server copy
              </button>
            </>
          )}
          <div className="info-note">
            <WifiOff size={19} />
            <p>
              A device copy makes offline work possible. Sign out on shared devices. Private browsing and
              cleared browser data may remove this copy.
            </p>
          </div>
        </section>
      </div>
      <section className="panel audit-panel">
        <div className="panel-head">
          <div>
            <h3>Recorded activity</h3>
            <p>
              {local
                ? 'Server audit history is available in an account workspace.'
                : 'A server hash chain links changes to their previous record. It does not prove the truth of entered information.'}
            </p>
          </div>
          <Fingerprint size={24} />
        </div>
        {audit.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Recorded at</th>
                  <th>Revision</th>
                  <th>Hash prefix</th>
                </tr>
              </thead>
              <tbody>
                {audit
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.action}</strong>
                        <small className="source-ref">{e.detail}</small>
                      </td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                      <td>{e.revision}</td>
                      <td className="mono">{e.hash.slice(0, 16)}…</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="audit-empty">
            {local
              ? 'Local demo changes are stored on this device.'
              : 'No recorded changes yet. Your first saved record will appear here.'}
          </p>
        )}
      </section>
      <div className="info-note">
        <Archive size={20} />
        <p>
          Batchlight currently uses recovery codes instead of email password resets. Keep your code in a
          password manager. Account emails are not verified, and this workspace has one owner.
        </p>
      </div>
      {discard && (
        <Modal
          title="Keep the server copy?"
          description="This removes pending changes from this device. Download them first if you need to preserve them."
          onClose={() => setDiscard(false)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDiscard(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await discardPending();
                  setDiscard(false);
                } catch (e) {
                  setError((e as Error).message);
                  setDiscard(false);
                }
              }}
            >
              Keep server copy
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
