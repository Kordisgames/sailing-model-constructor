import * as THREE from 'three';
import { V } from './meshBuilder.js';

const { clamp, lerp } = THREE.MathUtils;

/**
 * Формы носа.
 *  stem     — профиль форштевня: > 0 вогнутый (клиперский), < 0 выпуклый (круглый), 0 прямой
 *  k        — заострённость ватерлиний в плане: 1 острый нос, 0.5 круглый
 *  e        — форма шпангоутов в носу: 2 = V-образные, 1 = круглые
 *  forefoot — подрез киля у форштевня
 */
export const BOW_TYPES = {
  clipper: {
    label: 'Клиперский',
    hint: 'Вогнутый форштевень с сильным выносом, острые обводы',
    stem: 0.75, k: 1.0, e: 2.1, forefoot: 0.35,
    defaults: { bowRake: 0.14, bowFullness: 0.35 },
  },
  raked: {
    label: 'Наклонный',
    hint: 'Прямой наклонный форштевень',
    stem: 0.0, k: 1.0, e: 1.9, forefoot: 0.15,
    defaults: { bowRake: 0.1, bowFullness: 0.45 },
  },
  plumb: {
    label: 'Отвесный',
    hint: 'Почти вертикальный форштевень с закруглённым подрезом',
    stem: -0.7, k: 0.92, e: 1.7, forefoot: 0.3,
    defaults: { bowRake: 0.035, bowFullness: 0.5 },
  },
  spoon: {
    label: 'Круглый',
    hint: 'Выпуклый «ложкообразный» нос',
    stem: -0.6, k: 0.7, e: 1.4, forefoot: 0.65,
    defaults: { bowRake: 0.12, bowFullness: 0.6 },
  },
  bluff: {
    label: 'Полный',
    hint: 'Тупой пузатый нос галеонов и флейтов',
    stem: -1.0, k: 0.52, e: 1.15, forefoot: 0.3,
    defaults: { bowRake: 0.07, bowFullness: 0.8 },
  },
  ram: {
    label: 'Таранный',
    hint: 'Обратный наклон форштевня: у ватерлинии вперёд выступает таран (галера)',
    stem: -0.5, k: 1.0, e: 2.0, forefoot: 1.3,
    defaults: { bowRake: -0.07, bowFullness: 0.3 },
  },
  longship: {
    label: 'Ладейный',
    hint: 'Острый нос с высоким изогнутым штевнем (драккар, ладья)',
    stem: 0.5, k: 1.0, e: 1.8, forefoot: 0.5, post: 0.17,
    defaults: { bowRake: 0.12, bowFullness: 0.35 },
  },
};

/**
 * Формы кормы.
 *  transom     — есть ли плоский транец
 *  curve       — профиль ахтерштевня (как stem у носа)
 *  cap         — дополнительные шпангоуты у самой кормы (в долях первого шага), чтобы скругление в плане было плавным
 *  wrapWindows — окна идут по скруглению кормы
 *  gallery     — выступающий кормовой балкон
 *  notch       — ширина проёма в фальшборте транца (доля ширины транца)
 */
export const STERN_TYPES = {
  transom: {
    label: 'Транцевая',
    hint: 'Широкий плоский транец',
    transom: true, curve: 0, k: 1.0, e: 2.3,
    defaults: { sternWidth: 0.72, sternRake: 0.05, sternRise: 0.55, sternFullness: 0.5 },
  },
  galleon: {
    label: 'Галеонная',
    hint: 'Узкий высокий транец с сильным наклоном назад',
    transom: true, curve: 0, k: 1.0, e: 2.8,
    defaults: { sternWidth: 0.5, sternRake: 0.09, sternRise: 0.6, sternFullness: 0.55 },
  },
  round: {
    label: 'Круглая',
    hint: 'Закруглённая корма с подзором',
    transom: false, curve: 0.5, k: 0.55, e: 1.6,
    defaults: { sternWidth: 0, sternRake: 0.06, sternRise: 0.6, sternFullness: 0.7 },
  },
  pointed: {
    label: 'Острая',
    hint: 'Заострённая корма, как у нос (вельбот, шебека)',
    transom: false, curve: 0, k: 1.0, e: 1.9,
    defaults: { sternWidth: 0, sternRake: 0.08, sternRise: 0.3, sternFullness: 0.4 },
  },
  longship: {
    label: 'Ладейная',
    hint: 'Острая корма с высоким изогнутым штевнем, как нос ладьи',
    transom: false, curve: 0.5, k: 1.0, e: 1.9, post: 0.15,
    defaults: { sternWidth: 0, sternRake: 0.12, sternRise: 0.3, sternFullness: 0.4 },
  },
  tub: {
    label: 'Полукруглая',
    hint: 'Широкая корма, скруглённая в плане, с окнами по кругу',
    transom: false, curve: -0.45, k: 0.3, e: 1.35, cap: [0.2, 0.52], wrapWindows: true,
    defaults: { sternWidth: 0, sternRake: 0.05, sternRise: 0.5, sternFullness: 0.85 },
  },
  counter: {
    label: 'Со свесом',
    hint: 'Длинный свес: верх кормы с транцем выступает далеко назад над рулём',
    transom: true, curve: 0.85, k: 1.0, e: 2.4,
    defaults: { sternWidth: 0.62, sternRake: 0.13, sternRise: 0.6, sternFullness: 0.55 },
  },
  gallery: {
    label: 'С балконом',
    hint: 'Транец с выступающей кормовой галереей и балюстрадой',
    transom: true, curve: 0, k: 1.0, e: 2.5, gallery: true,
    defaults: { sternWidth: 0.66, sternRake: 0.06, sternRise: 0.58, sternFullness: 0.55 },
  },
  open: {
    label: 'С проёмом',
    hint: 'Высокий широкий транец с открытым проёмом в фальшборте, как у джонок',
    transom: true, curve: 0, k: 1.0, e: 2.2, notch: 0.5,
    defaults: { sternWidth: 0.85, sternRake: 0.1, sternRise: 0.6, sternFullness: 0.6 },
  },
};

