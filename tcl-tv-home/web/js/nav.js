// Spatial D-pad navigation: arrows move focus to the nearest [data-nav] element
// in that direction inside the active layer. Mouse and touch also work.

const layers = {};       // name -> { el, onKey?, onBack?, onShow?, onHide? }
const stack = [];        // open layers, last = on top
const lastFocus = {};    // layer name -> element

export function registerLayer(name, opts) {
  layers[name] = Object.assign({ el: document.querySelector(`[data-layer="${name}"]`) }, opts);
}

export function current() { return stack[stack.length - 1]; }

export function openLayer(name, arg) {
  const L = layers[name];
  if (!L) return;
  if (current() === name) return;
  // Only one overlay at a time on top of home.
  while (stack.length > 1) closeTop(true);
  if (name !== "home") stack.push(name); else if (!stack.length) stack.push("home");
  L.el.classList.add("active");
  document.getElementById("home").classList.toggle("dimmed", name !== "home" && name !== "assistant");
  if (L.onShow) L.onShow(arg);
  if (!L.noAutoFocus) focusFirst(name);
}

export function closeTop(silent) {
  if (stack.length <= 1) return false;
  const name = stack.pop();
  const L = layers[name];
  L.el.classList.remove("active");
  if (L.onHide) L.onHide();
  if (stack.length === 1) document.getElementById("home").classList.remove("dimmed");
  if (!silent) restoreFocus(current());
  return true;
}

export function goHome() {
  while (stack.length > 1) closeTop(true);
  restoreFocus("home");
}

function items(name) {
  const L = layers[name || current()];
  if (!L) return [];
  return Array.from(L.el.querySelectorAll("[data-nav]")).filter((el) => el.offsetParent !== null && !el.disabled);
}

export function focused() {
  const name = current();
  const el = lastFocus[name];
  return el && el.isConnected && el.offsetParent !== null ? el : null;
}

export function setFocus(el) {
  if (!el) return;
  const name = current();
  const prev = lastFocus[name];
  if (prev && prev !== el) prev.classList.remove("focus");
  el.classList.add("focus");
  lastFocus[name] = el;
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

export function focusFirst(name) {
  const list = items(name);
  const preferred = list.find((el) => el.hasAttribute("data-autofocus"));
  setFocus(preferred || list[0]);
}

function restoreFocus(name) {
  const el = lastFocus[name];
  if (el && el.isConnected && el.offsetParent !== null) setFocus(el);
  else focusFirst(name);
}

export function refocus() { restoreFocus(current()); }

export function move(dir) {
  const list = items();
  const cur = focused();
  if (!cur) { setFocus(list[0]); return true; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let primary, secondary;
    if (dir === "left")  { if (dx >= -1) continue; primary = -dx; secondary = Math.abs(dy); }
    if (dir === "right") { if (dx <= 1) continue;  primary = dx;  secondary = Math.abs(dy); }
    if (dir === "up")    { if (dy >= -1) continue; primary = -dy; secondary = Math.abs(dx); }
    if (dir === "down")  { if (dy <= 1) continue;  primary = dy;  secondary = Math.abs(dx); }
    const score = primary + secondary * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { setFocus(best); return true; }
  return false;
}

const DIRS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

export function handleKey(e) {
  const name = current();
  const L = layers[name];
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

  if (typing) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      active.blur();
      if (e.key === "ArrowUp" || e.key === "ArrowDown") move(DIRS[e.key]);
      e.preventDefault();
    }
    return;
  }

  if (L && L.onKey && L.onKey(e)) { e.preventDefault(); return; }

  if (DIRS[e.key]) { move(DIRS[e.key]); e.preventDefault(); return; }
  if (e.key === "Enter" || e.key === " ") {
    const el = focused();
    if (el) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.focus();
      else el.click();
    }
    e.preventDefault();
    return;
  }
  if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack" || e.key === "BrowserBack") {
    back();
    e.preventDefault();
  }
}

// Returns true if something was closed (used by the Android back button).
export function back() {
  const name = current();
  const L = layers[name];
  if (L && L.onBack && L.onBack()) return true;
  return closeTop();
}

export function initPointer() {
  // Hovering with a mouse (or an air-mouse remote) moves focus too.
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest("[data-nav]");
    if (el && layers[current()].el.contains(el)) setFocus(el);
  });
}
