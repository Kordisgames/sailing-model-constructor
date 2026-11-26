import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { buildShip } from './builder/ship.js';
import { createMaterials, applyColors } from './builder/materials.js';
import { presetState, normalizeState, randomState } from './presets.js';
import { createUI } from './ui.js';
import { exportShip, readProjectFile, buildProjectJson, download, fileSafeName } from './exporter.js';
import { getBackdropTexture } from './builder/backdrops.js';

const STATE_KEY = 'ship-builder:state:v1';
const SETTINGS_KEY = 'ship-builder:settings:v1';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- состояние
function loadStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const app = {
  state: normalizeState(loadStored(STATE_KEY) ?? presetState('brig')),
  settings: {
    origin: 'waterline',
    scale: 1,
    water: false,
    keepView: true,
    savedView: null,
    backdrop: 'none',
    pngTransparent: false,
    ...(loadStored(SETTINGS_KEY) ?? {}),
  },
  changed: () => scheduleRebuild(),
  saveSettings: () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings)),
  loadPreset: (id) => setState(presetState(id)),
  randomize: () => setState(randomState()),
  exportModel,
  exportIcon,
  saveProject,
  openProject: () => $('file-input').click(),
  getCameraView,
  applyCameraView,
  rememberView,
  applySavedView,
  clearSavedView,
  setBackdrop,
};

// ---------------------------------------------------------------- сцена
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const BG = new THREE.Color('#40464a');
const scene = new THREE.Scene();
scene.background = BG;

function setBackdrop(id) {
  app.settings.backdrop = id || 'none';
  app.saveSettings();
  applySceneBackground();
}

function applySceneBackground() {
  const id = app.settings.backdrop || 'none';
  if (id === 'none') {
    scene.background = BG;
    return;
  }
  const tex = getBackdropTexture(id);
  scene.background = tex || BG;
}

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.93;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight('#ffffff', '#b3a798', 2.25));
const sun = new THREE.DirectionalLight('#fff1d8', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.08;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#d6e2ff', 0.8);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShadowMaterial({ color: '#000000', opacity: 0.28 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const water = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 72),
  new THREE.MeshStandardMaterial({
    color: '#3f86ad',
    transparent: true,
    opacity: 0.62,
    roughness: 0.35,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
water.rotation.x = -Math.PI / 2;
water.visible = app.settings.water;
scene.add(water);

const materials = createMaterials();
let ship = null;
let bounds = new THREE.Box3();

// ---------------------------------------------------------------- сборка
let dirty = true;
let saveTimer = 0;

function scheduleRebuild() {
  dirty = true;
}

function disposeShip() {
  if (!ship) return;
  scene.remove(ship);
  ship.traverse((o) => o.geometry?.dispose());
  ship = null;
}

function rebuild() {
  dirty = false;
  let result;
  try {
    applyColors(materials, app.state.colors);
    result = buildShip(app.state, materials);
  } catch (err) {
    console.error(err);
    toast(`Не удалось построить корабль: ${err.message}`, true);
    return;
  }
  disposeShip();
  ship = result.group;
  scene.add(ship);

  bounds = new THREE.Box3().setFromObject(ship);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);

  ground.position.set(center.x, bounds.min.y - 0.03, center.z);
  ground.scale.setScalar(span * 8);
  water.position.set(center.x, 0, center.z);
  water.scale.setScalar(span * 4);

  sun.position.set(center.x - span * 0.5, bounds.max.y + span * 0.75, center.z + span * 0.8);
  sun.target.position.copy(center);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span * 0.95;
  sc.right = sc.top = span * 0.95;
  sc.near = 0.5;
  sc.far = span * 4;
  sc.updateProjectionMatrix();
  fill.position.set(center.x + span, center.y + span * 0.4, center.z - span);

  $('stats').textContent =
    `${result.triangles.toLocaleString('ru-RU')} треугольников · ` +
    `${size.z.toFixed(1)} × ${size.x.toFixed(1)} × ${size.y.toFixed(1)} м`;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(app.state));
    } catch {
      /* хранилище недоступно — не критично */
    }
  }, 300);
}

