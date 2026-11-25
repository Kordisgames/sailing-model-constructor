import { PALETTES } from './builder/materials.js';
import { BOW_TYPES, STERN_TYPES, HULL_FORMS, applyHullForm } from './builder/hull.js';

/** Полное описание корабля со значениями по умолчанию. */
export function baseState() {
  return {
    version: 1,
    name: 'Корабль',
    hull: {
      length: 26,
      beam: 7.2,
      draft: 2.6,
      freeboard: 2.6,
      bulwark: 0.9,
      midFullness: 0.7,
      tumblehome: 0.04,
      sheerBow: 1.3,
      sheerStern: 0.9,
      bowType: 'clipper',
      bowRake: 0.14,
      bowFullness: 0.35,
      sternType: 'transom',
      sternWidth: 0.72,
      sternRake: 0.05,
      sternRise: 0.55,
      sternFullness: 0.5,
      detail: 1,
      keel: true,
      rudder: true,
      forecastle: { on: false, length: 0.16, height: 1.3 },
      quarterdeck: { on: false, length: 0.28, height: 1.5 },
      poop: { on: false, length: 0.13, height: 1.5 },
    },
    rig: {
      masts: [],
      bowsprit: { on: true, length: 0.24, angle: 18, jibs: 2, spritsail: false },
      trim: 14,
      billow: 1,
      furled: false,
      stripes: false,
      rigging: true,
      tops: true,
      pennants: true,
    },
    details: {
      guns: 0,
      gunRow: 'hull',
      sternWindows: 0,
      lanterns: 1,
      anchors: true,
      hatches: true,
      wheel: true,
      beakhead: false,
      doors: true,
      ensign: true,
      oars: 0,
    },
    colors: { ...PALETTES.wood.colors },
  };
}

