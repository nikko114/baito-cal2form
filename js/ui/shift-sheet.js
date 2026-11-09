// 確定シフトの画面で日付をタップしたときに下から出るパネル。
// 予定（決まったシフト）と、実際に働いた時間（実績）を入れる。

import { WEEKDAYS, daysInMonth, parseYmd, todayYmd, weekdayOf } from '../dates.js';
import { optionMap } from '../logic.js';
import { END_HOURS, START_HOURS, dayPay, formatDuration, formatRange, formatYen, shortRange } from '../pay.js';
import { chip, colorChip, h, icon, weekdayClass } from './dom.js';
import { breakSelect, shiftChip, timePicker } from './shift-parts.js';

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
    shift ? withShift(state, actions, ymd, shift) : withoutShift(data, actions),
  );
}

// まだシフトがない日: 勤務パターンか、時間を指定して入れる
function withoutShift(data, actions) {
  return [
    templateGrid(data, null, actions),
    h(
      'div',
      { class: 'sheet-foot' },
      h('span', { class: 'hint' }, 'パターンにない時間なら'),
      h('button', { class: 'btn small', onclick: actions.addCustomShift }, '時間を指定して入れる'),
    ),
  ];
}

function templateGrid(data, shift, actions) {
  if (!data.templates.length) return h('p', { class: 'hint' }, '設定で勤務パターンを登録すると、1タップで入れられる');
  return h(
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
  );
}

const breakText = (min) => (min ? `休憩 ${formatDuration(min)}` : '休憩なし');

function calcText(day) {
  return [
    formatDuration(day.work),
    day.night > 0 && `（深夜 ${formatDuration(day.night)}）`,
    day.hourly > 0 && ` ・ ${formatYen(day.amount)}`,
  ];
}

// シフトがある日: 予定（たたんでおき、必要なら直す）と、実際の時間
function withShift(state, actions, ymd, shift) {
  const { data } = state;
  const templates = new Map(data.templates.map((t) => [t.id, t]));
  const planned = { start: shift.start, end: shift.end, breakMin: shift.breakMin, templateId: shift.templateId };
  const editing = state.shiftEditing;

  const plan = h(
    'section',
    { class: 'sheet-section' },
    h(
      'div',
      { class: 'section-row' },
      h('span', { class: 'section-label' }, '予定'),
      shiftChip(planned, templates),
      h('span', { class: 'grow plan-text' }, h('span', {}, formatRange(shift)), h('span', {}, breakText(shift.breakMin))),
      h(
        'button',
        { class: 'btn small', 'aria-expanded': String(editing), onclick: actions.toggleShiftEditing },
        editing ? 'できた' : '変える',
      ),
    ),
    editing && [
      templateGrid(data, shift, actions),
      h(
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
          h('span', { class: 'shift-calc' }, calcText(dayPay(data.pay, ymd, planned))),
        ),
      ),
    ],
  );

  return [
    plan,
    actualSection(data, actions, ymd, shift),
    h(
      'div',
      { class: 'sheet-foot' },
      h('span', { class: 'hint' }, '休んだ日・なくなった日は'),
      h('button', { class: 'btn small danger', onclick: actions.removeShift }, 'この日は休みにする'),
    ),
  ];
}

// 実際に働いた時間（実績）。その日になるまでは入れない
function actualSection(data, actions, ymd, shift) {
  if (ymd > todayYmd()) {
    return h('p', { class: 'hint sheet-note' }, '実際に働いた時間は、その日になったら入れられる（入れると給料の見込みが実際に近くなる）');
  }
  if (!shift.actual) {
    return h(
      'section',
      { class: 'sheet-section' },
      h(
        'div',
        { class: 'section-row' },
        h('span', { class: 'section-label' }, '実際'),
        h('span', { class: 'grow hint' }, 'まだ入れていない（予定の時間で計算中）'),
        h('button', { class: 'btn small primary', onclick: actions.markWorkedAsPlanned }, icon('check', 16), '予定どおり働いた'),
      ),
      h('p', { class: 'hint' }, '残業や早上がりがあった日は、押したあとに時間を直す'),
    );
  }
  const day = dayPay(data.pay, ymd, shift);
  const diff = day.diff === 0 ? '予定どおり' : `予定より ${day.diff > 0 ? '+' : '−'}${formatDuration(Math.abs(day.diff))}`;
  return h(
    'section',
    { class: 'sheet-section actual' },
    h(
      'div',
      { class: 'section-row' },
      h('span', { class: 'section-label' }, '実際'),
      h('span', { class: 'grow' }, diff),
      h('button', { class: 'btn small', onclick: actions.removeActual }, '実績を消す'),
    ),
    h(
      'div',
      { class: 'shift-editor' },
      h(
        'div',
        { class: 'time-row' },
        timePicker({
          id: 'actual-start',
          label: '出勤',
          value: shift.actual.start,
          hours: START_HOURS,
          step: 1,
          onchange: (v) => actions.updateActual({ start: v }),
        }),
        h('span', {}, '〜'),
        timePicker({
          id: 'actual-end',
          label: '退勤',
          value: shift.actual.end,
          hours: END_HOURS,
          step: 1,
          onchange: (v) => actions.updateActual({ end: v }),
        }),
      ),
      h(
        'div',
        { class: 'time-row' },
        h('label', { for: 'actual-break' }, '休憩'),
        breakSelect({ id: 'actual-break', value: shift.actual.breakMin, step: 5, onchange: (v) => actions.updateActual({ breakMin: v }) }),
        h('span', { class: 'shift-calc' }, calcText(day)),
      ),
      data.pay.rounding > 0 && h('p', { class: 'hint' }, `${data.pay.rounding}分単位に丸めて計算（${formatRange(day.times)}）`),
    ),
  );
}
