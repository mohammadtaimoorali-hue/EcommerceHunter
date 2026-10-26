// "Living" wallpaper: a mountain landscape painted on a canvas whose sky,
// light and stars follow the real time of day. It is painted once every few
// minutes (cheap), and CSS gives it a slow cinematic drift.
// Photo mode cross-fades your own image URLs instead.

import { getSettings } from "./store.js";

// Deterministic random so the same mountains appear every time.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return [0, 1, 2].map((i) => Math.round(lerp(c1[i], c2[i], t)));
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Sky palettes keyed by hour of day: [top, middle, horizon, mountain tint, light]
const KEYS = [
  { h: 0,  top: [6, 10, 28],   mid: [14, 22, 52],   hor: [32, 40, 78],   tint: [16, 20, 40],  light: 0.15 },
  { h: 5,  top: [20, 28, 70],  mid: [80, 70, 130],  hor: [240, 150, 120], tint: [50, 50, 90], light: 0.35 },
  { h: 7,  top: [70, 110, 190], mid: [170, 170, 220], hor: [255, 205, 170], tint: [80, 95, 140], light: 0.7 },
  { h: 11, top: [60, 120, 210], mid: [140, 180, 235], hor: [215, 225, 245], tint: [70, 95, 150], light: 1 },
  { h: 16, top: [70, 120, 200], mid: [160, 175, 225], hor: [245, 215, 200], tint: [80, 90, 145], light: 0.9 },
  { h: 18.5, top: [40, 50, 120], mid: [190, 110, 150], hor: [255, 150, 90], tint: [70, 55, 100], light: 0.55 },
  { h: 20, top: [14, 20, 55],  mid: [50, 45, 100],  hor: [110, 70, 110], tint: [30, 30, 60], light: 0.3 },
  { h: 24, top: [6, 10, 28],   mid: [14, 22, 52],   hor: [32, 40, 78],   tint: [16, 20, 40], light: 0.15 },
];

function paletteAt(hour) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (hour >= a.h && hour <= b.h) {
      const t = (hour - a.h) / (b.h - a.h);
      return {
        top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), hor: mix(a.hor, b.hor, t),
        tint: mix(a.tint, b.tint, t), light: lerp(a.light, b.light, t),
      };
    }
  }
  return KEYS[0];
}

function ridge(rand, w, baseY, amp, roughness, points, peaks) {
  // A few big peaks first, then midpoint displacement for natural detail.
  let pts = [];
  for (let i = 0; i <= peaks; i++) {
    const up = i % 2 === 1 ? 1 : -0.2;
    pts.push(baseY - amp * (0.35 + rand() * 0.65) * up);
  }
  let disp = amp * 0.45;
  while (pts.length < points) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      next.push(pts[i]);
      next.push((pts[i] + pts[i + 1]) / 2 + (rand() - 0.5) * disp);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    disp *= roughness;
  }
  const step = w / (pts.length - 1);
  return pts.map((y, i) => [i * step, y]);
}

