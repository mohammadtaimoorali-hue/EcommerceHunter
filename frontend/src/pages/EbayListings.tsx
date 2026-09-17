import { Fragment, useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#1a7f37',
  PAUSED: '#b45309',
  ENDED: '#b91c1c',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#555';
  return (
    <span
      style={{
        color,
        border: `1px solid ${color}`,
        borderRadius: '999px',
        padding: '0.1rem 0.6rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

function eventLabel(type: string): string {
  switch (type) {
    case 'PRICE_CHANGE':
      return 'Price updated';
    case 'PAUSED':
      return 'Paused';
    case 'RESUMED':
      return 'Resumed';
    case 'ENDED':
      return 'Ended';
    case 'CREATED':
      return 'Created';
    default:
      return type;
  }
}

export default function EbayListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  function load() {
    api.listings().then(setListings).catch((e) => setError(String(e)));
  }

  useEffect(load, []);

  async function toggleHistory(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setHistoryLoading(true);
    try {
      const events = await api.listingEvents(id);
      setHistory(events);
    } catch (e) {
      setError(String(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div>
      <h1>eBay Listings</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div className="button-row">
        <button onClick={load}>Refresh</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Store</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Last Monitor Event</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => {
              const lastEvent = l.events?.[0];
              return (
                <Fragment key={l.id}>
                  <tr>
                    <td>{l.listingDraft?.title}</td>
                    <td>{l.store?.name}</td>
                    <td>${l.currentPrice}</td>
                    <td>{l.quantity}</td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    <td>
                      {lastEvent
                        ? `${eventLabel(lastEvent.type)} · ${new Date(lastEvent.createdAt).toLocaleString()}`
                        : '—'}
                    </td>
                    <td>
                      <button onClick={() => toggleHistory(l.id)}>
                        {expandedId === l.id ? 'Hide history' : 'History'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === l.id && (
                    <tr>
                      <td colSpan={7} style={{ background: '#fafbfc' }}>
                        {historyLoading ? (
                          <p style={{ margin: '0.5rem 0' }}>Loading…</p>
                        ) : history.length === 0 ? (
                          <p style={{ margin: '0.5rem 0' }}>
                            No monitor events yet — the price/stock monitor runs automatically every
                            30 minutes, or trigger it now from System / Settings ("Run
                            PRICE_STOCK_CHECK").
                          </p>
                        ) : (
                          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                            {history.map((e) => (
                              <li key={e.id} style={{ marginBottom: '0.25rem' }}>
                                <strong>{eventLabel(e.type)}</strong> —{' '}
                                {new Date(e.createdAt).toLocaleString()}
                                {e.payload && (
                                  <span style={{ color: '#666' }}>
                                    {' '}
                                    ({Object.entries(e.payload)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(', ')}
                                    )
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {listings.length === 0 && <p>No listings yet — run the dry-run pipeline from Overview.</p>}
    </div>
  );
}
