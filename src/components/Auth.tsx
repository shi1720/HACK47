import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import { ErrorBox, Field, Logo, Spinner } from './ui';
export function Auth({ mode }: { mode: 'login' | 'register' | 'recover' }) {
  const { user, authenticate, startLocal, queue } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (user && !queue.length) return <Navigate to="/app" replace />;
  if (import.meta.env.VITE_STATIC_DEMO === 'true')
    return (
      <main className="static-setup">
        <Link to="/">
          <Logo />
        </Link>
        <div className="auth-icon">
          <ShieldCheck />
        </div>
        <h1>
          A private workspace,
          <br />
          on your own server.
        </h1>
        <p>
          This public demo runs entirely in your browser. The full application includes secure accounts,
          persistent storage and offline synchronization, and is self-hostable with Docker.
        </p>
        <a className="button primary" href="https://github.com/shi1720/HACK47#run-the-full-application">
          Set up the full application <ArrowRight size={16} />
        </a>
        <button
          className="button secondary"
          onClick={async () => {
            await startLocal();
            navigate('/app');
          }}
        >
          Explore the browser demo
        </button>
        <Link className="back-link" to="/">
          Back to Batchlight
        </Link>
      </main>
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await authenticate(mode, data);
      navigate('/app');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Link to="/">
          <Logo light />
        </Link>
        <div>
          <div className="eyebrow">SMALL BATCHES. BIG RESPONSIBILITY.</div>
          <h1>
            Behind every jar
            <br />
            is a story.
            <br />
            <em>Keep yours connected.</em>
          </h1>
          <p>A calm place for your ingredients, batches, and the people who trust what you make.</p>
        </div>
        <span>Batchlight · HACK47 OFFGRID 2026</span>
      </div>
      <div className="auth-main">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> Back to Batchlight
        </Link>
        <form onSubmit={submit} className="auth-form">
          <div className="auth-icon">{mode === 'recover' ? <KeyRound /> : <ShieldCheck />}</div>
          <div className="eyebrow">YOUR TRACEABILITY WORKSPACE</div>
          <h2>
            {mode === 'register'
              ? 'Make yourself at home.'
              : mode === 'recover'
                ? 'Recover your workspace.'
                : 'Welcome back.'}
          </h2>
          <p>
            {mode === 'register'
              ? 'Start with a clean workspace. Add your first ingredient when you’re ready.'
              : mode === 'recover'
                ? 'Use the recovery code saved when you created your account.'
                : 'Your records, right where you left them.'}
          </p>
          {mode === 'register' && (
            <>
              <Field label="Your name">
                <input name="name" autoComplete="name" required maxLength={100} />
              </Field>
              <Field label="Business / kitchen name">
                <input name="workspaceName" required maxLength={120} placeholder="e.g. Ember & Oak" />
              </Field>
            </>
          )}
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required maxLength={200} />
          </Field>
          {mode === 'recover' && (
            <Field label="Recovery code">
              <input name="recoveryCode" autoComplete="off" required />
            </Field>
          )}
          <Field
            label={mode === 'recover' ? 'New password' : 'Password'}
            hint={mode !== 'login' ? 'At least 12 characters. Use a unique passphrase.' : undefined}
          >
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 12}
              maxLength={128}
              required
            />
          </Field>
          <ErrorBox>{error}</ErrorBox>
          <button className="button primary full" disabled={busy}>
            {busy ? <Spinner /> : <ArrowRight size={18} />}{' '}
            {mode === 'register' ? 'Create your workspace' : mode === 'recover' ? 'Reset password' : 'Log in'}
          </button>
          <p className="auth-switch">
            {mode === 'register' ? (
              <>
                Already have an account? <Link to="/login">Log in</Link>
              </>
            ) : (
              <>
                New to Batchlight? <Link to="/register">Create a workspace</Link>
              </>
            )}
          </p>
          {mode === 'login' && (
            <Link className="forgot" to="/recover">
              Forgot your password? Use a recovery code
            </Link>
          )}
          <div className="auth-note">
            <ShieldCheck size={17} />
            <span>
              Your workspace is private to your account. A saved copy stays on this device for offline access.
              Use a trusted device.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
