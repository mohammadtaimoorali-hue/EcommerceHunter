// Appearance panel. Every control is reachable with the D-pad.
// Text fields open the TV keyboard when you press OK on them.

import { registerLayer, setFocus } from "./nav.js";
import { getSettings, updateSettings } from "./store.js";
import { geocode, escapeHtml } from "./weather.js";
import { phoneInfo, isTV, openSystemSettings } from "./bridge.js";

const ACCENTS = ["#8fb4ff", "#ff8ad8", "#ffb547", "#5ce08a", "#a78bff", "#5cc8ff", "#ffffff"];
const AMBIENT = [0, 2, 5, 10, 30];

let hooks = {};

function row(label, help, control, extra = "") {
  return `<div class="row ${extra}"><div><label>${label}</label>${help ? `<small>${help}</small>` : ""}</div>${control}</div>`;
}

function cycleRow(id, label, help, value) {
  return `<div class="row" data-nav data-cycle="${id}"><div><label>${label}</label>${help ? `<small>${help}</small>` : ""}</div><span class="val">${value}</span></div>`;
}

function render() {
  const s = getSettings();
  const body = document.getElementById("settings-body");
  const p = phoneInfo();
  const city = (i) => escapeHtml((s.cities[i] && s.cities[i].name) || "");
  body.innerHTML = [
    `<p class="section-title">You</p>`,
    row("Your name", "Used in the greeting", `<input data-nav data-field="name" type="text" value="${escapeHtml(s.name)}" placeholder="e.g. Sam">`),
    cycleRow("clock24", "Clock", "12 or 24 hour", s.clock24 ? "24-hour" : "12-hour"),

    `<p class="section-title">Weather</p>`,
    row("City 1", "Shown first, used for the outfit tip", `<input data-nav data-city="0" type="text" value="${city(0)}" placeholder="City name">`),
    row("City 2", "Optional", `<input data-nav data-city="1" type="text" value="${city(1)}" placeholder="City name">`),
    cycleRow("units", "Units", "", s.units === "C" ? "°C" : "°F"),

    `<p class="section-title">Look</p>`,
    cycleRow("wallpaper", "Wallpaper", "Living follows the sun · Photos uses your links", s.wallpaper === "photos" ? "Photos" : "Living"),
    cycleRow("accent", "Accent glow", "", `<span style="display:inline-block;width:1.2rem;height:1.2rem;border-radius:50%;vertical-align:middle;background:${s.accent}"></span>`),
    row("Photo links", "One image URL per line", `<textarea data-nav data-field="photoUrls" placeholder="https://…/photo.jpg">${escapeHtml(s.photoUrls.join("\n"))}</textarea>`, "wide"),
    cycleRow("ambientMinutes", "Ambient mode", "Hide the dock when idle", s.ambientMinutes ? `After ${s.ambientMinutes} min` : "Off"),
    cycleRow("effects", "Visual effects", "Fast keeps it smooth on TVs · Fancy adds frosted glass and motion",
      s.effects === "fancy" ? "Fancy" : s.effects === "fast" ? "Fast" : (isTV ? "Fast (auto)" : "Fancy (auto)")),
    cycleRow("nightDim", "Night warmth", "Dim and warm the screen 10 PM–6 AM", s.nightDim ? "On" : "Off"),

    `<p class="section-title">Assistant</p>`,
    row("Claude API key", "From console.anthropic.com · stored only on this TV", `<input data-nav data-field="apiKey" type="password" value="${escapeHtml(s.apiKey)}" placeholder="sk-ant-…">`),
    cycleRow("voiceReplies", "Spoken replies", "", s.voiceReplies ? "On" : "Off"),

    `<p class="section-title">Apps & phone</p>`,
    `<div class="row" data-nav data-action="favorites"><div><label>Choose dock apps</label><small>Pick and order your favourites</small></div><span class="val">Edit</span></div>`,
    isTV ? `<div class="row" data-nav data-action="system"><div><label>TV settings</label><small>Picture, sound, network</small></div><span class="val">Open</span></div>` : "",
    p ? row("Phone remote", "On your phone (same Wi-Fi), open this address and enter the PIN",
      `<span class="phone-box"><code>http://${escapeHtml(p.ip)}:${p.port}</code> PIN <code>${escapeHtml(p.pin)}</code></span>`, "wide")
      : row("Phone remote", "Available when running as the TV app", `<span class="val">TV only</span>`, "wide"),
  ].join("");

  body.querySelectorAll("[data-cycle]").forEach((el) => el.addEventListener("click", () => cycle(el.getAttribute("data-cycle"))));
  body.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", () => {
    const a = el.getAttribute("data-action");
    if (a === "favorites" && hooks.pickFavorites) hooks.pickFavorites();
    if (a === "system") openSystemSettings();
  }));
  body.querySelectorAll("[data-field]").forEach((el) => el.addEventListener("change", () => {
    const f = el.getAttribute("data-field");
    if (f === "photoUrls") updateSettings({ photoUrls: el.value.split(/\s+/).map((x) => x.trim()).filter(Boolean) });
    else updateSettings({ [f]: el.value.trim() });
  }));
  body.querySelectorAll("[data-city]").forEach((el) => el.addEventListener("change", async () => {
    const i = Number(el.getAttribute("data-city"));
    const cities = getSettings().cities.slice();
    const name = el.value.trim();
    if (!name) { cities.splice(i, 1); updateSettings({ cities }); return; }
    try {
      const found = await geocode(name);
      if (!found) { hooks.toast && hooks.toast(`Couldn't find “${name}”`); return; }
      cities[i] = found;
      updateSettings({ cities: cities.filter(Boolean) });
      el.value = found.name;
      hooks.toast && hooks.toast(`Weather set to ${found.name}`);
    } catch (e) {
      hooks.toast && hooks.toast("No internet connection");
    }
  }));
}

function cycle(key) {
  const s = getSettings();
  const next = {
    clock24: () => ({ clock24: !s.clock24 }),
    units: () => ({ units: s.units === "C" ? "F" : "C" }),
    wallpaper: () => ({ wallpaper: s.wallpaper === "photos" ? "living" : "photos" }),
    accent: () => ({ accent: ACCENTS[(ACCENTS.indexOf(s.accent) + 1) % ACCENTS.length] }),
    ambientMinutes: () => ({ ambientMinutes: AMBIENT[(AMBIENT.indexOf(s.ambientMinutes) + 1) % AMBIENT.length] }),
    nightDim: () => ({ nightDim: !s.nightDim }),
    voiceReplies: () => ({ voiceReplies: !s.voiceReplies }),
    effects: () => {
      const fast = s.effects === "fast" || (s.effects !== "fancy" && isTV);
      return { effects: fast ? "fancy" : "fast" };
    },
  }[key];
  if (!next) return;
  updateSettings(next());
  render();
  setFocus(document.querySelector(`[data-cycle="${key}"]`));
}

export function initSettings(h) {
  hooks = h;
  registerLayer("settings", { onShow: render });
}
