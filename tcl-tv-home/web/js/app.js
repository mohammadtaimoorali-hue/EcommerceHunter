// TV Home: clock, weather, dock, notes, timers, ambient mode and the tvBus
// entry point used by the Android app and the phone remote.

import { getSettings, onSettings, updateSettings, loadMessages, saveMessages } from "./store.js";
import { registerLayer, openLayer, closeTop, goHome, current, handleKey, back, setFocus, focused, refocus, initPointer } from "./nav.js";
import { getApps, refreshApps, launchApp, openUrl, youtubeSearch, speak, isTV } from "./bridge.js";
import { ICONS, BRANDS } from "./icons.js";
import { startWallpaper, applyWallpaper } from "./wallpaper.js";
import { refreshWeather, escapeHtml, geocode } from "./weather.js";
import { initDraw, openDraw, remoteStroke, clearDrawing, pinFromPhone } from "./draw.js";
import { initAssistant, openAssistant, askFromText, onVoiceResult } from "./assistant.js";
import { initSettings } from "./settings.js";

const $ = (id) => document.getElementById(id);

// Apps shown in the dock by default, in this order, when they are installed.
const PREFERRED = [
  "com.netflix.ninja", "com.google.android.youtube.tv", "com.apple.atve.androidtv.appletv",
  "com.wbd.stream", "com.hulu.livingroomplus", "com.disney.disneyplus",
  "com.amazon.amazonvideo.livingroom", "com.spotify.tv.android", "com.plexapp.android",
];
const MAX_DOCK = 10; // the dock scrolls, so it can hold more than fits on screen
const ALIASES = { hbo: "max", "hbo max": "max", prime: "prime video", amazon: "prime video", "disney plus": "disney+", "apple tv plus": "apple tv", "apple tv+": "apple tv", "youtube tv": "youtube" };

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

// ---------------------------------------------------------------- clock
function tick() {
  const s = getSettings();
  const now = new Date();
  const h = now.getHours(), m = String(now.getMinutes()).padStart(2, "0");
  $("time").textContent = s.clock24 ? `${String(h).padStart(2, "0")}:${m}` : `${h % 12 || 12}:${m}`;
  $("ampm").textContent = s.clock24 ? "" : (h < 12 ? "AM" : "PM");
  $("date").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const part = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  $("greeting").textContent = s.name ? `${part}, ${s.name}` : part;
  document.body.classList.toggle("night", s.nightDim && (h >= 22 || h < 6));
}

// ---------------------------------------------------------------- tiles
// Tint a tile with the average colour of an app's icon, so icon-only apps
// (no TV banner) still get a full, rich tile instead of a grey box.
const tintCache = new Map();
function tintFromIcon(tile, src) {
  if (tintCache.has(src)) { tile.style.background = tintCache.get(src); return; }
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, 8, 8);
      const d = x.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue; // skip transparent corners
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      const bg = `linear-gradient(145deg, rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)}), rgb(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)}))`;
      tintCache.set(src, bg);
      tile.style.background = bg;
    } catch (e) { /* keep the default tile colour */ }
  };
  img.src = src;
}

function appTile(app, opts = {}) {
  const b = document.createElement("button");
  b.className = "tile";
  b.setAttribute("data-nav", "");
  b.setAttribute("data-pkg", app.pkg);
  const brand = BRANDS[app.pkg];
  let face;
  if (app.banner) {
    face = `<img class="banner" src="${app.banner}" alt="">`;
  } else if (brand) {
    b.style.background = brand.bg;
    face = `<span class="word" style="color:${brand.fg}">${escapeHtml(brand.word)}</span>`;
  } else if (app.icon) {
    face = `<img class="icon" src="${app.icon}" alt="">`;
    tintFromIcon(b, app.icon);
  } else {
    face = `<span class="word">${escapeHtml(app.label.slice(0, 1))}</span>`;
  }
  b.innerHTML = `<span class="face">${face}<span class="gloss"></span></span><span class="label">${escapeHtml(app.label)}</span>${opts.star ? '<span class="star">★</span>' : ""}`;
  return b;
}

