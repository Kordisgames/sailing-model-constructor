import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function fileSafeName(name) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
    л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const s = (name || 'ship')
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'ship';
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Экспорт корабля в GLB (binary) или glTF (JSON со встроенными буферами).
 * В extras корневого узла сохраняется описание корабля, чтобы модель можно было
 * снова открыть в конструкторе.
 */
export async function exportShip(group, state, { binary = true, origin = 'waterline', scale = 1 } = {}) {
  const root = group.clone();
  // Склеиваем совпадающие вершины внутри плоских граней: модель выглядит так же,
  // а файл и число вершин заметно меньше.
  const temp = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = mergeVertices(o.geometry, 1e-4);
    o.geometry.name = o.name;
    temp.push(o.geometry);
  });
  root.name = fileSafeName(state.name);
  root.userData = { shipBuilder: JSON.parse(JSON.stringify(state)) };
  root.scale.setScalar(scale);
  if (origin === 'keel') {
    let minY = Infinity;
    group.traverse((o) => {
      if (o.isMesh) minY = Math.min(minY, o.geometry.boundingBox.min.y);
    });
    if (Number.isFinite(minY)) root.position.y = -minY * scale;
  }
  root.updateMatrixWorld(true);

  const exporter = new GLTFExporter();
  let result;
  try {
    result = await exporter.parseAsync(root, { binary, onlyVisible: true });
  } finally {
    temp.forEach((g) => g.dispose());
  }
  const blob = binary
    ? new Blob([result], { type: 'model/gltf-binary' })
    : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
  download(blob, `${root.name}.${binary ? 'glb' : 'gltf'}`);
  return blob.size;
}

/** Прочитать проект из файла: .json проекта или .glb/.gltf, экспортированный конструктором. */
export async function readProjectFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json')) {
    return JSON.parse(await file.text());
  }
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
    const buffer = await file.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    let found = null;
    gltf.scene.traverse((o) => {
      if (!found && o.userData?.shipBuilder) found = o.userData.shipBuilder;
    });
    if (!found) throw new Error('В этой модели нет данных конструктора (она создана не здесь).');
    return found;
  }
  throw new Error('Поддерживаются файлы .json, .glb и .gltf');
}
