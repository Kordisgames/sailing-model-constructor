import { BOW_TYPES, STERN_TYPES, HULL_FORMS, applyHullForm } from './builder/hull.js';
import { RIG_TYPES, SAIL_CUTS, WING_STYLES } from './builder/rig.js';
import { BACKDROPS } from './builder/backdrops.js';
import { GUN_ROWS } from './builder/details.js';
import {
  COLOR_SLOTS,
  PALETTES,
  loadCustomPalettes,
  saveCustomPalette,
  deleteCustomPalette,
} from './builder/materials.js';
import { PRESETS, newMast } from './presets.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value' || k === 'disabled') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const decimals = (step) => {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
};

/**
 * Панель управления. app: { state, changed(), loadPreset(id), randomize(), setState(), actions }.
 * Ползунки меняют state напрямую и вызывают app.changed(); структура панели
 * перерисовывается только при смене вкладки, типа детали или состава мачт.
 */
export function createUI(panel, app) {
  let tab = 'presets';

  // ---------- базовые элементы управления ----------
  const group = (title, children, extra) =>
    el('section', { class: 'grp' }, [el('h3', {}, [title, extra]), ...[].concat(children)]);

  const note = (text) => el('p', { class: 'note', text });

  function slider(label, obj, key, min, max, step, opts = {}) {
    const k = opts.scale ?? 1;
    const dec = decimals(step * k < 1 ? Number((step * k).toPrecision(2)) : step * k);
    const show = (v) => Number((v * k).toFixed(dec));
    const range = el('input', { type: 'range', min: min * k, max: max * k, step: step * k });
    const num = el('input', { type: 'number', class: 'num', min: min * k, max: max * k, step: step * k });
    range.value = show(obj[key]);
    num.value = show(obj[key]);
    const set = (raw, from) => {
      let v = Number(raw);
      if (!Number.isFinite(v)) return;
      v = Math.min(max * k, Math.max(min * k, v));
      obj[key] = v / k;
      if (from !== range) range.value = v;
      if (from !== num) num.value = show(v / k);
      opts.onChange?.(obj[key]);
      app.changed();
    };
    range.addEventListener('input', () => set(range.value, range));
    num.addEventListener('change', () => set(num.value, num));
    return el('div', { class: 'row', title: opts.hint }, [
      el('span', { class: 'lbl', text: label }),
      range,
      num,
      el('span', { class: 'unit', text: opts.unit ?? '' }),
    ]);
  }

  function toggle(label, obj, key, opts = {}) {
    const input = el('input', { type: 'checkbox', checked: !!obj[key] });
    input.addEventListener('change', () => {
      obj[key] = input.checked;
      opts.onChange?.(obj[key]);
      if (!opts.skipRebuild) app.changed();
      if (opts.rerender) render();
    });
    return el('label', { class: 'toggle', title: opts.hint }, [input, el('span', { text: label })]);
  }

  function chips(types, current, onPick) {
    return el(
      'div',
      { class: 'chips' },
      Object.entries(types).map(([id, t]) =>
        el('button', {
          type: 'button',
          class: 'chip' + (id === String(current) ? ' active' : ''),
          title: t.hint,
          text: t.label,
          onclick: () => onPick(id),
        }),
      ),
    );
  }

  // ---------- вкладки ----------
  function presetsTab() {
    return [
      group(
        'Заготовки кораблей',
        [
          el('button', { type: 'button', class: 'btn wide', text: 'Случайный корабль', onclick: () => app.randomize() }),
          el(
            'div',
            { class: 'cards' },
            PRESETS.map((p) =>
              el('button', { type: 'button', class: 'card', onclick: () => app.loadPreset(p.id) }, [
                el('strong', { text: p.label }),
                el('span', { text: p.hint }),
              ]),
            ),
          ),
        ],
      ),
      note(
        'Выберите заготовку, затем меняйте корпус, нос, корму, палубы и парусное вооружение на соседних вкладках. Все изменения сохраняются в браузере автоматически.',
      ),
    ];
  }

  function hullTab() {
    const h = app.state.hull;
    const stern = STERN_TYPES[h.sternType];
    return [
      group('Форма корпуса', [
        chips(HULL_FORMS, h.form, (id) => {
          applyHullForm(h, id);
          app.changed();
          render();
        }),
        note(
          HULL_FORMS[h.form]?.hint ??
            'Заготовка задаёт пропорции и обводы под текущую длину. Дальше всё можно подправить ползунками.',
        ),
      ]),
      group('Размеры', [
        slider('Длина', h, 'length', 6, 70, 0.5, { unit: 'м' }),
        slider('Ширина', h, 'beam', 2, 18, 0.1, { unit: 'м' }),
        slider('Осадка', h, 'draft', 0.5, 7, 0.1, { unit: 'м' }),
        slider('Высота борта', h, 'freeboard', 0.6, 8, 0.1, { unit: 'м', hint: 'Высота планширя над водой в середине корпуса' }),
        slider('Фальшборт', h, 'bulwark', 0.2, 1.8, 0.05, { unit: 'м', hint: 'Высота ограждения над главной палубой' }),
      ]),
      group('Нос', [
        chips(BOW_TYPES, h.bowType, (id) => {
          h.bowType = id;
          Object.assign(h, BOW_TYPES[id].defaults);
          app.changed();
          render();
        }),
        note(BOW_TYPES[h.bowType].hint),
        slider('Вынос', h, 'bowRake', -0.12, 0.3, 0.005, { scale: 100, unit: '%', hint: 'Насколько форштевень выдаётся вперёд (в долях длины). Отрицательный — обратный наклон, как у тарана' }),
        slider('Полнота', h, 'bowFullness', 0, 1, 0.01, { scale: 100, unit: '%', hint: 'Острый нос — малые значения, тупой — большие' }),
        slider('Подъём палубы', h, 'sheerBow', 0, 5, 0.05, { unit: 'м', hint: 'Седловатость: подъём борта к носу' }),
      ]),
      group('Корма', [
        chips(STERN_TYPES, h.sternType, (id) => {
          h.sternType = id;
          Object.assign(h, STERN_TYPES[id].defaults);
          app.changed();
          render();
        }),
        note(stern.hint),
        stern.transom && slider('Ширина транца', h, 'sternWidth', 0.2, 1, 0.01, { scale: 100, unit: '%' }),
        slider('Наклон', h, 'sternRake', -0.03, 0.2, 0.005, { scale: 100, unit: '%', hint: 'Свес кормы назад (в долях длины)' }),
        slider('Подъём днища', h, 'sternRise', 0, 1.2, 0.01, { scale: 100, unit: '%', hint: 'Насколько днище поднимается к корме' }),
        slider('Полнота', h, 'sternFullness', 0, 1, 0.01, { scale: 100, unit: '%' }),
        slider('Подъём палубы', h, 'sheerStern', 0, 5, 0.05, { unit: 'м', hint: 'Седловатость: подъём борта к корме' }),
      ]),
      group('Обводы', [
        slider('Полнота миделя', h, 'midFullness', 0, 1, 0.01, { scale: 100, unit: '%', hint: 'Малые значения — V-образное сечение, большие — «ящик»' }),
        slider('Завал бортов', h, 'tumblehome', 0, 0.3, 0.005, { scale: 100, unit: '%', hint: 'Сужение корпуса кверху, как у галеонов' }),
        el('div', { class: 'row' }, [
          el('span', { class: 'lbl', text: 'Детализация' }),
          chips({ 0: { label: 'Низкая' }, 1: { label: 'Средняя' }, 2: { label: 'Высокая' } }, h.detail, (id) => {
            h.detail = Number(id);
            app.changed();
            render();
          }),
        ]),
      ]),
      group('Киль и руль', [toggle('Киль и штевни', h, 'keel'), toggle('Руль', h, 'rudder')]),
    ];
  }

  function deckBlock(title, obj, hint, lenMax) {
    return group(title, [
      toggle('Включить', obj, 'on', { rerender: true }),
      note(hint),
      obj.on && slider('Длина', obj, 'length', 0.06, lenMax, 0.01, { scale: 100, unit: '%', hint: 'В долях длины корпуса' }),
      obj.on && slider('Высота', obj, 'height', 0.5, 3.5, 0.05, { unit: 'м', hint: 'Высота палубы над нижележащей' }),
    ]);
  }

  function decksTab() {
    const h = app.state.hull;
    return [
      deckBlock('Бак (носовая надстройка)', h.forecastle, 'Приподнятая палуба в носу.', 0.4),
      deckBlock('Шканцы (кормовая надстройка)', h.quarterdeck, 'Приподнятая палуба в корме — здесь стоит штурвал.', 0.6),
      h.quarterdeck.on
        ? deckBlock('Ют (второй ярус кормы)', h.poop, 'Ещё один ярус поверх шканцев — для галеонов и больших кораблей.', 0.5)
        : note('Ют (второй ярус) доступен после включения шканцев.'),
    ];
  }

  function mastName(i, n) {
    const names = { 1: ['Грот-мачта'], 2: ['Фок-мачта', 'Грот-мачта'], 3: ['Фок-мачта', 'Грот-мачта', 'Бизань-мачта'] };
    return names[n]?.[i] ?? `Мачта ${i + 1}`;
  }

  function mastCard(m, i, n) {
    const rig = app.state.rig;
    const remove = el('button', {
      type: 'button',
      class: 'icon-btn',
      title: 'Удалить мачту',
      text: '×',
      onclick: () => {
        rig.masts.splice(rig.masts.indexOf(m), 1);
        app.changed();
        render();
      },
    });
    const rows = [
      chips(RIG_TYPES, m.rig, (id) => {
        m.rig = id;
        app.changed();
        render();
      }),
      slider('Положение', m, 'pos', 0.05, 0.95, 0.01, { scale: 100, unit: '%', hint: '0% — корма, 100% — нос' }),
      slider('Высота', m, 'height', 4, 55, 0.5, { unit: 'м' }),
      slider('Наклон', m, 'rake', -12, 15, 0.5, { unit: '°', hint: 'Положительный — наклон к корме' }),
    ];
    const yardCut = () => [
      el('div', { class: 'row' }, [
        el('span', { class: 'lbl', text: 'Покрой' }),
        chips(SAIL_CUTS, m.cut || 'plain', (id) => {
          m.cut = id;
          app.changed();
          render();
        }),
      ]),
      note(SAIL_CUTS[m.cut || 'plain'].hint),
      toggle('Рифлёные складки', m, 'ribbed', { hint: 'Вертикальные складки на полотнище — «рифлёные трусы» и т.п.' }),
    ];
    if (m.rig === 'square') {
      rows.push(
        slider('Ярусов парусов', m, 'sails', 1, 4, 1),
        slider('Ширина парусов', m, 'width', 0.5, 1.5, 0.01, { scale: 100, unit: '%' }),
        ...yardCut(),
        toggle('Гафельный парус за мачтой (бизань)', m, 'spanker'),
      );
    } else if (m.rig === 'gaff') {
      rows.push(
        slider('Размер паруса', m, 'width', 0.5, 1.5, 0.01, { scale: 100, unit: '%' }),
        toggle('Топсель над гафелем', m, 'gaffTopsail'),
        toggle('Прямой марсель', m, 'squareTopsail', { hint: 'Прямой парус в верхней части мачты (марсельная шхуна)' }),
      );
    } else if (m.rig === 'wing') {
      const ws = m.wingStyle || 'ribbed';
      rows.push(
        slider(ws === 'skew' ? 'Длина паруса' : 'Размер паруса', m, 'width', 0.5, ws === 'skew' ? 2.2 : 1.5, 0.01, {
          scale: 100,
          unit: '%',
          hint: ws === 'skew' ? 'Вынос косого паруса вперёд — к бушприту' : undefined,
        }),
        el('div', { class: 'row' }, [
          el('span', { class: 'lbl', text: 'Формат' }),
          chips(WING_STYLES, ws, (id) => {
            m.wingStyle = id;
            if (id === 'skew' && (m.wingTilt == null || m.wingTilt > 70)) m.wingTilt = 32;
            if (id === 'triangle' && (m.wingTilt == null || m.wingTilt < 25)) m.wingTilt = 55;
            app.changed();
            render();
          }),
        ]),
        note(WING_STYLES[ws].hint),
        (ws === 'skew' || ws === 'triangle') &&
          slider('Наклон', m, 'wingTilt', ws === 'skew' ? 10 : 25, ws === 'skew' ? 65 : 75, 1, {
            unit: '°',
            hint: ws === 'skew'
              ? 'Наклон длинного рю: меньше — положе и длиннее к носу, больше — круче'
              : 'Наклон рю латинского крыла',
          }),
        slider('Угол к борту', m, 'wingAngle', 0, 70, 1, {
          unit: '°',
          hint: 'Отклонение плоскости паруса от диаметрали к борту',
        }),
        slider('Надув', m, 'wingInflate', 0, 1.8, 0.05, {
          scale: 100,
          unit: '%',
          hint: 'Насколько полотнище выдувается наружу',
        }),
        ws === 'ribbed' &&
          slider('Рёбер', m, 'battens', 3, 8, 1, { hint: 'Число рёбер веера на каждом крыле' }),
      );
    } else if (m.rig === 'junk' || m.rig === 'oblique') {
      rows.push(
        slider('Размер паруса', m, 'width', 0.5, 1.5, 0.01, { scale: 100, unit: '%' }),
        slider('Латов', m, 'battens', 3, 8, 1, {
          hint: m.rig === 'oblique' ? 'Горизонтальные латы между многоугольными секциями' : undefined,
        }),
      );
    } else if (m.rig === 'skew') {
      rows.push(
        slider('Ярусов парусов', m, 'sails', 1, 4, 1),
        slider('Ширина парусов', m, 'width', 0.5, 1.5, 0.01, { scale: 100, unit: '%' }),
        ...yardCut(),
        slider('Перекос реев', m, 'tilt', -35, 35, 1, { unit: '°', hint: 'Один конец рея выше другого' }),
        slider('Закрутка ярусов', m, 'twist', -20, 20, 1, { unit: '°', hint: 'Каждый следующий ярус развёрнут вокруг мачты сильнее предыдущего' }),
        toggle('Вразнобой', m, 'alternate', { hint: 'Соседние ярусы перекошены в разные стороны' }),
        toggle('Гафельный парус за мачтой (бизань)', m, 'spanker'),
      );
    } else if (m.rig !== 'bare') {
      rows.push(slider('Размер паруса', m, 'width', 0.5, 1.5, 0.01, { scale: 100, unit: '%' }));
    }
    return group(mastName(i, n), rows, remove);
  }

  function rigTab() {
    const rig = app.state.rig;
    const sorted = rig.masts.slice().sort((a, b) => b.pos - a.pos);
    const add = el('button', {
      type: 'button',
      class: 'btn wide',
      text: '+ Добавить мачту',
      disabled: rig.masts.length >= 5,
      onclick: () => {
        const ps = [0.03, ...rig.masts.map((m) => m.pos).sort((a, b) => a - b), 0.97];
        let best = 0;
        for (let i = 1; i < ps.length - 1; i++) if (ps[i + 1] - ps[i] > ps[best + 1] - ps[best]) best = i;
        const pos = (ps[best] + ps[best + 1]) / 2;
        const avg = rig.masts.length ? rig.masts.reduce((s, m) => s + m.height, 0) / rig.masts.length : app.state.hull.length * 0.85;
        rig.masts.push(newMast({ pos: Math.round(pos * 100) / 100, height: Math.round(avg) }));
        app.changed();
        render();
      },
    });
    const bs = rig.bowsprit;
    return [
      ...sorted.map((m, i) => mastCard(m, i, sorted.length)),
      add,
      group('Бушприт и кливера', [
        toggle('Бушприт', bs, 'on', { rerender: true }),
        bs.on && slider('Длина', bs, 'length', 0.05, 0.5, 0.01, { scale: 100, unit: '%', hint: 'В долях длины корпуса' }),
        bs.on && slider('Угол', bs, 'angle', 0, 40, 1, { unit: '°' }),
        bs.on && slider('Кливеров', bs, 'jibs', 0, 4, 1, { hint: 'Косые паруса от бушприта к фок-мачте' }),
        bs.on && toggle('Прямой парус на бушприте (блинд)', bs, 'spritsail', { hint: 'Прямой парус на рее под бушпритом — вместе с кливерами' }),
      ]),
      group('Паруса и такелаж', [
        slider('Разворот парусов', rig, 'trim', -35, 35, 1, { unit: '°', hint: 'Брасопка реев и вынос гиков на подветренный борт' }),
        slider('Наполнение ветром', rig, 'billow', 0, 2, 0.05, { scale: 100, unit: '%' }),
        toggle('Паруса убраны', rig, 'furled'),
        toggle('Полосы на парусах', rig, 'stripes', { hint: 'Чередование основного цвета паруса и цвета «Паруса: полосы»' }),
        toggle('Такелаж (ванты, штаги)', rig, 'rigging'),
        toggle('Марсовые площадки', rig, 'tops'),
        toggle('Вымпелы на мачтах', rig, 'pennants'),
      ]),
    ];
  }

  function detailsTab() {
    const d = app.state.details;
    return [
      group('Артиллерия', [
        slider('Пушек на борт', d, 'guns', 0, 24, 1),
        el('div', { class: 'row' }, [
          el('span', { class: 'lbl', text: 'Размещение' }),
          chips(GUN_ROWS, d.gunRow, (id) => {
            d.gunRow = id;
            app.changed();
            render();
          }),
        ]),
      ]),
      group('Корма', [
        slider('Кормовые окна', d, 'sternWindows', 0, 9, 1, { hint: 'Для кормы с транцем и полукруглой кормы' }),
        slider('Фонари', d, 'lanterns', 0, 3, 1),
        toggle('Кормовой флаг', d, 'ensign'),
      ]),
      group('Палуба и нос', [
        slider('Вёсел на борт', d, 'oars', 0, 20, 1, { hint: 'Вёсла вдоль главной палубы — для галер и ладей' }),
        toggle('Люки', d, 'hatches'),
        toggle('Штурвал / румпель', d, 'wheel'),
        toggle('Двери и окна надстроек', d, 'doors'),
        toggle('Якоря', d, 'anchors'),
        toggle('Гальюн (клюв под бушпритом)', d, 'beakhead'),
      ]),
    ];
  }

  function paletteBtn(p, opts = {}) {
    const apply = () => {
      Object.assign(app.state.colors, p.colors);
      app.changed();
      render();
    };
    const btn = el(
      'button',
      { type: 'button', class: 'palette', title: p.label, onclick: apply },
      [
        el(
          'span',
          { class: 'swatches' },
          ['hull', 'bulwark', 'trim', 'sail'].map((k) => el('i', { style: `background:${p.colors[k] ?? '#888'}` })),
        ),
        el('span', { class: 'palette-name', text: p.label }),
      ],
    );
    if (!opts.onDelete) return btn;
    return el('div', { class: 'palette-wrap' }, [
      btn,
      el('button', {
        type: 'button',
        class: 'icon-btn palette-del',
        title: 'Удалить палитру',
        text: '×',
        onclick: (e) => {
          e.stopPropagation();
          opts.onDelete();
        },
      }),
    ]);
  }

  function colorsTab() {
    const c = app.state.colors;
    const custom = loadCustomPalettes();
    return [
      group('Готовые палитры', [
        el(
          'div',
          { class: 'palettes' },
          Object.entries(PALETTES).map(([, p]) => paletteBtn(p)),
        ),
      ]),
      group('Мои палитры', [
        custom.length
          ? el(
              'div',
              { class: 'palettes' },
              custom.map((p) =>
                paletteBtn(p, {
                  onDelete: () => {
                    if (!confirm(`Удалить палитру «${p.label}»?`)) return;
                    deleteCustomPalette(p.id);
                    render();
                  },
                }),
              ),
            )
          : note('Пока пусто — настройте цвета ниже и сохраните палитру.'),
        el('button', {
          type: 'button',
          class: 'btn wide',
          text: 'Сохранить текущие цвета…',
          onclick: () => {
            const name = prompt('Название палитры', 'Моя палитра');
            if (!name) return;
            saveCustomPalette(name, c);
            render();
          },
        }),
      ]),
      group(
        'Цвета частей',
        COLOR_SLOTS.map(({ key, label }) => {
          const input = el('input', { type: 'color', value: c[key] });
          input.addEventListener('input', () => {
            c[key] = input.value;
            app.changed();
          });
          return el('label', { class: 'color-row' }, [input, el('span', { text: label })]);
        }),
      ),
      note('Каждый цвет — отдельный материал в GLB с тем же именем (hull, sail, deck…). Свои палитры хранятся в браузере.'),
    ];
  }

  function exportTab() {
    const o = app.settings;
    const originChips = chips(
      { waterline: { label: 'Ватерлиния', hint: 'y = 0 на уровне воды' }, keel: { label: 'Киль', hint: 'y = 0 под килем' } },
      o.origin,
      (id) => {
        o.origin = id;
        app.saveSettings();
        render();
      },
    );
    const view = app.getCameraView?.() ?? { azimuth: 0, elevation: 0, zoom: 1 };
    const saved = o.savedView;
    const fmt = (v) =>
      v
        ? `${(((v.azimuth % 360) + 360) % 360).toFixed(0)}° азимут · ${v.elevation.toFixed(0)}° высота · ×${(v.zoom ?? 1).toFixed(2)}`
        : 'не задан';
    return [
      group('Ракурс камеры', [
        note(`Сейчас: ${fmt(view)}`),
        saved ? note(`Запомнен: ${fmt(saved)}`) : note('Запомните ракурс, чтобы снимать разные корабли под одним углом.'),
        el('div', { class: 'btn-row' }, [
          el('button', {
            type: 'button',
            class: 'btn primary',
            text: 'Запомнить ракурс',
            onclick: () => {
              app.rememberView();
              render();
            },
          }),
          el('button', {
            type: 'button',
            class: 'btn',
            text: 'Применить',
            disabled: !saved,
            onclick: () => app.applySavedView(),
          }),
        ]),
        el('div', { class: 'btn-row' }, [
          el('button', {
            type: 'button',
            class: 'btn',
            text: 'Сбросить запомненный',
            disabled: !saved,
            onclick: () => {
              app.clearSavedView();
              render();
            },
          }),
        ]),
        toggle('Держать ракурс при смене корабля', o, 'keepView', {
          hint: 'При выборе заготовки или открытии JSON без своего ракурса — подставлять запомненный угол',
          rerender: true,
          skipRebuild: true,
          onChange: () => app.saveSettings(),
        }),
      ]),
      group('3D-модель', [
        el('div', { class: 'row' }, [el('span', { class: 'lbl', text: 'Нулевая высота' }), originChips]),
        slider('Масштаб', o, 'scale', 0.01, 10, 0.01, {
          hint: 'Множитель размера: при 1 одна единица равна метру',
          onChange: () => app.saveSettings(),
        }),
        el('div', { class: 'btn-row' }, [
          el('button', { type: 'button', class: 'btn primary', text: 'Скачать GLB', onclick: () => app.exportModel(true) }),
          el('button', { type: 'button', class: 'btn', text: 'Скачать glTF', onclick: () => app.exportModel(false) }),
        ]),
        note('Оси: нос +Z, верх +Y. В модель пишется JSON проекта и текущий ракурс камеры.'),
      ]),
      group('Фон и PNG', [
        el('div', { class: 'row' }, [
          el('span', { class: 'lbl', text: 'Фон' }),
          chips(BACKDROPS, o.backdrop || 'none', (id) => {
            app.setBackdrop(id);
            render();
          }),
        ]),
        note(BACKDROPS[o.backdrop || 'none'].hint),
        el('div', { class: 'btn-row' }, [
          el('button', {
            type: 'button',
            class: 'btn primary',
            text: 'PNG с фоном',
            disabled: (o.backdrop || 'none') === 'none',
            title: (o.backdrop || 'none') === 'none' ? 'Сначала выберите фон выше' : undefined,
            onclick: () => app.exportIcon({ transparent: false }),
          }),
          el('button', {
            type: 'button',
            class: 'btn',
            text: 'PNG прозрачный',
            onclick: () => app.exportIcon({ transparent: true }),
          }),
        ]),
        note('Фон сразу виден во вьюпорте. Снимок 1024×1024 — с фоном или с прозрачностью, текущий ракурс.'),
      ]),
      group('Проект JSON', [
        el('div', { class: 'btn-row' }, [
          el('button', { type: 'button', class: 'btn primary', text: 'Скачать .json', onclick: () => app.saveProject() }),
          el('button', { type: 'button', class: 'btn', text: 'Открыть…', onclick: () => app.openProject() }),
        ]),
        note(
          'JSON хранит все параметры корабля и ракурс. Можно снова открыть и править. Также открываются GLB/glTF, экспортированные отсюда.',
        ),
      ]),
    ];
  }

  const tabs = [
    { id: 'presets', label: 'Заготовки', render: presetsTab },
    { id: 'hull', label: 'Корпус', render: hullTab },
    { id: 'decks', label: 'Палубы', render: decksTab },
    { id: 'rig', label: 'Паруса', render: rigTab },
    { id: 'details', label: 'Детали', render: detailsTab },
    { id: 'colors', label: 'Цвета', render: colorsTab },
    { id: 'export', label: 'Экспорт', render: exportTab },
  ];

  const nav = el('nav', { class: 'tabs' });
  const body = el('div', { class: 'tab-body' });
  panel.append(nav, body);

  function render() {
    nav.replaceChildren(
      ...tabs.map((t) =>
        el('button', {
          type: 'button',
          class: 'tab' + (t.id === tab ? ' active' : ''),
          text: t.label,
          onclick: () => {
            tab = t.id;
            body.scrollTop = 0;
            render();
          },
        }),
      ),
    );
    const scroll = body.scrollTop;
    body.replaceChildren(...tabs.find((t) => t.id === tab).render().filter(Boolean));
    body.scrollTop = scroll;
  }

  render();
  return { render };
}
