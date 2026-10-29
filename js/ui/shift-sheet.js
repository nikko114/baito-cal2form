// 確定シフトの画面で日付をタップしたときに下から出るパネル

import { WEEKDAYS, daysInMonth, parseYmd, weekdayOf } from '../dates.js';
import { optionMap } from '../logic.js';
import { END_HOURS, START_HOURS, dayPay, formatDuration, formatRange, formatYen, shortRange } from '../pay.js';
import { chip, colorChip, h, icon, weekdayClass } from './dom.js';
import { breakSelect, timePicker } from './shift-parts.js';

export function renderShiftSheet({ state, actions }) {
  const { data } = state;
  const ymd = state.shiftDate;
  const { y, m, d } = parseYmd(ymd);
  const wd = weekdayOf(y, m, d);
  const shift = data.shifts[ymd];
  const wish = optionMap(data).get(data.entries[ymd]);

  return h(
    'div',
    { class: 'sheet-inner' },
    h(
      'div',
      { class: 'sheet-head' },
      h('button', { class: 'icon-btn', 'aria-label': '前の日', disabled: d <= 1, onclick: () => actions.shiftStep(-1) }, icon('left', 22)),
      h('div', { class: 'sheet-title' }, `${m}月${d}日`, h('span', { class: ['sheet-wd', weekdayClass(wd)] }, `(${WEEKDAYS[wd]})`)),
      h(
        'button',
        { class: 'icon-btn', 'aria-label': '次の日', disabled: d >= daysInMonth(y, m), onclick: () => actions.shiftStep(1) },
        icon('right', 22),
      ),
      h('button', { class: 'btn small', onclick: actions.closeShiftSheet }, '閉じる'),
    ),
    h('p', { class: 'sheet-wish' }, '出した希望: ', wish ? [chip(wish), wish.note] : 'なし'),
    data.templates.length
      ? h(
          'div',
          { class: 'opt-grid' },
          data.templates.map((t) =>
            h(
              'button',
              {
                class: ['opt-btn', shift?.templateId === t.id && 'current'],
                'aria-pressed': String(shift?.templateId === t.id),
                'aria-label': `${t.name} ${formatRange(t)}`,
                onclick: () => actions.applyTemplate(t.id),
              },
              colorChip(shortRange(t), t.color, { large: true }),
              t.name && h('span', { class: 'note' }, t.name),
            ),
          ),
        )
      : h('p', { class: 'hint' }, '設定で勤務パターンを登録すると、1タップで入れられる'),
    shift && editor(data, ymd, shift, actions),
    h(
      'div',
      { class: 'sheet-foot' },
      h('span', { class: 'hint' }, shift ? '時間はあとから直せる' : 'パターンにない時間なら'),
      shift
        ? h('button', { class: 'btn small danger', onclick: actions.removeShift }, 'この日は休みにする')
        : h('button', { class: 'btn small', onclick: actions.addCustomShift }, '時間を指定して入れる'),
    ),
  );
}

function editor(data, ymd, shift, actions) {
  const day = dayPay(data.pay, ymd, shift);
  return h(
    'div',
    { class: 'shift-editor' },
    h(
      'div',
      { class: 'time-row' },
      timePicker({
        id: 'shift-start',
        label: '始まり',
        value: shift.start,
        hours: START_HOURS,
        onchange: (v) => actions.updateShift({ start: v }),
      }),
      h('span', {}, '〜'),
      timePicker({
        id: 'shift-end',
        label: '終わり',
        value: shift.end,
        hours: END_HOURS,
        onchange: (v) => actions.updateShift({ end: v }),
      }),
    ),
    h(
      'div',
      { class: 'time-row' },
      h('label', { for: 'shift-break' }, '休憩'),
      breakSelect({ id: 'shift-break', value: shift.breakMin, onchange: (v) => actions.updateShift({ breakMin: v }) }),
      h(
        'span',
        { class: 'shift-calc' },
        formatDuration(day.work),
        day.night > 0 && `（深夜 ${formatDuration(day.night)}）`,
        day.hourly > 0 && ` ・ ${formatYen(day.amount)}`,
      ),
    ),
  );
}
