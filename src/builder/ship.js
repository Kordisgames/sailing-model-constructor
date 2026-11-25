import { MeshBuilder } from './meshBuilder.js';
import { buildHull } from './hull.js';
import { buildRig } from './rig.js';
import { buildDetails } from './details.js';

/**
 * Собрать корабль по описанию state.
 * Система координат: нос смотрит в +Z, Y вверх, y = 0 — ватерлиния, единицы — метры.
 */
export function buildShip(state, materials) {
  const mb = new MeshBuilder();
  const shape = buildHull(mb, state.hull, state.details);
  const rigInfo = buildRig(mb, shape, state);
  buildDetails(mb, shape, state, rigInfo);
  const group = mb.build(materials, state.name || 'Ship');
  return { group, triangles: mb.triangleCount, shape };
}
