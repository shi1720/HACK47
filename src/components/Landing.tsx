import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CornerDownRight,
  FileCheck2,
  GitBranch,
  Play,
  ShieldCheck,
  Sprout,
  WifiOff,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { ErrorBox, Logo, Spinner } from './ui';
export function Landing() {
  const { authenticate, startLocal, user } = useStore(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      if (import.meta.env.VITE_STATIC_DEMO === 'true') await startLocal();
      else await authenticate('demo', {});
      navigate('/app');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the demo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" aria-label="Batchlight home">
          <Logo />
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#why">Built for makers</a>
          <Link to={user ? '/app' : '/login'}>
            {user
              ? 'Your workspace'
              : import.meta.env.VITE_STATIC_DEMO === 'true'
                ? 'Account setup'
                : 'Log in'}
            <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-sun" /> THE RECALL REHEARSAL WORKSPACE
            </div>
            <h1>
              Good food.
              <br />
              Clear records.
              <br />
              <em>Peace of mind.</em>
            </h1>
            <p>
              You know what went into your food.
              <br className="desktop-break" /> Know exactly where your records lead.
            </p>
            <p className="hero-detail">
              Trace an ingredient through every batch and delivery. Rehearse a recall before you need one.
              Built for the people who actually make the food.
            </p>
            <div className="hero-actions">
              <button className="button primary large" onClick={demo} disabled={busy}>
                {busy ? <Spinner /> : <Play size={16} fill="currentColor" />}Explore the live demo
                <ArrowRight size={17} />
              </button>
              {import.meta.env.VITE_STATIC_DEMO === 'true' ? (
                <a
                  className="button text"
                  href="https://github.com/shi1720/HACK47#run-the-full-application"
                  target="_blank"
                  rel="noreferrer"
                >
                  Run the full application
                </a>
              ) : (
                <Link className="button text" to="/register">
                  Start your workspace
                </Link>
              )}
            </div>
            <p className="hero-fine">
              <Check size={14} />{' '}
              {import.meta.env.VITE_STATIC_DEMO === 'true'
                ? 'Free browser demo. Data stays on this device.'
                : 'No card. No integrations. Just follow the ingredient.'}
            </p>
            <ErrorBox>{error}</ErrorBox>
            {error && (
              <button
                className="text-button"
                onClick={async () => {
                  await startLocal();
                  navigate('/app');
                }}
              >
                Open the demo on this device instead <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div className="hero-visual" aria-label="Example trace from paprika to sauce batches to retailers">
            <div className="hero-note">
              <span>THE SCENARIO</span>
              <p>
                “There’s a problem
                <br />
                with the paprika.”
              </p>
              <small>Which jars? Which customers?</small>
            </div>
            <div className="ingredient-card">
              <div className="spice-art">
                <div className="jar">
                  <div className="jar-cap" />
                  <div className="jar-body">
                    <span>
                      EMBER
                      <br />& OAK
                    </span>
                    <b>
                      SMOKED
                      <br />
                      PAPRIKA
                    </b>
                    <small>LOT PAP-2409</small>
                  </div>
                </div>
                <span className="ingredient-orbit a" />
                <span className="ingredient-orbit b" />
              </div>
              <div className="ingredient-caption">
                <Sprout size={17} />
                <div>
                  <strong>Smoked paprika</strong>
                  <span>One ingredient. A story to follow.</span>
                </div>
                <span className="lot-sticker">PAP-2409</span>
              </div>
            </div>
            <div className="hero-proof">
              <div className="proof-icon">
                <GitBranch size={20} />
              </div>
              <div>
                <strong>Follow the whole story.</strong>
                <p>
                  Ingredient <ArrowRight size={12} /> batch <ArrowRight size={12} /> customer
                </p>
              </div>
              <CornerDownRight size={20} />
            </div>
            <div className="hero-caption">
              <i /> SYNTHETIC DEMO SCENARIO
            </div>
          </div>
        </section>
        <section className="landing-strip">
          <span>MADE FOR SMALL FOOD BUSINESSES</span>
          <p>Sauce makers</p>
          <i>✳</i>
          <p>Independent bakeries</p>
          <i>✳</i>
          <p>Shared kitchens</p>
          <i>✳</i>
          <p>Small-batch producers</p>
        </section>
        <section id="how" className="how-section">
          <div>
            <div className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</div>
            <h2>
              A fire drill.
              <br />
              <em>For your food business.</em>
            </h2>
          </div>
          <div className="how-steps">
            {[
              {
                icon: Sprout,
                n: '01',
                title: 'Keep the connections.',
                text: 'Record incoming lots, what you made, and where it went. Start with your existing spreadsheets.',
              },
              {
                icon: GitBranch,
                n: '02',
                title: 'Follow one ingredient.',
                text: 'See recorded connections and missing inputs separately. An incomplete record never becomes a green light.',
              },
              {
                icon: FileCheck2,
                n: '03',
                title: 'Leave with a plan.',
                text: 'Save a dated rehearsal and download the evidence pack, with batch details and customer contact drafts.',
              },
            ].map((s) => (
              <article key={s.n}>
                <span>{s.n}</span>
                <s.icon size={25} />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="why" className="promise-section">
          <div>
            <WifiOff size={27} />
            <h3>The kitchen Wi-Fi can wait.</h3>
            <p>
              Your saved workspace stays available offline. Record a delivery, run a drill, and sync when you
              reconnect.
            </p>
          </div>
          <div>
            <ShieldCheck size={27} />
            <h3>Honest about what’s missing.</h3>
            <p>
              “No recorded connection” means exactly that. Batchlight helps investigate your records; it
              doesn’t certify food safety.
            </p>
          </div>
          <div className="landing-cta">
            <span className="eyebrow">YOUR FIRST DRILL STARTS HERE</span>
            <h3>
              Find the gaps
              <br />
              before the phone rings.
            </h3>
            <button onClick={demo} className="button primary">
              Try the sample kitchen <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Built by Shivam Gupta for HACK47: OFFGRID</span>
        <a href="https://github.com/shi1720/HACK47" target="_blank" rel="noreferrer">
          Source & build notes <ArrowRight size={14} />
        </a>
      </footer>
    </div>
  );
}
