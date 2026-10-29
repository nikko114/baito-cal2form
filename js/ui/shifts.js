// 確定シフトの画面（決まったシフトの時間を入れるカレンダー）

import { WEEKDAYS, daysInMonth, monthWeeks, parseMonthKey, todayYmd, toYmd, weekdayOrder } from '../dates.js';
import { optionMap } from '../logic.js';
import { formatDuration, formatRange, formatYen, payForRange, shiftsText } from '../pay.js';
import { copyText, monthNav, notice, toast } from './common.js';
import { h, icon, weekdayClass } from './dom.js';
import { shiftChip } from './shift-parts.js';

export function renderShifts({ state, actions }) {
  const { data } = state;
  const { y, m } = parseMonthKey(state.month);
  const order = weekdayOrder(data.settings.weekStartsOn);
  const options = optionMap(data);
  const templates = new Map(data.templates.map((t) => [t.id, t]));
  const today = todayYmd();
  const sum = payForRange(data, toYmd(y, m, 1), toYmd(y, m, daysInMonth(y, m)));
  const hasWage = data.pay.wages.some((w) => w.hourly > 0);

  const head = h(
    'div',
    { class: 'cal-head' },
    order.map((wd) => h('div', { class: ['wd', weekdayClass(wd)] }, WEEKDAYS[wd])),
  );

  const body = h(
    'div',
    { class: 'cal-body' },
    monthWeeks(y, m, data.settings.weekStartsOn).map((week) =>
      h(
        'div',
        { class: 'cal-week' },
        week.map((d, i) => {
          if (d == null) return h('div', { class: 'cell empty', 'aria-hidden': 'true' });
          const ymd = toYmd(y, m, d);
          const wd = order[i];
          const shift = data.shifts[ymd];
          const wish = options.get(data.entries[ymd]);
          return h(
            'button',
            {
              class: ['cell', weekdayClass(wd), ymd === today && 'today', ymd === state.shiftDate && 'selected'],
              'aria-label': `${m}月${d}日 ${WEEKDAYS[wd]}曜日 ${shift ? formatRange(shift) : 'シフトなし'}${wish ? `（希望 ${wish.label}）` : ''}`,
              onclick: () => actions.tapShiftDay(ymd),
            },
            h('span', { class: 'num' }, d),
            shift
              ? shiftChip(shift, templates, { cell: true })
              : wish
                ? h('span', { class: 'wish-hint' }, wish.short || wish.label)
                : h('span', { class: 'chip-empty' }),
          );
        }),
      ),
    ),
  );

  const summary = h(
    'div',
    { class: 'cal-summary' },
    h('span', {}, `出勤 ${sum.workDays}日`),
    h('span', {}, `計 ${formatDuration(sum.workMinutes)}`),
    sum.nightMinutes > 0 && h('span', {}, `うち深夜 ${formatDuration(sum.nightMinutes)}`),
    hasWage
      ? h('span', { class: 'strong' }, `見込み ${formatYen(sum.total)}`)
      : h('span', { class: 'hint' }, '設定で時給を入れると、給料の見込みが出る'),
  );

  return h(
    'div',
    { class: 'view-shifts' },
    notice(state, actions),
    monthNav(state, actions),
    h('div', { class: 'cal' }, head, body),
    summary,
    h('p', { class: 'hint tool-hint' }, '日付をタップして、決まったシフトの時間を入れる。マスの点線の文字は、出した希望'),
    h(
      'div',
      { class: 'toolbar' },
      h('button', { class: 'btn', disabled: state.shiftUndo.length === 0, onclick: actions.undoShift }, icon('undo', 18), '元に戻す'),
      h(
        'button',
        {
          class: 'btn',
          onclick: async () => toast((await copyText(shiftsText(data, state.month))) ? 'シフトをコピーした' : 'コピーできなかった'),
        },
        icon('copy', 18),
        'シフトをコピー',
      ),
      h('button', { class: 'btn', onclick: () => actions.setTab('pay') }, '給料を見る'),
    ),
  );
}