function iconTile(icon, label, onClick) {
  const b = document.createElement("button");
  b.className = "tile round";
  b.setAttribute("data-nav", "");
  b.setAttribute("data-key", label);
  b.innerHTML = `<span class="face">${icon}<span class="gloss"></span></span><span class="label">${label}</span>`;
  b.addEventListener("click", onClick);
  return b;
}

// Slide the dock track so the focused tile always has room on screen.
let trackX = 0;
function keepInView(el) {
  const track = el.parentElement;
  if (!track || !track.classList.contains("track")) return;
  const margin = window.innerWidth * 0.08;
  // offsetLeft ignores the tile's own lift/scale, so the maths stays stable.
  const left = el.offsetLeft + trackX, right = left + el.offsetWidth;
  let next = trackX;
  if (right > window.innerWidth - margin) next -= right - (window.innerWidth - margin);
  if (left < margin) next += margin - left;
  const maxShift = Math.min(0, window.innerWidth - (track.scrollWidth));
  next = Math.max(maxShift, Math.min(0, next));
  if (next !== trackX) {
    trackX = next;
    track.style.transform = `translate3d(${trackX}px,0,0)`;
  }
  updateEdges(track);
}

function updateEdges(track) {
  const dock = $("dock");
  dock.classList.toggle("more-left", trackX < -1);
  dock.classList.toggle("more-right", track.scrollWidth + trackX > window.innerWidth + 1);
}

// A quick "press" when a tile is opened.
function press(el) {
  el.classList.add("pressed");
  setTimeout(() => el.classList.remove("pressed"), 140);
}

function favoriteApps() {
  const apps = getApps();
  const byPkg = new Map(apps.map((a) => [a.pkg, a]));
  const fav = getSettings().favorites;
  let list = (fav.length ? fav : PREFERRED).map((p) => byPkg.get(p)).filter(Boolean);
  if (!fav.length) list = list.slice(0, 6); // a calm default; choose more in Appearance
  if (!list.length) list = apps.filter((a) => a.pkg !== "com.android.tv.settings").slice(0, 6);
  return list.slice(0, MAX_DOCK);
}

function openApp(app) {
  if (launchApp(app.pkg)) return;
  toast(isTV ? `Couldn't open ${app.label}` : `Preview: this would open ${app.label}`);
}

function renderDock() {
  const dock = $("dock");
  const f = focused();
  const keep = f && dock.contains(f) ? (f.getAttribute("data-pkg") || f.getAttribute("data-key")) : null;
  dock.innerHTML = "";
  const track = document.createElement("div");
  track.className = "track";
  favoriteApps().forEach((app) => {
    const t = appTile(app);
    t.addEventListener("click", () => { press(t); setTimeout(() => openApp(app), 120); });
    track.appendChild(t);
  });
  const sep = document.createElement("span");
  sep.className = "dock-sep";
  track.appendChild(sep);
  track.appendChild(iconTile(ICONS.more, "All apps", () => openLayer("apps", "open")));
  track.appendChild(iconTile(ICONS.pen, "Draw", () => openDraw()));
  track.appendChild(iconTile(ICONS.mic, "Ask", () => openAssistant()));
  track.appendChild(iconTile(ICONS.appearance, "Appearance", () => openLayer("settings")));
  dock.appendChild(track);
  trackX = 0;
  updateEdges(track);
  if (current() === "home") {
    const again = keep && Array.from(track.children).find((c) => c.getAttribute("data-pkg") === keep || c.getAttribute("data-key") === keep);
    setFocus(again || track.firstElementChild);
  }
}

