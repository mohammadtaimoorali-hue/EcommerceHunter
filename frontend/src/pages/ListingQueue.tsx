import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ListingQueue() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.listingDrafts().then(setDrafts).catch((e) => setError(String(e)));
  }

  useEffect(load, []);

  async function approve(id: string) {
    await api.approveDraft(id);
    load();
  }

  async function reject(id: string) {
    await api.rejectDraft(id);
    load();
  }

  return (
    <div>
      <h1>Listing Queue</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Target Price</th>
            <th>Status</th>
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td>${d.priceTarget}</td>
              <td>{d.status}</td>
              <td>{d.riskStatus}</td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => approve(d.id)} disabled={d.status === 'APPROVED'}>
                    Approve
                  </button>
                  <button onClick={() => reject(d.id)} disabled={d.status === 'REJECTED'}>
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {drafts.length === 0 && <p>No listing drafts yet — run the dry-run pipeline from Overview.</p>}
    </div>
  );
}
