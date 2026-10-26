// Small inline SVG icons (stroke = currentColor) so nothing needs a network fetch.
const s = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  sun: s('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: s('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  cloud: s('<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18Z"/>'),
  partly: s('<path d="M8.5 5.5a3.5 3.5 0 0 1 5.6 1.6"/><path d="M8 19h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 11a4 4 0 0 0 0 8Z"/>'),
  rain: s('<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 6.1 4.5 4.5 0 0 0 7 15Z"/><path d="M8 18.5 7 21M12 18.5 11 21M16 18.5 15 21"/>'),
  snow: s('<path d="M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 5.1 4.5 4.5 0 0 0 7 14Z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/>'),
  storm: s('<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 6.1 4.5 4.5 0 0 0 7 15Z"/><path d="m12 15-2 4h4l-2 4"/>'),
  fog: s('<path d="M4 9h16M3 13h18M5 17h14"/>'),
  shirt: s('<path d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z"/>'),
  umbrella: s('<path d="M3 12a9 9 0 0 1 18 0Z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>'),
  more: s('<path d="m9 5 7 7-7 7"/>'),
  appearance: s('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
  pen: s('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'),
  mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  phone: s('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
};

export function weatherIcon(code, isDay) {
  if (code === 0 || code === 1) return isDay ? ICONS.sun : ICONS.moon;
  if (code === 2) return ICONS.partly;
  if (code === 3) return ICONS.cloud;
  if (code === 45 || code === 48) return ICONS.fog;
  if (code >= 51 && code <= 67) return ICONS.rain;
  if (code >= 71 && code <= 77) return ICONS.snow;
  if (code >= 80 && code <= 82) return ICONS.rain;
  if (code >= 85 && code <= 86) return ICONS.snow;
  if (code >= 95) return ICONS.storm;
  return ICONS.cloud;
}

export function weatherLabel(code) {
  const map = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog",
    51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow",
    80: "Showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers",
    95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  return map[code] || "—";
}

// Brand colours for app tiles when the TV gives no banner image (and in the browser preview).
export const BRANDS = {
  "com.netflix.ninja": { word: "NETFLIX", bg: "linear-gradient(135deg,#1a0004,#3a0008)", fg: "#e50914" },
  "com.google.android.youtube.tv": { word: "YouTube", bg: "linear-gradient(135deg,#ff2a2a,#b80000)", fg: "#fff" },
  "com.apple.atve.androidtv.appletv": { word: "tv", bg: "linear-gradient(135deg,#2a2d36,#0d0e12)", fg: "#fff" },
  "com.wbd.stream": { word: "max", bg: "linear-gradient(135deg,#0026ff,#002bb3)", fg: "#fff" },
  "com.hulu.livingroomplus": { word: "hulu", bg: "linear-gradient(135deg,#0b1c16,#10291f)", fg: "#1ce783" },
  "com.disney.disneyplus": { word: "Disney+", bg: "linear-gradient(135deg,#0e2a78,#05103a)", fg: "#fff" },
  "com.amazon.amazonvideo.livingroom": { word: "prime", bg: "linear-gradient(135deg,#0f79af,#0a3d62)", fg: "#fff" },
  "com.spotify.tv.android": { word: "Spotify", bg: "linear-gradient(135deg,#121212,#1f1f1f)", fg: "#1ed760" },
  "com.plexapp.android": { word: "plex", bg: "linear-gradient(135deg,#1f1f1f,#2b2b2b)", fg: "#e5a00d" },
  "com.google.android.youtube.tvmusic": { word: "Music", bg: "linear-gradient(135deg,#ff0033,#7a0018)", fg: "#fff" },
  "com.android.tv.settings": { word: "Settings", bg: "linear-gradient(135deg,#3a3f4b,#22252c)", fg: "#fff" },
};
