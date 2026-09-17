import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ProductHunter() {
  const [products, setProducts] = useState<any[]>([]);
  const [minScore, setMinScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .products({ minScore: minScore || undefined })
      .then(setProducts)
      .catch((e) => setError(String(e)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore]);

  return (
    <div>
      <h1>Product Hunter</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div className="filters">
        <label>
          Min score:{' '}
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            min={0}
            max={100}
          />
        </label>
        <button onClick={load}>Refresh</button>
      </div>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Score</th>
            <th>Risk</th>
            <th>Price</th>
            <th>In Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.brand ?? '—'}</td>
              <td>{p.category ?? '—'}</td>
              <td>{p.latestScore != null ? p.latestScore.toFixed(1) : '—'}</td>
              <td>{p.riskStatus ?? '—'}</td>
              <td>{p.latestPrice != null ? `$${p.latestPrice}` : '—'}</td>
              <td>{p.latestStock?.inStock ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {products.length === 0 && <p>No products yet — run the dry-run pipeline from Overview.</p>}
    </div>
  );
}
