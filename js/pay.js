// 確定シフトと給料の計算（画面に依存しない処理）。
// 時刻はその日の0時からの分で持つ。25:00（翌1時）は 1500。

import { addMonths, dayRange, daysInMonth, formatDay, parseMonthKey, toYmd } from './dates.js';

export const NIGHT_PREMIUM = 0.25; // 深夜（22時〜翌5時）の割増
export const OVERTIME_PREMIUM = 0.25; // 1日8時間を超えた分の割増
const OVERTIME_AFTER = 8 * 60;
// 深夜の時間帯。シフトは翌日の終わりまでしか続かないので、この3つで足りる
const NIGHT_WINDOWS = [
  [0, 5 * 60],
  [22 * 60, 29 * 60],
  [46 * 60, 48 * 60],
];

// 時刻の入力で選べる範囲
export const START_HOURS = [0, 23];
export const END_HOURS = [1, 30];
export const BREAK_CHOICES = [0, 15, 30, 45, 60, 75, 90, 105, 120];

// 8:00 / 25:00
export function formatTime(min) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

// カレンダーのマス用の短い書き方: 8-17 / 17:30-25
export function shortRange(shift) {
  const t = (min) => (min % 60 ? formatTime(min) : String(min / 60));
  return `${t(shift.start)}-${t(shift.end)}`;
}

export function formatRange(shift) {
  return `${formatTime(shift.start)}〜${formatTime(shift.end)}`;
}

export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!m) return `${h}時間`;
  return h ? `${h}時間${m}分` : `${m}分`;
}

export function formatYen(amount) {
  return `${Math.round(amount).toLocaleString('ja-JP')}円`;
}

// 始まり・終わり・休憩の組み合わせとして正しいか
export function isValidTimes({ start, end, breakMin }) {
  return (
    [start, end, breakMin].every(Number.isInteger) &&
    start >= 0 &&
    start < 24 * 60 &&
    end > start &&
    end - start <= 24 * 60 &&
    breakMin >= 0 &&
    breakMin < end - start
  );
}

// 1日分の時間（分）。休憩は深夜以外の時間から先に取ったものとして扱う。
export function shiftMinutes(shift, rules = { night: true, overtime: true }) {
  const span = shift.end - shift.start;
  const work = Math.max(0, span - shift.breakMin);
  let nightSpan = 0;
  for (const [a, b] of NIGHT_WINDOWS) {
    nightSpan += Math.max(0, Math.min(b, shift.end) - Math.max(a, shift.start));
  }
  const breakInNight = Math.max(0, shift.breakMin - (span - nightSpan));
  const night = Math.max(0, nightSpan - breakInNight);
  const overtime = Math.max(0, work - OVERTIME_AFTER);
  return { work, night: rules.night ? night : 0, overtime: rules.overtime ? overtime : 0 };
}

// その日の時給。wages は from（その日から）の昇順で、先頭は「最初から」（from が空）
export function wageOn(pay, ymd) {
  let hourly = 0;
  for (const w of pay.wages) {
    if (!w.from || w.from <= ymd) hourly = w.hourly;
  }
  return hourly;
}

// 「◯月分」の対象期間。closingDay: 0 = 月末締め、1〜27 = その日締め
export function payPeriod(monthKey, closingDay) {
  const { y, m } = parseMonthKey(monthKey);
  if (!closingDay) return { start: toYmd(y, m, 1), end: toYmd(y, m, daysInMonth(y, m)) };
  const prev = parseMonthKey(addMonths(monthKey, -1));
  return { start: toYmd(prev.y, prev.m, closingDay + 1), end: toYmd(y, m, closingDay) };
}

// 「◯月分」の給料日。payDay: 0 = 月末
export function paydayOf(monthKey, pay) {
  const { y, m } = parseMonthKey(addMonths(monthKey, pay.payMonthOffset));
  const last = daysInMonth(y, m);
  return toYmd(y, m, pay.payDay ? Math.min(pay.payDay, last) : last);
}

// 1日分の時給・時間・金額（金額は端数を丸める前）
export function dayPay(pay, ymd, shift) {
  const minutes = shiftMinutes(shift, { night: pay.nightPremium, overtime: pay.overtimePremium });
  const hourly = wageOn(pay, ymd);
  const amount = (hourly * (minutes.work + NIGHT_PREMIUM * minutes.night + OVERTIME_PREMIUM * minutes.overtime)) / 60;
  return { hourly, ...minutes, amount };
}

// start〜end の確定シフトから給料を計算する。
// 時給ごとの基本給・深夜手当・残業手当はそれぞれ円未満を四捨五入する。
export function payForRange(data, start, end) {
  const { pay } = data;
  const days = [];
  const byWage = new Map(); // 時給 -> 勤務時間（分）
  let night = 0;
  let overtime = 0;
  for (const ymd of dayRange(start, end)) {
    const shift = data.shifts[ymd];
    if (!shift) continue;
    const day = dayPay(pay, ymd, shift);
    days.push({ ymd, shift, ...day });
    byWage.set(day.hourly, (byWage.get(day.hourly) ?? 0) + day.work);
    night += (day.hourly * NIGHT_PREMIUM * day.night) / 60;
    overtime += (day.hourly * OVERTIME_PREMIUM * day.overtime) / 60;
  }
  const wages = [...byWage].map(([hourly, minutes]) => ({ hourly, minutes, amount: Math.round((hourly * minutes) / 60) }));
  const parts = {
    base: wages.reduce((sum, w) => sum + w.amount, 0),
    night: Math.round(night),
    overtime: Math.round(overtime),
    transport: days.length * pay.transportPerDay,
  };
  const sum = (key) => days.reduce((total, d) => total + d[key], 0);
  return {
    days,
    wages,
    workDays: days.length,
    workMinutes: sum('work'),
    nightMinutes: sum('night'),
    overtimeMinutes: sum('overtime'),
    ...parts,
    total: parts.base + parts.night + parts.overtime + parts.transport,
  };
}

// 「◯月分」の給料（締め日・給料日の設定に従う）
export function periodPay(data, monthKey) {
  const period = payPeriod(monthKey, data.pay.closingDay);
  return { monthKey, period, payday: paydayOf(monthKey, data.pay), ...payForRange(data, period.start, period.end) };
}

// その年に支払われる分（給料日がその年に入る月の分）
export function yearPay(data, year) {
  const months = [];
  // 給料日は最大で2か月後なので、前の年の11月分から見ればよい
  for (let key = `${year - 1}-11`; key <= `${year}-12`; key = addMonths(key, 1)) {
    const p = periodPay(data, key);
    if (p.payday.startsWith(`${year}-`) && p.workDays > 0) months.push(p);
  }
  return { year, months, total: months.reduce((sum, p) => sum + p.total, 0) };
}

// コピー用のシフト一覧
export function shiftsText(data, monthKey) {
  const { y, m } = parseMonthKey(monthKey);
  const lines = [`${y}年${m}月のシフト`];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const shift = data.shifts[toYmd(y, m, d)];
    if (shift) lines.push(`${formatDay(y, m, d, data.settings.dateFormat)} ${formatRange(shift)}`);
  }
  if (lines.length === 1) lines.push('（まだない）');
  return lines.join('\n');
}