export function newMast(over = {}) {
  return {
    pos: 0.5,
    height: 22,
    rake: 2,
    rig: 'square',
    sails: 3,
    width: 1,
    spanker: false,
    gaffTopsail: true,
    squareTopsail: false,
    battens: 5,
    tilt: 18,
    twist: 6,
    alternate: false,
    cut: 'plain',
    ribbed: false,
    wingStyle: 'ribbed',
    wingAngle: 28,
    wingInflate: 1,
    wingTilt: 32,
    ...over,
  };
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Глубокое слияние: значения из over поверх base (массивы заменяются целиком). */
export function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/** Привести загруженный проект к актуальной структуре. */
export function normalizeState(raw) {
  const s = merge(baseState(), raw ?? {});
  s.rig.masts = (s.rig.masts ?? []).map((m) => {
    const mast = newMast(m);
    if (mast.cut === 'briefs') mast.cut = 'bell'; // старое имя «Трусы»
    return mast;
  });
  if (!BOW_TYPES[s.hull.bowType]) s.hull.bowType = 'clipper';
  if (!STERN_TYPES[s.hull.sternType]) s.hull.sternType = 'transom';
  return s;
}

export const PRESETS = [
  {
    id: 'sloop',
    label: 'Шлюп',
    hint: 'Одна мачта, гафельный грот и кливера',
    state: {
      name: 'Шлюп',
      hull: {
        length: 13, beam: 4.3, draft: 1.5, freeboard: 1.35, bulwark: 0.5, midFullness: 0.68,
        tumblehome: 0, sheerBow: 0.75, sheerStern: 0.4,
        bowType: 'clipper', bowRake: 0.13, bowFullness: 0.4,
        sternType: 'transom', sternWidth: 0.7, sternRake: 0.06, sternRise: 0.6, sternFullness: 0.5,
      },
      rig: {
        masts: [newMast({ pos: 0.6, height: 15, rake: 3, rig: 'gaff', gaffTopsail: true })],
        bowsprit: { on: true, length: 0.34, angle: 12, jibs: 2 },
        tops: false,
      },
      details: { guns: 0, lanterns: 0, anchors: false, hatches: true, sternWindows: 0 },
      colors: PALETTES.wood.colors,
    },
  },
  {
    id: 'tartane',
    label: 'Тартана',
    hint: 'Острая корма и латинский парус',
    state: {
      name: 'Тартана',
      hull: {
        length: 15, beam: 4.6, draft: 1.5, freeboard: 1.4, bulwark: 0.5, midFullness: 0.62,
        tumblehome: 0, sheerBow: 1.0, sheerStern: 0.8,
        bowType: 'raked', bowRake: 0.12, bowFullness: 0.4,
        sternType: 'pointed', sternWidth: 0, sternRake: 0.07, sternRise: 0.35, sternFullness: 0.45,
      },
      rig: {
        masts: [newMast({ pos: 0.56, height: 13, rake: -4, rig: 'lateen' })],
        bowsprit: { on: true, length: 0.24, angle: 10, jibs: 1 },
        tops: false,
      },
      details: { guns: 0, lanterns: 0, anchors: false, hatches: true, sternWindows: 0 },
      colors: PALETTES.merchant.colors,
    },
  },
  {
    id: 'schooner',
    label: 'Шхуна',
    hint: 'Две мачты с гафельными парусами',
    state: {
      name: 'Шхуна',
      hull: {
        length: 24, beam: 6.4, draft: 2.3, freeboard: 2.1, bulwark: 0.8, midFullness: 0.66,
        tumblehome: 0.02, sheerBow: 1.2, sheerStern: 0.7,
        bowType: 'clipper', bowRake: 0.15, bowFullness: 0.33,
        sternType: 'transom', sternWidth: 0.66, sternRake: 0.06, sternRise: 0.55, sternFullness: 0.5,
      },
      rig: {
        masts: [
          newMast({ pos: 0.7, height: 20, rake: 4, rig: 'gaff', gaffTopsail: true }),
          newMast({ pos: 0.4, height: 22, rake: 4, rig: 'gaff', gaffTopsail: true }),
        ],
        bowsprit: { on: true, length: 0.28, angle: 14, jibs: 3 },
      },
      details: { guns: 4, gunRow: 'deck', lanterns: 1, sternWindows: 3 },
      colors: PALETTES.wood.colors,
    },
  },
  {
    id: 'brigantine',
    label: 'Бригантина',
    hint: 'Фок с прямыми парусами, грот гафельный',
    state: {
      name: 'Бригантина',
      hull: {
        length: 27, beam: 7.4, draft: 2.6, freeboard: 2.5, bulwark: 0.9, midFullness: 0.7,
        tumblehome: 0.04, sheerBow: 1.3, sheerStern: 0.9,
        bowType: 'clipper', bowRake: 0.13, bowFullness: 0.38,
        sternType: 'transom', sternWidth: 0.7, sternRake: 0.05, sternRise: 0.55, sternFullness: 0.5,
        quarterdeck: { on: true, length: 0.24, height: 1.2 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.7, height: 23, rake: 2, rig: 'square', sails: 3 }),
          newMast({ pos: 0.37, height: 25, rake: 3, rig: 'gaff', gaffTopsail: true }),
        ],
        bowsprit: { on: true, length: 0.27, angle: 16, jibs: 3 },
      },
      details: { guns: 5, gunRow: 'deck', lanterns: 1, sternWindows: 4 },
      colors: PALETTES.crimson.colors,
    },
  },
  {
    id: 'brig',
    label: 'Бриг',
    hint: 'Две мачты с прямыми парусами и бизань-гафель',
    state: {
      name: 'Бриг',
      hull: {
        length: 31, beam: 8.4, draft: 3.0, freeboard: 3.0, bulwark: 1.0, midFullness: 0.74,
        tumblehome: 0.05, sheerBow: 1.4, sheerStern: 1.0,
        bowType: 'raked', bowRake: 0.1, bowFullness: 0.48,
        sternType: 'transom', sternWidth: 0.72, sternRake: 0.05, sternRise: 0.55, sternFullness: 0.52,
        quarterdeck: { on: true, length: 0.26, height: 1.4 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.72, height: 26, rake: 1, rig: 'square', sails: 3 }),
          newMast({ pos: 0.4, height: 29, rake: 2, rig: 'square', sails: 3, spanker: true }),
        ],
        bowsprit: { on: true, length: 0.27, angle: 18, jibs: 3 },
      },
      details: { guns: 7, gunRow: 'hull', lanterns: 1, sternWindows: 4 },
      colors: PALETTES.golden.colors,
    },
  },
  {
    id: 'frigate',
    label: 'Фрегат',
    hint: 'Три мачты, два ряда пушек',
    state: {
      name: 'Фрегат',
      hull: {
        length: 42, beam: 10.6, draft: 3.7, freeboard: 3.8, bulwark: 1.1, midFullness: 0.76,
        tumblehome: 0.07, sheerBow: 1.6, sheerStern: 1.3,
        bowType: 'raked', bowRake: 0.09, bowFullness: 0.52,
        sternType: 'transom', sternWidth: 0.7, sternRake: 0.055, sternRise: 0.55, sternFullness: 0.55,
        forecastle: { on: true, length: 0.15, height: 1.1 },
        quarterdeck: { on: true, length: 0.32, height: 1.5 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.78, height: 31, rake: 1, rig: 'square', sails: 4 }),
          newMast({ pos: 0.52, height: 35, rake: 2, rig: 'square', sails: 4 }),
          newMast({ pos: 0.24, height: 27, rake: 3, rig: 'square', sails: 3, spanker: true, width: 0.85 }),
        ],
        bowsprit: { on: true, length: 0.25, angle: 20, jibs: 3 },
      },
      details: { guns: 12, gunRow: 'both', lanterns: 3, sternWindows: 6 },
      colors: PALETTES.royal.colors,
    },
  },
  {
    id: 'galleon',
    label: 'Галеон',
    hint: 'Высокие надстройки, пузатый корпус, гальюн',
    state: {
      name: 'Галеон',
      hull: {
        length: 38, beam: 10.8, draft: 3.9, freeboard: 3.6, bulwark: 1.0, midFullness: 0.8,
        tumblehome: 0.14, sheerBow: 1.7, sheerStern: 2.6,
        bowType: 'bluff', bowRake: 0.07, bowFullness: 0.72,
        sternType: 'galleon', sternWidth: 0.55, sternRake: 0.085, sternRise: 0.6, sternFullness: 0.6,
        forecastle: { on: true, length: 0.18, height: 1.8 },
        quarterdeck: { on: true, length: 0.36, height: 2.0 },
        poop: { on: true, length: 0.18, height: 1.8 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.8, height: 25, rake: 0, rig: 'square', sails: 2 }),
          newMast({ pos: 0.53, height: 30, rake: 1, rig: 'square', sails: 3 }),
          newMast({ pos: 0.24, height: 21, rake: 3, rig: 'lateen' }),
        ],
        bowsprit: { on: true, length: 0.22, angle: 28, jibs: 1 },
      },
      details: { guns: 9, gunRow: 'both', lanterns: 3, sternWindows: 5, beakhead: true },
      colors: PALETTES.crimson.colors,
    },
  },
  {
    id: 'xebec',
    label: 'Шебека',
    hint: 'Три латинских паруса, острые обводы',
    state: {
      name: 'Шебека',
      hull: {
        length: 30, beam: 7.2, draft: 2.3, freeboard: 2.2, bulwark: 0.8, midFullness: 0.62,
        tumblehome: 0.03, sheerBow: 1.5, sheerStern: 1.5,
        bowType: 'clipper', bowRake: 0.17, bowFullness: 0.3,
        sternType: 'round', sternWidth: 0, sternRake: 0.09, sternRise: 0.6, sternFullness: 0.6,
        quarterdeck: { on: true, length: 0.22, height: 1.0 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.78, height: 18, rake: -8, rig: 'lateen' }),
          newMast({ pos: 0.5, height: 21, rake: 0, rig: 'lateen' }),
          newMast({ pos: 0.2, height: 15, rake: 3, rig: 'lateen', width: 0.9 }),
        ],
        bowsprit: { on: true, length: 0.18, angle: 10, jibs: 0 },
        tops: false,
      },
      details: { guns: 8, gunRow: 'deck', lanterns: 1, sternWindows: 0 },
      colors: PALETTES.navy.colors,
    },
  },
  {
    id: 'junk',
    label: 'Джонка',
    hint: 'Китайские паруса на латах, высокая корма с проёмом',
    state: {
      name: 'Джонка',
      hull: {
        length: 28, beam: 8.2, draft: 2.1, freeboard: 2.3, bulwark: 0.8, midFullness: 0.86,
        tumblehome: 0.03, sheerBow: 1.9, sheerStern: 2.6,
        bowType: 'spoon', bowRake: 0.13, bowFullness: 0.62,
        sternType: 'open', sternWidth: 0.85, sternRake: 0.1, sternRise: 0.6, sternFullness: 0.6,
        quarterdeck: { on: true, length: 0.27, height: 1.4 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.84, height: 15, rake: -7, rig: 'junk', battens: 5, width: 0.95 }),
          newMast({ pos: 0.54, height: 23, rake: 0, rig: 'junk', battens: 6 }),
          newMast({ pos: 0.17, height: 13, rake: 4, rig: 'junk', battens: 4, width: 0.85 }),
        ],
        bowsprit: { on: false, length: 0.2, angle: 12, jibs: 0 },
        tops: false,
      },
      details: { guns: 4, gunRow: 'deck', lanterns: 2, sternWindows: 4, anchors: true },
      colors: PALETTES.orient.colors,
    },
  },
  {
    id: 'oblique',
    label: 'Косая джонка',
    hint: 'Многоугольные косые паруса с горизонтальными латами',
    state: {
      name: 'Косая джонка',
      hull: {
        length: 30, beam: 8.6, draft: 2.3, freeboard: 2.5, bulwark: 0.85, midFullness: 0.82,
        tumblehome: 0.04, sheerBow: 1.6, sheerStern: 2.2,
        bowType: 'spoon', bowRake: 0.12, bowFullness: 0.58,
        sternType: 'open', sternWidth: 0.82, sternRake: 0.09, sternRise: 0.6, sternFullness: 0.6,
        quarterdeck: { on: true, length: 0.26, height: 1.5 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.82, height: 16, rake: -5, rig: 'oblique', battens: 5, width: 0.95 }),
          newMast({ pos: 0.52, height: 24, rake: 0, rig: 'oblique', battens: 6 }),
          newMast({ pos: 0.2, height: 14, rake: 4, rig: 'oblique', battens: 5, width: 0.88 }),
        ],
        bowsprit: { on: false, length: 0.18, angle: 10, jibs: 0 },
        tops: true,
        billow: 1.15,
      },
      details: { guns: 3, gunRow: 'deck', lanterns: 2, sternWindows: 3, anchors: true },
      colors: { ...PALETTES.orient.colors, sail: '#e6d8b8', sail2: '#8f3226' },
    },
  },
  {
    id: 'corsair',
    label: 'Корсар',
    hint: 'Фэнтези: косые реи вразнобой, полукруглая корма',
    state: {
      name: 'Корсар',
      hull: {
        length: 34, beam: 10, draft: 3.4, freeboard: 3.3, bulwark: 1.0, midFullness: 0.84,
        tumblehome: 0.14, sheerBow: 1.6, sheerStern: 2.2,
        bowType: 'bluff', bowRake: 0.08, bowFullness: 0.7,
        sternType: 'tub', sternWidth: 0, sternRake: 0.05, sternRise: 0.5, sternFullness: 0.85,
        forecastle: { on: true, length: 0.16, height: 1.4 },
        quarterdeck: { on: true, length: 0.3, height: 1.8 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.76, height: 25, rake: -2, rig: 'skew', sails: 3, tilt: 15, twist: 5, alternate: true }),
          newMast({ pos: 0.47, height: 30, rake: 2, rig: 'skew', sails: 3, tilt: -17, twist: -5, alternate: true }),
          newMast({ pos: 0.2, height: 19, rake: 5, rig: 'lateen', width: 0.9 }),
        ],
        bowsprit: { on: true, length: 0.2, angle: 24, jibs: 1 },
      },
      details: { guns: 8, gunRow: 'both', lanterns: 3, sternWindows: 6, beakhead: true },
      colors: { ...PALETTES.pirate.colors, sail: '#ddd3bd', flag: '#a8382b' },
    },
  },
  {
    id: 'drakkar',
    label: 'Драккар',
    hint: 'Ладья с высокими штевнями, прямой парус и вёсла',
    state: {
      name: 'Драккар',
      hull: {
        length: 24, beam: 5.2, draft: 1.0, freeboard: 1.1, bulwark: 0.35, midFullness: 0.55,
        tumblehome: 0, sheerBow: 2.1, sheerStern: 1.9,
        bowType: 'longship', bowRake: 0.12, bowFullness: 0.35,
        sternType: 'longship', sternWidth: 0, sternRake: 0.12, sternRise: 0.3, sternFullness: 0.4,
        form: 'longship',
      },
      rig: {
        masts: [newMast({ pos: 0.52, height: 11.5, rake: 0, rig: 'square', sails: 1, width: 1.05 })],
        bowsprit: { on: false, length: 0.2, angle: 12, jibs: 0 },
        tops: false,
        pennants: false,
      },
      details: { guns: 0, lanterns: 0, anchors: false, hatches: false, wheel: false, ensign: false, sternWindows: 0, oars: 9 },
      colors: { ...PALETTES.wood.colors, hull: '#7a5636', bulwark: '#7a5636', wale: '#4a3423', trim: '#c9a368', sail: '#b9483a' },
    },
  },
  {
    id: 'galley',
    label: 'Галера',
    hint: 'Длинный низкий корпус с тараном, латинские паруса и вёсла',
    state: {
      name: 'Галера',
      hull: {
        length: 40, beam: 6.8, draft: 2.0, freeboard: 2.3, bulwark: 0.8, midFullness: 0.8,
        tumblehome: 0, sheerBow: 1.0, sheerStern: 1.7,
        bowType: 'ram', bowRake: -0.07, bowFullness: 0.3,
        sternType: 'round', sternWidth: 0, sternRake: 0.07, sternRise: 0.5, sternFullness: 0.6,
        quarterdeck: { on: true, length: 0.2, height: 1.2 },
        form: 'galley',
      },
      rig: {
        masts: [
          newMast({ pos: 0.74, height: 19, rake: -5, rig: 'lateen' }),
          newMast({ pos: 0.42, height: 23, rake: 0, rig: 'lateen' }),
        ],
        bowsprit: { on: false, length: 0.15, angle: 8, jibs: 0 },
        tops: false,
      },
      details: { guns: 2, gunRow: 'deck', lanterns: 3, sternWindows: 0, hatches: true, oars: 14 },
      colors: PALETTES.royal.colors,
    },
  },
  {
    id: 'cog',
    label: 'Когг',
    hint: 'Круглый купеческий корпус, одна мачта, надстройки на носу и корме',
    state: {
      name: 'Когг',
      hull: {
        length: 20, beam: 7.2, draft: 2.4, freeboard: 2.5, bulwark: 0.7, midFullness: 0.85,
        tumblehome: 0.05, sheerBow: 1.0, sheerStern: 1.0,
        bowType: 'plumb', bowRake: 0.05, bowFullness: 0.6,
        sternType: 'tub', sternWidth: 0, sternRake: 0.04, sternRise: 0.5, sternFullness: 0.85,
        forecastle: { on: true, length: 0.17, height: 1.2 },
        quarterdeck: { on: true, length: 0.3, height: 1.5 },
        form: 'cog',
      },
      rig: {
        masts: [newMast({ pos: 0.54, height: 19, rake: 0, rig: 'square', sails: 1, width: 0.9 })],
        bowsprit: { on: true, length: 0.2, angle: 26, jibs: 0 },
      },
      details: { guns: 0, lanterns: 1, sternWindows: 4, hatches: true },
      colors: PALETTES.merchant.colors,
    },
  },
  {
    id: 'fluyt',
    label: 'Флейт',
    hint: 'Пузатый торговец с завалом бортов и круглой кормой',
    state: {
      name: 'Флейт',
      hull: {
        length: 34, beam: 10.4, draft: 3.7, freeboard: 3.4, bulwark: 1.0, midFullness: 0.9,
        tumblehome: 0.18, sheerBow: 1.4, sheerStern: 1.9,
        bowType: 'bluff', bowRake: 0.07, bowFullness: 0.78,
        sternType: 'tub', sternWidth: 0, sternRake: 0.05, sternRise: 0.5, sternFullness: 0.85,
        quarterdeck: { on: true, length: 0.3, height: 1.6 },
        poop: { on: true, length: 0.14, height: 1.4 },
        form: 'cargo',
      },
      rig: {
        masts: [
          newMast({ pos: 0.8, height: 24, rake: 0, rig: 'square', sails: 2 }),
          newMast({ pos: 0.53, height: 29, rake: 1, rig: 'square', sails: 3 }),
          newMast({ pos: 0.24, height: 20, rake: 3, rig: 'lateen', width: 0.9 }),
        ],
        bowsprit: { on: true, length: 0.22, angle: 24, jibs: 1 },
      },
      details: { guns: 5, gunRow: 'hull', lanterns: 1, sternWindows: 6 },
      colors: PALETTES.wood.colors,
    },
  },
  {
    id: 'lineship',
    label: 'Линейный корабль',
    hint: 'Три орудийные палубы, кормовая галерея, высокий борт',
    state: {
      name: 'Линейный корабль',
      hull: {
        length: 54, beam: 14.8, draft: 5.6, freeboard: 7.2, bulwark: 1.3, midFullness: 0.88,
        tumblehome: 0.2, sheerBow: 1.7, sheerStern: 2.4,
        bowType: 'bluff', bowRake: 0.06, bowFullness: 0.66,
        sternType: 'gallery', sternWidth: 0.7, sternRake: 0.06, sternRise: 0.58, sternFullness: 0.58,
        forecastle: { on: true, length: 0.14, height: 1.3 },
        quarterdeck: { on: true, length: 0.36, height: 1.8 },
        poop: { on: true, length: 0.17, height: 1.7 },
        form: 'warship',
      },
      rig: {
        masts: [
          newMast({ pos: 0.8, height: 40, rake: 1, rig: 'square', sails: 4 }),
          newMast({ pos: 0.54, height: 46, rake: 2, rig: 'square', sails: 4 }),
          newMast({ pos: 0.25, height: 35, rake: 3, rig: 'square', sails: 3, spanker: true, width: 0.85 }),
        ],
        bowsprit: { on: true, length: 0.24, angle: 22, jibs: 3 },
      },
      details: { guns: 14, gunRow: 'triple', lanterns: 3, sternWindows: 7, beakhead: true },
      colors: PALETTES.navy.colors,
    },
  },
  {
    id: 'winged',
    label: 'Крылатый',
    hint: 'Фэнтези: веер на бизани и большой косой парус вперёд к бушприту',
    state: {
      name: 'Крылатый',
      hull: {
        length: 32, beam: 9.2, draft: 3.2, freeboard: 3.0, bulwark: 0.9, midFullness: 0.78,
        tumblehome: 0.1, sheerBow: 1.5, sheerStern: 2.0,
        bowType: 'ram', bowRake: -0.05, bowFullness: 0.35,
        sternType: 'gallery', sternWidth: 0.62, sternRake: 0.07, sternRise: 0.55, sternFullness: 0.55,
        quarterdeck: { on: true, length: 0.28, height: 1.5 },
      },
      rig: {
        masts: [
          newMast({
            pos: 0.78, height: 18, rake: -2, rig: 'wing', width: 1.35,
            wingStyle: 'skew', wingAngle: 8, wingInflate: 1.1, wingTilt: 28,
          }),
          newMast({
            pos: 0.48, height: 24, rake: 1, rig: 'wing', width: 1.55,
            wingStyle: 'skew', wingAngle: 6, wingInflate: 1.15, wingTilt: 30,
          }),
          newMast({
            pos: 0.22, height: 26, rake: 3, rig: 'wing', battens: 6, width: 1.05,
            wingStyle: 'ribbed', wingAngle: 26, wingInflate: 1.1,
          }),
        ],
        bowsprit: { on: true, length: 0.28, angle: 16, jibs: 0, spritsail: false },
        stripes: true,
        tops: false,
        billow: 1.25,
      },
      details: { guns: 6, gunRow: 'deck', lanterns: 2, sternWindows: 4 },
      colors: { ...PALETTES.golden.colors, sail: '#f2efe4', sail2: '#e8c45a' },
    },
  },
  {
    id: 'opera',
    label: 'Сидней',
    hint: 'Паруса-ракушки, как своды Сиднейской оперы',
    state: {
      name: 'Сидней',
      hull: {
        length: 30, beam: 8.6, draft: 3.0, freeboard: 2.8, bulwark: 0.9, midFullness: 0.72,
        tumblehome: 0.06, sheerBow: 1.4, sheerStern: 1.6,
        bowType: 'clipper', bowRake: 0.14, bowFullness: 0.4,
        sternType: 'round', sternWidth: 0, sternRake: 0.06, sternRise: 0.55, sternFullness: 0.7,
        quarterdeck: { on: true, length: 0.24, height: 1.3 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.78, height: 18, rake: 0, rig: 'shell', width: 0.95 }),
          newMast({ pos: 0.52, height: 24, rake: 1, rig: 'shell' }),
          newMast({ pos: 0.26, height: 17, rake: 3, rig: 'shell', width: 0.85 }),
        ],
        bowsprit: { on: true, length: 0.26, angle: 16, jibs: 3, spritsail: false },
        tops: false,
        billow: 1.3,
      },
      details: { guns: 4, gunRow: 'deck', lanterns: 1, sternWindows: 0 },
      colors: { ...PALETTES.royal.colors, sail: '#d5cce8', sail2: '#6a5a8a', flag: '#6a5a8a' },
    },
  },
  {
    id: 'bellship',
    label: 'Колокол',
    hint: 'Паруса «колокол»: округлый верх, широкий низ, рифлёные складки и блинд',
    state: {
      name: 'Колокол',
      hull: {
        length: 36, beam: 10, draft: 3.5, freeboard: 3.4, bulwark: 1.0, midFullness: 0.8,
        tumblehome: 0.12, sheerBow: 1.5, sheerStern: 1.8,
        bowType: 'bluff', bowRake: 0.08, bowFullness: 0.65,
        sternType: 'tub', sternWidth: 0, sternRake: 0.05, sternRise: 0.5, sternFullness: 0.85,
        forecastle: { on: true, length: 0.14, height: 1.2 },
        quarterdeck: { on: true, length: 0.28, height: 1.5 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.76, height: 24, rake: 1, rig: 'square', sails: 2, cut: 'bell', ribbed: true }),
          newMast({ pos: 0.5, height: 28, rake: 2, rig: 'square', sails: 2, cut: 'bell', ribbed: true }),
          newMast({ pos: 0.24, height: 20, rake: 4, rig: 'square', sails: 2, cut: 'bell', ribbed: true, width: 0.9 }),
        ],
        bowsprit: { on: true, length: 0.22, angle: 20, jibs: 2, spritsail: true },
        billow: 1.25,
      },
      details: { guns: 7, gunRow: 'both', lanterns: 2, sternWindows: 5, beakhead: true },
      colors: { ...PALETTES.pirate.colors, sail: '#ddd3bd', sail2: '#8c2f25' },
    },
  },
  {
    id: 'layered',
    label: 'Двойной слой',
    hint: 'Прямые паруса слоями в одну сторону: большой и поменьше накладываются',
    state: {
      name: 'Двойной слой',
      hull: {
        length: 34, beam: 9.4, draft: 3.3, freeboard: 3.2, bulwark: 1.0, midFullness: 0.76,
        tumblehome: 0.08, sheerBow: 1.4, sheerStern: 1.5,
        bowType: 'raked', bowRake: 0.1, bowFullness: 0.48,
        sternType: 'transom', sternWidth: 0.7, sternRake: 0.05, sternRise: 0.55, sternFullness: 0.55,
        quarterdeck: { on: true, length: 0.26, height: 1.4 },
      },
      rig: {
        masts: [
          newMast({ pos: 0.74, height: 24, rake: 1, rig: 'square', sails: 2, cut: 'layer' }),
          newMast({ pos: 0.46, height: 28, rake: 2, rig: 'square', sails: 2, cut: 'layer' }),
          newMast({ pos: 0.22, height: 18, rake: 3, rig: 'lateen', width: 0.9 }),
        ],
        bowsprit: { on: true, length: 0.24, angle: 18, jibs: 2, spritsail: true },
        billow: 1.2,
      },
      details: { guns: 6, gunRow: 'hull', lanterns: 1, sternWindows: 4 },
      colors: PALETTES.crimson.colors,
    },
  },
];

