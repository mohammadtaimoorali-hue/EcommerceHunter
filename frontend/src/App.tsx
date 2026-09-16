import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import ProductHunter from './pages/ProductHunter';
import ListingQueue from './pages/ListingQueue';
import EbayListings from './pages/EbayListings';
import Sources from './pages/Sources';
import SystemSettings from './pages/SystemSettings';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="sidebar">
          <h2>ecom-hunter</h2>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/products">Product Hunter</NavLink>
          <NavLink to="/listing-queue">Listing Queue</NavLink>
          <NavLink to="/ebay-listings">eBay Listings</NavLink>
          <NavLink to="/sources">Sources</NavLink>
          <NavLink to="/settings">System / Settings</NavLink>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/products" element={<ProductHunter />} />
            <Route path="/listing-queue" element={<ListingQueue />} />
            <Route path="/ebay-listings" element={<EbayListings />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/settings" element={<SystemSettings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
