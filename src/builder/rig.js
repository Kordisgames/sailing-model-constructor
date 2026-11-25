import * as THREE from 'three';
import { V } from './meshBuilder.js';

const { clamp, lerp, degToRad } = THREE.MathUtils;
const M4 = () => new THREE.Matrix4();

export const RIG_TYPES = {
  square: { label: 'Прямые', hint: 'Реи с прямыми парусами (бриг, фрегат)' },
  gaff: { label: 'Гафельный', hint: 'Косой парус на гике и гафеле (шхуна, шлюп)' },
  lateen: { label: 'Латинский', hint: 'Треугольный парус на длинном рю (шебека, каравелла)' },
  bermuda: { label: 'Бермудский', hint: 'Треугольный парус на гике' },
  junk: { label: 'Китайский', hint: 'Парус джонки на латах, которые веером расходятся кверху' },
  oblique: {
    label: 'Косой китайский',
    hint: 'Горизонтальные латы, косой многоугольный парус: параллелограмм с острым верхом',
  },
  skew: { label: 'Косые реи', hint: 'Фэнтези: паруса на перекошенных реях, ярусы можно закрутить и наклонить вразнобой' },
  wing: {
    label: 'Крылья',
    hint: 'Фэнтези: крылья веером, ровные латинские или большой косой треугольник вперёд',
  },
  shell: { label: 'Ракушки', hint: 'Остроконечный надутый купол, как своды Сиднейской оперы' },
  bare: { label: 'Голая мачта', hint: 'Без парусов' },
};

/** Формат парусов-крыльев. */
export const WING_STYLES = {
  triangle: { label: 'Ровные', hint: 'Треугольный парус на длинном рю, как латинский — по одному на каждый борт' },
  ribbed: { label: 'Многорёберные', hint: 'Рёбра веером от мачты, между ними перепонка с вырезами по кромке' },
  skew: {
    label: 'Косой',
    hint: 'Большой косой треугольник от топа мачты вперёд (к бушприту): наклон и длина настраиваются',
  },
};

/** Покрой прямых парусов (для «Прямых» и «Косых реев»). */
export const SAIL_CUTS = {
  plain: { label: 'Обычные', hint: 'Классический прямой парус' },
  split: { label: 'Двойные', hint: 'Двойные прямые: парус разрезан по мачте на две половины' },
  twin: { label: 'Без порезки', hint: 'Два «пуза» на одном полотнище, без разреза посередине' },
  layer: { label: 'Слоями', hint: 'Два паруса в одну сторону: большой сзади, поменьше спереди — накладываются друг на друга' },
  round: { label: 'Круглые', hint: 'Сильно надутые «лепестки»: середина вперёд, края загнуты назад' },
  bell: { label: 'Колокол', hint: 'Цельный парус: округлый верх, широкий низ, мягкие обводы без острых углов' },
};

/** Вооружение с реями поперёк мачты. */
const hasYards = (rig) => rig === 'square' || rig === 'skew';
/** Джонка и косой китайский: без вант, парус сбоку от мачты. */
const isJunkish = (rig) => rig === 'junk' || rig === 'oblique';
/** Парус стоит перед мачтой, поэтому штаг к передней мачте не ставится. */
const sailAhead = (rig) => hasYards(rig) || rig === 'shell';

/**
 * Сетка паруса nu x nv; fn(u, v, i, j) -> Vector3.
 * При stripes столбцы чередуют основной цвет паруса и цвет полос.
 */
function sailGrid(mb, nu, nv, fn, stripes = false, offset = 0) {
  const pts = [];
  for (let j = 0; j <= nv; j++) {
    const row = [];
    for (let i = 0; i <= nu; i++) row.push(fn(i / nu, j / nv, i, j));
    pts.push(row);
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const mat = stripes && (i + offset) % 2 ? 'sail2' : 'sail';
      mb.quad(mat, pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]);
    }
  }
}

/**
 * Прямой парус под реем: yd = { h, a (полуширина по рею), b (полуширина по нижней шкаторине) }.
 * tilt и footTilt — перекос рея и нижней шкаторины (для «косых реев»).
 * st = { cut (покрой из SAIL_CUTS), ribbed (складки), stripes (полосы) }.
 */
