// 画面に依存しない処理（一覧・集計・塗り・曜日パターン）。
// entries を書き換える関数は、元を変えずに新しいオブジェクトを返す（元に戻す機能のため）。

import { daysInMonth, formatDay, parseMonthKey, toYmd, weekdayOf } from './dates.js';

export function optionMap(data) {
  return new Map(data.options.map((o) => [o.id, o]));
}

// その月の1日ごとの行
export function monthRows(data, monthKey) {
  const { y, m } = parseMonthKey(monthKey);
  const options = optionMap(data);
  const checked = data.months[monthKey]?.checked ?? {};
  const rows = [];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const ymd = toYmd(y, m, d);
    rows.push({
      ymd,
      d,
      wd: weekdayOf(y, m, d),
      option: options.get(data.entries[ymd]) ?? null,
      checked: checked[d] === true,
    });
  }
  return rows;
}

export function monthStats(data, monthKey) {
  const rows = monthRows(data, monthKey);
  const counts = new Map(data.options.map((o) => [o.id, 0]));
  let filled = 0;
  let available = 0;
  for (const r of rows) {
    if (!r.option) continue;
    filled++;
    counts.set(r.option.id, counts.get(r.option.id) + 1);
    if (!r.option.off) available++;
  }
  return {
    total: rows.length,
    filled,
    unset: rows.length - filled,
    available, // 出勤できる日（休み扱いの選択肢以外が入っている日）
    counts: data.options.map((o) => ({ option: o, count: counts.get(o.id) })),
  };
}

// コピー用のテキスト
export function monthText(data, monthKey) {
  const { y, m } = parseMonthKey(monthKey);
  const lines = [`${y}年${m}月のシフト希望`];
  for (const r of monthRows(data, monthKey)) {
    lines.push(`${formatDay(y, m, r.d, data.settings.dateFormat)} ${r.option ? r.option.label : '（未入力）'}`);
  }
  return lines.join('\n');
}

// 1日を塗る。同じ選択肢がもう入っていたら空に戻す。optionId が null なら消す。
export function paintDay(entries, ymd, optionId) {
  const next = { ...entries };
  if (optionId == null || next[ymd] === optionId) delete next[ymd];
  else next[ymd] = optionId;
  return next;
}

// 月の中の同じ曜日をまとめて塗る。全部すでにその選択肢なら空に戻す。
export function paintWeekday(entries, monthKey, wd, optionId) {
  const { y, m } = parseMonthKey(monthKey);
  const days = [];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    if (weekdayOf(y, m, d) === wd) days.push(toYmd(y, m, d));
  }
  const clear = optionId == null || days.every((ymd) => entries[ymd] === optionId);
  const next = { ...entries };
  for (const ymd of days) {
    if (clear) delete next[ymd];
    else next[ymd] = optionId;
  }
  return next;
}

// 曜日パターンで、その月の空いている日だけを埋める
export function fillWithPattern(data, monthKey) {
  const { y, m } = parseMonthKey(monthKey);
  const valid = new Set(data.options.map((o) => o.id));
  const entries = { ...data.entries };
  let filled = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const ymd = toYmd(y, m, d);
    if (valid.has(entries[ymd])) continue;
    const id = data.pattern[weekdayOf(y, m, d)];
    if (valid.has(id)) {
      entries[ymd] = id;
      filled++;
    }
  }
  return { entries, filled };
}

export function countUsage(data, optionId) {
  return Object.values(data.entries).filter((id) => id === optionId).length;
}

// 選択肢を消す。その選択肢が入っていた日は空に、曜日パターンからも外す。
export function removeOption(data, optionId) {
  const entries = {};
  for (const [ymd, id] of Object.entries(data.entries)) {
    if (id !== optionId) entries[ymd] = id;
  }
  return {
    ...data,
    options: data.options.filter((o) => o.id !== optionId),
    entries,
    pattern: data.pattern.map((id) => (id === optionId ? null : id)),
  };
}

// 背景色に対して読みやすい文字色（白か黒）
export function textColorFor(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.3 ? '#1c1c22' : '#ffffff';
}
