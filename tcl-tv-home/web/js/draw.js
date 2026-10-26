// Draw on the TV screen: with the remote (a cursor + pen up/down), with a mouse
// or touch screen, or live from your phone (strokes arrive through tvBus).
// Strokes are stored with 0..1 coordinates so any screen size can replay them.

import { registerLayer, openLayer, closeTop, setFocus, focused, move } from "./nav.js";

const COLORS = ["#ffffff", "#ff5b6e", "#ffb547", "#ffe45c", "#5ce08a", "#5cc8ff", "#a78bff", "#ff8ad8", "#111111"];
const SIZES = [{ k: "S", v: 0.004 }, { k: "M", v: 0.008 }, { k: "L", v: 0.016 }, { k: "XL", v: 0.03 }];

let canvas, ctx, cursorEl, layerEl;
let strokes = [];              // finished strokes
const live = new Map();        // stroke id -> stroke being drawn (pointer, remote or phone)
let color = COLORS[1];
let sizeIdx = 1;
let cursor = { x: 0.5, y: 0.5, down: false, id: null };
let toolsOpen = false;
let holdTimer = null, speed = 0.006;
let onPin = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  redraw();
}

function drawStroke(s) {
  const w = canvas.width, h = canvas.height;
  const pts = s.points;
  if (!pts.length) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size * w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0][0] * w, pts[0][1] * h, (s.size * w) / 2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  // Quadratic smoothing through midpoints.
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0] * w, pts[i][1] * h, mx * w, my * h);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0] * w, last[1] * h);
  ctx.stroke();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(drawStroke);
  live.forEach(drawStroke);
}

function begin(id, x, y, c, size) {
  const s = { id, color: c || color, size: size || SIZES[sizeIdx].v, points: [[x, y]] };
  live.set(id, s);
  drawStroke(s);
}

function extend(id, x, y) {
  const s = live.get(id);
  if (!s) return;
  s.points.push([x, y]);
  redraw();
}

function end(id) {
  const s = live.get(id);
  if (!s) return;
  live.delete(id);
  strokes.push(s);
}

// ----- remote control cursor -----
function placeCursor() {
  cursorEl.style.left = `${cursor.x * 100}%`;
  cursorEl.style.top = `${cursor.y * 100}%`;
  cursorEl.style.setProperty("--pen", color);
  cursorEl.classList.toggle("down", cursor.down);
}

function nudge(dx, dy) {
  // Holding an arrow accelerates the cursor.
  speed = Math.min(speed * 1.12, 0.03);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { speed = 0.006; }, 180);
  cursor.x = Math.min(1, Math.max(0, cursor.x + dx * speed));
  cursor.y = Math.min(1, Math.max(0, cursor.y + dy * speed * (16 / 9)));
  if (cursor.down) extend(cursor.id, cursor.x, cursor.y);
  placeCursor();
}

function togglePen() {
  if (cursor.down) {
    end(cursor.id);
    cursor.down = false;
  } else {
    cursor.id = `remote-${Date.now()}`;
    begin(cursor.id, cursor.x, cursor.y);
    cursor.down = true;
  }
  placeCursor();
}

function setTools(open) {
  toolsOpen = open;
  layerEl.classList.toggle("tools-open", open);
  if (open) {
    if (cursor.down) togglePen();
    setFocus(document.querySelector('#swatches .swatch.active') || document.querySelector("#draw-bar [data-nav]"));
  } else {
    const f = focused();
    if (f) f.classList.remove("focus");
  }
}

function renderSwatches() {
  const box = document.getElementById("swatches");
  box.innerHTML = "";
  COLORS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "swatch" + (c === color ? " active" : "");
    b.style.background = c;
    b.setAttribute("data-nav", "");
    b.setAttribute("aria-label", `Color ${c}`);
    b.addEventListener("click", () => {
      color = c;
      renderSwatches();
      placeCursor();
      setTools(false);
    });
    box.appendChild(b);
  });
}

function act(name) {
  if (name === "size") {
    sizeIdx = (sizeIdx + 1) % SIZES.length;
    document.getElementById("size-label").textContent = SIZES[sizeIdx].k;
  } else if (name === "undo") {
    strokes.pop(); redraw();
  } else if (name === "clear") {
    clearDrawing();
  } else if (name === "pin") {
    if (strokes.length && onPin) onPin(snapshot());
    clearDrawing();
    closeTop();
  } else if (name === "exit") {
    closeTop();
  }
}