function squareSail(mb, yd, zf, bil, st = {}) {
  // «слоями» рисуется как обычный парус — второй экземпляр ставит вызывающий код
  // briefs — старое имя покроя «Колокол»
  let cut = st.cut === 'briefs' ? 'bell' : st.cut;
  if (cut === 'layer' || !SAIL_CUTS[cut]) cut = 'plain';
  const h = yd.h * 0.96;
  const A = yd.a * 0.97;
  const F = yd.b * 0.97;
  const k0 = Math.tan(yd.tilt ?? 0);
  const k1 = Math.tan(yd.footTilt ?? 0);
  const splitLike = cut === 'split';
  const d =
    bil *
    0.17 *
    Math.min(yd.a * 2, h) *
    (cut === 'round' ? 1.85 : cut === 'bell' ? 1.45 : splitLike ? 0.85 : 1);
  const nu = st.ribbed ? 6 : cut === 'round' || cut === 'bell' ? 6 : 4;
  const nv = cut === 'round' || cut === 'bell' ? 5 : 3;
  const rib = st.ribbed ? 0.05 * A : 0;
  const zSign = zf >= 0 ? 1 : -1; // пузо уходит от мачты и спереди, и сзади

  /** Полуширина паруса на высоте v (0 — рей, 1 — нижняя шкаторина). */
  const halfW = (v) => {
    if (cut === 'bell') {
      // колокол: уже сверху, заметно шире и «пухлее» снизу
      return lerp(A * 0.78, Math.max(A, F) * 1.38, Math.pow(v, 0.72));
    }
    if (cut === 'round') {
      // лепесток: узкий верх, расширяется к низу, углы скруглены
      const w = lerp(A * 0.55, F * 1.05, Math.pow(v, 0.7));
      return w * (1 - 0.18 * Math.pow(v, 3));
    }
    return lerp(A, F, v);
  };
  /** Прогиб шкаторин. */
  const edgeY = (u, v) => {
    if (cut === 'bell') {
      // сильный дугообразный верх + мягкий провис низа, без острых углов
      const head = 0.22 * h * (1 - v) * (1 - Math.pow(Math.abs(u), 1.6));
      const foot = 0.14 * h * v * v * (1 - u * u);
      return head + foot;
    }
    if (cut === 'round') return 0.22 * h * v * v * (1 - u * u);
    return 0.08 * h * v * v * (1 - u * u);
  };
  const vBelly = (v) => Math.sin(Math.PI * (cut === 'round' || cut === 'bell' ? 0.9 : 0.75) * Math.min(1, v * 1.05));

  const panel = (u0, u1, cols, offset) =>
    sailGrid(
      mb, cols, nv,
      (uu, v, i) => {
        const u = lerp(u0, u1, uu);
        const s = uu * 2 - 1;
        // профиль «пуза» поперёк: одно на всю ширину, своё у каждой половины или два без разреза
        const across = splitLike ? 1 - s * s : cut === 'twin' ? 1 - Math.pow(2 * Math.abs(u) - 1, 2) : 1 - u * u;
        // у «колокола» сильно скругляем углы у рея и слегка у низа
        const roundTop = cut === 'bell'
          ? 1 - 0.42 * (1 - v) * Math.pow(Math.abs(u), 1.8) - 0.08 * v * Math.pow(Math.abs(u), 3)
          : 1;
        const w = halfW(v) * roundTop;
        const fold = ((i + offset) % 2 ? rib : -rib) * (0.25 + 0.75 * Math.min(1, v * 2));
        const y = -0.1 - v * h + edgeY(u, v) + u * w * lerp(k0, k1, v);
        // у «круглых» края загибаем назад (к мачте), середина остаётся пузом вперёд
        const edgeBack =
          cut === 'round'
            ? -0.55 * d * Math.pow(Math.abs(u), 1.7) * (0.25 + 0.75 * Math.sin(Math.PI * v))
              - 0.18 * d * Math.pow(v, 1.6) * (0.35 + 0.65 * u * u)
            : 0;
        return V(u * w, y, zf + zSign * (d * across * vBelly(v) + fold + edgeBack));
      },
      st.stripes, offset,
    );

  mb.sheet(() => {
    if (splitLike) {
      panel(-1, -0.04, Math.max(2, Math.round(nu / 2)), 0);
      panel(0.04, 1, Math.max(2, Math.round(nu / 2)), Math.round(nu / 2));
    } else {
      panel(-1, 1, nu, 0);
    }
  });
}

/**
 * Парус-крыло на одном борту.
 * style 'ribbed' — веер рёбер от мачты;
 * style 'triangle' — треугольник на рю, как латинский (пара по бортам);
 * style 'skew' — большой косой треугольник вперёд к бушприту.
 * angle — полуугол к борту; tilt — наклон рю; inflate — надув.
 */
