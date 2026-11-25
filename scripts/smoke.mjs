// Проверка генератора без браузера: собирает все заготовки и много случайных
// кораблей с параметрами по всему диапазону ползунков, ищет ошибки и NaN в геометрии.
// Запуск: npm test
import { buildShip } from '../src/builder/ship.js';
import { createMaterials } from '../src/builder/materials.js';
import { BOW_TYPES, STERN_TYPES } from '../src/builder/hull.js';
import { RIG_TYPES } from '../src/builder/rig.js';
import { GUN_ROWS } from '../src/builder/details.js';
import { PRESETS, presetState, randomState, newMast } from '../src/presets.js';

const materials = createMaterials();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const flip = (p = 0.5) => Math.random() < p;

function wildState() {
  const s = presetState(pick(PRESETS).id);
  Object.assign(s.hull, {
    length: rnd(6, 70),
    beam: rnd(2, 18),
    draft: rnd(0.5, 7),
    freeboard: rnd(0.6, 8),
    bulwark: rnd(0.2, 1.8),
    midFullness: rnd(0, 1),
    tumblehome: rnd(0, 0.3),
    sheerBow: rnd(0, 5),
    sheerStern: rnd(0, 5),
    bowType: pick(Object.keys(BOW_TYPES)),
    bowRake: rnd(-0.12, 0.3),
    bowFullness: rnd(0, 1),
    sternType: pick(Object.keys(STERN_TYPES)),
    sternWidth: rnd(0.2, 1),
    sternRake: rnd(-0.03, 0.2),
    sternRise: rnd(0, 1.2),
    sternFullness: rnd(0, 1),
    detail: pick([0, 1, 2]),
    keel: flip(0.8),
    rudder: flip(0.8),
    forecastle: { on: flip(), length: rnd(0.06, 0.4), height: rnd(0.5, 3.5) },
    quarterdeck: { on: flip(), length: rnd(0.06, 0.6), height: rnd(0.5, 3.5) },
    poop: { on: flip(), length: rnd(0.06, 0.5), height: rnd(0.5, 3.5) },
  });
  const n = Math.floor(rnd(0, 6));
  s.rig.masts = Array.from({ length: n }, () =>
    newMast({
      pos: rnd(0.05, 0.95),
      height: rnd(4, 55),
      rake: rnd(-12, 15),
      rig: pick(Object.keys(RIG_TYPES)),
      sails: Math.round(rnd(1, 4)),
      width: rnd(0.5, 1.5),
      spanker: flip(),
      gaffTopsail: flip(),
      squareTopsail: flip(),
      battens: Math.round(rnd(3, 8)),
      tilt: rnd(-35, 35),
      twist: rnd(-20, 20),
      alternate: flip(),
      cut: pick(['plain', 'split', 'twin', 'layer', 'round', 'bell']),
      ribbed: flip(0.35),
    }),
  );
  Object.assign(s.rig, {
    bowsprit: { on: flip(0.8), length: rnd(0.05, 0.5), angle: rnd(0, 40), jibs: Math.round(rnd(0, 4)), spritsail: flip(0.35) },
    trim: rnd(-35, 35),
    billow: rnd(0, 2),
    furled: flip(0.2),
    stripes: flip(0.35),
    rigging: flip(0.8),
    tops: flip(),
    pennants: flip(),
  });
  Object.assign(s.details, {
    guns: Math.round(rnd(0, 24)),
    gunRow: pick(Object.keys(GUN_ROWS)),
    sternWindows: Math.round(rnd(0, 9)),
    lanterns: Math.round(rnd(0, 3)),
    anchors: flip(),
    hatches: flip(),
    wheel: flip(),
    beakhead: flip(),
    doors: flip(),
    ensign: flip(),
    oars: flip(0.3) ? Math.round(rnd(0, 20)) : 0,
  });
  return s;
}

function check(state, label) {
  const { group, triangles } = buildShip(state, materials);
  let verts = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position').array;
    const nrm = o.geometry.getAttribute('normal').array;
    verts += pos.length / 3;
    for (let i = 0; i < pos.length; i++) {
      if (!Number.isFinite(pos[i]) || !Number.isFinite(nrm[i])) {
        throw new Error(`${label}: NaN в меше "${o.name}"`);
      }
    }
    const bb = o.geometry.boundingBox;
    const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    if (span > 600) throw new Error(`${label}: меш "${o.name}" неправдоподобно большой (${span.toFixed(0)} м)`);
    o.geometry.dispose();
  });
  if (triangles < 100) throw new Error(`${label}: слишком мало треугольников (${triangles})`);
  return { triangles, verts };
}

let failed = 0;
const run = (state, label) => {
  try {
    return check(state, label);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}: ${err.message}`);
    if (failed <= 3) {
      console.error(err.stack);
      console.error(JSON.stringify(state));
    }
    return null;
  }
};

for (const p of PRESETS) {
  const r = run(presetState(p.id), `заготовка ${p.id}`);
  if (r) console.log(`${p.id.padEnd(11)} ${String(r.triangles).padStart(5)} треугольников`);
}

const N = 600;
let maxTris = 0;
for (let i = 0; i < N; i++) {
  const r = run(i % 3 === 0 ? randomState() : wildState(), `случайный #${i}`);
  if (r) maxTris = Math.max(maxTris, r.triangles);
}
console.log(`случайных кораблей: ${N}, максимум треугольников: ${maxTris}, ошибок: ${failed}`);
process.exit(failed ? 1 : 0);