export function presetState(id) {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return normalizeState(JSON.parse(JSON.stringify(p.state)));
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const round = (v, step = 0.01) => Math.round(v / step) * step;

/** Случайный корабль: берём заготовку и перемешиваем формы, пропорции и цвета. */
export function randomState() {
  const s = presetState(pick(PRESETS).id);
  const h = s.hull;
  h.bowType = pick(Object.keys(BOW_TYPES));
  Object.assign(h, BOW_TYPES[h.bowType].defaults);
  h.sternType = pick(Object.keys(STERN_TYPES));
  Object.assign(h, STERN_TYPES[h.sternType].defaults);
  const k = rnd(0.88, 1.15);
  h.length = round(h.length * k, 0.5);
  if (Math.random() < 0.4) {
    // иногда корпус целиком берётся из заготовки формы (кроме самых низких — под них нужен свой рангоут)
    applyHullForm(h, pick(Object.keys(HULL_FORMS).filter((id) => id !== 'longship' && id !== 'galley')));
  } else {
    delete h.form;
    h.beam = round(h.beam * k * rnd(0.92, 1.1), 0.1);
    h.midFullness = round(rnd(0.55, 0.85));
    h.tumblehome = round(rnd(0, 0.12));
    h.sheerBow = round(h.sheerBow * rnd(0.7, 1.4), 0.05);
    h.sheerStern = round(h.sheerStern * rnd(0.7, 1.4), 0.05);
  }
  // высокий штевень ладьи занимает место бушприта
  if (BOW_TYPES[h.bowType].post) s.rig.bowsprit.on = false;
  s.rig.billow = 1.2;
  s.rig.trim = Math.round(rnd(-20, 20));
  s.colors = { ...pick(Object.values(PALETTES)).colors };
  s.name = 'Случайный корабль';
  return s;
}
