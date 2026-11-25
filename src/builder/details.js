import * as THREE from 'three';
import { V } from './meshBuilder.js';

const { clamp, lerp, degToRad } = THREE.MathUtils;
const M4 = () => new THREE.Matrix4();

export const GUN_ROWS = {
  hull: { label: 'В борту', hint: 'Орудийные порты ниже главной палубы' },
  deck: { label: 'На палубе', hint: 'Пушки на верхней палубе, порты в фальшборте' },
  both: { label: 'Два ряда', hint: 'Порты в борту и в фальшборте' },
  triple: { label: 'Три ряда', hint: 'Две орудийные палубы в борту и пушки на верхней палубе (нужен высокий борт)' },
};

function gunPort(mb, S, t, y, sgn, size, withLid) {
  mb.push(S.sideFrame(t, y, sgn));
  mb.box('dark', 0, 0, 0.0, size, size, 0.06);
  mb.cyl('metal', V(0, 0, -size * 0.3), V(0, 0, size * 1.05), size * 0.2, size * 0.14, 6, false, true);
  if (withLid) {
    mb.push(M4().makeTranslation(0, size * 0.55, 0.02).multiply(M4().makeRotationX(degToRad(-70))));
    mb.box('trim', 0, size * 0.45, 0, size * 1.05, size * 0.95, 0.06);
    mb.pop();
  }
  mb.pop();
}

function guns(mb, S, det) {
  const n = Math.round(det.guns ?? 0);
  if (n <= 0) return;
  const row = det.gunRow ?? 'hull';
  const size = clamp(S.L * 0.021, 0.42, 0.78);

  const hullRows = row === 'triple' ? 2 : row === 'hull' || row === 'both' ? 1 : 0;
  for (let r = 0; r < hullRows; r++) {
    // нижний ряд сдвинут на полшага, порты стоят в шахматном порядке
    const cnt = r === 0 ? n : n - 1;
    for (let k = 0; k < cnt; k++) {
      const t = lerp(0.15, 0.85, (k + (r === 0 ? 0.5 : 1)) / n);
      const yMin = 0.35 + size / 2;
      const y = Math.max(yMin, S.mainDeckY(t) - S.waleH - size * 0.75) - r * size * 2;
      if (r > 0 && y < yMin) continue;
      for (const sgn of [1, -1]) gunPort(mb, S, t, y, sgn, size, true);
    }
  }
  if (row !== 'hull') {
    const t0 = Math.max(S.tQ, 0.08) + 0.035;
    const t1 = Math.min(S.tF, 0.9) - 0.035;
    const m = row === 'deck' ? n : Math.max(1, Math.round(n * 0.6));
    const s2 = Math.min(size * 0.85, S.bw * 0.62);
    if (t1 > t0) {
      for (let k = 0; k < m; k++) {
        const t = lerp(t0, t1, (k + 0.5) / m);
        const y = S.mainDeckY(t) + S.bw * 0.5;
        for (const sgn of [1, -1]) gunPort(mb, S, t, y, sgn, s2, false);
      }
    }
  }
}

/** Ярусы кормовых кают на шпангоуте t: высота центра окон и их размер. */
function cabinBands(S, t = 0) {
  const st = S.stackAt(Math.max(t, 0.001));
  const whMax = clamp(S.L * 0.028, 0.45, 0.95);
  const bands = [];
  if (st.length > 1) {
    // окна кают под палубой каждой надстройки (ниже декоративного пояса)
    for (let k = 1; k < st.length; k++) {
      const yLo = st[k - 1].top(t) - st[k - 1].bul;
      const yHi = st[k - 1].top(t) - 0.2;
      const wh = Math.min(whMax, yHi - yLo - 0.12);
      if (wh >= 0.3) bands.push({ yC: yHi - wh / 2, wh });
    }
  } else {
    const yD = S.mainDeckY(t);
    const room = yD - S.keelY(t);
    if (room > 1.5) {
      const wh = Math.min(whMax, room * 0.35);
      bands.push({ yC: yD - 0.15 - wh / 2, wh });
    }
  }
  return bands;
}

