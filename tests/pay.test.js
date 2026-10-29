process.env.TZ = 'Asia/Tokyo';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatDuration,
  formatRange,
  formatYen,
  isValidTimes,
  paydayOf,
  payPeriod,
  periodPay,
  shiftMinutes,
  shiftsText,
  shortRange,
  wageOn,
  yearPay,
} from '../js/pay.js';
import { defaultPay } from '../js/store.js';

const t = (h, m = 0) => h * 60 + m;
const shift = (start, end, breakMin) => ({ start, end, breakMin, templateId: null });

function sample(pay = {}) {
  return {
    shifts: {
      '2026-11-02': shift(t(16), t(25), 60), // 遅番
      '2026-11-04': shift(t(8), t(17), 60), // 早番
      '2026-11-05': shift(t(18), t(25), 45),
      '2026-12-01': shift(t(9), t(17), 45),
    },
    pay: { ...defaultPay(), wages: [{ from: '', hourly: 1100 }], transportPerDay: 400, ...pay },
    settings: { dateFormat: 'D日(W)' },
  };
}

test('時刻と金額の書き方', () => {
  assert.equal(formatRange(shift(t(8), t(17), 60)), '8:00〜17:00');
  assert.equal(formatRange(shift(t(17, 30), t(25), 45)), '17:30〜25:00');
  assert.equal(shortRange(shift(t(8), t(17), 60)), '8-17');
  assert.equal(shortRange(shift(t(17, 30), t(25), 45)), '17:30-25');
  assert.equal(formatDuration(480), '8時間');
  assert.equal(formatDuration(375), '6時間15分');
  assert.equal(formatDuration(45), '45分');
  assert.equal(formatYen(27325), '27,325円');
  assert.equal(formatYen(1650.4), '1,650円');
});

test('時刻の組み合わせのチェック', () => {
  assert.ok(isValidTimes(shift(t(16), t(25), 60)));
  assert.ok(!isValidTimes(shift(t(17), t(8), 0))); // 終わりが先
  assert.ok(!isValidTimes(shift(t(8), t(9), 60))); // 休憩が勤務と同じ長さ
  assert.ok(!isValidTimes(shift(t(24), t(26), 0))); // 始まりが24時以降
  assert.ok(!isValidTimes(shift(t(8), t(33), 0))); // 24時間を超える
});

test('早番 8-17（休憩1時間）は8時間・深夜なし', () => {
  assert.deepEqual(shiftMinutes(shift(t(8), t(17), 60)), { work: 480, night: 0, overtime: 0 });
});

test('遅番 16-25（休憩1時間）は8時間のうち3時間が深夜', () => {
  assert.deepEqual(shiftMinutes(shift(t(16), t(25), 60)), { work: 480, night: 180, overtime: 0 });
});

test('休憩が深夜以外の時間に収まらないときは、はみ出た分を深夜から引く', () => {
  // 21:30-25:00 は深夜以外が30分だけ。休憩60分のうち30分は深夜から引く
  assert.deepEqual(shiftMinutes(shift(t(21, 30), t(25), 60)), { work: 150, night: 150, overtime: 0 });
});

test('早朝（5時まで）も深夜として数える', () => {
  assert.deepEqual(shiftMinutes(shift(t(4), t(9), 0)), { work: 300, night: 60, overtime: 0 });
});

test('1日8時間を超えた分は残業', () => {
  assert.deepEqual(shiftMinutes(shift(t(8), t(19), 60)), { work: 600, night: 0, overtime: 120 });
  // 深夜と残業が重なってもそれぞれ数える
  assert.deepEqual(shiftMinutes(shift(t(14), t(25), 60)), { work: 600, night: 180, overtime: 120 });
});

test('割増をオフにすると深夜・残業は0', () => {
  assert.deepEqual(shiftMinutes(shift(t(14), t(25), 60), { night: false, overtime: false }), { work: 600, night: 0, overtime: 0 });
});

