// 日付まわりの小さなユーティリティ。
// 日付は Date オブジェクトではなく "YYYY-MM-DD"（端末のローカル日付）の文字列で扱う。
// toISOString() は UTC になり、日本時間だと前日にずれるので使わない。

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const pad2 = (n) => String(n).padStart(2, '0');

export function toYmd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function toMonthKey(y, m) {
  return `${y}-${pad2(m)}`;
}

export function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

export function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { y, m };
}

export function isMonthKey(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function isYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseYmd(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

// 0 = 日曜 ... 6 = 土曜
export function weekdayOf(y, m, d) {
  return new Date(y, m - 1, d).getDay();
}

export function addMonths(key, n) {
  const { y, m } = parseMonthKey(key);
  const index = y * 12 + (m - 1) + n;
  return toMonthKey(Math.floor(index / 12), (index % 12) + 1);
}

export function todayYmd(now = new Date()) {
  return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function currentMonthKey(now = new Date()) {
  return toMonthKey(now.getFullYear(), now.getMonth() + 1);
}

// 週の並び。weekStartsOn: 0 = 日曜始まり, 1 = 月曜始まり
export function weekdayOrder(weekStartsOn) {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

// start から end まで（両端を含む）の日付の一覧
export function dayRange(start, end) {
  const days = [];
  let { y, m, d } = parseYmd(start);
  for (let ymd = start; ymd <= end; ymd = toYmd(y, m, d)) {
    days.push(ymd);
    if (++d > daysInMonth(y, m)) {
      d = 1;
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return days;
}

// カレンダー表示用。1週7マスの配列の配列で、月の外のマスは null。
export function monthWeeks(y, m, weekStartsOn) {
  const lead = (weekdayOf(y, m, 1) - weekStartsOn + 7) % 7;
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const DATE_FORMATS = ['D日(W)', 'M/D(W)', 'M月D日(W)'];

export function formatDay(y, m, d, format = DATE_FORMATS[0]) {
  const w = WEEKDAYS[weekdayOf(y, m, d)];
  if (format === 'M/D(W)') return `${m}/${d}(${w})`;
  if (format === 'M月D日(W)') return `${m}月${d}日(${w})`;
  return `${d}日(${w})`;
}
