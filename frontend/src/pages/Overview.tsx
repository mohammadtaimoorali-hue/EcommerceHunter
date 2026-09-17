import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Overview() {
  const [data, setData] = useState<any>(null);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.overview().then(setData).catch((e) => setError(String(e)));
  }, []);

  async function runDryRun() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.dryRun();
      setDryRunResult(result);
      const refreshed = await api.overview();
      setData(refreshed);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Overview</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {data && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{data.canonicalProducts}</div>
            <div className="stat-label">Canonical Products</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.listingDrafts}</div>
            <div className="stat-label">Listing Drafts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.activeListings}</div>
            <div className="stat-label">Active Listings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.sources}</div>
            <div className="stat-label">Sources</div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Dry-Run Pipeline</h2>
        <p>
          Runs the full discovery → normalize → dedupe → score → profitability → risk →
          listing-gen → validate → MockEbayAdapter publish pipeline. Never touches the real eBay
          API.
        </p>
        <button onClick={runDryRun} disabled={loading}>
          {loading ? 'Running…' : 'Run Dry-Run Pipeline'}
        </button>
        {dryRunResult && (
          <div className="dry-run-summary" style={{ marginTop: '1rem' }}>
            <p>Candidates found: {dryRunResult.candidatesFound}</p>
            <p>Shortlisted: {dryRunResult.shortlisted}</p>
            <p>Listings generated: {dryRunResult.listingsGenerated}</p>
            <p>Listings published (mock): {dryRunResult.listingsPublished}</p>
            <p>Estimated revenue: ${dryRunResult.estimatedRevenue}</p>
            <p>Estimated profit: ${dryRunResult.estimatedProfit}</p>
          </div>
        )}
      </div>

      {data?.alerts?.length > 0 && (
        <div className="panel">
          <h2>System Alerts</h2>
          <ul>
            {data.alerts.map((a: any) => (
              <li key={a.id}>
                [{a.severity}] {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
