// The send queue on this tablet (D-102, D-217; layout WF-Q1 "Sync queue").
// Everything you did without a connection, newest first, and what happened
// to it: waiting, sent, or refused by the server (with the reason). Refused
// items are listed first under "Refused: review" and stay until you remove
// them; they were never official records, and the paper tech log entry
// still stands.
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDateTime, type DisplaySettings } from '../lib/format';
import { useOnline, useOutbox } from '../lib/offline/hooks';
import { removeFailed, retry, syncNow } from '../lib/offline/outbox';
import type { OutboxItem } from '../lib/offline/db';
import { BackButton, Crumbs, PageHead, Section } from '../components/PageFrame';

const STATE: Record<string, { label: string; tone: string }> = {
  queued: { label: 'Waiting for signal', tone: 'amber' },
  sending: { label: 'Sending…', tone: 'blue' },
  sent: { label: 'Accepted', tone: 'green' },
  failed: { label: 'Refused', tone: 'red' },
};

function Row({ i, display }: { i: OutboxItem; display: DisplaySettings }) {
  const s = STATE[i.status];
  return (
    <tr>
      <td data-label="Item">
        {i.label}
        {i.kind === 'signed' && <> <span className="chip tone-amber provisional">Signed offline</span></>}
        <div className="small muted">made {formatDateTime(new Date(i.createdAt), display)}
          {i.sentAt && ` · accepted ${formatDateTime(new Date(i.sentAt), display)}`}</div>
        {i.error && <div className="small sq-reason">{i.error}</div>}
      </td>
      <td data-label="State"><span className={`chip tone-${s.tone}`}>{s.label}</span></td>
      <td data-label="Record">{i.recordPath ? <Link to={i.recordPath}>Open</Link> : <span className="muted">—</span>}</td>
      {i.status === 'failed' && (
        <td data-label="">
          <div className="action-row">
            <button type="button" className="outline-button" onClick={() => retry(i.id!)}>Try again</button>
            <button type="button" className="outline-button" onClick={() => {
              if (window.confirm('Remove this refused item from the tablet? It never reached the record. The paper tech log entry still stands.')) removeFailed(i.id!);
            }}>Remove</button>
          </div>
        </td>
      )}
    </tr>
  );
}

export function SyncQueue() {
  const { me, display } = useAuth();
  const online = useOnline();
  const items = useOutbox();
  const shown = [...items].reverse();
  const refused = shown.filter((i) => i.status === 'failed');
  const others = shown.filter((i) => i.status !== 'failed');

  return (
    <div className="page">
      <Crumbs items={[{ label: 'All aircraft', to: '/' }, { label: 'Sync queue' }]} />
      <BackButton to="/" label="All aircraft" />
      <PageHead title="Sync queue"
        sub={<>Items saved on this device · {online ? 'Online: waiting items are being sent.' : 'Offline: items wait here until the connection returns.'}</>}>
        <button type="button" onClick={() => syncNow(me?.userId)} disabled={!online}>Send now</button>
        <Link className="button outline-button" to="/device">This tablet</Link>
      </PageHead>

      {refused.length > 0 && (
        <Section title={`Refused by the server: review (${refused.length})`} tone="warn">
          <p className="small">The server checked these and refused them, with the reason shown. Open the record to see what changed, then try again or remove the item. Nothing official was changed (D-217).</p>
          <table className="board sq-table">
            <thead><tr><th>Item</th><th>State</th><th>Record</th><th aria-label="Actions" /></tr></thead>
            <tbody>{refused.map((i) => <Row key={i.id} i={i} display={display} />)}</tbody>
          </table>
        </Section>
      )}

      <Section title="On this device">
        {others.length === 0
          ? <p className="muted sq-empty">Nothing waiting. Everything you did has reached the server.</p>
          : (
            <table className="board sq-table">
              <thead><tr><th>Item</th><th>State</th><th>Record</th></tr></thead>
              <tbody>{others.map((i) => <Row key={i.id} i={i} display={display} />)}</tbody>
            </table>
          )}
      </Section>
    </div>
  );
}
