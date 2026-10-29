// 確定シフトまわりで使う部品（シフトのラベル、時刻と休憩の入力）

import { BREAK_CHOICES, formatDuration, shortRange } from '../pay.js';
import { colorChip, h } from './dom.js';

// 勤務パターンを使っていない（時間を自分で入れた）シフトの色
const CUSTOM_COLOR = '#4a4a55';

export function shiftChip(shift, templates, opts) {
  const color = templates.get(shift.templateId)?.color ?? CUSTOM_COLOR;
  return colorChip(shortRange(shift), color, opts);
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const withValue = (list, value) => [...new Set([...list, value])].sort((a, b) => a - b);

// 時・分の2つのセレクト。value は0時からの分、hours は選べる時の範囲 [最小, 最大]
export function timePicker({ id, label, value, hours, onchange }) {
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
      range(0, 11).map((i) => i * 5),
      value % 60,
    ).map((mm) => h('option', { value: String(mm) }, String(mm).padStart(2, '0'))),
  );
  return h('span', { class: 'time-picker' }, hourSelect, h('span', { 'aria-hidden': 'true' }, ':'), minuteSelect);
}

export function breakSelect({ id, value, onchange }) {
  return h(
    'select',
    { id, value: String(value), onchange: (e) => onchange(Number(e.target.value)) },
    withValue(BREAK_CHOICES, value).map((min) => h('option', { value: String(min) }, min ? formatDuration(min) : 'なし')),
  );
}