function wingSail(mb, o) {
  const { H, lee } = o;
  const side = o.side ?? lee;
  const style = o.style === 'triangle' || o.style === 'skew' ? o.style : 'ribbed';
  const α = degToRad(clamp(o.angle ?? 28, 0, 78));
  const inflate = clamp(o.inflate ?? 1, 0, 2);
  // горизонталь плоскости крыла: назад и в борт (для skew — вперёд)
  const fwd = style === 'skew';
  const ox = side * Math.sin(α);
  const oz = fwd ? Math.cos(α) : -Math.cos(α);
  const nx = side * Math.cos(α); // нормаль наружу
  const nz = fwd ? -Math.sin(α) : Math.sin(α);

  if (style === 'skew') {
    // большой косой: топ мачты → нос, нижний угол у мачты (как на разметке)
    const tilt = degToRad(clamp(o.tilt ?? 32, 8, 70));
    const xo = side * (o.r0 + 0.12);
    const head = V(xo, 0.97 * H, 0);
    const tack = V(xo, o.hb, 0.04);
    let len = Math.max(0.8 * H, o.reach);
    len = Math.min(len, o.maxFwd ?? len);
    const clew = V(
      xo + ox * len * Math.cos(tilt),
      Math.max(o.hb + 0.15, head.y - Math.sin(tilt) * len),
      oz * len * Math.cos(tilt),
    );
    const ry = 0.055 + len * 0.0055;
    const bulge = V(nx, 0, nz).multiplyScalar(inflate * o.bil * 0.065 * len);

    if (!o.set) {
      mb.cyl('spar', head, clew, ry, ry * 0.5, 6, true, true);
      mb.cyl('sail', head.clone().lerp(clew, 0.08).add(V(0, -ry - 0.1, 0)), head.clone().lerp(clew, 0.9).add(V(0, -ry - 0.1, 0)), 0.22, 0.16, 5);
      return;
    }

    mb.cyl('spar', head, clew, ry, ry * 0.55, 6, true, true);
    // лёгкая передняя шкаторина вдоль мачты
    mb.cyl('spar', tack, head, ry * 0.55, ry * 0.4, 4, true, true);
    const off = V(nx * 0.04, -ry - 0.03, nz * 0.04);
    mb.sheet(() =>
      mb.triGrid(
        'sail',
        head.clone().add(off),
        tack.clone().add(off),
        clew.clone().add(off),
        bulge,
        4,
        o.stripes ? 'sail2' : null,
      ),
    );
    return;
  }

  if (style === 'triangle') {
    // как латинский: длинный рю + треугольное полотнище; tilt — наклон рю
    const elev = degToRad(clamp(o.tilt ?? 55, 25, 75));
    const ce = Math.cos(elev);
    const se = Math.sin(elev);
    const dir = V(ox * ce, se, oz * ce);
    let len = Math.min(1.25 * H, Math.max(0.7 * H, o.reach * 1.55));
    const aftLim = o.maxAft / Math.max(0.25, Math.abs(dir.z));
    const outLim = (o.maxOut ?? o.reach * 1.4) / Math.max(0.2, Math.abs(dir.x) || 0.2);
    len = Math.min(len, Math.max(aftLim, 0.6 * H), outLim);
    const xo = side * (o.r0 + 0.14);
    const c = V(xo, 0.74 * H, 0);
    const fore = c.clone().addScaledVector(dir, -0.5 * len);
    const aft = c.clone().addScaledVector(dir, 0.5 * len);
    const ry = 0.06 + len * 0.006;
    const bulge = V(nx, 0, nz).multiplyScalar(inflate * o.bil * 0.07 * len);

    if (!o.set) {
      mb.cyl('spar', c, fore, ry, ry * 0.55, 6, false, true);
      mb.cyl('spar', c, aft, ry, ry * 0.5, 6, false, true);
      mb.cyl('sail', fore.clone().lerp(aft, 0.08).add(V(0, -ry - 0.12, 0)), fore.clone().lerp(aft, 0.92).add(V(0, -ry - 0.12, 0)), 0.2, 0.16, 5);
      return;
    }

    mb.cyl('spar', c, fore, ry, ry * 0.55, 6, false, true);
    mb.cyl('spar', c, aft, ry, ry * 0.5, 6, false, true);
    const clew = V(xo + nx * inflate * o.bil * 0.04 * len, o.hb, aft.z * 0.96);
    const off = V(nx * 0.03, -ry - 0.04, nz * 0.03);
    mb.sheet(() =>
      mb.triGrid(
        'sail',
        fore.clone().add(off),
        aft.clone().add(off),
        clew,
        bulge,
        3,
        o.stripes ? 'sail2' : null,
      ),
    );
    return;
  }

  // многорёберные: прежний веер рёбер от корня у мачты
  const n = clamp(Math.round(o.n ?? 5), 3, 8);
  const rr = 0.035 + o.reach * 0.0035;
  const x = side * (o.r0 + rr * 1.5 + 0.06);
  const P = V(x, o.hb, 0);
  const a0 = degToRad(6);
  const a1 = degToRad(86);
  const top = 0.97 * H - o.hb;
  const at = (th, R, bulge = 0) =>
    V(
      x + ox * R * Math.cos(th) + nx * bulge,
      o.hb + R * Math.sin(th),
      oz * R * Math.cos(th) + nz * bulge,
    );
  const radius = (s) => {
    const th = lerp(a0, a1, s);
    const cth = Math.max(0.05, Math.cos(th));
    const R = lerp(o.reach, top, s) * (1 + 0.3 * Math.sin(Math.PI * Math.pow(s, 1.2)));
    const aft = o.maxAft / (cth * Math.max(0.2, Math.cos(α)));
    const beam = (o.maxOut ?? o.reach * 1.2) / (cth * Math.max(0.12, Math.sin(α) || 0.12));
    return Math.min(R, aft, beam, (1.08 * H - o.hb) / Math.max(0.05, Math.sin(th)));
  };
  const spar = (th, R, k) => mb.cyl('spar', P, at(th, R * 1.05), rr * k, rr * k * 0.45, k > 1 ? 6 : 4, true, true);

  if (!o.set) {
    spar(a0, radius(0), 1.5);
    spar(a1, radius(1), 1.5);
    mb.cyl('sail', at(a1, top * 0.06), at(a1, top * 0.9), 0.26, 0.16, 5);
    return;
  }

  const ribs = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    ribs.push({ th: lerp(a0, a1, s), R: radius(s) });
  }
  ribs.forEach((r, k) => spar(r.th, r.R, k === 0 || k === n ? 1.5 : 1));
  const d0 = inflate * o.bil * 0.035 * o.reach;
  mb.sheet(() => {
    for (let k = 0; k < n; k++) {
      const a = ribs[k];
      const b = ribs[k + 1];
      const A = at(a.th, a.R);
      const B = at(b.th, b.R);
      const M = at((a.th + b.th) / 2, ((a.R + b.R) / 2) * 0.84, d0 * (side === lee ? 1 : 0.75));
      const mat = o.stripes && k % 2 ? 'sail2' : 'sail';
      mb.tri(mat, P, A, M);
      mb.tri(mat, P, M, B);
    }
  });
}

/**
 * Парус-ракушка: остроконечный купол перед мачтой, как своды Сиднейской оперы.
 * Вершина у топа мачты, нижняя кромка выгнута аркой.
 */
function shellSail(mb, o) {
  const { H, W, zf } = o;
  const yTop = 0.97 * H;
  const D = (0.55 + 0.45 * o.bil) * W;
  mb.sheet(() =>
    sailGrid(
      mb, 5, 5,
      (uu, v) => {
        const u = uu * 2 - 1;
        // свод Сиднейской оперы: острый верх, широкая подкова внизу, глубокий купол
        const t = Math.pow(v, 0.75); // 0 низ → 1 верх
        const k = Math.pow(1 - t, 0.45); // ширина: полная внизу, точка наверху
        const c = Math.max(0, 1 - u * u);
        const yb = o.hb + 0.28 * (yTop - o.hb) * c; // арка нижней кромки
        const belly = Math.sin(Math.PI * (0.15 + 0.7 * t)) * Math.pow(c, 0.55);
        return V(u * W * k, lerp(yb, yTop, t), zf + D * belly * (0.35 + 0.65 * k));
      },
      o.stripes,
    ),
  );
}

/**
 * Косой китайский парус в многоугольном стиле: почти горизонтальные латы,
 * силуэт — параллелограмм с приподнятым пиком. Каждая секция — четыре
 * треугольника от центра (жёсткие грани, как на вайрфрейме).
 * Передняя шкаторина у мачты, основная площадь уходит в корму; небольшой вынос вперёд.
 */
