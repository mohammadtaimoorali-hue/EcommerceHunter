// Thin wrapper over the Android app's JavaScript interface (window.Android).
// When the page runs in a normal desktop browser there is no bridge, so every
// call has a browser fallback. That makes the whole UI testable on a laptop.

const A = typeof window !== "undefined" ? window.Android : undefined;
export const isTV = !!A;

// Demo apps for the browser preview. Package names are the real Android TV ones,
// so the same favorites list works once the APK is installed.
const DEMO_APPS = [
  { pkg: "com.netflix.ninja", label: "Netflix" },
  { pkg: "com.google.android.youtube.tv", label: "YouTube" },
  { pkg: "com.apple.atve.androidtv.appletv", label: "Apple TV" },
  { pkg: "com.wbd.stream", label: "Max" },
  { pkg: "com.hulu.livingroomplus", label: "Hulu" },
  { pkg: "com.disney.disneyplus", label: "Disney+" },
  { pkg: "com.amazon.amazonvideo.livingroom", label: "Prime Video" },
  { pkg: "com.spotify.tv.android", label: "Spotify" },
  { pkg: "com.plexapp.android", label: "Plex" },
  { pkg: "com.google.android.youtube.tvmusic", label: "YouTube Music" },
  { pkg: "com.android.tv.settings", label: "Settings" },
];

let appsCache = null;

export function getApps() {
  if (appsCache) return appsCache;
  if (A && A.getApps) {
    try { appsCache = JSON.parse(A.getApps()); } catch (e) { appsCache = []; }
  } else {
    appsCache = DEMO_APPS.slice();
  }
  return appsCache;
}

export function refreshApps() { appsCache = null; return getApps(); }

export function launchApp(pkg) {
  if (A && A.launchApp) return A.launchApp(pkg);
  return false;
}

export function openUrl(url, pkg) {
  if (A && A.openUrl) return A.openUrl(url, pkg || "");
  window.open(url, "_blank");
  return true;
}

// Opens YouTube's own search on the TV. Returns false when not possible.
export function youtubeSearch(query) {
  if (A && A.youtubeSearch) return A.youtubeSearch(query);
  return false;
}

export function openSystemSettings() {
  if (A && A.openSystemSettings) A.openSystemSettings();
}

export function phoneInfo() {
  if (A && A.getPhoneInfo) {
    try { return JSON.parse(A.getPhoneInfo()); } catch (e) { /* fall through */ }
  }
  return null;
}

// ----- speech -----
export function canListen() {
  return !!(A && A.startVoice) || "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

// Resolves with the recognised text, or "" if nothing was heard.
export function listen() {
  return new Promise((resolve) => {
    if (A && A.startVoice) {
      window.__voiceResolve = resolve; // called by tvBus.onVoice from the app
      A.startVoice();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { resolve(""); return; }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    rec.onresult = (e) => { done = true; resolve(e.results[0][0].transcript || ""); };
    rec.onerror = () => { if (!done) { done = true; resolve(""); } };
    rec.onend = () => { if (!done) { done = true; resolve(""); } };
    rec.start();
  });
}

export function speak(text) {
  if (!text) return;
  if (A && A.speak) { A.speak(text); return; }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }
}

export function stopSpeaking() {
  if (A && A.stopSpeaking) { A.stopSpeaking(); return; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
