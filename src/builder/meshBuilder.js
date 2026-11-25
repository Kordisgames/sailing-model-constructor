import * as THREE from 'three';

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _n = new THREE.Vector3();

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * Накопитель треугольников, разложенных по материалам.
 * Вся геометрия корабля собирается сюда, а в конце превращается
 * в один меш на материал (минимум draw calls в игре).
 * Геометрия не индексированная, поэтому нормали получаются плоскими (low poly).
 */
export class MeshBuilder {
  constructor() {
    this.buckets = new Map();
    this.m = null;
    this.stack = [];
    this.twoSided = false;
  }

  /** Вложенная система координат для последующих примитивов. */
  push(matrix) {
    this.stack.push(this.m);
    this.m = this.m ? this.m.clone().multiply(matrix) : matrix.clone();
    return this;
  }

  pop() {
    this.m = this.stack.pop() ?? null;
    return this;
  }

  _bucket(mat) {
    let b = this.buckets.get(mat);
    if (!b) {
      b = [];
      this.buckets.set(mat, b);
    }
    return b;
  }

  tri(mat, a, b, c) {
    let pa = a;
    let pb = b;
    let pc = c;
    if (this.m) {
      pa = a.clone().applyMatrix4(this.m);
      pb = b.clone().applyMatrix4(this.m);
      pc = c.clone().applyMatrix4(this.m);
    }
    _e1.subVectors(pb, pa);
    _e2.subVectors(pc, pa);
    _n.crossVectors(_e1, _e2);
    if (_n.lengthSq() < 1e-10) return; // вырожденный треугольник
    const b_ = this._bucket(mat);
    b_.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, pc.x, pc.y, pc.z);
    if (this.twoSided) b_.push(pa.x, pa.y, pa.z, pc.x, pc.y, pc.z, pb.x, pb.y, pb.z);
  }

  /**
   * Тонкие полотнища (паруса, флаги): каждая грань добавляется с обеих сторон.
   * Так материал остаётся односторонним, а освещение и тени в игре корректны с любой стороны.
   */
  sheet(fn) {
    const prev = this.twoSided;
    this.twoSided = true;
    fn();
    this.twoSided = prev;
  }

  quad(mat, a, b, c, d) {
    this.tri(mat, a, b, c);
    this.tri(mat, a, c, d);
  }

  /** Треугольник, развёрнутый лицом в сторону dir (в локальных координатах). */
  triF(mat, a, b, c, dir) {
    _e1.subVectors(b, a);
    _e2.subVectors(c, a);
    _n.crossVectors(_e1, _e2);
    if (_n.dot(dir) < 0) this.tri(mat, a, c, b);
    else this.tri(mat, a, b, c);
  }

  /** Четырёхугольник, развёрнутый лицом в сторону dir (в локальных координатах). */
  quadF(mat, a, b, c, d, dir) {
    _e1.subVectors(c, a);
    _e2.subVectors(d, b);
    _n.crossVectors(_e1, _e2);
    if (_n.dot(dir) < 0) this.quad(mat, a, d, c, b);
    else this.quad(mat, a, b, c, d);
  }

  /** Усечённый конус/цилиндр между двумя точками. */
  cyl(mat, p0, p1, r0, r1, sides = 6, capStart = true, capEnd = true) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    if (dir.lengthSq() < 1e-10) return;
    dir.normalize();
    const up = Math.abs(dir.y) < 0.99 ? V(0, 1, 0) : V(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(up, dir).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u);
    const ring0 = [];
    const ring1 = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const o = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      ring0.push(p0.clone().addScaledVector(o, r0));
      ring1.push(p1.clone().addScaledVector(o, r1));
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(mat, ring0[i], ring0[j], ring1[j], ring1[i]);
      if (capStart && r0 > 1e-4) this.tri(mat, p0, ring0[j], ring0[i]);
      if (capEnd && r1 > 1e-4) this.tri(mat, p1, ring1[i], ring1[j]);
    }
  }

  /** Параллелепипед по центру и размерам (оси текущей системы координат). */
  box(mat, cx, cy, cz, sx, sy, sz) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const p = (i, j, k) => V(cx + i * hx, cy + j * hy, cz + k * hz);
    this.quadF(mat, p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), V(1, 0, 0));
    this.quadF(mat, p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1), V(-1, 0, 0));
    this.quadF(mat, p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), V(0, 1, 0));
    this.quadF(mat, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), V(0, -1, 0));
    this.quadF(mat, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), V(0, 0, 1));
    this.quadF(mat, p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), V(0, 0, -1));
  }

  /** Параллелепипед между двумя точками (брус) с сечением w x h. */
  beam(mat, p0, p1, w, h) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    if (len < 1e-5) return;
    dir.normalize();
    const up = Math.abs(dir.y) < 0.99 ? V(0, 1, 0) : V(1, 0, 0);
    const x = new THREE.Vector3().crossVectors(up, dir).normalize();
    const y = new THREE.Vector3().crossVectors(dir, x);
    const m = new THREE.Matrix4().makeBasis(x, y, dir).setPosition(p0.clone().lerp(p1, 0.5));
    this.push(m);
    this.box(mat, 0, 0, 0, w, h, len);
    this.pop();
  }

  /**
   * Пластина: выпуклый многоугольник в плоскости (z, y), вытянутый по x от xa до xb.
   * pts — массив { z, y }.
   */
  plate(mat, pts, xa, xb) {
    const n = pts.length;
    let cz = 0;
    let cy = 0;
    for (const p of pts) {
      cz += p.z / n;
      cy += p.y / n;
    }
    const A = pts.map((p) => V(xa, p.y, p.z));
    const B = pts.map((p) => V(xb, p.y, p.z));
    for (let i = 1; i < n - 1; i++) {
      this.triF(mat, B[0], B[i], B[i + 1], V(1, 0, 0));
      this.triF(mat, A[0], A[i], A[i + 1], V(-1, 0, 0));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dir = V(0, (pts[i].y + pts[j].y) / 2 - cy, (pts[i].z + pts[j].z) / 2 - cz);
      this.quadF(mat, A[i], A[j], B[j], B[i], dir);
    }
  }

  /** Поверхность по сетке nu x nv; fn(u, v) -> Vector3, u и v в диапазоне 0..1. */
  grid(mat, nu, nv, fn) {
    const pts = [];
    for (let j = 0; j <= nv; j++) {
      const row = [];
      for (let i = 0; i <= nu; i++) row.push(fn(i / nu, j / nv));
      pts.push(row);
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        this.quad(mat, pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]);
      }
    }
  }

  /**
   * Треугольный парус (кливер, латинский) с разбиением n и выпуклостью bulge.
   * Ребро a–b — передняя шкаторина (остаётся прямой), c — шкотовый угол.
   * mat2 — материал для чередующихся полос, идущих вдоль передней шкаторины.
   */
  triGrid(mat, a, b, c, bulge, n = 3, mat2 = null) {
    const pt = (i, j) => {
      const u = i / n;
      const v = j / n;
      const w = 1 - u - v;
      const p = V(
        a.x * w + b.x * u + c.x * v,
        a.y * w + b.y * u + c.y * v,
        a.z * w + b.z * u + c.z * v,
      );
      return p.addScaledVector(bulge, 4 * v * (1 - v));
    };
    for (let j = 0; j < n; j++) {
      const m = mat2 && j % 2 ? mat2 : mat;
      for (let i = 0; i < n - j; i++) {
        this.tri(m, pt(i, j), pt(i + 1, j), pt(i, j + 1));
        if (i + j < n - 1) this.tri(m, pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1));
      }
    }
  }

  get triangleCount() {
    let n = 0;
    for (const b of this.buckets.values()) n += b.length / 9;
    return n;
  }

  /** Собрать группу мешей: по одному на материал. */
  build(materials, name = 'Ship') {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, data] of this.buckets) {
      if (!data.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, materials[key] ?? materials.hull);
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
