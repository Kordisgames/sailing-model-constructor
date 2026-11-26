import * as THREE from 'three';

/** Пресеты фона для вьюпорта и PNG. */
export const BACKDROPS = {
  none: { label: 'Нет', hint: 'Серый фон вьюпорта; PNG — прозрачный' },
  openSea: { label: 'Открытое море', hint: 'Голубое небо, лёгкие облака, спокойная вода' },
  harbor: { label: 'Гавань', hint: 'Мягкое небо, бирюзовая вода у горизонта' },
  sunset: { label: 'Закат', hint: 'Тёплый закат над морем' },
  storm: { label: 'Шторм', hint: 'Тяжёлые тучи и тёмная вода' },
  mist: { label: 'Туман', hint: 'Светлая дымка, едва видный горизонт' },
};

const cache = new Map();

function rgb(c, a = 1) {
  return a < 1 ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : `rgb(${c[0]},${c[1]},${c[2]})`;
}

function fillVGradient(ctx, w, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, c, a = 1] of stops) g.addColorStop(t, rgb(c, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
}

function cloud(ctx, x, y, rx, ry, alpha, tint = [255, 255, 255]) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, rgb(tint, 0.95));
  g.addColorStop(0.55, rgb(tint, 0.45));
  g.addColorStop(1, rgb(tint, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function cloudBank(ctx, cx, cy, scale, alpha, tint, seed) {
  const n = 5 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1 || 1)) * 2 - 1;
    const j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const f = j - Math.floor(j);
    cloud(
      ctx,
      cx + u * scale * 1.1,
      cy + (f - 0.5) * scale * 0.25,
      scale * (0.35 + f * 0.35),
      scale * (0.18 + (1 - f) * 0.16),
      alpha * (0.55 + f * 0.4),
      tint,
    );
  }
}