/** Окна по скруглению кормы: по одному на грань обшивки, начиная от ахтерштевня. */
function wrapWindows(mb, S, n) {
  const ts = S.stations;
  const perSide = Math.max(1, Math.round(n / 2));
  const levels = cabinBands(S).length;
  for (let b = 0; b < levels; b++) {
    for (const sgn of [1, -1]) {
      let placed = 0;
      for (let i = 0; i < ts.length - 1 && placed < perSide; i++) {
        const tm = (ts[i] + ts[i + 1]) / 2;
        if (tm > 0.2) break;
        // высота окон следует за седловатостью борта
        const band = cabinBands(S, tm)[b];
        if (!band) break;
        const { yC, wh } = band;
        const pa = S.surf(ts[i], yC, sgn);
        const pb = S.surf(ts[i + 1], yC, sgn);
        const width = pa.distanceTo(pb);
        if (width < 0.6) continue;
        const right = pb.clone().sub(pa).normalize();
        const up = S.surf(tm, yC + 0.1, sgn).sub(S.surf(tm, yC - 0.1, sgn)).normalize();
        const nrm = new THREE.Vector3().crossVectors(right, up).normalize();
        if (nrm.x * sgn * 0.3 - nrm.z < 0) {
          right.negate();
          nrm.negate();
        }
        up.crossVectors(nrm, right).normalize();
        const ww = Math.min(width * 0.62, wh * 0.9);
        mb.push(M4().makeBasis(right, up, nrm).setPosition(pa.lerp(pb, 0.5)));
        mb.box('trim', 0, 0, 0.02, ww + 0.14, wh + 0.14, 0.08);
        mb.box('glass', 0, 0, 0.05, ww, wh, 0.08);
        mb.pop();
        placed++;
      }
    }
  }
}

function sternWindows(mb, S, det) {
  const n = Math.round(det.sternWindows ?? 0);
  if (n <= 0) return;
  if (!S.hasTransom) {
    if (S.stern.wrapWindows) wrapWindows(mb, S, n);
    return;
  }
  for (const { yC, wh } of cabinBands(S)) {
    const p = S.surf(0, yC);
    const half = p.x * 0.84;
    if (half < 0.4) continue;
    const cnt = Math.max(1, Math.min(n, Math.floor((2 * half) / 0.5)));
    const pitch = (2 * half) / cnt;
    const ww = Math.min(pitch * 0.68, wh * 0.9);
    const up = S.surf(0, yC + 0.1).sub(S.surf(0, yC - 0.1));
    up.x = 0;
    up.normalize();
    const right = V(-1, 0, 0);
    const nrm = new THREE.Vector3().crossVectors(right, up);
    mb.push(M4().makeBasis(right, up, nrm).setPosition(0, yC, p.z));
    for (let i = 0; i < cnt; i++) {
      const x = -half + pitch * (i + 0.5);
      mb.box('trim', x, 0, 0.02, ww + 0.14, wh + 0.14, 0.06);
      mb.box('glass', x, 0, 0.05, ww, wh, 0.06);
    }
    mb.pop();
  }
}

/** Кормовая галерея: выступающий балкон с балюстрадой под окнами кают. */
function sternGallery(mb, S) {
  if (!S.stern.gallery || !S.hasTransom) return;
  const band = cabinBands(S)[0];
  if (!band) return;
  const L = S.L;
  const yF = band.yC - band.wh / 2 - 0.14;
  const p0 = S.surf(0, yF);
  const w = p0.x;
  if (w < 0.7) return;
  const d = clamp(L * 0.04, 0.6, 1.6);
  const tf = clamp(L * 0.004, 0.07, 0.14);
  const hr = clamp(band.wh * 0.85, 0.4, 0.8);
  const rr = clamp(L * 0.0028, 0.045, 0.085);
  const zin = p0.z + 0.05;
  // контур площадки в плане: середина выступает сильнее краёв
  const out = [[-w, 0.62], [-w * 0.55, 1], [w * 0.55, 1], [w, 0.62]].map(([x, k]) => ({ x, z: p0.z - d * k }));
  const at = (o, y) => V(o.x, y, o.z);
  for (let i = 0; i < 3; i++) {
    const a = out[i];
    const b = out[i + 1];
    mb.quadF('deck', V(a.x, yF, zin), V(b.x, yF, zin), at(b, yF), at(a, yF), V(0, 1, 0));
    mb.quadF('trim', V(a.x, yF - tf, zin), V(b.x, yF - tf, zin), at(b, yF - tf), at(a, yF - tf), V(0, -1, 0));
    mb.quadF('trim', at(a, yF - tf), at(b, yF - tf), at(b, yF), at(a, yF), V(b.z - a.z, 0, a.x - b.x));
  }
  for (const o of [out[0], out[3]]) {
    mb.quadF('trim', V(o.x, yF - tf, zin), at(o, yF - tf), at(o, yF), V(o.x, yF, zin), V(o.x, 0, 0));
  }
  // балюстрада
  const yR = yF + hr;
  const zR = S.surf(0, yR).z + 0.03;
  const pts = [V(-w, yR, zR), ...out.map((o) => at(o, yR)), V(w, yR, zR)];
  for (let i = 0; i < pts.length - 1; i++) mb.beam('trim', pts[i], pts[i + 1], rr * 2, rr * 2);
  for (let i = 0; i < 3; i++) {
    const a = out[i];
    const b = out[i + 1];
    const cnt = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.9));
    for (let k = i === 0 ? 0 : 1; k <= cnt; k++) {
      const f = k / cnt;
      mb.box('trim', lerp(a.x, b.x, f), yF + hr / 2, lerp(a.z, b.z, f), rr * 1.5, hr, rr * 1.5);
    }
  }
  // подкосы под площадкой
  const yLow = Math.max(yF - tf - d * 1.1, S.keelY(0) + 0.15);
  const low = S.surf(0, yLow);
  for (const sgn of [1, -1]) {
    const x = sgn * w * 0.55;
    const xl = sgn * Math.min(w * 0.55, low.x * 0.85);
    mb.beam('keel', V(x, yF - tf, p0.z - d * 0.85), V(xl, yLow, low.z - 0.02), rr * 2.4, rr * 2.4);
  }
}