// ---------------------------------------------------------------- all apps
let appsMode = "open";
function renderApps() {
  const grid = $("apps-grid");
  const fav = getSettings().favorites.length ? getSettings().favorites : favoriteApps().map((a) => a.pkg);
  $("apps-title").textContent = appsMode === "pick" ? "Choose dock apps" : "All apps";
  $("apps-hint").textContent = appsMode === "pick" ? `OK adds or removes ★ · up to ${MAX_DOCK} · Back when done` : "Press OK to open";
  grid.innerHTML = "";
  getApps().slice().sort((a, b) => a.label.localeCompare(b.label)).forEach((app) => {
    const t = appTile(app, { star: appsMode === "pick" && fav.includes(app.pkg) });
    t.addEventListener("click", () => {
      if (appsMode === "open") { openApp(app); return; }
      let list = fav.slice();
      if (list.includes(app.pkg)) list = list.filter((p) => p !== app.pkg);
      else if (list.length < MAX_DOCK) list.push(app.pkg);
      else { toast(`The dock holds ${MAX_DOCK} apps. Remove one first.`); return; }
      updateSettings({ favorites: list });
      renderApps();
      setFocus(grid.querySelector(`[data-pkg="${app.pkg}"]`));
    });
    grid.appendChild(t);
  });
}

// ---------------------------------------------------------------- notes
let messages = loadMessages();
function renderMessages() {
  const box = $("messages");
  box.innerHTML = "";
  messages.slice(-4).reverse().forEach((m) => {
    const el = document.createElement("div");
    el.className = m.image ? "note drawing" : "note";
    el.setAttribute("data-nav", "");
    if (m.color) el.style.background = m.color;
    const when = new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    el.innerHTML = (m.image ? `<img src="${m.image}" alt="Drawing">` : escapeHtml(m.text)) +
      `<span class="from">${escapeHtml(m.from || "Note")} · ${when}</span>`;
    el.addEventListener("click", () => {
      messages = messages.filter((x) => x.id !== m.id);
      saveMessages(messages);
      renderMessages();
      refocus();
    });
    box.appendChild(el);
  });
}

function addMessage(m) {
  messages.push(Object.assign({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() }, m));
  messages = messages.slice(-8);
  saveMessages(messages);
  renderMessages();
  wake();
  chime(660);
}

function pinNote(text, from, minutes, color) {
  if (!text) return "There was nothing to pin.";
  addMessage({ text: String(text).slice(0, 280), from: from || "Note", color: color || "", expiresAt: minutes ? Date.now() + minutes * 60000 : 0 });
  return "Pinned it to the home screen.";
}

// Expire notes in the background.
setInterval(() => {
  const before = messages.length;
  messages = messages.filter((m) => !m.expiresAt || m.expiresAt > Date.now());
  if (messages.length !== before) { saveMessages(messages); renderMessages(); }
}, 30000);

// ---------------------------------------------------------------- timers
let timers = [];
function setTimer(minutes, label) {
  const ms = Math.max(5, Math.round(minutes * 60)) * 1000;
  timers.push({ id: Date.now(), label: label || "", endAt: Date.now() + ms, done: false });
  renderTimers();
  const mins = ms / 60000;
  const nice = mins >= 1 ? `${+mins.toFixed(1)} minute${mins === 1 ? "" : "s"}` : `${Math.round(ms / 1000)} seconds`;
  return `${label ? label + " timer" : "Timer"} set for ${nice}.`;
}

