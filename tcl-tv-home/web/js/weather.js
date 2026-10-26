// Weather from Open-Meteo (free, no API key) + a "what to wear" tip.

import { getSettings } from "./store.js";
import { ICONS, weatherIcon, weatherLabel } from "./icons.js";

let latest = []; // last fetched results, also given to the assistant as context

export function weatherSummary() {
  const unit = getSettings().units === "C" ? "C" : "F";
  return latest
    .map((w) => `${w.name}: ${Math.round(w.temp)}°${unit}, ${weatherLabel(w.code)}, high ${Math.round(w.hi)}° low ${Math.round(w.lo)}°`)
    .join("; ");
}

export async function geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();
  const r = data.results && data.results[0];
  if (!r) return null;
  return { name: r.name, lat: r.latitude, lon: r.longitude };
}

async function fetchCity(city, units) {
  const params = new URLSearchParams({
    latitude: city.lat, longitude: city.lon,
    current: "temperature_2m,weather_code,is_day",
    hourly: "temperature_2m,precipitation_probability",
    daily: "temperature_2m_max,temperature_2m_min",
    temperature_unit: units === "C" ? "celsius" : "fahrenheit",
    timezone: "auto", forecast_days: "2",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const d = await res.json();
  return {
    name: city.name,
    temp: d.current.temperature_2m,
    code: d.current.weather_code,
    isDay: d.current.is_day === 1,
    hi: d.daily.temperature_2m_max[0],
    lo: d.daily.temperature_2m_min[0],
    hourly: d.hourly,
    utcOffset: d.utc_offset_seconds,
  };
}

// Tip like "Light jacket · cools to 53° by 10 PM", based on the first city.
function buildTip(w, units) {
  const F = (c) => (units === "C" ? c * 9 / 5 + 32 : c);
  // Look at the next ~12 hours of the forecast.
  const nowLocal = new Date(Date.now() + (w.utcOffset + new Date().getTimezoneOffset() * 60) * 1000);
  const times = w.hourly.time.map((t) => new Date(t));
  let minT = w.temp, minAt = null, rain = 0;
  times.forEach((t, i) => {
    const dh = (t - nowLocal) / 3600000;
    if (dh > 0 && dh <= 12) {
      const temp = w.hourly.temperature_2m[i];
      if (temp < minT) { minT = temp; minAt = t; }
      rain = Math.max(rain, w.hourly.precipitation_probability[i] || 0);
    }
  });
  const coldest = F(minT);
  let wear, icon = ICONS.shirt;
  if (rain >= 50) { wear = "Bring an umbrella"; icon = ICONS.umbrella; }
  else if (coldest < 45) wear = "Warm coat";
  else if (coldest < 58) wear = "Light jacket";
  else if (coldest < 70) wear = "Long sleeves";
  else wear = "T-shirt weather";
  let detail = "";
  if (minAt && minT < w.temp - 2) {
    const hr = minAt.getHours();
    const label = getSettings().clock24 ? `${String(hr).padStart(2, "0")}:00` : `${hr % 12 || 12} ${hr < 12 ? "AM" : "PM"}`;
    detail = `cools to ${Math.round(minT)}° by ${label}`;
  } else if (rain >= 30) {
    detail = `${rain}% chance of rain`;
  } else {
    detail = `high of ${Math.round(w.hi)}°`;
  }
  return `${icon}<b>${wear}</b><span style="opacity:.75">· ${detail}</span>`;
}

export async function refreshWeather() {
  const s = getSettings();
  const box = document.getElementById("weather");
  const tip = document.getElementById("tip");
  const cities = (s.cities || []).filter((c) => c && c.lat != null).slice(0, 2);
  if (!cities.length) { box.innerHTML = ""; tip.classList.add("hidden"); return; }
  try {
    latest = await Promise.all(cities.map((c) => fetchCity(c, s.units)));
    box.innerHTML = latest.map((w) => `
      <div class="wx">
        ${weatherIcon(w.code, w.isDay)}
        <span class="t">${Math.round(w.temp)}°</span>
        <span class="meta"><b>${escapeHtml(w.name)}</b><br>${weatherLabel(w.code)} · ${Math.round(w.hi)}° / ${Math.round(w.lo)}°</span>
      </div>`).join("");
    tip.innerHTML = buildTip(latest[0], s.units);
    tip.classList.remove("hidden");
  } catch (e) {
    // Offline: keep whatever was shown last.
    console.warn("weather failed", e);
  }
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
