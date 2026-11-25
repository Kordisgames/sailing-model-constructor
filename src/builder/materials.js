import * as THREE from 'three';

/** Цвета, которые настраивает пользователь. Ключ совпадает с именем материала в GLB. */
export const COLOR_SLOTS = [
  { key: 'hull', label: 'Борт' },
  { key: 'bottom', label: 'Днище' },
  { key: 'wale', label: 'Бархоут (пояс)' },
  { key: 'bulwark', label: 'Верх борта, надстройки' },
  { key: 'trim', label: 'Отделка, планширь' },
  { key: 'keel', label: 'Киль, штевни, руль' },
  { key: 'deck', label: 'Палуба' },
  { key: 'spar', label: 'Мачты и реи' },
  { key: 'sail', label: 'Паруса' },
  { key: 'sail2', label: 'Паруса: полосы' },
  { key: 'flag', label: 'Флаги' },
];

export const PALETTES = {
  wood: {
    label: 'Дерево',
    colors: {
      hull: '#a37a4c', bottom: '#8a6540', wale: '#6f4f31', bulwark: '#a37a4c', trim: '#c9a368',
      keel: '#5f432a', deck: '#c2a071', spar: '#7a5a3a', sail: '#ece3cf', sail2: '#b8402f', flag: '#b8402f',
    },
  },
  royal: {
    label: 'Королевский',
    colors: {
      hull: '#9c7446', bottom: '#d8d2c0', wale: '#3f3327', bulwark: '#3f6f8f', trim: '#e0b84a',
      keel: '#4f3a26', deck: '#c7a877', spar: '#7d5d3c', sail: '#f0e8d6', sail2: '#2f5fa8', flag: '#2f5fa8',
    },
  },
  golden: {
    label: 'Золотой',
    colors: {
      hull: '#94693d', bottom: '#7d5733', wale: '#5a3f27', bulwark: '#d6ac3f', trim: '#f0d27a',
      keel: '#4a3421', deck: '#bf9a66', spar: '#6f5134', sail: '#efe6d0', sail2: '#d6ac3f', flag: '#c9a227',
    },
  },
  pirate: {
    label: 'Пиратский',
    colors: {
      hull: '#3a322d', bottom: '#2a2421', wale: '#8c2f25', bulwark: '#2f2925', trim: '#a8382b',
      keel: '#211c19', deck: '#8f7450', spar: '#4a3a2c', sail: '#3b3836', sail2: '#8c2f25', flag: '#141414',
    },
  },
  navy: {
    label: 'Военный',
    colors: {
      hull: '#2c2a29', bottom: '#b9b3a2', wale: '#d1a23b', bulwark: '#2c2a29', trim: '#d1a23b',
      keel: '#242120', deck: '#c4a77a', spar: '#8a6a46', sail: '#eee7d6', sail2: '#b3271f', flag: '#b3271f',
    },
  },
  merchant: {
    label: 'Торговец',
    colors: {
      hull: '#8e6a45', bottom: '#6c4f34', wale: '#4d6b4a', bulwark: '#c9b58c', trim: '#4d6b4a',
      keel: '#5a422c', deck: '#bfa075', spar: '#75573a', sail: '#e6dcc3', sail2: '#4d6b4a', flag: '#4d6b4a',
    },
  },
  crimson: {
    label: 'Алый',
    colors: {
      hull: '#8a6038', bottom: '#70502f', wale: '#3d2c1f', bulwark: '#a33a2c', trim: '#e3c06a',
      keel: '#463220', deck: '#c0a070', spar: '#6e5033', sail: '#f1e9d8', sail2: '#a33a2c', flag: '#a33a2c',
    },
  },
  orient: {
    label: 'Восточный',
    colors: {
      hull: '#7a5434', bottom: '#5a3f28', wale: '#33291f', bulwark: '#8f3226', trim: '#d9b24f',
      keel: '#3f2c1d', deck: '#b8966a', spar: '#5e4530', sail: '#b9553a', sail2: '#d9b24f', flag: '#d9b24f',
    },
  },
  gilded: {
    label: 'Позолота',
    colors: {
      hull: '#6e4a28', bottom: '#cfc6a8', wale: '#3a2a18', bulwark: '#5a3f24', trim: '#f2c14b',
      keel: '#2e2114', deck: '#c9a96a', spar: '#6a4e32', sail: '#f3ead4', sail2: '#e0a820', flag: '#e0a820',
    },
  },
  violet: {
    label: 'Фиолетовый',
    colors: {
      hull: '#6b4e38', bottom: '#8a7660', wale: '#2c2433', bulwark: '#5b3d78', trim: '#c9a227',
      keel: '#2a1f18', deck: '#b89a6e', spar: '#5c4530', sail: '#ebe3d2', sail2: '#7a4ea8', flag: '#7a4ea8',
    },
  },
  walnut: {
    label: 'Тёмно-коричневый',
    colors: {
      hull: '#3d2a1c', bottom: '#2a1c13', wale: '#1a120c', bulwark: '#4a3424', trim: '#8a6a3e',
      keel: '#18100a', deck: '#6e5438', spar: '#3a2a1c', sail: '#d9ceb6', sail2: '#6b4428', flag: '#5a3a22',
    },
  },
  ivory: {
    label: 'Слоновая кость',
    colors: {
      hull: '#d6cbb0', bottom: '#b9ae95', wale: '#6a5a42', bulwark: '#ebe3d0', trim: '#c9a368',
      keel: '#5a4a34', deck: '#e8dcc4', spar: '#8a7355', sail: '#f7f1e4', sail2: '#8c2f25', flag: '#8c2f25',
    },
  },
  teal: {
    label: 'Бирюзовый',
    colors: {
      hull: '#7a5a3a', bottom: '#cfc7b0', wale: '#2a3332', bulwark: '#2f6f6a', trim: '#d4b45a',
      keel: '#3a2a1c', deck: '#c2a478', spar: '#6e5336', sail: '#efe7d4', sail2: '#2f6f6a', flag: '#b3271f',
    },
  },
};

