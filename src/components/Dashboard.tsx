import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GitBranch,
  Leaf,
  PackageCheck,
  Plus,
  Sprout,
  Truck,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { formatDate, number } from '../lib/api';
import { Badge, Empty, PageHeading } from './ui';
export function Dashboard({ onAdd }: { onAdd: (kind: 'lot' | 'batch' | 'shipment') => void }) {
  const { workspace: w, user } = useStore();
  if (!w) return null;
  const complete = w.batches.filter((b) => b.recordsComplete).length;
  const completeness = w.batches.length ? Math.round((complete / w.batches.length) * 100) : 0;
  const recent = w.batches
    .slice()
    .sort((a, b) => b.producedOn.localeCompare(a.producedOn))
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="YOUR KITCHEN, CONNECTED"
        title={user?.isDemo ? 'Welcome to Ember & Oak.' : `Hello, ${user?.name.split(' ')[0] || 'maker'}.`}
        description="A clear view of what came in, what you made, and where it went."
        action={
          <button className="button primary" onClick={() => onAdd('lot')}>
            <Plus size={17} />
            Receive a lot
          </button>
        }
      />
      <div className="dashboard-stats">
        {[
          {
            label: 'Ingredient lots',
            value: w.lots.length,
            detail: `${new Set(w.lots.map((l) => l.supplier)).size} suppliers in your records`,
            icon: Sprout,
            tone: 'green',
          },
          {
            label: 'Production batches',
            value: w.batches.length,
            detail: `${complete} with complete input records`,
            icon: FlaskConical,
            tone: 'orange',
          },
          {
            label: 'Customer deliveries',
            value: w.shipments.length,
            detail: `${new Set(w.shipments.map((s) => s.customer)).size} customers connected`,
            icon: Truck,
            tone: 'blue',
          },
          {
            label: 'Recall rehearsals',
            value: w.recalls.filter((r) => r.mode === 'drill').length,
            detail: w.recalls.length ? 'Your preparation is taking shape' : 'Your first rehearsal is waiting',
            icon: ClipboardList,
            tone: 'neutral',
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <div className={`stat-icon ${s.tone}`}>
                <s.icon size={18} />
              </div>
            </div>
            <strong>{s.value.toString().padStart(2, '0')}</strong>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="drill-feature">
          <div className="drill-copy">
            <div className="eyebrow">
              <span className="pulse-dot" /> READY BEFORE THE PHONE RINGS
            </div>
            <h2>
              One ingredient.
              <br />
              <em>Follow every connection.</em>
            </h2>
            <p>A supplier flags a lot. Can you find every batch and customer it reached? Let’s rehearse.</p>
            <Link to="/app/trace" className="button cream">
              Start a recall drill
              <ArrowRight size={17} />
            </Link>
            <span className="drill-foot">A rehearsal. No notifications are sent.</span>
          </div>
          <div className="drill-illustration" aria-hidden="true">
            <div className="diagram-orbit o1" />
            <div className="diagram-orbit o2" />
            <svg className="drill-connectors" viewBox="0 0 300 300">
              <path d="M150 66V135M150 135L63 195M150 135L237 195M63 220V260M237 220V260" />
            </svg>
            <div className="diagram-node ingredient">
              <Leaf size={25} />
              <span>INGREDIENT</span>
            </div>
            <div className="diagram-center">
              <GitBranch size={28} />
            </div>
            <div className="diagram-node batch-one">
              <FlaskConical size={23} />
              <span>BATCH 01</span>
            </div>
            <div className="diagram-node batch-two">
              <FlaskConical size={23} />
              <span>BATCH 02</span>
            </div>
            <div className="diagram-mini customer-one">
              <Truck size={16} />
            </div>
            <div className="diagram-mini customer-two">
              <Truck size={16} />
            </div>
          </div>
        </section>
        <section className="readiness-card">
          <div className="section-line">
            <h3>How complete is the story?</h3>
            <GitBranch size={17} />
          </div>
          <div
            className="readiness-donut"
            style={{ '--percentage': `${completeness}%` } as React.CSSProperties}
          >
            <div>
              <strong>
                {completeness}
                <span>%</span>
              </strong>
              <small>input records complete</small>
            </div>
          </div>
          <div className="readiness-row">
            <span>
              <i className="dot green" />
              All inputs recorded
            </span>
            <strong>{complete} batches</strong>
          </div>
          <div className="readiness-row">
            <span>
              <i className="dot amber" />
              Needs a closer look
            </span>
            <strong>{w.batches.length - complete} batches</strong>
          </div>
          <p>Completeness is recorded by your team. It is not a food safety score.</p>
          <Link to="/app/batches">
            Review production records <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Fresh from production</h3>
              <p>The latest batches in your kitchen.</p>
            </div>
            <Link to="/app/batches">
              All batches <ArrowRight size={15} />
            </Link>
          </div>
          {recent.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Batch / product</th>
                    <th>Produced</th>
                    <th>Output</th>
                    <th>Input records</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="cell-product">
                          <div className="product-icon">
                            <FlaskConical size={19} />
                          </div>
                          <div>
                            <strong>{b.name}</strong>
                            <span>{b.code}</span>
                          </div>
                        </div>
                      </td>
                      <td>{formatDate(b.producedOn)}</td>
                      <td>
                        {number(b.quantity)} {b.unit}
                      </td>
                      <td>
                        <Badge tone={b.recordsComplete ? 'green' : 'orange'}>
                          {b.recordsComplete ? 'Complete' : 'Needs investigation'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={<FlaskConical />}
              title="Your first batch belongs here."
              description="Receive an ingredient lot, then record what you made with it."
              action={
                <button className="button secondary" onClick={() => onAdd('batch')}>
                  Record a batch
                </button>
              }
            />
          )}
        </section>
        <section className="quick-actions">
          <div className="section-line">
            <h3>Keep the story going</h3>
          </div>
          {[
            {
              kind: 'lot' as const,
              icon: Sprout,
              title: 'Receive ingredients',
              detail: 'Save the supplier lot code',
            },
            {
              kind: 'batch' as const,
              icon: Box,
              title: 'Record a batch',
              detail: 'Connect inputs to output',
            },
            {
              kind: 'shipment' as const,
              icon: PackageCheck,
              title: 'Log a delivery',
              detail: 'Know who received each batch',
            },
          ].map((a) => (
            <button key={a.kind} onClick={() => onAdd(a.kind)}>
              <span className="quick-icon">
                <a.icon size={21} />
              </span>
              <span>
                <strong>{a.title}</strong>
                <small>{a.detail}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          <Link to="/app/import" className="quick-import">
            <ClipboardList size={16} />
            Already have a spreadsheet?
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <div className="workspace-footer">
        <span>
          <Check size={14} /> Your records stay yours. Export them anytime.
        </span>
        <span>Made with care, for people who make.</span>
      </div>
    </>
  );
}