export function clearDrawing() {
  strokes = []; live.clear(); redraw();
}

// Renders the strokes, cropped to what was drawn, as a transparent PNG
// for pinning on the home screen.
function snapshot() {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0, pad = 0;
  strokes.forEach((st) => {
    pad = Math.max(pad, st.size);
    st.points.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  });
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad * 1.8);
  x1 = Math.min(1, x1 + pad); y1 = Math.min(1, y1 + pad * 1.8);
  const bw = Math.max(x1 - x0, 0.02), bh = Math.max(y1 - y0, 0.02);
  const scale = Math.min(640 / (bw * 1920), 480 / (bh * 1080), 1);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(bw * 1920 * scale));
  out.height = Math.max(1, Math.round(bh * 1080 * scale));
  const o = out.getContext("2d");
  // Draw in a virtual 1920x1080 space shifted to the crop box.
  const saved = { canvas, ctx };
  canvas = { width: 1920 * scale, height: 1080 * scale };
  ctx = o;
  o.translate(-x0 * 1920 * scale, -y0 * 1080 * scale);
  strokes.forEach(drawStroke);
  canvas = saved.canvas; ctx = saved.ctx;
  return out.toDataURL("image/png");
}

// Called by tvBus for strokes drawn on the phone.
export function remoteStroke(msg) {
  if (msg.clear) { clearDrawing(); return; }
  if (msg.undo) { strokes.pop(); redraw(); return; }
  const id = `phone-${msg.id}`;
  const pts = msg.points || [];
  if (!live.has(id) && pts.length) {
    begin(id, pts[0][0], pts[0][1], msg.color, msg.size);
    pts.slice(1).forEach(([x, y]) => live.get(id).points.push([x, y]));
    redraw();
  } else {
    pts.forEach(([x, y]) => { const s = live.get(id); if (s) s.points.push([x, y]); });
    redraw();
  }
  if (msg.end) end(id);
}

export function pinFromPhone() {
  if (strokes.length && onPin) onPin(snapshot());
  clearDrawing();
}

export function initDraw(pinHandler) {
  onPin = pinHandler;
  canvas = document.getElementById("draw-canvas");
  ctx = canvas.getContext("2d");
  cursorEl = document.getElementById("cursor");
  layerEl = document.getElementById("draw");
  renderSwatches();

  document.querySelectorAll("#draw-bar .tool").forEach((b) => {
    b.addEventListener("click", () => act(b.getAttribute("data-act")));
  });

  // Mouse / touch drawing.
  let pid = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  canvas.addEventListener("pointerdown", (e) => {
    pid = `ptr-${e.pointerId}-${Date.now()}`;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pos(e); begin(pid, x, y);
  });
  canvas.addEventListener("pointermove", (e) => { if (pid) { const [x, y] = pos(e); extend(pid, x, y); } });
  const up = () => { if (pid) { end(pid); pid = null; } };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  registerLayer("draw", {
    noAutoFocus: true,
    onShow() {
      setTools(false);
      requestAnimationFrame(resize);
      placeCursor();
    },
    onHide() {
      if (cursor.down) togglePen();
    },
    onKey(e) {
      if (toolsOpen) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { move(e.key === "ArrowLeft" ? "left" : "right"); return true; }
        if (e.key === "ArrowUp") { setTools(false); return true; }
        return false; // Enter/back handled by nav
      }
      const k = e.key;
      if (k === "ArrowLeft") { nudge(-1, 0); return true; }
      if (k === "ArrowRight") { nudge(1, 0); return true; }
      if (k === "ArrowUp") { nudge(0, -1); return true; }
      if (k === "ArrowDown") { nudge(0, 1); return true; }
      if (k === "Enter" || k === " ") { togglePen(); return true; }
      if (/^[1-9]$/.test(k)) { color = COLORS[Number(k) - 1]; renderSwatches(); placeCursor(); return true; }
      if (k === "0") { clearDrawing(); return true; }
      return false;
    },
    onBack() {
      if (!toolsOpen) { setTools(true); return true; }
      return false; // second Back closes the layer
    },
  });
  window.addEventListener("resize", () => { if (layerEl.classList.contains("active")) resize(); });
}

export function openDraw() { openLayer("draw"); }
