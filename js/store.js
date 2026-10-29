// データの形・初期値・保存と読み込み。
// localStorage にキー1つで JSON をまとめて保存する。

import { DATE_FORMATS, isMonthKey, isYmd } from './dates.js';
import { isValidTimes } from './pay.js';

export const STORAGE_KEY = 'baito-cal2form';

export const PALETTE = [
  '#2e9d5b',
  '#8a8f98',
  '#e8833a',
  '#1f9e9a',
  '#5b5bd6',
  '#c79a1e',
  '#2f7de1',
  '#3aa6d8',
  '#8e5bd6',
  '#d6577e',
  '#9a6b4f',
  '#4a4a55',
];

// 初期の選択肢（シフト提出フォームのプルダウンに合わせたもの。設定画面で変えられる）
const DEFAULT_OPTIONS = [
  { label: '○', note: '早・中・遅どれでもOK', color: '#2e9d5b' },
  { label: '×', note: '休み希望（出勤不可）', color: '#8a8f98', off: true },
  { label: '早', note: '早番 8-17', color: '#e8833a' },
  { label: '中', note: '中番', color: '#1f9e9a' },
  { label: '遅', note: '遅番 16-25', color: '#5b5bd6' },
  { label: '9-', note: '9時から（〜17）', color: '#c79a1e' },
  { label: '17-', note: '17時から（〜25）', color: '#2f7de1' },
  { label: '17:30-', note: '17:30から（〜25）', color: '#3aa6d8' },
  { label: '18-', note: '18時から（〜25）', color: '#8e5bd6' },
];

// 確定シフトを入れるときの勤務パターン（休憩は仮。設定画面で変えられる）
const DEFAULT_TEMPLATES = [
  { name: '早番', start: 8 * 60, end: 17 * 60, breakMin: 60, color: '#e8833a' },
  { name: '遅番', start: 16 * 60, end: 25 * 60, breakMin: 60, color: '#5b5bd6' },
  { name: '9時から', start: 9 * 60, end: 17 * 60, breakMin: 45, color: '#c79a1e' },
  { name: '17時から', start: 17 * 60, end: 25 * 60, breakMin: 45, color: '#2f7de1' },
  { name: '17:30から', start: 17 * 60 + 30, end: 25 * 60, breakMin: 45, color: '#3aa6d8' },
  { name: '18時から', start: 18 * 60, end: 25 * 60, breakMin: 45, color: '#8e5bd6' },
];

export function newId() {
  return 'o' + Math.random().toString(36).slice(2, 10);
}

export function emptyMonth() {
  return { checked: {}, memo: '', editUrl: '' };
}

export function defaultPay() {
  return {
    wages: [{ from: '', hourly: 0 }], // 時給。from はその日から（空 = 最初から）
    transportPerDay: 0, // 交通費（出勤1日あたり）
    nightPremium: true, // 深夜（22時〜翌5時）は 25%増し
    overtimePremium: true, // 1日8時間を超えた分は 25%増し
    closingDay: 0, // 締め日（0 = 月末）
    payMonthOffset: 1, // 給料日: 0 = 当月, 1 = 翌月, 2 = 翌々月
    payDay: 25, // 給料日の日（0 = 月末）
  };
}

