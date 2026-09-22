import { useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  ChevronDown,
  CloudUpload,
  Download,
  FileDown,
  FileInput,
  FlaskConical,
  GitBranch,
  HelpCircle,
  LayoutDashboard,
  Leaf,
  Menu,
  Settings as SettingsIcon,
  Sprout,
  Truck,
  WifiOff,
  X,
} from 'lucide-react';
import { useStore } from './lib/store';
import { downloadFile } from './lib/api';
import { Logo, Modal, Spinner } from './components/ui';
import { Landing } from './components/Landing';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Records } from './components/Records';
import { Trace } from './components/Trace';
import { Recalls } from './components/Recalls';
import { ImportRecords } from './components/Import';
import { Settings } from './components/Settings';
import { RecordForm } from './components/RecordForms';
function Shell({ onAdd }: { onAdd: (kind: 'lot' | 'batch' | 'shipment') => void }) {
  const { user, workspace, online, local, queue, syncing, syncError, readOnly, recoveryCode, clearRecovery } =
    useStore();
  const location = useLocation();
  const [menu, setMenu] = useState(false),
    [help, setHelp] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  const nav = [
    { path: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { path: '/app/lots', label: 'Ingredient lots', icon: Sprout },
    { path: '/app/batches', label: 'Production batches', icon: FlaskConical },
    { path: '/app/shipments', label: 'Customer deliveries', icon: Truck },
    { path: '/app/trace', label: 'Recall workspace', icon: GitBranch },
    { path: '/app/recalls', label: 'Rehearsals & reports', icon: FileDown },
  ];
  const current =
    nav.find((n) => n.path === location.pathname)?.label ||
    (location.pathname.endsWith('import') ? 'Import records' : 'Workspace & data');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <Link to="/" className="sidebar-brand">
          <Logo />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={19} />
        </button>
        <Link to="/app/settings" className="workspace-switch">
          <div>EO</div>
          <span>
            <strong>{workspace?.name.replace(' · demo', '')}</strong>
            <small>{user.isDemo ? 'Sample kitchen' : 'Your workspace'}</small>
          </span>
          <ChevronDown size={15} />
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n, index) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.end}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${index === 4 ? 'nav-break' : ''}`
              }
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {index === 4 && <span className="nav-new">DRILL</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div>
              <Leaf size={20} />
              <span>
                Small batch.
                <br />
                <strong>Big peace of mind.</strong>
              </span>
            </div>
            <p>A little preparation goes a long way.</p>
            <Link to="/app/trace">
              Run a rehearsal <ArrowRight size={14} />
            </Link>
          </div>
          <NavLink className="nav-link" to="/app/import" onClick={() => setMenu(false)}>
            <FileInput size={18} />
            Import records
          </NavLink>
          <NavLink className="nav-link" to="/app/settings" onClick={() => setMenu(false)}>
            <SettingsIcon size={18} />
            Workspace & data
          </NavLink>
          <button className="nav-link help-link" onClick={() => setHelp(true)}>
            <HelpCircle size={18} />A little guidance
          </button>
          <div className="sidebar-user">
            <div>{user.name.slice(0, 1).toUpperCase()}</div>
            <span>
              <strong>{user.name}</strong>
              <small>{user.isDemo ? 'Exploring Batchlight' : 'Workspace owner'}</small>
            </span>
          </div>
        </div>
      </aside>
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-brand">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className={`sync-status ${!online ? 'offline' : ''}`}>
            {syncing ? <Spinner /> : !online ? <WifiOff size={15} /> : <CloudUpload size={15} />}
            <span>
              {local
                ? 'Saved on this device'
                : !online
                  ? 'Offline · saved on this device'
                  : syncing
                    ? 'Syncing records…'
                    : queue.length
                      ? `${queue.length} pending ${queue.length === 1 ? 'change' : 'changes'}`
                      : 'All changes saved'}
            </span>
          </div>
        </header>
        {user.isDemo && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              You’re exploring a synthetic sample kitchen. All records are fictional.
            </span>
            <Link to="/app/settings">
              {local ? 'Browser-only demo' : 'Private demo session'}
              <ArrowUpRightIcon />
            </Link>
          </div>
        )}
        {readOnly && (
          <div className="sync-banner">
            <InfoIcon />
            <span>
              This tab is read-only to protect unsynced records. Close the other Batchlight tab, then reload
              here to edit.
            </span>
          </div>
        )}
        {syncError && (
          <div className="sync-banner">
            <WifiOff size={16} />
            <span>{syncError}</span>
            <Link to="/app/settings">Review sync</Link>
            <Link to="/login">Sign in again</Link>
          </div>
        )}
        <main id="main-content" className="content">
          <Outlet />
        </main>
      </div>
      {recoveryCode && (
        <Modal
          title="Keep your recovery code."
          description="This is shown once. It lets you reset your password without an email service."
          onClose={clearRecovery}
        >
          <div className="recovery-code">{recoveryCode}</div>
          <p className="muted">
            Store this code in a password manager. Anyone with your email and this code can reset your
            password.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() =>
                downloadFile(
                  'batchlight-recovery-code.txt',
                  `Batchlight recovery code\nAccount: ${user.email}\n${recoveryCode}\nKeep this private. This code allows a password reset.`,
                  'text/plain',
                )
              }
            >
              <Download size={16} />
              Download code
            </button>
            <button className="button primary" onClick={clearRecovery}>
              I saved my code
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="A little guidance."
          description="A clear record starts with the work you already do."
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
            <li>
              <strong>Receive an ingredient lot.</strong>
              <p>Copy the lot code from the supplier label and keep the delivery reference.</p>
            </li>
            <li>
              <strong>Record what you made.</strong>
              <p>
                Connect every ingredient or intermediate batch. Leave completeness unchecked when an input is
                missing.
              </p>
            </li>
            <li>
              <strong>Log where it went.</strong>
              <p>
                Link a production batch to a customer delivery. Batchlight prevents allocating more than
                recorded stock.
              </p>
            </li>
            <li>
              <strong>Rehearse a recall.</strong>
              <p>
                Choose a lot, inspect connections, investigate unknowns, and save an evidence pack. Nothing is
                sent automatically.
              </p>
            </li>
          </ol>
          <button
            className="button primary"
            onClick={() => {
              setHelp(false);
              onAdd('lot');
            }}
          >
            Receive your next lot <ArrowRight size={15} />
          </button>
        </Modal>
      )}
    </div>
  );
}
function InfoIcon() {
  return <HelpCircle size={16} />;
}
function ArrowUpRightIcon() {
  return <ArrowRight size={13} style={{ transform: 'rotate(-40deg)' }} />;
}
export default function App() {
  const { loading } = useStore();
  const [form, setForm] = useState<'lot' | 'batch' | 'shipment' | null>(null);
  if (loading)
    return (
      <div className="loading-page">
        <Logo />
        <Spinner />
        <p>Gathering your records…</p>
      </div>
    );
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/recover" element={<Auth mode="recover" />} />
        <Route path="/app" element={<Shell onAdd={setForm} />}>
          <Route index element={<Dashboard onAdd={setForm} />} />
          <Route path="lots" element={<Records kind="lot" onAdd={() => setForm('lot')} />} />
          <Route path="batches" element={<Records kind="batch" onAdd={() => setForm('batch')} />} />
          <Route path="shipments" element={<Records kind="shipment" onAdd={() => setForm('shipment')} />} />
          <Route path="trace" element={<Trace />} />
          <Route path="recalls" element={<Recalls />} />
          <Route path="import" element={<ImportRecords />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="not-found">
              <Logo />
              <h1>This page isn’t in the records.</h1>
              <Link className="button primary" to="/">
                Back to Batchlight <ArrowLeft size={16} />
              </Link>
            </div>
          }
        />
      </Routes>
      {form && <RecordForm kind={form} onClose={() => setForm(null)} />}
    </>
  );
}
