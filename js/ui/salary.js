// 給料の画面（確定シフトから出した見込み）

import { formatDay, parseMonthKey, parseYmd, weekdayOf } from '../dates.js';
import { formatDuration, formatRange, formatYen, periodPay, yearPay } from '../pay.js';
import { monthNav, notice } from './common.js';
import { h, weekdayClass } from './dom.js';

const monthDay = (ymd) => {
  const { m, d } = parseYmd(ymd);
  return `${m}/${d}`;
};

function row(label, amount, { total = false } = {}) {
  return h('div', { class: ['pay-row', total && 'total'] }, h('span', {}, label), h('span', { class: 'amount' }, amount));
}

export function renderSalary({ state, actions }) {
  const { data } = state;
  const p = periodPay(data, state.month);
  const hasWage = data.pay.wages.some((w) => w.hourly > 0);
  const year = Number(p.payday.slice(0, 4));
  const yp = yearPay(data, year);

  const total = h(
    'section',
    { class: 'card pay-total' },
    h('p', { class: 'hint' }, '見込み（税金などが引かれる前）'),
    h('p', { class: 'amount' }, formatYen(p.total)),
    h('p', { class: 'hint' }, `${monthDay(p.period.start)}〜${monthDay(p.period.end)} の勤務 ・ ${monthDay(p.payday)} 支払い`),
    !hasWage &&
      h(
        'div',
        { class: 'banner inline-banner' },
        h('div', { class: 'grow' }, '時給がまだ入っていない'),
        h('button', { class: 'btn small', onclick: () => actions.setTab('settings') }, '設定で入れる'),
      ),
  );

  if (p.workDays === 0) {
    return h(
      'div',
      { class: 'view-salary' },
      notice(state, actions),
      monthNav(state, actions, { suffix: '分' }),
      total,
      h(
        'section',
        { class: 'card' },
        h('p', {}, 'この期間の確定シフトはまだない'),
        h(
          'div',
          { class: 'toolbar' },
          h('button', { class: 'btn primary', onclick: () => actions.setTab('shifts') }, '確定シフトを入れる'),
        ),
      ),
      yearCard(yp),
      note(),
    );
  }

  const breakdown = h(
    'section',
    { class: 'card' },
    h('h2', {}, '内訳'),
    h(
      'div',
      { class: 'pay-rows' },
      p.wages.map((w) => row(`基本給（${formatYen(w.hourly)} × ${formatDuration(w.minutes)}）`, formatYen(w.amount))),
      p.nightMinutes > 0 && row(`深夜手当（25%増し・${formatDuration(p.nightMinutes)}）`, formatYen(p.night)),
      p.overtimeMinutes > 0 && row(`残業手当（25%増し・${formatDuration(p.overtimeMinutes)}）`, formatYen(p.overtime)),
      data.pay.transportPerDay > 0 && row(`交通費（${formatYen(data.pay.transportPerDay)} × ${p.workDays}日）`, formatYen(p.transport)),
      row('合計', formatYen(p.total), { total: true }),
    ),
    h('p', { class: 'hint' }, `出勤 ${p.workDays}日 ・ 合計 ${formatDuration(p.workMinutes)}`),
  );

  const days = h(
    'section',
    { class: 'card' },
    h('h2', {}, '日ごと'),
    h(
      'div',
      { class: 'pay-days' },
      p.days.map((day) => {
        const { y, m, d } = parseYmd(day.ymd);
        return h(
          'div',
          { class: 'pay-day' },
          h('span', { class: ['date', weekdayClass(weekdayOf(y, m, d))] }, formatDay(y, m, d, 'M/D(W)')),
          h('span', {}, formatRange(day.shift)),
          h('span', { class: 'amount' }, formatYen(day.amount)),
          h(
            'span',
            { class: 'mins' },
            h('span', {}, formatDuration(day.work)),
            day.night > 0 && h('span', {}, `深夜 ${formatDuration(day.night)}`),
            h('span', {}, `休憩 ${day.shift.breakMin ? formatDuration(day.shift.breakMin) : 'なし'}`),
          ),
        );
      }),
    ),
  );

  return h(
    'div',
    { class: 'view-salary' },
    notice(state, actions),
    monthNav(state, actions, { suffix: '分' }),
    total,
    breakdown,
    days,
    yearCard(yp),
    note(),
  );
}

function yearCard(yp) {
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, `${yp.year}年に支払われる分`),
    yp.months.length
      ? h(
          'div',
          { class: 'pay-rows' },
          yp.months.map((p) => row(`${parseMonthKey(p.monthKey).m}月分（${monthDay(p.payday)} 支払い）`, formatYen(p.total))),
          row('合計', formatYen(yp.total), { total: true }),
        )
      : h('p', { class: 'hint' }, 'まだない'),
    h('p', { class: 'hint' }, '給料日がこの年に入る分の合計（確定シフトから出した見込み）。扶養の範囲などを考えるときの目安に'),
  );
}

function note() {
  return h(
    'p',
    { class: 'hint pay-note' },
    '深夜（22時〜翌5時）と、1日8時間を超えた分は25%増しで計算（設定で変えられる）。休憩は深夜以外の時間から取ったものとして計算。' +
      '給与明細と合わないときは、設定の時給・交通費・締め日と、勤務パターンの休憩を見直してね',
  );
}