function obliqueJunkSail(mb, o) {
  const { H, chord, n, lee } = o;
  const rb = 0.055 + chord * 0.007;
  const rl = 0.028 + chord * 0.0028;
  const bw = rl * 1.6; // сечение лат — брус, как на референсе
  const x = lee * (o.r0 + rb + 0.04);
  const y0 = o.hb;
  const y1 = 0.88 * H;
  // четыре угла паруса: шкотовый внизу у мачты, галс чуть вперёд, пик высоко сзади
  const tack = V(x, y0, o.fw * 0.15);
  const throat = V(x, y1, o.fw * 0.55);
  const peak = V(x, Math.min(0.98 * H, y1 + chord * 0.32), -chord * 0.72);
  const clew = V(x, y0 + chord * 0.06, -chord);
  const row = (s) => ({
    luff: tack.clone().lerp(throat, s),
    leech: clew.clone().lerp(peak, s),
  });
  const stick = (r, thick) => mb.beam('spar', r.luff, r.leech, thick, thick * 0.7);

  if (!o.set) {
    const b = row(0);
    const up = (p, dy) => V(p.x, p.y + dy, p.z);
    stick(b, rb);
    mb.cyl('sail', up(b.luff.clone().lerp(b.leech, 0.05), rb + 0.18), up(b.luff.clone().lerp(b.leech, 0.95), rb + 0.18), 0.22, 0.18, 5);
    stick({ luff: up(b.luff, 2 * rb + 0.4), leech: up(b.leech, 2 * rb + 0.4) }, rb);
    return;
  }

  const rows = [];
  for (let k = 0; k <= n; k++) rows.push(row(k / n));
  rows.forEach((r, k) => stick(r, k === 0 || k === n ? rb : rl));

  // лёгкий «зигзаг» шкаторины, чтобы грани не были идеально плоскими
  const d = lee * o.bil * 0.055 * chord;
  mb.sheet(() => {
    for (let k = 0; k < n; k++) {
      const A = rows[k].luff;
      const B = rows[k].leech;
      const C = rows[k + 1].leech;
      const D = rows[k + 1].luff;
      const M = V(
        (A.x + B.x + C.x + D.x) / 4 + d * (0.55 + 0.45 * Math.sin((k + 0.5) * 1.1)),
        (A.y + B.y + C.y + D.y) / 4,
        (A.z + B.z + C.z + D.z) / 4,
      );
      const mat = o.stripes && k % 2 ? 'sail2' : 'sail';
      mb.tri(mat, A, B, M);
      mb.tri(mat, B, C, M);
      mb.tri(mat, C, D, M);
      mb.tri(mat, D, A, M);
    }
  });
}

/**
 * Китайский парус (джонка): полотнище на латах. Нижние латы почти горизонтальны,
 * верхние веером поднимаются к рею; часть паруса выходит вперёд за мачту.
 * Строится в плоскости сбоку от мачты, корма в сторону -Z.
 */
function junkSail(mb, o) {
  const { H, chord, n, lee } = o;
  const a0 = degToRad(5);
  const a1 = degToRad(42);
  const rb = 0.05 + chord * 0.006; // гик и рей
  const rl = 0.03 + chord * 0.003; // латы
  const x = lee * (o.r0 + rb + 0.05);
  const lenTop = chord * 0.82;
  const luffH = Math.max(0.14 * H, 0.97 * H - o.hb - lenTop * Math.sin(a1));
  const row = (s) => {
    const ang = lerp(a0, a1, Math.pow(s, 1.6));
    const len = chord * lerp(1, 0.82, s);
    const zl = o.fw * lerp(1, 1.12, s);
    const yl = o.hb + s * luffH;
    return { luff: V(x, yl, zl), leech: V(x, yl + len * Math.sin(ang), zl - len * Math.cos(ang)) };
  };
  const stick = (r, rad, sides) => {
    const a = r.leech.clone().lerp(r.luff, 1.02);
    const b = r.luff.clone().lerp(r.leech, 1.02);
    mb.cyl('spar', a, b, rad, rad * 0.8, sides);
  };

  if (!o.set) {
    // парус спущен: латы сложены стопкой на гике
    const b = row(0);
    const up = (p, dy) => V(p.x, p.y + dy, p.z);
    stick(b, rb, 6);
    mb.cyl('sail', up(b.luff.clone().lerp(b.leech, 0.03), rb + 0.2), up(b.luff.clone().lerp(b.leech, 0.97), rb + 0.2), 0.24, 0.2, 5);
    stick({ luff: up(b.luff, 2 * rb + 0.42), leech: up(b.leech, 2 * rb + 0.42) }, rb, 6);
    return;
  }

  const rows = [];
  for (let k = 0; k <= n; k++) rows.push(row(k / n));
  rows.forEach((r, k) => {
    const edge = k === 0 || k === n;
    stick(r, edge ? rb : rl, edge ? 6 : 4);
  });
  const d = lee * o.bil * 0.03 * chord;
  mb.sheet(() => {
    for (let k = 0; k < n; k++) {
      const A = rows[k];
      const B = rows[k + 1];
      mb.grid(o.stripes && k % 2 ? 'sail2' : 'sail', 2, 2, (u, v) => {
        const p = A.luff.clone().lerp(A.leech, u).lerp(B.luff.clone().lerp(B.leech, u), v);
        p.x += d * Math.sin(Math.PI * v) * (0.45 + 0.55 * Math.sin(Math.PI * u));
        return p;
      });
    }
  });
}