/**
 * Заготовки формы корпуса: пропорции задаются в долях длины,
 * поэтому форма применяется к кораблю любого размера.
 */
export const HULL_FORMS = {
  sleek: {
    label: 'Стройный',
    hint: 'Узкий быстроходный корпус с острыми обводами (шхуна, клипер)',
    beam: 0.245, draft: 0.088, freeboard: 0.085, bulwark: 0.03,
    midFullness: 0.6, tumblehome: 0, sheerBow: 0.048, sheerStern: 0.026,
  },
  classic: {
    label: 'Классический',
    hint: 'Универсальные пропорции брига или фрегата',
    beam: 0.27, draft: 0.096, freeboard: 0.095, bulwark: 0.032,
    midFullness: 0.74, tumblehome: 0.05, sheerBow: 0.045, sheerStern: 0.032,
  },
  cargo: {
    label: 'Пузатый',
    hint: 'Широкий вместительный корпус торговца с завалом бортов (флейт)',
    beam: 0.31, draft: 0.11, freeboard: 0.1, bulwark: 0.03,
    midFullness: 0.9, tumblehome: 0.17, sheerBow: 0.04, sheerStern: 0.05,
  },
  tall: {
    label: 'Высокобортный',
    hint: 'Высокий борт и сильная седловатость (галеон, каракка)',
    beam: 0.285, draft: 0.102, freeboard: 0.12, bulwark: 0.028,
    midFullness: 0.8, tumblehome: 0.13, sheerBow: 0.046, sheerStern: 0.068,
  },
  shallow: {
    label: 'Плоскодонный',
    hint: 'Малая осадка, низкий борт и плоское днище (барка, прибрежное судно)',
    beam: 0.3, draft: 0.055, freeboard: 0.07, bulwark: 0.028,
    midFullness: 0.94, tumblehome: 0, sheerBow: 0.03, sheerStern: 0.02,
  },
  galley: {
    label: 'Галерный',
    hint: 'Очень длинный, узкий и низкий корпус под вёсла (галера, галеас)',
    beam: 0.17, draft: 0.05, freeboard: 0.058, bulwark: 0.02,
    midFullness: 0.8, tumblehome: 0, sheerBow: 0.026, sheerStern: 0.04,
  },
  longship: {
    label: 'Ладья',
    hint: 'Низкий открытый корпус с высоко поднятыми носом и кормой (драккар)',
    beam: 0.215, draft: 0.042, freeboard: 0.046, bulwark: 0.015,
    midFullness: 0.55, tumblehome: 0, sheerBow: 0.09, sheerStern: 0.085,
  },
  cog: {
    label: 'Круглый',
    hint: 'Короткий, очень широкий и глубокий корпус (когг, неф)',
    beam: 0.36, draft: 0.12, freeboard: 0.125, bulwark: 0.035,
    midFullness: 0.85, tumblehome: 0.06, sheerBow: 0.05, sheerStern: 0.05,
  },
  warship: {
    label: 'Линейный',
    hint: 'Высокий тяжёлый корпус с сильным завалом бортов под несколько орудийных палуб',
    beam: 0.275, draft: 0.105, freeboard: 0.135, bulwark: 0.024,
    midFullness: 0.88, tumblehome: 0.2, sheerBow: 0.032, sheerStern: 0.045,
  },
  yacht: {
    label: 'Острый киль',
    hint: 'Узкий корпус с глубоким V-образным днищем и низким бортом (яхта, куттер)',
    beam: 0.25, draft: 0.12, freeboard: 0.072, bulwark: 0.02,
    midFullness: 0.25, tumblehome: 0, sheerBow: 0.042, sheerStern: 0.02,
  },
};