/** Дистанция «Показать целиком» для текущего корабля. */
function computeFitDistance() {
  if (!ship) return 40;
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(0.5, size.length() / 2);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitH = radius / Math.sin(fov / 2);
  const fitW = radius / Math.sin(Math.atan(Math.tan(fov / 2) * Math.max(0.2, camera.aspect)));
  return Math.max(fitH, fitW) * 0.78;
}

/** Текущий ракурс: азимут/высота в градусах, zoom относительно «Показать целиком». */
function getCameraView() {
  const offset = camera.position.clone().sub(controls.target);
  const s = new THREE.Spherical().setFromVector3(offset);
  const fit = computeFitDistance() || s.radius || 1;
  return {
    azimuth: Math.round(THREE.MathUtils.radToDeg(s.theta) * 10) / 10,
    elevation: Math.round((90 - THREE.MathUtils.radToDeg(s.phi)) * 10) / 10,
    zoom: Math.round((s.radius / fit) * 1000) / 1000,
  };
}

/** Применить ракурс к текущему кораблю (центр и зум пересчитываются под размер). */
function applyCameraView(v) {
  if (!ship || !v) return false;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(0.5, size.length() / 2);
  const fit = computeFitDistance();
  const dist = Math.max(radius * 0.3, (v.zoom ?? 1) * fit);
  const phi = THREE.MathUtils.degToRad(90 - (v.elevation ?? 20));
  const theta = THREE.MathUtils.degToRad(v.azimuth ?? 0);
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, phi, theta));
  controls.target.copy(center);
  camera.position.copy(center).add(offset);
  camera.near = Math.max(0.1, dist / 200);
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.minDistance = radius * 0.25;
  controls.maxDistance = Math.max(dist * 4, fit * 4);
  controls.update();
  updateCamReadout();
  return true;
}

function rememberView() {
  app.settings.savedView = getCameraView();
  app.saveSettings();
  updateCamReadout();
  toast(
    `Ракурс сохранён: ${fmtView(app.settings.savedView)} — будет применяться к другим кораблям`,
  );
}

function applySavedView() {
  if (!app.settings.savedView) {
    toast('Сначала запомните ракурс', true);
    return;
  }
  applyCameraView(app.settings.savedView);
  toast(`Ракурс применён: ${fmtView(app.settings.savedView)}`);
}

function clearSavedView() {
  app.settings.savedView = null;
  app.saveSettings();
  updateCamReadout();
  toast('Сохранённый ракурс сброшен');
}

function fmtView(v) {
  if (!v) return '—';
  const az = ((v.azimuth % 360) + 360) % 360;
  return `${az.toFixed(0)}° / ${v.elevation.toFixed(0)}° / ×${(v.zoom ?? 1).toFixed(2)}`;
}

function updateCamReadout() {
  const node = $('cam-angle');
  if (!node) return;
  const cur = getCameraView();
  const saved = app.settings.savedView;
  node.classList.toggle('has-saved', !!saved);
  node.innerHTML = saved
    ? `Ракурс <mark>${fmtView(cur)}</mark> · запомнен ${fmtView(saved)}`
    : `Ракурс ${fmtView(cur)}`;
}

function fitCamera() {
  if (!ship) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(0.5, size.length() / 2);
  const dist = computeFitDistance();
  const dir = new THREE.Vector3(-0.8, 0.36, 0.6).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = Math.max(0.1, dist / 200);
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.minDistance = radius * 0.25;
  controls.maxDistance = dist * 4;
  controls.update();
  updateCamReadout();
}

function setState(next, opts = {}) {
  const view = opts.view ?? null;
  const keep = opts.keepView ?? (app.settings.keepView && !!app.settings.savedView);
  app.state = normalizeState(next);
  $('ship-name').value = app.state.name;
  rebuild();
  if (view) applyCameraView(view);
  else if (keep && app.settings.savedView) applyCameraView(app.settings.savedView);
  else fitCamera();
  ui.render();
}

// ---------------------------------------------------------------- экспорт
async function exportModel(binary) {
  if (dirty) rebuild();
  if (!ship) return;
  try {
    const bytes = await exportShip(ship, app.state, {
      binary,
      origin: app.settings.origin,
      scale: app.settings.scale,
      view: getCameraView(),
    });
    toast(`Сохранено: ${fileSafeName(app.state.name)}.${binary ? 'glb' : 'gltf'} (${(bytes / 1024).toFixed(0)} КБ)`);
  } catch (err) {
    console.error(err);
    toast(`Ошибка экспорта: ${err.message}`, true);
  }
}