function lanterns(mb, S, det) {
  const n = Math.round(det.lanterns ?? 0);
  if (n <= 0) return;
  const s = clamp(S.L / 30, 0.55, 1.3);
  const yT = S.topY(0.001);
  const p = S.surf(0, yT);
  const half = Math.max(0, p.x - 0.25 * s);
  let xs = n === 1 || half < 0.5 ? [0] : n === 2 ? [-half * 0.8, half * 0.8] : [-half * 0.85, 0, half * 0.85];
  // у кормы с проёмом фонари стоят только по краям
  if (S.sternGap) xs = n === 1 ? [half * 0.82] : [-half * 0.82, half * 0.82];
  for (const x of xs) {
    const lift = x === 0 && xs.length > 1 ? 0.35 * s : 0;
    mb.push(M4().makeTranslation(x, yT, p.z + S.thick * 0.5).multiply(M4().makeRotationX(degToRad(-12))));
    mb.cyl('metal', V(0, 0, 0), V(0, 0.55 * s + lift, 0), 0.045 * s, 0.04 * s, 4, false, false);
    const y0 = 0.55 * s + lift;
    mb.cyl('trim', V(0, y0, 0), V(0, y0 + 0.07 * s, 0), 0.2 * s, 0.24 * s, 6);
    mb.cyl('glass', V(0, y0 + 0.07 * s, 0), V(0, y0 + 0.5 * s, 0), 0.19 * s, 0.24 * s, 6);
    mb.cyl('trim', V(0, y0 + 0.5 * s, 0), V(0, y0 + 0.74 * s, 0), 0.29 * s, 0.03 * s, 6);
    mb.pop();
  }
}

function anchors(mb, S, det) {
  if (!det.anchors) return;
  const s = clamp(S.L / 28, 0.5, 1.4);
  const t = 0.86;
  const y = S.topY(t) - 0.75 * s - 0.15;
  for (const sgn of [1, -1]) {
    mb.push(S.sideFrame(t, y, sgn));
    const z = 0.12 * s;
    mb.box('metal', 0, 0, z, 0.1 * s, 1.5 * s, 0.1 * s);
    mb.box('keel', 0, 0.68 * s, z, 0.95 * s, 0.11 * s, 0.11 * s);
    for (const d of [1, -1]) {
      mb.push(M4().makeTranslation(0, -0.72 * s, z).multiply(M4().makeRotationZ(degToRad(d * 55))));
      mb.box('metal', 0, 0.3 * s, 0, 0.1 * s, 0.62 * s, 0.09 * s);
      mb.pop();
    }
    mb.pop();
  }
}