function paintSea(ctx, w, h, horizon, palette) {
  const seaTop = horizon;
  const seaH = h - seaTop;
  fillVGradient(ctx, w, seaTop, h, [
    [0, palette.horizonSea],
    [0.18, palette.seaNear],
    [0.55, palette.seaMid],
    [1, palette.seaDeep],
  ]);

  // блик дорожки на воде
  const path = ctx.createLinearGradient(w * 0.35, seaTop, w * 0.65, h);
  path.addColorStop(0, rgb(palette.glint, 0.35));
  path.addColorStop(0.45, rgb(palette.glint, 0.08));
  path.addColorStop(1, rgb(palette.glint, 0));
  ctx.fillStyle = path;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, seaTop);
  ctx.lineTo(w * 0.58, seaTop);
  ctx.lineTo(w * 0.72, h);
  ctx.lineTo(w * 0.28, h);
  ctx.closePath();
  ctx.fill();

  // тонкие «волны»
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = rgb(palette.wave);
  ctx.lineWidth = Math.max(1, h * 0.0015);
  for (let i = 0; i < 14; i++) {
    const t = (i + 1) / 15;
    const y = seaTop + seaH * (0.08 + t * 0.85);
    const amp = (1 - t) * w * 0.012;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x * 0.01 + i * 1.7) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // линия горизонта
  const hg = ctx.createLinearGradient(0, seaTop - 2, 0, seaTop + 6);
  hg.addColorStop(0, rgb(palette.horizonLine, 0));
  hg.addColorStop(0.45, rgb(palette.horizonLine, 0.55));
  hg.addColorStop(1, rgb(palette.horizonLine, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(0, seaTop - 2, w, 8);
}

function paintSky(ctx, w, h, horizon, palette) {
  fillVGradient(ctx, w, 0, horizon, [
    [0, palette.zenith],
    [0.45, palette.skyMid],
    [0.82, palette.skyLow],
    [1, palette.horizonSky],
  ]);

  // солнце / диск света
  if (palette.sun) {
    const [sx, sy, r] = palette.sun;
    const g = ctx.createRadialGradient(sx * w, sy * horizon, 0, sx * w, sy * horizon, r * w);
    g.addColorStop(0, rgb(palette.sunCore, 0.95));
    g.addColorStop(0.25, rgb(palette.sunGlow, 0.55));
    g.addColorStop(1, rgb(palette.sunGlow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon);
  }

  const tint = palette.cloud ?? [255, 255, 255];
  const dens = palette.cloudDensity ?? 1;
  for (let i = 0; i < Math.round(6 * dens); i++) {
    const f = (Math.sin(i * 19.1) * 0.5 + 0.5 + i * 0.13) % 1;
    const x = w * (0.08 + f * 0.84);
    const y = horizon * (0.12 + ((i * 37) % 70) / 100 * 0.55);
    const s = w * (0.06 + ((i * 13) % 40) / 100 * 0.1);
    cloudBank(ctx, x, y, s, (palette.cloudAlpha ?? 0.55) * (0.7 + (i % 3) * 0.1), tint, i * 17 + 3);
  }
}

const PALETTES = {
  openSea: {
    zenith: [92, 156, 220],
    skyMid: [135, 186, 230],
    skyLow: [186, 214, 236],
    horizonSky: [214, 228, 236],
    horizonSea: [120, 170, 196],
    seaNear: [70, 130, 168],
    seaMid: [42, 98, 140],
    seaDeep: [24, 62, 98],
    glint: [220, 236, 248],
    wave: [200, 230, 245],
    horizonLine: [230, 240, 248],
    cloud: [255, 255, 255],
    cloudAlpha: 0.6,
    cloudDensity: 1,
    sun: [0.72, 0.28, 0.18],
    sunCore: [255, 250, 230],
    sunGlow: [255, 236, 190],
  },
  harbor: {
    zenith: [120, 168, 210],
    skyMid: [168, 200, 222],
    skyLow: [210, 222, 230],
    horizonSky: [232, 228, 214],
    horizonSea: [110, 168, 168],
    seaNear: [64, 140, 148],
    seaMid: [40, 110, 124],
    seaDeep: [28, 78, 96],
    glint: [236, 230, 210],
    wave: [190, 220, 220],
    horizonLine: [240, 232, 210],
    cloud: [248, 246, 240],
    cloudAlpha: 0.5,
    cloudDensity: 0.85,
    sun: [0.3, 0.35, 0.22],
    sunCore: [255, 244, 210],
    sunGlow: [255, 220, 170],
  },
  sunset: {
    zenith: [62, 78, 128],
    skyMid: [120, 90, 130],
    skyLow: [220, 120, 80],
    horizonSky: [255, 180, 100],
    horizonSea: [180, 100, 90],
    seaNear: [90, 60, 90],
    seaMid: [48, 42, 78],
    seaDeep: [24, 28, 52],
    glint: [255, 200, 120],
    wave: [220, 150, 130],
    horizonLine: [255, 210, 150],
    cloud: [255, 180, 160],
    cloudAlpha: 0.45,
    cloudDensity: 1.1,
    sun: [0.55, 0.78, 0.14],
    sunCore: [255, 230, 160],
    sunGlow: [255, 140, 70],
  },
  storm: {
    zenith: [48, 56, 68],
    skyMid: [70, 78, 90],
    skyLow: [96, 102, 112],
    horizonSky: [120, 124, 128],
    horizonSea: [70, 82, 92],
    seaNear: [42, 58, 72],
    seaMid: [28, 40, 54],
    seaDeep: [14, 22, 34],
    glint: [160, 175, 190],
    wave: [140, 160, 180],
    horizonLine: [150, 155, 160],
    cloud: [90, 96, 108],
    cloudAlpha: 0.75,
    cloudDensity: 1.4,
    sun: null,
  },
  mist: {
    zenith: [200, 210, 218],
    skyMid: [214, 220, 226],
    skyLow: [226, 228, 230],
    horizonSky: [232, 230, 224],
    horizonSea: [180, 190, 196],
    seaNear: [150, 168, 178],
    seaMid: [120, 140, 154],
    seaDeep: [96, 116, 132],
    glint: [240, 242, 244],
    wave: [210, 220, 228],
    horizonLine: [236, 236, 232],
    cloud: [255, 255, 255],
    cloudAlpha: 0.35,
    cloudDensity: 0.7,
    sun: [0.5, 0.4, 0.35],
    sunCore: [255, 252, 245],
    sunGlow: [255, 245, 220],
  },
};

/**
 * Нарисовать фон в canvas. horizonY — доля высоты (0..1), где небо переходит в море.
 */
export function paintBackdrop(ctx, w, h, id, { horizon = 0.58 } = {}) {
  const palette = PALETTES[id] ?? PALETTES.openSea;
  const hy = Math.round(h * horizon);
  ctx.clearRect(0, 0, w, h);
  paintSky(ctx, w, h, hy, palette);
  paintSea(ctx, w, h, hy, palette);
}

/** Texture для scene.background (кэшируется по id). */
export function getBackdropTexture(id, size = 1536) {
  if (!id || id === 'none') return null;
  const key = `${id}:${size}`;
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.72);
  const ctx = canvas.getContext('2d');
  paintBackdrop(ctx, canvas.width, canvas.height, id);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Снимок фона в Blob PNG (для оффлайн-композиции, если нужно). */
export function backdropToDataURL(id, w = 1024, h = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paintBackdrop(canvas.getContext('2d'), w, h, id, { horizon: 0.55 });
  return canvas.toDataURL('image/png');
}
