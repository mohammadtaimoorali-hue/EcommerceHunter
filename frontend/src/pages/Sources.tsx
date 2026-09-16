import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Sources() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.sources().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>Sources</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p>
        Every retailer integration implements the same <code>SourceConnector</code> interface.
        FixtureConnector is the only real, working connector; the others are stubs proving the
        plugin architecture extends without touching core code — they intentionally report
        UNAVAILABLE rather than scrape any site without a public API.
      </p>
      <table>
        <thead>
          <tr>
            <th>Connector</th>
            <th>Health</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {data?.connectors?.map((c: any) => (
            <tr key={c.key}>
              <td>{c.key}</td>
              <td>{c.health.status}</td>
              <td>{c.health.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