function deckFittings(mb, S, det, rigInfo) {
  const L = S.L;
  const mastTs = (rigInfo?.masts ?? []).map((m) => m.t).sort((a, b) => a - b);
  const lo = Math.max(S.tQ, 0.06) + 0.05;
  const hi = Math.min(S.tF, 0.94) - 0.05;

  // люки между мачтами на главной палубе
  if (det.hatches) {
    const cand = [];
    for (let i = 0; i < mastTs.length - 1; i++) {
      if (mastTs[i + 1] - mastTs[i] > 0.13) cand.push((mastTs[i] + mastTs[i + 1]) / 2);
    }
    if (mastTs.length === 1) cand.push(mastTs[0] - 0.13);
    if (mastTs.length === 0) cand.push(0.5);
    for (const t of cand) {
      if (t < lo || t > hi) continue;
      const p = S.deckPoint(t);
      const w = Math.min(S.deckHalf(t) * 0.75, S.B * 0.3);
      const len = clamp(L * 0.07, 0.8, 3.2);
      const hh = clamp(L * 0.008, 0.12, 0.28);
      mb.box('keel', 0, p.y + hh / 2, p.z, w, hh, len);
      mb.box('dark', 0, p.y + hh + 0.015, p.z, w * 0.78, 0.03, len * 0.82);
    }
  }

  // штурвал (или румпель у небольших судов) на кормовой палубе
  if (det.wheel) {
    const tEnd = S.hasPoop ? S.tP : S.hasQuarterdeck ? S.tQ : 0.2;
    const taken = mastTs.filter((t) => t < tEnd + 0.02);
    let t = clamp(tEnd * 0.62, 0.05, 0.3);
    for (const mt of taken) if (Math.abs(mt - t) < 0.04) t = mt - 0.05;
    t = clamp(t, 0.04, 0.4);
    const p = S.deckPoint(t);
    if (L >= 15) {
      const s = clamp(L / 30, 0.6, 1.15);
      mb.box('keel', 0, p.y + 0.4 * s, p.z, 0.22 * s, 0.8 * s, 0.3 * s);
      mb.cyl('trim', V(0, p.y + 0.85 * s, p.z + 0.16 * s), V(0, p.y + 0.85 * s, p.z + 0.24 * s), 0.52 * s, 0.52 * s, 8);
      mb.cyl('keel', V(0, p.y + 0.85 * s, p.z + 0.13 * s), V(0, p.y + 0.85 * s, p.z + 0.3 * s), 0.1 * s, 0.1 * s, 6);
    } else {
      const zs = S.surf(0, S.deckY(0.001)).z;
      mb.cyl('keel', V(0, p.y + 0.55, zs + 0.15), V(0, p.y + 0.75, zs + clamp(L * 0.13, 0.8, 2)), 0.05, 0.04, 5);
    }
  }
}

/** Вёсла вдоль бортов: выходят из фальшборта и опущены лопастями в воду. */
function oars(mb, S, det) {
  const n = Math.round(det.oars ?? 0);
  if (n <= 0) return;
  const t0 = Math.max(S.tQ, 0.1) + 0.06;
  const t1 = Math.min(S.tF, 0.9) - 0.08;
  if (t1 <= t0) return;
  const r = clamp(S.L * 0.0022, 0.035, 0.07);
  for (let k = 0; k < n; k++) {
    const t = lerp(t0, t1, (k + 0.5) / n);
    const y = S.mainDeckY(t) + S.bw * 0.45;
    const reach = Math.max(2.2, (y + 0.5) * 2.4);
    for (const sgn of [1, -1]) {
      const p = S.surf(t, y, sgn);
      const tip = V(p.x + sgn * reach, -0.45, p.z - reach * 0.22);
      mb.cyl('spar', p.clone().lerp(tip, -0.12), tip, r, r, 4, true, false);
      mb.beam('spar', p.clone().lerp(tip, 0.76), p.clone().lerp(tip, 1.03), r * 5, r * 0.9);
    }
  }
}

/** Гальюн — клювовидный выступ под бушпритом, характерный для галеонов. */
function beakhead(mb, S, det) {
  if (!det.beakhead) return;
  const L = S.L;
  const tB = 0.955;
  const yB = S.mainDeckY(1) + S.bw * 0.15;
  const base = S.surf(tB, yB);
  const stem = S.surf(1, yB);
  const len = L * 0.1;
  const hh = clamp(L * 0.018, 0.3, 0.7);
  const tip = V(0, yB + len * 0.22, stem.z + len);
  const w = Math.max(0.3, base.x * 0.95);
  const zb = base.z + 0.05;
  const A = V(-w, yB, zb);
  const Bp = V(w, yB, zb);
  const lower = (p, d) => V(p.x, p.y - d, p.z);
  mb.triF('deck', A, Bp, tip, V(0, 1, 0));
  mb.triF('bulwark', lower(A, hh), lower(Bp, hh), lower(tip, hh * 0.4), V(0, -1, 0));
  mb.quadF('bulwark', lower(A, hh), A, tip, lower(tip, hh * 0.4), V(-1, 0, 0.3));
  mb.quadF('bulwark', lower(Bp, hh), Bp, tip, lower(tip, hh * 0.4), V(1, 0, 0.3));
  // леера гальюна
  const rh = clamp(L * 0.02, 0.35, 0.7);
  const rr = clamp(L * 0.0025, 0.04, 0.08);
  for (const sgn of [1, -1]) {
    const a = V(sgn * w, yB + rh, zb);
    const b = V(0, tip.y + rh * 0.5, tip.z);
    mb.beam('trim', a, b, rr * 2, rr * 2);
    mb.beam('trim', V(sgn * w, yB, zb), a, rr * 1.6, rr * 1.6);
    const mid = V(sgn * w * 0.5, yB + (tip.y - yB) * 0.5, lerp(zb, tip.z, 0.5));
    mb.beam('trim', mid, V(mid.x, mid.y + rh * 0.75, mid.z), rr * 1.6, rr * 1.6);
  }
  mb.beam('trim', tip, V(0, tip.y + rh * 0.5, tip.z), rr * 1.6, rr * 1.6);
}