/** Гафельный парус с гиком и гафелем. Строится в плоскости x = 0, от мачты в корму. */
function gaffSail(mb, o) {
  const ang = degToRad(36);
  const rb = 0.05 + o.boomLen * 0.008;
  const boomEnd = V(0, o.hb + o.boomLen * 0.06, -o.r0 - o.boomLen);
  mb.cyl('spar', V(0, o.hb, -o.r0 * 0.5), boomEnd, rb, rb * 0.7, 6);
  const peak = V(0, o.throatY + o.gaffLen * Math.sin(ang), -o.r0 - o.gaffLen * Math.cos(ang));
  mb.cyl('spar', V(0, o.throatY, -o.r0 * 0.5), peak, rb * 0.9, rb * 0.55, 6);
  if (!o.set) {
    mb.cyl('sail', V(0, o.hb + rb + 0.14, -o.r0 - 0.2), V(0, boomEnd.y + rb + 0.14, boomEnd.z * 0.95), 0.2, 0.16, 5);
    return;
  }
  const tack = V(0, o.hb + rb + 0.05, -o.r0 - 0.06);
  const clew = V(0, boomEnd.y + rb + 0.05, boomEnd.z + o.boomLen * 0.03);
  const throat = V(0, o.throatY - rb - 0.05, -o.r0 - 0.06);
  const pk = V(0, peak.y - rb - 0.03, peak.z + o.gaffLen * 0.03);
  const d = o.lee * o.bil * 0.09 * o.boomLen;
  mb.sheet(() => {
    sailGrid(
      mb, 3, 3,
      (u, v) => {
        const lo = tack.clone().lerp(clew, u);
        const hi = throat.clone().lerp(pk, u);
        const p = lo.lerp(hi, v);
        p.x += d * Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.8 * v));
        return p;
      },
      o.stripes,
    );
    if (o.topsailHead) {
      mb.triGrid(
        'sail',
        V(0, o.throatY + rb + 0.2, -o.r0 - 0.06),
        V(0, o.topsailHead, -o.r0 - 0.06),
        V(0, peak.y + rb + 0.05, peak.z + o.gaffLen * 0.04),
        V(d * 0.25, 0, 0),
        2,
        o.stripes ? 'sail2' : null,
      );
    }
  });
}