test('時給の変更は、その日から反映する', () => {
  const pay = {
    wages: [
      { from: '', hourly: 1050 },
      { from: '2026-12-01', hourly: 1100 },
    ],
  };
  assert.equal(wageOn(pay, '2026-11-30'), 1050);
  assert.equal(wageOn(pay, '2026-12-01'), 1100);
  assert.equal(wageOn(pay, '2027-03-01'), 1100);
});

test('締め日ごとの対象期間', () => {
  assert.deepEqual(payPeriod('2026-11', 0), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(payPeriod('2026-11', 15), { start: '2026-10-16', end: '2026-11-15' });
  assert.deepEqual(payPeriod('2027-01', 20), { start: '2026-12-21', end: '2027-01-20' });
  assert.deepEqual(payPeriod('2027-03', 27), { start: '2027-02-28', end: '2027-03-27' });
});

test('給料日', () => {
  assert.equal(paydayOf('2026-11', { payMonthOffset: 1, payDay: 25 }), '2026-12-25');
  assert.equal(paydayOf('2026-12', { payMonthOffset: 1, payDay: 25 }), '2027-01-25');
  assert.equal(paydayOf('2026-11', { payMonthOffset: 0, payDay: 0 }), '2026-11-30');
  assert.equal(paydayOf('2027-01', { payMonthOffset: 1, payDay: 31 }), '2027-02-28');
});

test('月の給料: 基本給 + 深夜手当 + 交通費', () => {
  const p = periodPay(sample(), '2026-11');
  assert.equal(p.workDays, 3);
  assert.equal(p.workMinutes, 480 + 480 + 375);
  assert.equal(p.nightMinutes, 180 + 180);
  assert.equal(p.base, 24475); // 1100円 × 22時間15分
  assert.equal(p.night, 1650); // 1100円 × 25% × 6時間
  assert.equal(p.overtime, 0);
  assert.equal(p.transport, 1200); // 400円 × 3日
  assert.equal(p.total, 27325);
  assert.equal(p.payday, '2026-12-25');
  assert.deepEqual(
    p.days.map((d) => d.ymd),
    ['2026-11-02', '2026-11-04', '2026-11-05'],
  );
});

test('15日締めだと前の月の16日からを数える', () => {
  const p = periodPay(sample({ closingDay: 15 }), '2026-12');
  assert.deepEqual(p.period, { start: '2026-11-16', end: '2026-12-15' });
  assert.equal(p.workDays, 1); // 12/1 だけ
});

test('途中で時給が変わると、時給ごとに分けて計算する', () => {
  const data = sample({
    wages: [
      { from: '', hourly: 1000 },
      { from: '2026-11-04', hourly: 1100 },
    ],
  });
  const p = periodPay(data, '2026-11');
  assert.deepEqual(p.wages, [
    { hourly: 1000, minutes: 480, amount: 8000 },
    { hourly: 1100, minutes: 855, amount: 15675 },
  ]);
  assert.equal(p.base, 23675);
  assert.equal(p.night, 1575); // 1000 × 25% × 3時間 + 1100 × 25% × 3時間
});

test('時給が未設定なら0円（交通費だけ）', () => {
  const p = periodPay(sample({ wages: [{ from: '', hourly: 0 }] }), '2026-11');
  assert.equal(p.total, 1200);
});

test('年の合計は給料日がその年に入る分だけ', () => {
  const data = sample();
  // 12月分は翌年1月25日払いなので 2026年には入らない
  const y2026 = yearPay(data, 2026);
  assert.deepEqual(
    y2026.months.map((p) => p.monthKey),
    ['2026-11'],
  );
  assert.equal(y2026.total, 27325);
  const y2027 = yearPay(data, 2027);
  assert.deepEqual(
    y2027.months.map((p) => p.monthKey),
    ['2026-12'],
  );
});

test('シフトのコピー用テキスト', () => {
  assert.equal(shiftsText(sample(), '2026-11'), '2026年11月のシフト\n2日(月) 16:00〜25:00\n4日(水) 8:00〜17:00\n5日(木) 18:00〜25:00');
  assert.equal(shiftsText(sample(), '2027-02'), '2027年2月のシフト\n（まだない）');
});