/** Балюстрады и двери на срезах надстроек. */
function bulkheadDecor(mb, S, det) {
  const rr = clamp(S.L * 0.003, 0.05, 0.1);
  for (const b of S.bulkheads) {
    const z = b.z + b.dirZ * rr;
    const yR = b.yHi + b.bul;
    mb.box('trim', 0, yR - rr, z, b.half * 2, rr * 2, rr * 2);
    const cnt = Math.max(2, Math.round((b.half * 2) / 0.9));
    for (let i = 1; i < cnt; i++) {
      const x = -b.half + (2 * b.half * i) / cnt;
      mb.box('trim', x, b.yHi + (b.bul - rr) / 2, z, rr * 1.3, b.bul - rr, rr * 1.3);
    }
    const hgt = b.yHi - b.yLo;
    if (det.doors && hgt >= 1.25 && b.half > 0.9) {
      const dh = Math.min(1.75, hgt - 0.18);
      const dw = Math.min(0.85, b.half * 0.5);
      const zd = (b.zLo + b.z) / 2;
      mb.box('trim', 0, b.yLo + dh / 2 + 0.03, zd, dw + 0.14, dh + 0.06, Math.abs(b.z - b.zLo) + 0.08);
      mb.box('dark', 0, b.yLo + dh / 2, zd + b.dirZ * 0.03, dw, dh, Math.abs(b.z - b.zLo) + 0.1);
      // окошки по сторонам от двери
      if (b.half > 2.2) {
        for (const sgn of [1, -1]) {
          const x = sgn * b.half * 0.55;
          const wy = b.yLo + hgt * 0.58;
          mb.box('trim', x, wy, zd, 0.62, 0.52, Math.abs(b.z - b.zLo) + 0.08);
          mb.box('glass', x, wy, zd + b.dirZ * 0.03, 0.48, 0.38, Math.abs(b.z - b.zLo) + 0.1);
        }
      }
    }
  }
}

/** Кормовой флаг на флагштоке. */
function ensign(mb, S, det, state) {
  if (!det.ensign) return;
  const L = S.L;
  const yT = S.topY(0.001);
  const p = S.surf(0, yT);
  const hs = clamp(L * 0.13, 1.6, 4.5);
  // у кормы с проёмом флагшток смещён на левую половину транца
  const xe = S.sternGap ? -(S.sternGap + p.x) / 2 : 0;
  const base = V(xe, yT - 0.2, p.z + S.thick * 0.5);
  const top = V(xe, yT + hs, p.z - hs * 0.22);
  mb.cyl('spar', base, top, 0.05, 0.035, 5, false, true);
  const fw = hs * 0.62;
  const fh = hs * 0.42;
  const phi = degToRad(state.rig.trim ?? 0);
  const dir = V(Math.sin(phi) * 0.6, 0, -1).normalize();
  const seg = 3;
  const pt = (i, v) => {
    const f = i / seg;
    const o = top.clone().lerp(base, v * (fh / hs));
    o.addScaledVector(dir, f * fw);
    o.x += (i === 0 ? 0 : i % 2 ? 1 : -1) * 0.06 * fw;
    o.y -= f * f * fh * 0.25;
    return o;
  };
  mb.sheet(() => {
    for (let i = 0; i < seg; i++) mb.quad('flag', pt(i, 0), pt(i + 1, 0), pt(i + 1, 1), pt(i, 1));
  });
}

export function buildDetails(mb, S, state, rigInfo) {
  const det = state.details;
  guns(mb, S, det);
  sternWindows(mb, S, det);
  sternGallery(mb, S);
  lanterns(mb, S, det);
  anchors(mb, S, det);
  deckFittings(mb, S, det, rigInfo);
  oars(mb, S, det);
  beakhead(mb, S, det);
  bulkheadDecor(mb, S, det);
  ensign(mb, S, det, state);
}