function renderTimers() {
  const box = $("timers");
  box.innerHTML = timers.map((t) => {
    const left = Math.max(0, t.endAt - Date.now());
    const mm = Math.floor(left / 60000), ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
    const hh = Math.floor(mm / 60);
    const txt = hh ? `${hh}:${String(mm % 60).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
    return `<div class="pill timer${t.done ? " done" : ""}">⏱ ${t.label ? escapeHtml(t.label) + " · " : ""}${t.done ? "Done!" : txt}</div>`;
  }).join("");
}

setInterval(() => {
  if (!timers.length) return;
  timers.forEach((t) => {
    if (!t.done && t.endAt <= Date.now()) {
      t.done = true;
      wake();
      chime(880); setTimeout(() => chime(880), 450); setTimeout(() => chime(1175), 900);
      const msg = `${t.label ? "Your " + t.label + " timer" : "Your timer"} is done.`;
      toast(msg);
      speak(msg);
      setTimeout(() => { timers = timers.filter((x) => x !== t); renderTimers(); }, 60000);
    }
  });
  renderTimers();
}, 1000);

// ---------------------------------------------------------------- sound
let audio;
function chime(freq) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.8);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.85);
  } catch (e) { /* audio not available */ }
}

// ---------------------------------------------------------------- ambient
let lastInput = Date.now();
function wake() {
  lastInput = Date.now();
  if (document.body.classList.contains("ambient")) {
    document.body.classList.remove("ambient");
    return true;
  }
  return false;
}
function goAmbient() {
  goHome();
  document.body.classList.add("ambient");
}
setInterval(() => {
  const mins = getSettings().ambientMinutes;
  if (mins && current() === "home" && Date.now() - lastInput > mins * 60000) document.body.classList.add("ambient");
}, 10000);

// ---------------------------------------------------------------- app lookup for voice
function findApp(name) {
  let q = String(name).toLowerCase().replace(/^the\s+/, "").replace(/\s+app$/, "").trim();
  q = ALIASES[q] || q;
  const norm = (x) => x.toLowerCase().replace(/\+/g, " plus").replace(/[^a-z0-9]/g, "");
  const nq = norm(q);
  if (!nq) return null;
  const apps = getApps();
  return apps.find((a) => norm(a.label) === nq) ||
    apps.find((a) => norm(a.label).startsWith(nq)) ||
    apps.find((a) => norm(a.label).includes(nq) || nq.includes(norm(a.label)));
}

const actions = {
  appNames: () => getApps().map((a) => a.label),
  openApp(name) {
    const app = findApp(name);
    if (!app) return { ok: false, message: `I couldn't find an app called ${name} on this TV.` };
    setTimeout(() => openApp(app), 900); // let the reply show first
    return { ok: true, message: `Opening ${app.label}.` };
  },
  youtube(query) {
    setTimeout(() => {
      if (!youtubeSearch(query)) openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    }, 900);
    return `Searching YouTube for ${query}.`;
  },
  setTimer,
  pinNote: (text) => pinNote(text, "Assistant"),
  openDraw: () => setTimeout(openDraw, 600),
  clearDrawing,
  clearMessages() { messages = []; saveMessages(messages); renderMessages(); },
  ambient: goAmbient,
  settings: () => openLayer("settings"),
};

// ---------------------------------------------------------------- tvBus
// Entry point for the Android app (keys, voice results) and the phone remote.
const KEYMAP = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", ok: "Enter" };

window.tvBus = {
  receive(msg) {
    if (!msg || typeof msg !== "object") return;
    const woke = wake();
    switch (msg.type) {
      case "stroke":
        if (current() !== "draw") openDraw();
        remoteStroke(msg);
        break;
      case "draw":
        if (msg.action === "open") openDraw();
        if (msg.action === "clear") clearDrawing();
        if (msg.action === "pin") { pinFromPhone(); if (current() === "draw") closeTop(); }
        if (msg.action === "close" && current() === "draw") closeTop();
        break;
      case "note":
        pinNote(msg.text, msg.from || "Phone", Number(msg.minutes) || 0, msg.color);
        toast(`New note from ${msg.from || "your phone"}`);
        break;
      case "ask":
        if (msg.text) askFromText(String(msg.text));
        break;
      case "timer":
        toast(setTimer(Number(msg.minutes) || 1, msg.label || ""));
        break;
      case "launch": {
        const app = getApps().find((a) => a.pkg === msg.pkg);
        if (app) openApp(app);
        break;
      }
      case "key":
        if (woke) break;
        if (msg.key === "back") back();
        else if (msg.key === "home") goHome();
        else if (KEYMAP[msg.key]) handleKey(new KeyboardEvent("keydown", { key: KEYMAP[msg.key] }));
        break;
      case "settings":
        applyRemoteSettings(msg);
        break;
      default:
        break;
    }
  },
  back() { if (wake()) return true; return back(); },
  key(name) {
    if (wake() && name !== "assistant") return;
    if (name === "assistant") openAssistant();
    if (name === "draw") openDraw();
    if (name === "ambient") goAmbient();
    if (name === "settings") openLayer("settings");
    if (name === "home") { goHome(); }
  },
  onVoice(text) { onVoiceResult(text); },
  onResume() {
    goHome();
    tick();
    // Weather is refreshed every 15 minutes anyway; only fetch if it is stale.
    if (Date.now() - lastWeatherAt > 15 * 60 * 1000) { lastWeatherAt = Date.now(); refreshWeather(); }
  },
  appsChanged() { refreshApps(); renderDock(); if (current() === "apps") renderApps(); },
};

async function applyRemoteSettings(msg) {
  const patch = {};
  if (typeof msg.apiKey === "string" && msg.apiKey.trim()) patch.apiKey = msg.apiKey.trim();
  if (typeof msg.name === "string" && msg.name.trim()) patch.name = msg.name.trim();
  if (Object.keys(patch).length) updateSettings(patch);
  if (typeof msg.city === "string" && msg.city.trim()) {
    try {
      const found = await geocode(msg.city.trim());
      if (found) { updateSettings({ cities: [found].concat(getSettings().cities.slice(1, 2)) }); toast(`Weather set to ${found.name}`); }
    } catch (e) { /* offline */ }
  }
  if (patch.apiKey) toast("Claude API key saved");
}

// ---------------------------------------------------------------- boot
let lastWeatherAt = 0;
function applyAccent(color) {
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-glow", `rgba(${r},${g},${b},0.45)`);
  document.documentElement.style.setProperty("--accent-soft", `rgba(${r},${g},${b},0.35)`);
}

// Fast mode: solid panels and a still wallpaper. On by default on the TV.
function applyEffects() {
  const e = getSettings().effects;
  document.body.classList.toggle("lite", e === "fast" || (e !== "fancy" && isTV));
}

function boot() {
  applyEffects();
  applyAccent(getSettings().accent);
  registerLayer("home", {});
  registerLayer("apps", {
    onShow(mode) { appsMode = mode || "open"; renderApps(); },
    onHide() { if (appsMode === "pick") renderDock(); },
  });
  initDraw((png) => addMessage({ image: png, from: "Drawing" }));
  initAssistant(actions);
  initSettings({ toast, pickFavorites: () => { closeTop(true); openLayer("apps", "pick"); } });
  initPointer();
  document.addEventListener("navfocus", (e) => keepInView(e.target));
  openLayer("home");

  tick();
  setInterval(tick, 1000);
  renderDock();
  renderMessages();
  startWallpaper();
  lastWeatherAt = Date.now();
  refreshWeather();
  setInterval(() => { lastWeatherAt = Date.now(); refreshWeather(); }, 15 * 60 * 1000);

  onSettings((s, patch) => {
    if ("accent" in patch) applyAccent(s.accent);
    if ("effects" in patch) { applyEffects(); applyWallpaper(); }
    if ("wallpaper" in patch || "photoUrls" in patch) applyWallpaper();
    if ("cities" in patch || "units" in patch || "clock24" in patch) refreshWeather();
    if ("favorites" in patch && current() === "home") renderDock();
    tick();
  });

  document.addEventListener("keydown", (e) => {
    if (wake()) { e.preventDefault(); return; } // first key just wakes the screen
    // Colour buttons and shortcuts on remotes/keyboards.
    if (e.key === "ColorF0Red" || e.key === "F1") { openDraw(); e.preventDefault(); return; }
    if (e.key === "ColorF1Green" || e.key === "F2") { openAssistant(); e.preventDefault(); return; }
    if (e.key === "ColorF3Blue" || e.key === "F4") { goAmbient(); e.preventDefault(); return; }
    if (e.key === "ContextMenu") { openLayer("settings"); e.preventDefault(); return; }
    handleKey(e);
  });
  document.addEventListener("pointermove", () => { lastInput = Date.now(); }, { passive: true });
  document.addEventListener("click", () => { wake(); }, true);
}

boot();