function exportIcon(opts = {}) {
  if (dirty) rebuild();
  const size = 1024;
  const transparent = opts.transparent ?? app.settings.pngTransparent ?? false;
  const backdropId = opts.backdrop ?? app.settings.backdrop ?? 'none';
  const useBackdrop = !transparent && backdropId !== 'none';

  const prev = {
    ratio: renderer.getPixelRatio(),
    aspect: camera.aspect,
    w: canvas.clientWidth,
    h: canvas.clientHeight,
    bg: scene.background,
  };
  const groundWas = ground.visible;
  const waterWas = water.visible;
  ground.visible = false;
  water.visible = false;

  if (useBackdrop) {
    scene.background = getBackdropTexture(backdropId) || BG;
    renderer.setClearColor(0x000000, 1);
  } else {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
  }

  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (blob) {
      const tag = useBackdrop ? `-${backdropId}` : '';
      download(blob, `${fileSafeName(app.state.name)}${tag}.png`);
      toast(useBackdrop ? `PNG с фоном «${backdropId}» сохранён` : 'PNG с прозрачным фоном сохранён');
    } else {
      toast('Не удалось сохранить PNG', true);
    }
  }, 'image/png');

  ground.visible = groundWas;
  water.visible = waterWas;
  scene.background = prev.bg;
  renderer.setPixelRatio(prev.ratio);
  renderer.setSize(prev.w, prev.h, false);
  camera.aspect = prev.aspect;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

function saveProject() {
  const payload = buildProjectJson(app.state, getCameraView());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  download(blob, `${fileSafeName(app.state.name)}.ship.json`);
  toast('Проект сохранён (.json с ракурсом камеры)');
}

// ---------------------------------------------------------------- интерфейс
let toastTimer = 0;
function toast(message, isError = false) {
  const node = $('toast');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), isError ? 6000 : 2600);
}

const ui = createUI($('ui'), app);

$('ship-name').value = app.state.name;
$('ship-name').addEventListener('input', (e) => {
  app.state.name = e.target.value;
  scheduleRebuild();
});
$('btn-glb').addEventListener('click', () => exportModel(true));
$('btn-gltf').addEventListener('click', () => exportModel(false));
$('btn-png').addEventListener('click', exportIcon);
$('btn-fit').addEventListener('click', fitCamera);

$('opt-water').checked = app.settings.water;
$('opt-water').addEventListener('change', (e) => {
  water.visible = app.settings.water = e.target.checked;
  app.saveSettings();
});
$('opt-wire').addEventListener('change', (e) => {
  for (const m of Object.values(materials)) m.wireframe = e.target.checked;
});
$('opt-rotate').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
});

$('file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { state, view } = await readProjectFile(file);
    setState(state, { view: view || undefined, keepView: !view && app.settings.keepView });
    toast(view ? `Открыт «${app.state.name}» с сохранённым ракурсом` : `Открыт проект «${app.state.name}»`);
  } catch (err) {
    console.error(err);
    toast(`Не удалось открыть файл: ${err.message}`, true);
  }
});

let camReadoutPending = false;
controls.addEventListener('change', () => {
  if (!camReadoutPending) {
    camReadoutPending = true;
    requestAnimationFrame(() => {
      camReadoutPending = false;
      updateCamReadout();
    });
  }
});

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

rebuild();
applySceneBackground();
if (app.settings.keepView && app.settings.savedView) applyCameraView(app.settings.savedView);
else fitCamera();
updateCamReadout();

renderer.setAnimationLoop(() => {
  if (dirty) rebuild();
  controls.update();
  renderer.render(scene, camera);
});

// Доступ из консоли браузера — удобно для отладки и автоматизации.
window.shipBuilder = {
  get state() {
    return app.state;
  },
  setState,
  loadPreset: app.loadPreset,
  rebuild: scheduleRebuild,
  fit: fitCamera,
  getView: getCameraView,
  applyView: applyCameraView,
  view(dx, dy, dz, dist, focus) {
    const center = focus ? new THREE.Vector3(...focus) : bounds.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(new THREE.Vector3(dx, dy, dz).normalize(), dist);
    controls.update();
    updateCamReadout();
  },
};
