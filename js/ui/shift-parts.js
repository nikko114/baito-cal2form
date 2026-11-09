// 確定シフトまわりで使う部品（シフトのラベル、時刻と休憩の入力）

import { textColorFor } from '../logic.js';
import { formatDuration, shortRange } from '../pay.js';
import { colorChip, h } from './dom.js';

// 勤務パターンを使っていない（時間を自分で入れた）シフトの色
const CUSTOM_COLOR = '#4a4a55';

// 実際の時間（実績）が入っていればそちらを出す
export function shiftChip(shift, templates, opts = {}) {
  const color = templates.get(shift.templateId)?.color ?? CUSTOM_COLOR;
  const text = shortRange(shift.actual ?? shift);
  if (!opts.cell || !text.includes(':')) return colorChip(text, color, opts);
  // マスの中では、分まである時間（16:02-25:31 など）は始まりと終わりの2行に分ける
  const [from, to] = text.split('-');
  return h(
    'span',
    { class: 'chip two-line', style: { background: color, color: textColorFor(color) } },
    h('span', {}, from),
    h('span', {}, to),
  );
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const withValue = (list, value) => [...new Set([...list, value])].sort((a, b) => a - b);

// 時・分の2つのセレクト。value は0時からの分、hours は選べる時の範囲 [最小, 最大]、step は分の刻み
export function timePicker({ id, label, value, hours, onchange, step = 5 }) {
  const emit = () => onchange(Number(hourSelect.value) * 60 + Number(minuteSelect.value));
  const hourSelect = h(
    'select',
    { id, 'aria-label': `${label}（時）`, value: String(Math.floor(value / 60)), onchange: emit },
    withValue(range(hours[0], hours[1]), Math.floor(value / 60)).map((hh) => h('option', { value: String(hh) }, String(hh))),
  );
  const minuteSelect = h(
    'select',
    { 'aria-label': `${label}（分）`, value: String(value % 60), onchange: emit },
    withValue(
      range(0, Math.floor(59 / step)).map((i) => i * step),
      value % 60,
    ).map((mm) => h('option', { value: String(mm) }, String(mm).padStart(2, '0'))),
  );
  return h('span', { class: 'time-picker' }, hourSelect, h('span', { 'aria-hidden': 'true' }, ':'), minuteSelect);
}

// 休憩（分）。step 分刻みで2時間まで
export function breakSelect({ id, value, onchange, step = 15 }) {
  return h(
    'select',
    { id, value: String(value), onchange: (e) => onchange(Number(e.target.value)) },
    withValue(
      range(0, Math.floor(120 / step)).map((i) => i * step),
      value,
    ).map((min) => h('option', { value: String(min) }, min ? formatDuration(min) : 'なし')),
  );
}
