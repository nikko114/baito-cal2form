// 日付をタップしたときに下から出る、選択肢のパネル

import { WEEKDAYS, daysInMonth, parseYmd, weekdayOf } from '../dates.js';
import { chip, h, icon, weekdayClass } from './dom.js';

export function renderSheet({ state, actions }) {
  const { data } = state;
  const { y, m, d } = parseYmd(state.sheetDate);
  const wd = weekdayOf(y, m, d);
  const current = data.entries[state.sheetDate];

  return h(
    'div',
    { class: 'sheet-inner' },
    h(
      'div',
      { class: 'sheet-head' },
      h('button', { class: 'icon-btn', 'aria-label': '前の日', disabled: d <= 1, onclick: () => actions.sheetStep(-1) }, icon('left', 22)),
      h('div', { class: 'sheet-title' }, `${m}月${d}日`, h('span', { class: ['sheet-wd', weekdayClass(wd)] }, `(${WEEKDAYS[wd]})`)),
      h(
        'button',
        { class: 'icon-btn', 'aria-label': '次の日', disabled: d >= daysInMonth(y, m), onclick: () => actions.sheetStep(1) },
        icon('right', 22),
      ),
      h('button', { class: 'btn small', onclick: actions.closeSheet }, '閉じる'),
    ),
    data.options.length
      ? h(
          'div',
          { class: 'opt-grid' },
          data.options.map((o) =>
            h(
              'button',
              {
                class: ['opt-btn', o.id === current && 'current'],
                'aria-pressed': String(o.id === current),
                onclick: () => actions.choose(o.id),
              },
              chip(o, { large: true }),
              o.note && h('span', { class: 'note' }, o.note),
            ),
          ),
        )
      : h('p', { class: 'hint' }, '選択肢がまだない。設定で登録してね'),
    h(
      'div',
      { class: 'sheet-foot' },
      h('span', { class: 'hint' }, '選ぶと次の日に進む'),
      h('button', { class: 'btn small', disabled: !current, onclick: actions.clearDay }, 'この日を空にする'),
    ),
  );
}