/** Применить заготовку формы корпуса, сохранив текущую длину. */
export function applyHullForm(h, id) {
  const f = HULL_FORMS[id];
  if (!f) return;
  const L = h.length;
  const r = (v, step) => Math.round(v / step) * step;
  h.form = id;
  h.beam = r(L * f.beam, 0.1);
  h.draft = r(Math.max(0.5, L * f.draft), 0.1);
  h.freeboard = r(Math.max(0.6, L * f.freeboard), 0.1);
  h.bulwark = r(Math.min(1.8, Math.max(0.3, L * f.bulwark)), 0.05);
  h.midFullness = f.midFullness;
  h.tumblehome = f.tumblehome;
  h.sheerBow = r(L * f.sheerBow, 0.05);
  h.sheerStern = r(L * f.sheerStern, 0.05);
}

const DETAIL = [
  { stations: 10, below: 2, above: 1 },
  { stations: 14, below: 3, above: 2 },
  { stations: 20, below: 4, above: 2 },
];

/** Профиль штевня: доля выноса на относительной высоте s (0 — киль, 1 — планширь, > 1 — надстройки). */
function profileCurve(shape, s) {
  const a = 1 + 1.6 * Math.abs(shape);
  if (s <= 0) return 0;
  if (s <= 1) return shape >= 0 ? Math.pow(s, a) : 1 - Math.pow(1 - s, a);
  const slope = shape >= 0 ? Math.min(a, 1.1) : 0.15;
  return 1 + slope * (s - 1);
}

/**
 * Математическая модель обводов корпуса.
 * t — положение по длине: 0 корма, 1 нос. Ось Z направлена в нос, Y вверх, y = 0 — ватерлиния.
 */
export function makeHullShape(h) {
  const L = h.length;
  const B = h.beam;
  const draft = h.draft;
  const fb = h.freeboard;
  const bow = BOW_TYPES[h.bowType] ?? BOW_TYPES.clipper;
  const stern = STERN_TYPES[h.sternType] ?? STERN_TYPES.transom;

  const bw = Math.min(h.bulwark, fb * 0.6);
  const waleH = clamp(fb * 0.2, 0.25, 0.7);
  const thick = clamp(B * 0.025, 0.08, 0.22);

  const bowRake = h.bowRake * L;
  const sternRake = h.sternRake * L;
  const zKb = L / 2 - bowRake;
  const zKs = -L / 2 + sternRake;

  const nB = lerp(1.35, 4.2, h.bowFullness);
  const nS = lerp(1.5, 4.2, h.sternFullness);
  const ts = stern.transom ? h.sternWidth : 0;

  const eMid = lerp(1.5, 0.6, h.midFullness);
  const eBow = Math.max(eMid, bow.e);
  const eStern = Math.max(eMid, stern.e);

  const riseH = h.sternRise * (draft + 0.3 * fb);
  const foreH = bow.forefoot * draft * 0.7;

  /** Линия планширя (седловатость). */
  const sheer = (t) => {
    const u = 2 * t - 1;
    return fb + (u > 0 ? h.sheerBow : h.sheerStern) * u * u;
  };

  /** Линия киля: подъём днища к корме и подрез у форштевня. */
  const keelY = (t) => {
    let y = -draft;
    if (t < 0.42) y += riseH * Math.pow((0.42 - t) / 0.42, 1.8);
    if (t > 0.68) y += foreH * Math.pow((t - 0.68) / 0.32, 2);
    return Math.min(y, sheer(t) - bw - waleH - 0.3);
  };

  /** Ширина корпуса в плане (0..1 от полуширины). */
  const planW = (t) => {
    const u = 2 * t - 1;
    if (u >= 0) return Math.pow(Math.max(0, 1 - Math.pow(u, nB)), bow.k);
    return ts + (1 - ts) * Math.pow(Math.max(0, 1 - Math.pow(-u, nS)), stern.k);
  };

  /** Показатель суперэллипса шпангоута: U-образный на миделе, V-образный в оконечностях. */
  const eAt = (t) => {
    if (t >= 0.5) return lerp(eMid, eBow, Math.pow((t - 0.5) / 0.5, 1.5));
    return lerp(eMid, eStern, Math.pow((0.5 - t) / 0.5, 1.5));
  };

  /** Точка наружной обшивки на шпангоуте t и высоте y. sgn: +1 правый борт, -1 левый. */
  const surf = (t, y, sgn = 1) => {
    const yK = keelY(t);
    const top = sheer(t);
    const Yf = (y - yK) / (top - yK);
    const Yc = clamp(Yf, 0, 1);
    const e = eAt(t);
    const X = Math.pow(Math.max(0, 1 - Math.pow(1 - Yc, 2 / e)), e / 2);
    const q = (Yf - 0.45) / 0.55;
    const tumble = q <= 0 ? 0 : q <= 1 ? q * q : 2 * q - 1;
    const f = Math.max(0.3, 1 - h.tumblehome * tumble);
    const x = (B / 2) * planW(t) * X * f;
    const z =
      lerp(zKs, zKb, t) +
      bowRake * profileCurve(bow.stem, Yf) * t * t * t -
      sternRake * profileCurve(stern.curve, Yf) * Math.pow(1 - t, 3);
    return V(sgn * x, y, z);
  };

  return {
    L, B, draft, fb, bw, waleH, thick, transomW: ts, eMid, zKb, zKs,
    bow, stern, sheer, keelY, planW, surf,
  };
}

