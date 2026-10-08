// The send queue on this tablet (D-102, D-217).
// Everything you did without a connection, oldest first, and what happened
// to it: waiting, sent, or refused by the server (with the reason). Refused
// items stay here until you remove them; they were never official records,
// and the paper tech log entry still stands.
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { useOnline, useOutbox } from '../lib/offline/hooks';
import { removeFailed, retry, syncNow } from '../lib/offline/outbox';

const STATE: Record<string, { label: string; tone: string }> = {
  queued: { label: 'Waiting', tone: 'amber' },
  sending: { label: 'Sending…', tone: 'blue' },
  sent: { label: 'Accepted', tone: 'green' },
  failed: { label: 'Refused', tone: 'red' },
};

export function SyncQueue() {
  const { me, display } = useAuth();
  const online = useOnline();
  const items = useOutbox();
  const shown = [...items].reverse();

  return (
    <div className="page">
      <div className="breadcrumb"><Link to="/">Home</Link> › Send queue</div>
      <div className="page-head">
        <div>
          <h1>Send queue on this tablet</h1>
          <div className="small muted">{online ? 'Online: waiting items are being sent.' : 'Offline: items wait here until the connection returns.'}</div>
        </div>
        <button type="button" onClick={() => syncNow(me?.userId)} disabled={!online}>Send now</button>
      </div>
      {shown.length === 0 && <div className="card"><p className="muted">Nothing waiting. Everything you did has reached the server.</p></div>}
      {shown.length > 0 && (
        <section className="card">
          <ul className="open-list">
            {shown.map((i) => {
              const s = STATE[i.status];
              return (
                <li key={i.id}>
                  <span className={`chip tone-${s.tone}`}>{s.label}</span>
                  {i.kind === 'signed' && <span className="chip tone-amber">Signed offline</span>}
                  {i.recordPath ? <Link to={i.recordPath}>{i.label}</Link> : <span>{i.label}</span>}
                  <span className="small muted">made {formatDateTime(new Date(i.createdAt), display)}
                    {i.sentAt && ` · accepted ${formatDateTime(new Date(i.sentAt), display)}`}</span>
                  {i.error && <div className="small" style={{ flexBasis: '100%', color: 'var(--red)' }}>{i.error}</div>}
                  {i.status === 'failed' && (
                    <span className="row" style={{ flex: '0 0 auto', gap: 6 }}>
                      <button type="button" className="secondary" onClick={() => retry(i.id!)}>Try again</button>
                      <button type="button" className="secondary" onClick={() => {
                        if (window.confirm('Remove this refused item from the tablet? It never reached the record. The paper tech log entry still stands.')) removeFailed(i.id!);
                      }}>Remove</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
