import { useEffect, useState } from 'react';
import { api } from '../api';

export default function EbayListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listings().then(setListings).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>eBay Listings</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Store</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td>{l.listingDraft?.title}</td>
              <td>{l.store?.name}</td>
              <td>${l.currentPrice}</td>
              <td>{l.quantity}</td>
              <td>{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {listings.length === 0 && <p>No listings yet — run the dry-run pipeline from Overview.</p>}
    </div>
  );
}