export function defaultData() {
  return {
    version: 2,
    options: DEFAULT_OPTIONS.map((o) => ({ id: newId(), short: '', off: false, ...o })),
    entries: {}, // "2026-11-01" -> 選択肢の id
    pattern: [null, null, null, null, null, null, null], // 曜日パターン（0 = 日曜）
    months: {}, // "2026-11" -> { checked, memo, editUrl }
    templates: DEFAULT_TEMPLATES.map((t) => ({ id: newId(), ...t })),
    shifts: {}, // "2026-11-02" -> { start, end, breakMin, templateId }（時刻は0時からの分）
    pay: defaultPay(),
    settings: { weekStartsOn: 0, dateFormat: DATE_FORMATS[0], hideInstallTip: false },
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
const times = (v) => {
  const t = { start: v.start, end: v.end, breakMin: v.breakMin };
  return isValidTimes(t) ? t : null;
};

function normalizeTemplates(list) {
  const ids = new Set();
  const templates = [];
  for (const t of list) {
    if (!isObject(t) || !times(t)) continue;
    let id = typeof t.id === 'string' && t.id ? t.id : newId();
    while (ids.has(id)) id = newId();
    ids.add(id);
    templates.push({
      id,
      name: str(t.name, 20),
      ...times(t),
      color: isHexColor(t.color) ? t.color.toLowerCase() : PALETTE[templates.length % PALETTE.length],
    });
  }
  return templates;
}

function normalizePay(raw) {
  const p = isObject(raw) ? raw : {};
  const byDate = new Map(); // 同じ日付が重なったら後のほうを使う
  for (const w of Array.isArray(p.wages) ? p.wages : []) {
    if (!isObject(w)) continue;
    const hourly = int(w.hourly, 0, 100000);
    const from = w.from === '' || w.from == null ? '' : isYmd(w.from) ? w.from : null;
    if (hourly !== null && from !== null) byDate.set(from, hourly);
  }
  if (!byDate.has('')) byDate.set('', 0);
  const wages = [...byDate].map(([from, hourly]) => ({ from, hourly })).sort((a, b) => (a.from < b.from ? -1 : 1));
  const d = defaultPay();
  return {
    wages,
    transportPerDay: int(p.transportPerDay, 0, 100000) ?? d.transportPerDay,
    nightPremium: p.nightPremium !== false,
    overtimePremium: p.overtimePremium !== false,
    closingDay: int(p.closingDay, 0, 27) ?? d.closingDay,
    payMonthOffset: int(p.payMonthOffset, 0, 2) ?? d.payMonthOffset,
    payDay: int(p.payDay, 0, 31) ?? d.payDay,
  };
}

// 保存データやバックアップを、アプリが扱える形にそろえる。おかしな値は捨てる。
export function normalize(raw) {
  if (!isObject(raw) || !Array.isArray(raw.options)) {
    throw new Error('このアプリのデータではないみたい');
  }

  const ids = new Set();
  const options = [];
  for (const o of raw.options) {
    if (!isObject(o)) continue;
    const label = str(o.label, 40);
    if (!label) continue;
    let id = typeof o.id === 'string' && o.id ? o.id : newId();
    while (ids.has(id)) id = newId();
    ids.add(id);
    options.push({
      id,
      label,
      short: str(o.short, 8),
      note: str(o.note, 60),
      color: isHexColor(o.color) ? o.color.toLowerCase() : PALETTE[options.length % PALETTE.length],
      off: o.off === true,
    });
  }

  const entries = {};
  if (isObject(raw.entries)) {
    for (const [ymd, id] of Object.entries(raw.entries)) {
      if (isYmd(ymd) && ids.has(id)) entries[ymd] = id;
    }
  }

  const pattern = Array.from({ length: 7 }, (_, i) => {
    const id = Array.isArray(raw.pattern) ? raw.pattern[i] : null;
    return ids.has(id) ? id : null;
  });

  const months = {};
  if (isObject(raw.months)) {
    for (const [key, v] of Object.entries(raw.months)) {
      if (!isMonthKey(key) || !isObject(v)) continue;
      const checked = {};
      if (isObject(v.checked)) {
        for (const [d, on] of Object.entries(v.checked)) {
          if (on === true && /^([1-9]|[12]\d|3[01])$/.test(d)) checked[d] = true;
        }
      }
      months[key] = {
        checked,
        memo: typeof v.memo === 'string' ? v.memo.slice(0, 2000) : '',
        editUrl: str(v.editUrl, 2000),
      };
    }
  }

  // version 1 のデータには勤務パターンがないので、初期の勤務パターンを入れる
  const templates = normalizeTemplates(
    Array.isArray(raw.templates) ? raw.templates : DEFAULT_TEMPLATES.map((t) => ({ id: newId(), ...t })),
  );
  const templateIds = new Set(templates.map((t) => t.id));

  const shifts = {};
  if (isObject(raw.shifts)) {
    for (const [ymd, s] of Object.entries(raw.shifts)) {
      if (!isYmd(ymd) || !isObject(s) || !times(s)) continue;
      shifts[ymd] = { ...times(s), templateId: templateIds.has(s.templateId) ? s.templateId : null };
    }
  }

  const s = isObject(raw.settings) ? raw.settings : {};
  const settings = {
    weekStartsOn: s.weekStartsOn === 1 ? 1 : 0,
    dateFormat: DATE_FORMATS.includes(s.dateFormat) ? s.dateFormat : DATE_FORMATS[0],
    hideInstallTip: s.hideInstallTip === true,
  };

  return { version: 2, options, entries, pattern, months, templates, shifts, pay: normalizePay(raw.pay), settings };
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// 戻り値: { data, error, fresh }。error は画面に出す説明文（問題なければ null）
export function load(storage = defaultStorage()) {
  if (!storage) {
    return { data: defaultData(), error: 'このブラウザの設定では保存できないみたい。閉じると入力が消える', fresh: false };
  }
  let text;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: defaultData(), error: '保存データを読めなかった。閉じると入力が消えるかも', fresh: false };
  }
  if (text == null) return { data: defaultData(), error: null, fresh: true };
  try {
    const raw = JSON.parse(text);
    // migrated: 古い形式から読み替えたので、保存し直したほうがよい
    return { data: normalize(raw), error: null, fresh: false, migrated: raw?.version !== 2 };
  } catch {
    try {
      storage.setItem(`${STORAGE_KEY}:broken`, text);
    } catch {
      // 退避できなくても初期状態で起動はする
    }
    return { data: defaultData(), error: '保存データが壊れていたので最初の状態で開いた', fresh: false };
  }
}

export function save(data, storage = defaultStorage()) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function exportJson(data, now = new Date()) {
  return JSON.stringify({ app: 'baito-cal2form', exportedAt: now.toISOString(), ...data }, null, 2);
}

export function importJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読めなかった。コピーした文字が途中で切れていないか確認してね');
  }
  if (isObject(raw) && raw.app !== undefined && raw.app !== 'baito-cal2form') {
    throw new Error('このアプリのバックアップではないみたい');
  }
  return normalize(raw);
}
