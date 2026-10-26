// Settings + small persisted state. Everything lives in localStorage on the TV.
// Every access is wrapped: storage can be unavailable and the UI must still work.

const KEY = "tvhome.settings.v1";
const MSG_KEY = "tvhome.messages.v1";

export const DEFAULTS = {
  name: "",
  cities: [
    { name: "San Francisco", lat: 37.7749, lon: -122.4194 },
  ],
  units: "F",            // "F" | "C"
  clock24: false,
  wallpaper: "living",   // "living" | "photos"
  photoUrls: [],
  accent: "#8fb4ff",
  ambientMinutes: 5,     // 0 = off
  nightDim: true,
  apiKey: "",
  voiceReplies: true,
  favorites: [],         // package names, in dock order (empty = auto)
  effects: "auto",       // "auto" (fast on TVs) | "fast" | "fancy"
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

const listeners = new Set();
let settings = Object.assign({}, DEFAULTS, read(KEY, {}));

export function getSettings() { return settings; }

export function updateSettings(patch) {
  settings = Object.assign({}, settings, patch);
  write(KEY, settings);
  listeners.forEach((fn) => fn(settings, patch));
}

export function onSettings(fn) { listeners.add(fn); }

// ----- messages (notes and drawings pinned to the home screen) -----
export function loadMessages() {
  const now = Date.now();
  return read(MSG_KEY, []).filter((m) => !m.expiresAt || m.expiresAt > now);
}

export function saveMessages(list) {
  // Keep storage small: newest 8 only.
  write(MSG_KEY, list.slice(-8));
}