function paintLiving(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr) || 1920;
  const h = Math.round(canvas.clientHeight * dpr) || 1080;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const p = paletteAt(hour);
  const night = p.light < 0.35;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
  sky.addColorStop(0, rgb(p.top));
  sky.addColorStop(0.55, rgb(p.mid));
  sky.addColorStop(1, rgb(p.hor));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const rand = rng(20241024);

  // Stars
  if (night) {
    const starRand = rng(7);
    for (let i = 0; i < 420; i++) {
      const x = starRand() * w, y = starRand() * h * 0.6;
      const r = starRand() * 1.4 * dpr;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + starRand() * 0.7 * (1 - p.light)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Sun / moon travels across the sky
  const dayT = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
  const isSun = dayT >= 0 && dayT <= 1;
  const t = isSun ? dayT : ((hour + 24 - 18) % 24) / 12;
  const cx = w * (0.1 + 0.8 * t);
  const cy = h * (0.62 - Math.sin(Math.PI * t) * 0.45);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.35);
  glow.addColorStop(0, isSun ? "rgba(255,240,210,0.9)" : "rgba(220,230,255,0.55)");
  glow.addColorStop(0.08, isSun ? "rgba(255,220,170,0.45)" : "rgba(200,215,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = isSun ? "rgba(255,250,235,0.95)" : "rgba(235,240,255,0.9)";
  ctx.beginPath(); ctx.arc(cx, cy, h * (isSun ? 0.028 : 0.022), 0, Math.PI * 2); ctx.fill();

  // Soft clouds
  for (let i = 0; i < 7; i++) {
    const x = rand() * w, y = h * (0.12 + rand() * 0.25), rw = w * (0.15 + rand() * 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.22); // squash a circle into a long soft cloud
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, `rgba(255,255,255,${0.12 * (0.4 + p.light)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rw, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Mountain layers, far (light, snowy) to near (dark, forested)
  const layers = [
    { y: 0.62, amp: 0.36, rough: 0.56, haze: 0.42, snow: true, peaks: 6 },
    { y: 0.68, amp: 0.20, rough: 0.55, haze: 0.30, snow: true, peaks: 9 },
    { y: 0.75, amp: 0.09, rough: 0.52, haze: 0.18, snow: false, peaks: 12 },
    { y: 0.83, amp: 0.05, rough: 0.50, haze: 0.08, snow: false, trees: true, peaks: 16 },
  ];
  layers.forEach((L, idx) => {
    const pts = ridge(rand, w, h * L.y, h * L.amp, L.rough, 400, L.peaks);
    const base = mix(p.tint, [10, 14, 24], idx / (layers.length - 1));
    const col = mix(base, p.hor, L.haze);
    const grad = ctx.createLinearGradient(0, h * (L.y - L.amp), 0, h);
    grad.addColorStop(0, rgb(mix(col, [255, 255, 255], 0.12 * p.light)));
    grad.addColorStop(1, rgb(mix(col, [0, 0, 0], 0.35)));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, h);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

    if (L.snow) {
      // Snow caps: lighten every point above a snow line.
      const snowLine = h * (L.y - L.amp * 0.55);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0, h);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(w, h); ctx.closePath(); ctx.clip();
      const sg = ctx.createLinearGradient(0, h * (L.y - L.amp), 0, snowLine);
      const snowA = 0.55 + 0.35 * p.light;
      sg.addColorStop(0, `rgba(250,252,255,${snowA})`);
      sg.addColorStop(1, "rgba(250,252,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, snowLine);
      ctx.restore();
    }

    if (L.trees) {
      ctx.fillStyle = rgb(mix(col, [0, 0, 0], 0.55));
      const treeRand = rng(99);
      for (let x = -20; x < w + 20; x += 6 * dpr + treeRand() * 10 * dpr) {
        const i = Math.min(pts.length - 1, Math.max(0, Math.round((x / w) * (pts.length - 1))));
        const gy = pts[i][1] + h * 0.02;
        const th = h * (0.05 + treeRand() * 0.09);
        const tw = th * 0.28;
        ctx.beginPath();
        ctx.moveTo(x, gy - th);
        for (let k = 1; k <= 4; k++) {
          const yy = gy - th + (th * k) / 4;
          ctx.lineTo(x + (tw * k) / 4, yy);
          ctx.lineTo(x + (tw * k) / 8, yy);
        }
        ctx.lineTo(x - tw / 8, gy);
        for (let k = 4; k >= 1; k--) {
          const yy = gy - th + (th * k) / 4;
          ctx.lineTo(x - (tw * k) / 8, yy);
          ctx.lineTo(x - (tw * k) / 4, yy);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.fillRect(0, h * (L.y + 0.08), w, h);
    }

    // Valley mist between layers
    const mist = ctx.createLinearGradient(0, h * (L.y - 0.02), 0, h * (L.y + 0.1));
    mist.addColorStop(0, "rgba(255,255,255,0)");
    mist.addColorStop(1, `rgba(${p.hor[0]},${p.hor[1]},${p.hor[2]},${0.18 * (1 - idx / 4)})`);
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * (L.y - 0.02), w, h * 0.12);
  });
}

let photoIdx = 0;
let photoFront = "a";
let photoTimer = null;

function showNextPhoto() {
  const urls = getSettings().photoUrls.filter(Boolean);
  if (!urls.length) return;
  const url = urls[photoIdx % urls.length];
  photoIdx++;
  const next = document.getElementById(photoFront === "a" ? "photo-b" : "photo-a");
  const cur = document.getElementById(photoFront === "a" ? "photo-a" : "photo-b");
  const img = new Image();
  img.onload = () => {
    next.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
    next.classList.add("show");
    cur.classList.remove("show");
    photoFront = photoFront === "a" ? "b" : "a";
  };
  img.src = url;
}

export function applyWallpaper() {
  const canvas = document.getElementById("wallpaper");
  const s = getSettings();
  clearInterval(photoTimer);
  if (s.wallpaper === "photos" && s.photoUrls.filter(Boolean).length) {
    canvas.style.display = "none";
    showNextPhoto();
    photoTimer = setInterval(showNextPhoto, 60 * 1000);
  } else {
    document.getElementById("photo-a").classList.remove("show");
    document.getElementById("photo-b").classList.remove("show");
    canvas.style.display = "block";
    paintLiving(canvas);
  }
}

export function startWallpaper() {
  applyWallpaper();
  // Repaint every 5 minutes so the sky follows the sun.
  setInterval(() => { if (getSettings().wallpaper !== "photos") paintLiving(document.getElementById("wallpaper")); }, 5 * 60 * 1000);
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(applyWallpaper, 300); });
}
