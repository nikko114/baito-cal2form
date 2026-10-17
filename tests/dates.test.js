// 日本時間で日付がずれないことも確かめたいので、TZ を固定してから Date を使う
process.env.TZ = 'Asia/Tokyo';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addMonths,
  currentMonthKey,
  daysInMonth,
  formatDay,
  isMonthKey,
  isYmd,
  monthWeeks,
  todayYmd,
  toYmd,
  weekdayOf,
  weekdayOrder,
} from '../js/dates.js';

test('月の日数（うるう年を含む）', () => {
  assert.equal(daysInMonth(2026, 11), 30);
  assert.equal(daysInMonth(2026, 12), 31);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2100, 2), 28);
});

test('曜日', () => {
  assert.equal(weekdayOf(2026, 11, 1), 0); // 2026/11/1 は日曜
  assert.equal(weekdayOf(2026, 10, 17), 6); // 土曜
  assert.equal(weekdayOf(2027, 1, 1), 5); // 金曜
});

test('月の足し引き（年またぎ）', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', 14), '2027-12');
  assert.equal(addMonths('2026-03', -15), '2024-12');
});

test('日本時間の0時台でも前日にならない', () => {
  const justAfterMidnight = new Date(2026, 10, 1, 0, 30); // 11/1 0:30 JST（UTC だと 10/31）
  assert.equal(todayYmd(justAfterMidnight), '2026-11-01');
  assert.equal(currentMonthKey(justAfterMidnight), '2026-11');
});

test('日付文字列の形式チェック', () => {
  assert.equal(toYmd(2026, 1, 5), '2026-01-05');
  assert.ok(isYmd('2026-11-30'));
  assert.ok(!isYmd('2026-11-31'));
  assert.ok(!isYmd('2026-02-29'));
  assert.ok(isYmd('2028-02-29'));
  assert.ok(!isYmd('2026-1-5'));
  assert.ok(!isYmd('__proto__'));
  assert.ok(isMonthKey('2026-11'));
  assert.ok(!isMonthKey('2026-13'));
});

test('カレンダーのマス（日曜始まり）', () => {
  const weeks = monthWeeks(2026, 11, 0);
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0], [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(weeks[4], [29, 30, null, null, null, null, null]);
});

test('カレンダーのマス（月曜始まり）', () => {
  const weeks = monthWeeks(2026, 11, 1);
  assert.equal(weeks.length, 6);
  assert.deepEqual(weeks[0], [null, null, null, null, null, null, 1]);
  assert.deepEqual(weeks[5], [30, null, null, null, null, null, null]);
  assert.deepEqual(weekdayOrder(1), [1, 2, 3, 4, 5, 6, 0]);
});

test('日付の書き方', () => {
  assert.equal(formatDay(2026, 11, 1, 'D日(W)'), '1日(日)');
  assert.equal(formatDay(2026, 11, 1, 'M/D(W)'), '11/1(日)');
  assert.equal(formatDay(2026, 11, 30, 'M月D日(W)'), '11月30日(月)');
  assert.equal(formatDay(2026, 11, 2), '2日(月)');
});