const CUSTOM_KEY = 'ship-builder:palettes:v1';

/** Снимок текущих цветов в объект палитры. */
export function snapshotColors(colors) {
  const out = {};
  for (const { key } of COLOR_SLOTS) out[key] = colors[key] ?? '#ffffff';
  return out;
}

/** Пользовательские палитры из localStorage. */
export function loadCustomPalettes() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.id && p.label && p.colors) : [];
  } catch {
    return [];
  }
}

function saveCustomList(list) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

/** Сохранить текущие цвета как именованную палитру. */
export function saveCustomPalette(label, colors) {
  const name = String(label ?? '').trim().slice(0, 40);
  if (!name) return null;
  const list = loadCustomPalettes();
  const entry = {
    id: `c${Date.now().toString(36)}`,
    label: name,
    colors: snapshotColors(colors),
  };
  list.push(entry);
  saveCustomList(list);
  return entry;
}

/** Удалить пользовательскую палитру по id. */
export function deleteCustomPalette(id) {
  saveCustomList(loadCustomPalettes().filter((p) => p.id !== id));
}

const FIXED = {
  metal: { color: '#2f3034', roughness: 0.6, metalness: 0.4 },
  dark: { color: '#231b15', roughness: 1, metalness: 0 },
  rope: { color: '#3d3127', roughness: 1, metalness: 0 },
  glass: { color: '#f2c468', roughness: 0.4, metalness: 0, emissive: '#6b4a12' },
};

export function createMaterials() {
  const mats = {};
  for (const { key } of COLOR_SLOTS) {
    mats[key] = new THREE.MeshStandardMaterial({
      name: key,
      color: '#ffffff',
      roughness: key === 'sail' || key === 'sail2' || key === 'flag' ? 1 : 0.86,
      metalness: 0,
      flatShading: true,
    });
  }
  for (const [key, def] of Object.entries(FIXED)) {
    mats[key] = new THREE.MeshStandardMaterial({
      name: key,
      color: def.color,
      roughness: def.roughness,
      metalness: def.metalness,
      emissive: def.emissive ?? '#000000',
      flatShading: true,
    });
  }
  return mats;
}

export function applyColors(mats, colors) {
  for (const { key } of COLOR_SLOTS) {
    if (colors[key]) mats[key].color.set(colors[key]);
  }
}