function buildMast(mb, mi, ctx) {
  const { m, H, r0 } = mi;
  const { S, rig, phi, bil, lee, sailsSet, stripes } = ctx;
  const B = S.B;
  const width = m.width ?? 1;
  const hb = clamp(0.1 * H, 1.3, 3.6);
  const yards = [];
  let lowerTop = 0.62 * H;
  let twoPart = H >= 13;

  mb.push(mi.M);

  // ---- раскладка парусов ----
  if (hasYards(m.rig)) {
    const skew = m.rig === 'skew';
    const tilt = skew ? degToRad(clamp(m.tilt ?? 18, -40, 40)) : 0;
    const twist = skew ? degToRad(clamp(m.twist ?? 0, -25, 25)) : 0;
    const n = clamp(Math.round(m.sails ?? 3), 1, 4);
    const a0 = 0.95 * B * width;
    // перекошенный нижний парус поднимаем, чтобы его нижний угол не задевал борт
    const hBase = clamp(0.13 * H, 1.8, 4.5) + a0 * Math.tan(Math.abs(tilt) * 0.4) * 0.5;
    const hTop = 0.95 * H;
    const gap = 0.012 * H;
    const w = [1, 0.9, 0.7, 0.55].slice(0, n);
    const sum = w.reduce((s, x) => s + x, 0);
    const total = Math.max(0.2 * H, hTop - hBase - gap * (n - 1));
    let y = hBase;
    for (let k = 0; k < n; k++) {
      const hs = (total * w[k]) / sum;
      const tk = tilt * (m.alternate && k % 2 ? -1 : 1);
      yards.push({
        y: y + hs,
        h: hs,
        a: a0 * Math.pow(0.8, k),
        b: k === 0 ? a0 * 1.03 : a0 * Math.pow(0.8, k - 1),
        tilt: tk,
        // нижняя шкаторина идёт параллельно рею яруса ниже
        footTilt: k === 0 ? tk * 0.4 : yards[k - 1].tilt,
        turn: twist * k,
      });
      y += hs + gap;
    }
    lowerTop = yards[0].y + 0.025 * H;
    twoPart = twoPart && n >= 2;
  } else if (m.rig === 'gaff') {
    const throatY = (m.squareTopsail ? 0.56 : 0.66) * H;
    lowerTop = throatY + 0.06 * H;
    if (m.squareTopsail) {
      const a = 0.62 * B * width;
      const b = 0.82 * B * width;
      const yLow = throatY + 0.1 * H;
      yards.push({ y: yLow, a: b, bare: true });
      yards.push({ y: 0.95 * H, h: 0.95 * H - yLow - 0.012 * H, a, b });
    }
  } else {
    twoPart = false;
  }

  // ---- мачта ----
  if (twoPart) {
    mb.cyl('spar', V(0, -0.6, 0), V(0, lowerTop + 0.35, 0), r0, r0 * 0.82, 6, false, true);
    mb.cyl('spar', V(0, lowerTop - 0.4, 0), V(0, H, 0), r0 * 0.68, r0 * 0.36, 6, true, true);
    if (rig.tops) {
      const R = clamp(0.03 * H, 0.45, 1.0);
      mi.platR = R;
      mb.cyl('spar', V(0, lowerTop - 0.06, 0), V(0, lowerTop + 0.08, 0), R * 0.8, R, 8);
    }
  } else {
    mb.cyl('spar', V(0, -0.6, 0), V(0, H, 0), r0, r0 * 0.42, 6, false, true);
  }
  mb.box('spar', 0, H + 0.04, 0, r0 * 0.95, 0.09, r0 * 0.95);
  mi.twoPart = twoPart;
  mi.lowerTop = lowerTop;
  mi.shroudY = twoPart ? lowerTop : 0.78 * H;

  // ---- реи и прямые паруса ----
  for (const yd of yards) {
    const ry = 0.05 + yd.a * 0.011;
    const zf = r0 + ry + 0.03;
    const kt = Math.tan(yd.tilt ?? 0);
    mb.push(M4().makeTranslation(0, yd.y, 0).multiply(M4().makeRotationY(phi + (yd.turn ?? 0))));
    const yard = (half, z, rad) => {
      mb.cyl('spar', V(0, 0, z), V(half * 1.06, half * 1.06 * kt, z), rad, rad * 0.5, 6, false, true);
      mb.cyl('spar', V(0, 0, z), V(-half * 1.06, -half * 1.06 * kt, z), rad, rad * 0.5, 6, false, true);
    };
    const furled = (half, z, rad) => {
      const rf = 0.14 + half * 0.012;
      const xf = half * 0.93;
      const yf = -rad - rf * 0.7;
      mb.cyl('sail', V(-xf, yf - xf * kt, z), V(xf, yf + xf * kt, z), rf, rf, 5);
    };
    if (!yd.bare && hasYards(m.rig) && m.cut === 'layer') {
      // два паруса в одну сторону: большой сзади (у мачты), меньший спереди — края большого видны вокруг
      const gap = Math.max(0.55, yd.a * 0.14);
      const zBack = zf;
      const zFront = zf + gap;
      const sc = 0.62;
      const ydBig = yd;
      const ydSmall = { ...yd, a: yd.a * sc, b: yd.b * sc, h: yd.h * 0.78 };
      const rySm = 0.04 + ydSmall.a * 0.011;
      yard(ydBig.a, zBack, ry);
      yard(ydSmall.a, zFront, rySm);
      if (sailsSet) {
        squareSail(mb, ydBig, zBack, bil * 0.85, { cut: 'plain', ribbed: m.ribbed, stripes });
        squareSail(mb, ydSmall, zFront, bil, { cut: 'plain', ribbed: m.ribbed, stripes });
      } else {
        furled(ydBig.a, zBack, ry);
        furled(ydSmall.a, zFront, rySm);
      }
    } else {
      yard(yd.a, zf, ry);
      if (!yd.bare) {
        const st = hasYards(m.rig) ? { cut: m.cut, ribbed: m.ribbed, stripes } : { stripes };
        if (sailsSet) squareSail(mb, yd, zf, bil, st);
        else furled(yd.a, zf, ry);
      }
    }
    mb.pop();
  }

  // ---- косые паруса ----
  if (m.rig === 'gaff') {
    const boomLen = Math.min(0.6 * H * width, mi.availAft);
    const throatY = (m.squareTopsail ? 0.56 : 0.66) * H;
    mb.push(M4().makeRotationY(-phi * 0.8));
    gaffSail(mb, {
      hb, boomLen, throatY, gaffLen: boomLen * 0.58, r0, bil, lee, set: sailsSet, stripes,
      topsailHead: m.gaffTopsail && !m.squareTopsail ? 0.96 * H : 0,
    });
    mb.pop();
  } else if (hasYards(m.rig) && m.spanker) {
    const boomLen = Math.min(0.42 * H, mi.availAft);
    const throatY = yards[0].y - 0.12 * yards[0].h;
    mb.push(M4().makeRotationY(-phi * 0.8));
    gaffSail(mb, { hb, boomLen, throatY, gaffLen: boomLen * 0.55, r0, bil, lee, set: sailsSet, stripes, topsailHead: 0 });
    mb.pop();
  } else if (m.rig === 'lateen') {
    const ang = degToRad(55);
    let len = 1.2 * H * width;
    const maxAft = mi.availAft / (0.5 * Math.cos(ang));
    len = Math.min(len, Math.max(maxAft, 0.6 * H));
    const dir = V(0, Math.sin(ang), -Math.cos(ang));
    const xo = lee * (r0 + 0.14);
    const c = V(xo, 0.74 * H, 0);
    const fore = c.clone().addScaledVector(dir, -0.5 * len);
    const aft = c.clone().addScaledVector(dir, 0.5 * len);
    const ry = 0.06 + len * 0.006;
    mb.push(M4().makeRotationY(-phi * 0.6));
    mb.cyl('spar', c, fore, ry, ry * 0.55, 6, false, true);
    mb.cyl('spar', c, aft, ry, ry * 0.5, 6, false, true);
    if (sailsSet) {
      const clew = V(xo, hb, aft.z * 0.96);
      const off = V(lee * 0.03, -ry - 0.04, 0);
      mb.sheet(() =>
        mb.triGrid('sail', fore.clone().add(off), aft.clone().add(off), clew, V(lee * bil * 0.07 * len, 0, 0), 3, stripes ? 'sail2' : null),
      );
    } else {
      mb.cyl('sail', fore.clone().lerp(aft, 0.06).add(V(0, -ry - 0.12, 0)), fore.clone().lerp(aft, 0.94).add(V(0, -ry - 0.12, 0)), 0.2, 0.16, 5);
    }
    mb.pop();
  } else if (m.rig === 'bermuda') {
    const boomLen = Math.min(0.5 * H * width, mi.availAft);
    const rb = 0.05 + boomLen * 0.008;
    mb.push(M4().makeRotationY(-phi * 0.8));
    const boomEnd = V(0, hb + boomLen * 0.05, -r0 - boomLen);
    mb.cyl('spar', V(0, hb, -r0 * 0.5), boomEnd, rb, rb * 0.7, 6);
    if (sailsSet) {
      mb.sheet(() =>
        mb.triGrid(
          'sail',
          V(0, hb + rb + 0.05, -r0 - 0.06),
          V(0, 0.95 * H, -r0 - 0.06),
          V(0, boomEnd.y + rb + 0.05, boomEnd.z + boomLen * 0.03),
          V(lee * bil * 0.05 * boomLen, 0, 0),
          3,
          stripes ? 'sail2' : null,
        ),
      );
    } else {
      mb.cyl('sail', V(0, hb + rb + 0.14, -r0 - 0.2), V(0, boomEnd.y + rb + 0.14, boomEnd.z * 0.95), 0.2, 0.16, 5);
    }
    mb.pop();
  } else if (isJunkish(m.rig)) {
    // парус не должен заходить на соседние мачты: назад — до следующей, вперёд — не дальше четверти пролёта
    const chord = Math.min(0.62 * H * width, mi.availAft / 0.8, 0.95 * H);
    const fw = Math.min((m.rig === 'oblique' ? 0.28 : 0.2) * chord, 0.22 * mi.availFwd);
    const opts = {
      H, chord, fw, r0, lee, bil, set: sailsSet, stripes,
      hb: clamp(0.12 * H, 1.7, 3.6),
      n: clamp(Math.round(m.battens ?? (m.rig === 'oblique' ? 6 : 5)), 3, 8),
    };
    mb.push(M4().makeRotationY(-phi * 0.7));
    if (m.rig === 'oblique') obliqueJunkSail(mb, opts);
    else junkSail(mb, opts);
    mb.pop();
    // небольшая марсовая площадка, как на вайрфрейме
    if (rig.tops && H >= 10) {
      const R = clamp(0.025 * H, 0.35, 0.85);
      const y = 0.9 * H;
      mb.cyl('spar', V(0, y - 0.05, 0), V(0, y + 0.07, 0), R * 0.75, R, 8);
    }
  } else if (m.rig === 'wing') {
    // крылья: веер / ровный латинский / большой косой вперёд
    const style = m.wingStyle === 'triangle' || m.wingStyle === 'skew' ? m.wingStyle : 'ribbed';
    const nBat = clamp(Math.round(m.battens ?? 5), 3, 8);
    const hbW = clamp(0.12 * H, 1.7, 3.6);
    const angle = clamp(m.wingAngle ?? (style === 'skew' ? 10 : 28), 0, 78);
    const inflate = clamp(m.wingInflate ?? 1, 0, 2);
    const tilt = clamp(m.wingTilt ?? (style === 'triangle' ? 55 : 32), 8, 75);
    mb.push(M4().makeRotationY(-phi * (style === 'skew' ? 0.2 : 0.45)));
    if (style === 'skew') {
      // один большой косой парус вперёд — до бушприта
      const bs = rig.bowsprit;
      const stem = S.surf(1, S.topY(0.999));
      const tipZ = stem.z + (bs?.on ? bs.length * S.L * Math.cos(degToRad(bs.angle ?? 0)) : S.L * 0.06);
      const maxFwd = Math.max(2.5, tipZ - mi.foot.z);
      const reach = Math.min(1.65 * H * width, maxFwd * 0.98);
      wingSail(mb, {
        H, r0, lee, side: lee, bil, set: sailsSet, stripes,
        hb: hbW, reach, maxAft: mi.availAft, maxFwd, maxOut: 1.1 * B * width,
        n: nBat, style, angle, inflate, tilt,
      });
    } else {
      const reach = Math.min(0.62 * H * width, mi.availAft);
      for (const side of [1, -1]) {
        wingSail(mb, {
          H, r0, lee, side, bil, set: sailsSet, stripes,
          hb: hbW, reach, maxAft: mi.availAft, maxOut: 1.15 * B * width,
          n: nBat, style, angle, inflate, tilt,
        });
      }
    }
    mb.pop();
  } else if (m.rig === 'shell') {
    const zf = r0 + 0.08;
    mb.push(M4().makeRotationY(phi));
    if (sailsSet) {
      shellSail(mb, { H, zf, bil, stripes, W: 0.85 * B * width, hb: clamp(0.14 * H, 1.8, 4.5) });
    } else {
      mb.cyl('sail', V(0, 0.45 * H, zf + 0.2), V(0, 0.9 * H, zf + 0.14), 0.26, 0.16, 5);
    }
    mb.pop();
  }

  // ---- вымпел ----
  if (rig.pennants) {
    const lp = clamp(0.11 * H, 1, 3.4);
    const hp = lp * 0.24;
    mb.cyl('spar', V(0, H, 0), V(0, H + hp * 1.5, 0), 0.035, 0.022, 4, false, true);
    // флаги и вымпелы развеваются в корму с уклоном на подветренный борт
    mb.push(M4().makeTranslation(0, H + hp * 0.85, 0).multiply(M4().makeRotationY(-phi * 0.6)));
    const seg = 3;
    const pt = (i, s) => {
      const f = i / seg;
      const zig = i === 0 ? 0 : (i % 2 ? 1 : -1) * 0.07 * lp;
      return V(zig, s * (hp / 2) * (1 - f) - f * hp * 0.25, -f * lp);
    };
    mb.sheet(() => {
      for (let i = 0; i < seg; i++) mb.quad('flag', pt(i, -1), pt(i + 1, -1), pt(i + 1, 1), pt(i, 1));
    });
    mb.pop();
  }

  mb.pop();
}