/**
 * Построить корпус: обшивку, палубы, фальшборт, надстройки, транец, киль и руль.
 * Возвращает модель корпуса с функциями для размещения рангоута и деталей.
 */
export function buildHull(mb, h, det = {}) {
  const S = makeHullShape(h);
  const { L, B, bw, thick, sheer, keelY, surf, draft, stern } = S;
  const D = DETAIL[h.detail] ?? DETAIL[1];
  let N = D.stations;

  // ---- Уровни палуб: главная + надстройки -------------------------------
  const bwC = bw * 0.85;
  const levels = [{ id: 'main', t0: -1, t1: 2, top: sheer, bul: bw }];
  const breaks = [];
  const qd = h.quarterdeck;
  const pp = h.poop;
  const fc = h.forecastle;
  let tQ = 0;
  let tP = 0;
  let tF = 1;
  if (fc.on) tF = 1 - clamp(fc.length, 0.08, 0.4);
  if (qd.on) {
    tQ = clamp(qd.length, 0.1, Math.min(0.6, tF - 0.12));
    const dQ = Math.max(0.5, qd.height) + bwC - bw;
    levels.push({ id: 'qd', t0: -1, t1: tQ, top: (t) => sheer(t) + dQ, bul: bwC });
    breaks.push(tQ);
    if (pp.on) {
      tP = clamp(pp.length, 0.06, tQ - 0.06);
      const dP = dQ + Math.max(0.5, pp.height);
      levels.push({ id: 'poop', t0: -1, t1: tP, top: (t) => sheer(t) + dP, bul: bwC });
      breaks.push(tP);
    }
  }
  if (fc.on) {
    const dF = Math.max(0.5, fc.height) + bwC - bw;
    levels.push({ id: 'fc', t0: tF, t1: 2, top: (t) => sheer(t) + dF, bul: bwC });
    breaks.push(tF);
  }
  const stackAt = (t) => levels.filter((l) => t > l.t0 && t < l.t1);

  // ---- Шпангоуты (станции) ----------------------------------------------
  const ts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    ts.push(lerp(u, (1 - Math.cos(Math.PI * u)) / 2, 0.5));
  }
  const used = new Set();
  for (const b of breaks) {
    let best = -1;
    let bd = Infinity;
    for (let i = 1; i < N; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(ts[i] - b);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best > 0) {
      ts[best] = b;
      used.add(best);
    }
  }
  ts.sort((a, b) => a - b);
  if (stern.cap) {
    const t1 = ts[1];
    for (const f of stern.cap) ts.push(t1 * f);
    ts.sort((a, b) => a - b);
    N = ts.length - 1;
  }

  // ---- Пояса обшивки ------------------------------------------------------
  const yKm = keelY(0.5);
  const wbm = sheer(0.5) - bw - S.waleH;
  const Ywl = clamp((0 - yKm) / (wbm - yKm), 0.15, 0.9);
  const thWl = Math.acos(Math.pow(1 - Ywl, 1 / S.eMid));
  const fr = [];
  for (let j = 0; j <= D.below; j++) {
    fr.push(1 - Math.pow(Math.cos((thWl * j) / D.below), S.eMid));
  }
  for (let j = 1; j <= D.above; j++) {
    const th = thWl + ((Math.PI / 2 - thWl) * j) / D.above;
    fr.push(j === D.above ? 1 : 1 - Math.pow(Math.cos(th), S.eMid));
  }
  const nLow = D.below + D.above;
  const bandMats = [];
  for (let j = 0; j < nLow; j++) bandMats.push(j < D.below ? 'bottom' : 'hull');
  bandMats.push('wale', 'bulwark');
  const R = bandMats.length;

  const rowsY = (t) => {
    const yK = keelY(t);
    const top = sheer(t);
    const deck = top - bw;
    const wb = deck - S.waleH;
    const ys = fr.map((f) => yK + f * (wb - yK));
    ys.push(deck, top);
    return ys;
  };

  const mirror = (p) => V(-p.x, p.y, p.z);

  /** Наружная нормаль к ватерлинии правого борта в плане: [nx, nz]. */
  const planNormal = (t, y) => {
    const e = 0.004;
    const a = surf(Math.max(0, t - e), y, 1);
    const b = surf(Math.min(1, t + e), y, 1);
    const nx = b.z - a.z;
    const nz = a.x - b.x;
    const len = Math.hypot(nx, nz);
    if (len < 1e-9 || nx <= 0) return [1, 0];
    return [nx / len, nz / len];
  };
  /** Точка, смещённая от обшивки по нормали в плане на d (внутрь корпуса при d < 0). */
  const shell = (t, y, sgn, d) => {
    const p = surf(t, y, 1);
    const [nx, nz] = planNormal(t, y);
    p.x = Math.max(0, p.x + d * nx) * sgn;
    p.z += d * nz;
    return p;
  };
  /** Направление «наружу» для участка борта между шпангоутами ta и tb. */
  const outDir = (ta, tb, y, sgn) => {
    const [nx, nz] = planNormal((ta + tb) / 2, y);
    return V(sgn * nx, 0, nz);
  };
  const inner = (t, y, sgn = 1) => shell(t, y, sgn, -thick);

  // ---- Наружная обшивка ---------------------------------------------------
  const P = ts.map((t) => rowsY(t).map((y) => surf(t, y, 1)));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const a = P[i][j];
      const b = P[i + 1][j];
      const c = P[i + 1][j + 1];
      const d = P[i][j + 1];
      const dir = outDir(ts[i], ts[i + 1], (a.y + b.y + c.y + d.y) / 4, 1);
      if (j < nLow) dir.y = -0.6;
      mb.quadF(bandMats[j], a, b, c, d, dir);
      mb.quadF(bandMats[j], mirror(a), mirror(b), mirror(c), mirror(d), V(-dir.x, dir.y, dir.z));
    }
  }

  // ---- Планширь -----------------------------------------------------------
  const railO = clamp(L * 0.002, 0.03, 0.07);
  const railUp = clamp(L * 0.0025, 0.04, 0.08);
  const railDn = clamp(L * 0.004, 0.06, 0.12);
  const lift = (p, dy) => {
    p.y += dy;
    return p;
  };
  const rail = (ta, ya, tb, yb, sgn) => {
    const O = (t, y, dy) => lift(shell(t, y, sgn, railO), dy);
    const I = (t, y, dy) => lift(shell(t, y, sgn, -thick - railO), dy);
    const out = outDir(ta, tb, (ya + yb) / 2, sgn);
    mb.quadF('trim', O(ta, ya, railUp), O(tb, yb, railUp), I(tb, yb, railUp), I(ta, ya, railUp), V(0, 1, 0));
    mb.quadF('trim', O(ta, ya, -railDn), O(tb, yb, -railDn), O(tb, yb, railUp), O(ta, ya, railUp), out);
    mb.quadF('trim', I(ta, ya, -railDn), I(tb, yb, -railDn), I(tb, yb, railUp), I(ta, ya, railUp), out.clone().negate());
  };

  /** Декоративный пояс по борту в основании стены надстройки. */
  const moulding = (ta, ya, tb, yb, sgn) => {
    const O = (t, y, dy) => lift(shell(t, y, sgn, railO), dy);
    const W = (t, y, dy) => lift(surf(t, y, sgn), dy);
    mb.quadF('trim', O(ta, ya, -railDn), O(tb, yb, -railDn), O(tb, yb, railUp), O(ta, ya, railUp), outDir(ta, tb, (ya + yb) / 2, sgn));
    mb.quadF('trim', W(ta, ya, railUp), W(tb, yb, railUp), O(tb, yb, railUp), O(ta, ya, railUp), V(0, 1, 0));
    mb.quadF('trim', W(ta, ya, -railDn), W(tb, yb, -railDn), O(tb, yb, -railDn), O(ta, ya, -railDn), V(0, -1, 0));
  };

  // ---- Палубы, фальшборт, стены надстроек --------------------------------
  const segStack = [];
  for (let i = 0; i < N; i++) segStack.push(stackAt((ts[i] + ts[i + 1]) / 2));

  for (let i = 0; i < N; i++) {
    const st = segStack[i];
    const ta = ts[i];
    const tb = ts[i + 1];
    for (let k = 1; k < st.length; k++) {
      const ya0 = st[k - 1].top(ta);
      const ya1 = st[k].top(ta);
      const yb0 = st[k - 1].top(tb);
      const yb1 = st[k].top(tb);
      for (const sgn of [1, -1]) {
        mb.quadF('bulwark', surf(ta, ya0, sgn), surf(tb, yb0, sgn), surf(tb, yb1, sgn), surf(ta, ya1, sgn), outDir(ta, tb, (ya0 + yb1) / 2, sgn));
        moulding(ta, ya0, tb, yb0, sgn);
      }
    }
    const K = st[st.length - 1];
    const yTa = K.top(ta);
    const yTb = K.top(tb);
    const yDa = yTa - K.bul;
    const yDb = yTb - K.bul;
    for (const sgn of [1, -1]) {
      mb.quadF('bulwark', inner(ta, yDa, sgn), inner(tb, yDb, sgn), inner(tb, yTb, sgn), inner(ta, yTa, sgn), outDir(ta, tb, (yDa + yTb) / 2, sgn).negate());
      rail(ta, yTa, tb, yTb, sgn);
    }
    mb.quadF('deck', inner(ta, yDa, -1), inner(ta, yDa, 1), inner(tb, yDb, 1), inner(tb, yDb, -1), V(0, 1, 0));
  }

  // ---- Переборки на срезах надстроек -------------------------------------
  const bulkheads = [];
  for (let i = 1; i < N; i++) {
    const Ka = segStack[i - 1][segStack[i - 1].length - 1];
    const Kb = segStack[i][segStack[i].length - 1];
    if (Ka === Kb) continue;
    const t = ts[i];
    const dA = Ka.top(t) - Ka.bul;
    const dB = Kb.top(t) - Kb.bul;
    const hi = dA > dB ? Ka : Kb;
    const lo = dA > dB ? Kb : Ka;
    const dirZ = dA > dB ? 1 : -1;
    const yLo = Math.min(dA, dB);
    const yHi = Math.max(dA, dB);
    mb.quadF('bulwark', inner(t, yLo, -1), inner(t, yLo, 1), inner(t, yHi, 1), inner(t, yHi, -1), V(0, 0, dirZ));
    for (const sgn of [1, -1]) {
      mb.quadF('bulwark', inner(t, lo.top(t), sgn), surf(t, lo.top(t), sgn), surf(t, hi.top(t), sgn), inner(t, hi.top(t), sgn), V(0, 0, dirZ));
    }
    const z = inner(t, yHi).z;
    const half = inner(t, yHi).x;
    bulkheads.push({ t, yLo, yHi, dirZ, z, half, bul: hi.bul, zLo: inner(t, yLo).z });
  }

  // ---- Транец -------------------------------------------------------------
  const hasTransom = S.transomW > 0 && surf(0, sheer(0)).x > 0.05;
  const st0 = segStack[0];
  const stN = segStack[N - 1];
  let sternGap = 0;
  if (hasTransom) {
    const ys = rowsY(0);
    const mats = bandMats.slice();
    for (let k = 1; k < st0.length; k++) {
      const yb = st0[k - 1].top(0);
      const pb = surf(0, yb, 1);
      mb.box('trim', 0, yb + (railUp - railDn) / 2, pb.z - railO / 2, 2 * (pb.x + railO), railUp + railDn, railO);
      ys.push(st0[k].top(0));
      mats.push('bulwark');
    }
    const K = st0[st0.length - 1];
    const yT = K.top(0);
    const yD = yT - K.bul;
    // проём в фальшборте транца
    if (stern.notch) {
      sternGap = Math.min(stern.notch * surf(0, yD).x, inner(0, yT).x - 0.3);
      if (sternGap < 0.3) sternGap = 0;
    }
    if (sternGap && yD > ys[ys.length - 2] + 1e-3) {
      ys.splice(ys.length - 1, 0, yD);
      mats.push('bulwark');
    }
    const aft = V(0, -0.3, -1);
    /** Точки транца: наружная на расстоянии x от оси и внутренняя стенка фальшборта. */
    const tOut = (x, y) => V(x, y, surf(0, y).z);
    const tIn = (x, y) => V(x, y, surf(0, y).z + thick);
    for (let j = 0; j < ys.length - 1; j++) {
      const ya = ys[j];
      const yb = ys[j + 1];
      if (sternGap && ya >= yD - 1e-3) {
        for (const sgn of [1, -1]) {
          mb.quadF(mats[j], tOut(sgn * sternGap, ya), surf(0, ya, sgn), surf(0, yb, sgn), tOut(sgn * sternGap, yb), aft);
        }
      } else {
        mb.quadF(mats[j], surf(0, ya, -1), surf(0, ya, 1), surf(0, yb, 1), surf(0, yb, -1), aft);
      }
    }
    const xD = inner(0, yD).x;
    const xT = inner(0, yT).x;
    const pT = surf(0, yT, 1);
    const railY = yT + (railUp - railDn) / 2;
    const railD = thick + 2 * railO;
    if (sternGap) {
      const g = sternGap;
      const pw = clamp(thick * 1.3, 0.12, 0.3);
      const zD = surf(0, yD).z;
      for (const sgn of [1, -1]) {
        mb.quadF('bulwark', tIn(sgn * g, yD), tIn(sgn * xD, yD), tIn(sgn * xT, yT), tIn(sgn * g, yT), V(0, 0, 1));
        mb.quadF('bulwark', tOut(sgn * g, yD), tIn(sgn * g, yD), tIn(sgn * g, yT), tOut(sgn * g, yT), V(-sgn, 0, 0));
        const xo = pT.x + railO;
        mb.box('trim', (sgn * (g + xo)) / 2, railY, pT.z + thick / 2, xo - g, railUp + railDn, railD);
        // стойки по краям проёма
        const hp = yT - yD + railUp + pw * 0.6;
        mb.box('trim', sgn * (g + pw / 2 - 0.02), yD + hp / 2, (zD + pT.z + thick) / 2, pw, hp, railD + Math.abs(zD - pT.z));
      }
      mb.box('trim', 0, yD + 0.03, zD + thick / 2, 2 * g, 0.06, railD);
    } else {
      mb.quadF('bulwark', tIn(-xD, yD), tIn(xD, yD), tIn(xT, yT), tIn(-xT, yT), V(0, 0, 1));
      mb.box('trim', 0, railY, pT.z + thick / 2, 2 * (pT.x + railO), railUp + railDn, railD);
    }
  }

  // ---- Киль, форштевень, ахтерштевень ------------------------------------
  const kd = clamp(L * 0.012, 0.12, 0.4);
  const kw = clamp(B * 0.035, 0.1, 0.32);
  if (h.keel) {
    const prof = [];
    /**
     * Высокий изогнутый штевень ладьи над планширем: продолжает линию a → b
     * и загибается вверх и к середине корпуса (inward: +1 для кормы, -1 для носа).
     */
    const post = (a, b, f, inward) => {
      const d = new THREE.Vector3().subVectors(b, a).normalize();
      const len = clamp(L * f, 0.8, 4.5);
      const p1 = b.clone().addScaledVector(d, len * 0.55);
      const d2 = V(0, d.y + 0.7, d.z + inward * 0.55).normalize();
      const p2 = p1.clone().addScaledVector(d2, len * 0.45);
      return [
        { p: p1, free: true, s: 1.25 },
        { p: p2, free: true, s: 0.55 },
      ];
    };
    if (!hasTransom) {
      const ys0 = rowsY(0);
      for (let k = 1; k < st0.length; k++) ys0.push(st0[k].top(0));
      for (let j = ys0.length - 1; j >= 1; j--) prof.push({ p: surf(0, ys0[j]), part: 'stern' });
      if (stern.post) {
        const [p1, p2] = post(prof[1].p, prof[0].p, stern.post, 1);
        prof.unshift({ ...p2, part: 'stern' }, { ...p1, part: 'stern' });
      }
    }
    for (let i = 0; i <= N; i++) prof.push({ p: surf(ts[i], keelY(ts[i])), part: 'keel', t: ts[i] });
    const ysN = rowsY(1);
    for (let k = 1; k < stN.length; k++) ysN.push(stN[k].top(1));
    for (let j = 1; j < ysN.length; j++) prof.push({ p: surf(1, ysN[j]), part: 'stem' });
    {
      const a = prof[prof.length - 2].p;
      const b = prof[prof.length - 1].p;
      if (S.bow.post) {
        for (const q of post(a, b, S.bow.post, -1)) prof.push({ ...q, part: 'stem' });
      } else {
        // топ форштевня чуть выше планширя
        const d = new THREE.Vector3().subVectors(b, a).normalize();
        prof.push({ p: b.clone().addScaledVector(d, clamp(L * 0.02, 0.2, 0.7)), part: 'stem', free: true });
      }
    }

    const n = prof.length;
    const outer = [];
    for (let k = 0; k < n; k++) {
      const a = prof[Math.max(0, k - 1)].p;
      const b = prof[Math.min(n - 1, k + 1)].p;
      const tz = b.z - a.z;
      const ty = b.y - a.y;
      const len = Math.hypot(tz, ty) || 1;
      const p = prof[k].p;
      const kk = kd * (prof[k].s ?? 1);
      const o = V(0, p.y - (tz / len) * kk, p.z + (ty / len) * kk);
      if (prof[k].part === 'keel' && prof[k].t < 0.5) {
        o.y = -draft - kd;
        o.z = p.z - (prof[k].t === 0 && !hasTransom ? kd : 0);
      }
      outer.push(o);
    }
    const at = (p, x) => V(x, p.y, p.z);
    for (let k = 0; k < n - 1; k++) {
      const i0 = prof[k].p;
      const i1 = prof[k + 1].p;
      const o0 = outer[k];
      const o1 = outer[k + 1];
      mb.quadF('keel', at(i0, kw / 2), at(i1, kw / 2), at(o1, kw / 2), at(o0, kw / 2), V(1, 0, 0));
      mb.quadF('keel', at(i0, -kw / 2), at(i1, -kw / 2), at(o1, -kw / 2), at(o0, -kw / 2), V(-1, 0, 0));
      const dir = V(0, o0.y + o1.y - i0.y - i1.y, o0.z + o1.z - i0.z - i1.z);
      if (dir.lengthSq() > 1e-8) {
        mb.quadF('keel', at(o0, kw / 2), at(o1, kw / 2), at(o1, -kw / 2), at(o0, -kw / 2), dir);
        // у свободно стоящей части штевня видна и обратная сторона
        if (prof[k].free || prof[k + 1].free) {
          mb.quadF('keel', at(i0, kw / 2), at(i1, kw / 2), at(i1, -kw / 2), at(i0, -kw / 2), dir.clone().negate());
        }
      }
    }
    // торцы
    const capA = V(0, prof[0].p.y - prof[1].p.y, prof[0].p.z - prof[1].p.z);
    mb.quadF('keel', at(prof[0].p, kw / 2), at(outer[0], kw / 2), at(outer[0], -kw / 2), at(prof[0].p, -kw / 2), capA);
    const capB = V(0, prof[n - 1].p.y - prof[n - 2].p.y, prof[n - 1].p.z - prof[n - 2].p.z);
    mb.quadF('keel', at(prof[n - 1].p, kw / 2), at(outer[n - 1], kw / 2), at(outer[n - 1], -kw / 2), at(prof[n - 1].p, -kw / 2), capB);
  }

  // ---- Руль ---------------------------------------------------------------
  if (h.rudder) {
    const rw = clamp(L * 0.045, 0.35, 1.6);
    const back = h.keel && !hasTransom ? kd : 0;
    const yBot = -draft - (h.keel ? kd : 0);
    const yTop = Math.max(keelY(0) + 0.3, Math.min(0.6, sheer(0) - bw - 0.3));
    const zBot = S.zKs - back - 0.02;
    const zTop = Math.min(S.zKs, surf(0, yTop).z) - back - 0.02;
    // Перо руля повторяет излом ахтерштевня: вертикальная часть до подзора, выше — по наклону кормы.
    const yMid = clamp(keelY(0), yBot + 0.2, yTop);
    mb.plate(
      'keel',
      [
        { z: zBot, y: yBot },
        { z: zBot - rw, y: yBot + rw * 0.12 },
        { z: zBot - rw * 0.85, y: yMid },
        { z: zBot, y: yMid },
      ],
      -kw * 0.4,
      kw * 0.4,
    );
    if (yTop - yMid > 0.05) {
      mb.plate(
        'keel',
        [
          { z: zBot, y: yMid },
          { z: zBot - rw * 0.85, y: yMid },
          { z: zTop - rw * 0.7, y: yTop },
          { z: zTop, y: yTop },
        ],
        -kw * 0.4,
        kw * 0.4,
      );
    }
  }

  // ---- Справочные функции для рангоута и деталей -------------------------
  const topLevelAt = (t) => {
    const st = stackAt(clamp(t, 0.001, 0.999));
    return st[st.length - 1];
  };
  const deckY = (t) => {
    const K = topLevelAt(t);
    return K.top(t) - K.bul;
  };
  const topY = (t) => topLevelAt(t).top(t);
  const mainDeckY = (t) => sheer(t) - bw;
  const deckPoint = (t) => {
    const y = deckY(t);
    return V(0, y, surf(t, y).z);
  };
  const deckHalf = (t) => inner(t, deckY(t)).x;
  const tAtZ = (z) => {
    let a = 0;
    let b = 1;
    for (let i = 0; i < 24; i++) {
      const m = (a + b) / 2;
      if (surf(m, sheer(m)).z < z) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  /** Локальная система координат на поверхности борта: X вдоль борта, Y вверх, Z наружу. */
  const sideFrame = (t, y, sgn) => {
    const p = surf(t, y, sgn);
    const e = 0.01;
    const dT = surf(Math.min(1, t + e), y, sgn).sub(surf(Math.max(0, t - e), y, sgn));
    const dY = surf(t, y + 0.05, sgn).sub(surf(t, y - 0.05, sgn));
    const nrm = new THREE.Vector3().crossVectors(dY, dT).multiplyScalar(sgn).normalize();
    const right = dT.normalize().multiplyScalar(-sgn);
    const up = new THREE.Vector3().crossVectors(nrm, right).normalize();
    right.crossVectors(up, nrm).normalize();
    return new THREE.Matrix4().makeBasis(right, up, nrm).setPosition(p);
  };

  return {
    ...S,
    stations: ts, levels, bulkheads, hasTransom, sternGap, tQ, tP, tF, bwC, kd, kw,
    stackAt, topLevelAt, deckY, topY, mainDeckY, deckPoint, deckHalf, tAtZ, sideFrame, inner,
    hasQuarterdeck: qd.on, hasPoop: qd.on && pp.on, hasForecastle: fc.on,
  };
}
