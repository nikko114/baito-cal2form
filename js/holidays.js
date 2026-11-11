// 日本の祝日。今の祝日法のルール（2020年以降）で計算する。
// 春分・秋分は国立天文台が前の年の2月に発表する日付と同じになる計算式（2099年まで）を使う。

import { addDays, toYmd, weekdayOf } from './dates.js';

const FIXED = [
  [1, 1, '元日'],
  [2, 11, '建国記念の日'],
  [2, 23, '天皇誕生日'],
  [4, 29, '昭和の日'],
  [5, 3, '憲法記念日'],
  [5, 4, 'みどりの日'],
  [5, 5, 'こどもの日'],
  [8, 11, '山の日'],
  [11, 3, '文化の日'],
  [11, 23, '勤労感謝の日'],
];

// [月, 第何月曜, 名前]
const HAPPY_MONDAYS = [
  [1, 2, '成人の日'],
  [7, 3, '海の日'],
  [9, 3, '敬老の日'],
  [10, 2, 'スポーツの日'],
];

function nthMonday(y, m, n) {
  return 1 + ((8 - weekdayOf(y, m, 1)) % 7) + (n - 1) * 7;
}

const sinceBase = (y) => 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4);
const vernalEquinoxDay = (y) => Math.floor(20.8431 + sinceBase(y));
const autumnalEquinoxDay = (y) => Math.floor(23.2488 + sinceBase(y));

const cache = new Map();

// その年の祝日（振替休日・国民の休日を含む）。"2026-11-03" -> "文化の日"
export function holidaysOf(y) {
  if (cache.has(y)) return cache.get(y);
  const holidays = new Map();
  for (const [m, d, name] of FIXED) holidays.set(toYmd(y, m, d), name);
  for (const [m, n, name] of HAPPY_MONDAYS) holidays.set(toYmd(y, m, nthMonday(y, m, n)), name);
  holidays.set(toYmd(y, 3, vernalEquinoxDay(y)), '春分の日');
  holidays.set(toYmd(y, 9, autumnalEquinoxDay(y)), '秋分の日');

  const national = new Set(holidays.keys()); // 「国民の祝日」そのもの
  // 国民の休日: 前の日と次の日が祝日にはさまれた日
  for (const ymd of national) {
    const next = addDays(ymd, 1);
    if (!national.has(next) && national.has(addDays(ymd, 2))) holidays.set(next, '国民の休日');
  }
  // 振替休日: 祝日が日曜なら、そのあとのいちばん近い「祝日でない日」
  for (const ymd of national) {
    const [yy, mm, dd] = ymd.split('-').map(Number);
    if (weekdayOf(yy, mm, dd) !== 0) continue;
    let day = addDays(ymd, 1);
    while (national.has(day)) day = addDays(day, 1);
    holidays.set(day, '振替休日');
  }

  const sorted = new Map([...holidays].sort(([a], [b]) => (a < b ? -1 : 1)));
  cache.set(y, sorted);
  return sorted;
}

// 祝日ならその名前、ちがえば null
export function holidayName(ymd) {
  return holidaysOf(Number(ymd.slice(0, 4))).get(ymd) ?? null;
}