/** Рангоут, паруса и такелаж. */
export function buildRig(mb, S, state) {
  const rig = state.rig;
  const phi = degToRad(rig.trim ?? 0);
  const lee = phi >= 0 ? 1 : -1;
  const ropeR = clamp(S.L * 0.0018, 0.022, 0.06);
  const ctx = { S, rig, phi, lee, bil: rig.billow ?? 1, sailsSet: !rig.furled, stripes: !!rig.stripes };
  const stripe = ctx.stripes ? 'sail2' : null;
  const rope = (a, b) => mb.cyl('rope', a, b, ropeR, ropeR, 3, false, false);

  const infos = rig.masts
    .slice()
    .sort((a, b) => b.pos - a.pos) // от носа к корме
    .map((m) => {
      const t = clamp(m.pos, 0.05, 0.95);
      const foot = S.deckPoint(t);
      const M = M4().makeTranslation(foot.x, foot.y, foot.z).multiply(M4().makeRotationX(-degToRad(m.rake ?? 0)));
      const H = Math.max(2, m.height);
      return { m, t, foot, M, H, r0: 0.09 + H * 0.011, world: (x, y, z) => V(x, y, z).applyMatrix4(M) };
    });

  const sternZ = S.surf(0, S.sheer(0)).z;
  infos.forEach((mi, i) => {
    const next = infos[i + 1];
    const aftZ = next ? next.foot.z + 0.6 : sternZ - S.L * 0.07;
    mi.availAft = Math.max(1, mi.foot.z - aftZ);
    // китайский парус следующей мачты выходит вперёд за неё — оставляем ему место
    if (isJunkish(next?.m.rig)) mi.availAft = Math.max(1, Math.min(mi.availAft, (mi.foot.z - next.foot.z) * 0.74));
    mi.availFwd = i > 0 ? infos[i - 1].foot.z - mi.foot.z : Infinity;
    buildMast(mb, mi, ctx);
  });

  const fm = infos[0];
  const stays = [];

  // ---- бушприт и кливера ----
  const bs = rig.bowsprit;
  if (bs?.on) {
    const ang = degToRad(bs.angle);
    const rbs = 0.07 + 0.008 * S.L;
    const stemTop = S.surf(1, S.topY(0.999));
    const stemPt = V(0, stemTop.y + clamp(S.L * 0.02, 0.2, 0.7) + rbs, stemTop.z);
    const inboard = S.L * 0.1;
    const dir = V(0, Math.sin(ang), Math.cos(ang));
    const root = stemPt.clone().addScaledVector(dir, -inboard / Math.cos(ang));
    const tip = stemPt.clone().addScaledVector(dir, bs.length * S.L);
    mb.cyl('spar', root, tip, rbs, rbs * 0.5, 6);
    // опора шпора бушприта на палубе
    const tRoot = S.tAtZ(root.z);
    const dY = S.deckY(tRoot);
    if (root.y - dY > 0.05) {
      const pw = rbs * 2.1;
      mb.box('keel', 0, (root.y + dY) / 2, root.z + pw * 0.2, pw, root.y - dY + rbs, pw * 0.8);
    }

    const nj = Math.round(bs.jibs ?? 0);
    if (fm && nj > 0) {
      for (let k = 0; k < nj; k++) {
        const f = nj === 1 ? 0.75 : k / (nj - 1);
        const tack = stemPt.clone().lerp(tip, lerp(0.3, 0.97, f));
        const mp = fm.world(0, fm.H * lerp(0.56, 0.93, f), fm.r0);
        stays.push([tack, mp]);
        if (!ctx.sailsSet) continue;
        const head = tack.clone().lerp(mp, 0.86);
        const base = V(0, Math.max(S.topY(0.96), fm.foot.y + S.bw) + 0.7, fm.foot.z + fm.r0 + 0.5);
        const clew = tack.clone().lerp(base, lerp(0.88, 0.62, f));
        const size = tack.distanceTo(clew);
        clew.x += Math.sin(phi) * size * 0.4;
        mb.sheet(() =>
          mb.triGrid('sail', tack.clone().lerp(mp, 0.04), head, clew, V(lee * ctx.bil * 0.07 * size, 0, 0), 3, stripe),
        );
      }
    } else if (fm) {
      stays.push([tip, fm.world(0, fm.H * 0.9, fm.r0)]);
    }

    // блинд — прямой парус на рее под бушпритом
    if (bs.spritsail) {
      const a = clamp(0.42 * S.B, 0.8, 6);
      const ry = 0.05 + a * 0.011;
      const c = stemPt.clone().lerp(tip, 0.6);
      c.y -= rbs * 0.8 + ry;
      const hs = Math.min(a * 1.25, c.y - 0.7); // нижняя кромка не должна касаться воды
      mb.push(M4().makeTranslation(c.x, c.y, c.z).multiply(M4().makeRotationY(phi * 0.6)));
      mb.cyl('spar', V(0, 0, 0), V(a * 1.06, 0, 0), ry, ry * 0.5, 6, false, true);
      mb.cyl('spar', V(0, 0, 0), V(-a * 1.06, 0, 0), ry, ry * 0.5, 6, false, true);
      if (hs > 0.9) {
        if (ctx.sailsSet) squareSail(mb, { h: hs, a, b: a * 0.9 }, ry + 0.03, ctx.bil, { stripes: ctx.stripes });
        else mb.cyl('sail', V(-a * 0.93, -ry - 0.15, 0), V(a * 0.93, -ry - 0.15, 0), 0.18, 0.18, 5);
      }
      mb.pop();
    }
  } else if (fm && !isJunkish(fm.m.rig)) {
    const stemTop = S.surf(1, S.topY(0.999));
    stays.push([V(0, stemTop.y + 0.1, stemTop.z - 0.1), fm.world(0, fm.H * 0.85, fm.r0)]);
  }

  // ---- такелаж ----
  if (rig.rigging) {
    for (const [a, b] of stays) rope(a, b);
    const sp = clamp(S.L * 0.028, 0.35, 1.1);
    infos.forEach((mi, i) => {
      if (isJunkish(mi.m.rig) || mi.m.rig === 'wing') return; // джонки и «крылья» стоят без вант и штагов
      const A = mi.world(0, mi.shroudY, 0);
      const top = mi.world(0, mi.H * 0.93, 0);
      for (const sgn of [1, -1]) {
        for (let k = 0; k < 3; k++) {
          const z = mi.foot.z - (0.3 + k * 0.8) * sp;
          const tt = S.tAtZ(z);
          rope(V(sgn * mi.r0 * 0.5, A.y, A.z), S.surf(tt, S.topY(tt), sgn));
        }
        // фордун
        const zb = mi.foot.z - (0.3 + 3 * 0.8) * sp - S.L * 0.02;
        const tb = S.tAtZ(zb);
        rope(V(sgn * 0.03, top.y, top.z), S.surf(tb, S.topY(tb), sgn));
        // стень-ванты
        if (mi.twoPart && mi.platR) {
          const up = mi.world(sgn * mi.r0 * 0.4, mi.lowerTop + (mi.H - mi.lowerTop) * 0.72, 0);
          rope(mi.world(sgn * mi.platR * 0.9, mi.lowerTop + 0.08, -mi.platR * 0.25), up);
          rope(mi.world(sgn * mi.platR * 0.9, mi.lowerTop + 0.08, mi.platR * 0.2), up);
        }
      }
      // штаг к передней мачте (только для мачт без прямых парусов, чтобы не протыкать их)
      if (i > 0 && !sailAhead(mi.m.rig) && !isJunkish(infos[i - 1].m.rig) && infos[i - 1].m.rig !== 'wing') {
        const f = infos[i - 1];
        rope(mi.world(0, mi.H * 0.94, mi.r0 * 0.4), f.world(0, f.H * 0.3, -f.r0));
      }
    });
  }

  return { masts: infos };
}
