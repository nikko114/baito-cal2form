// DOM を組み立てる小さなヘルパー。
// 文字列はすべてテキストノードとして入れる（innerHTML は使わない）。

import { textColorFor } from '../logic.js';
import { WEEKDAYS } from '../dates.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (key === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (key === 'style') Object.assign(el.style, v);
    else if (key === 'dataset') Object.assign(el.dataset, v);
    else if (key === 'value') value = v;
    else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2), v);
    else if (typeof v === 'boolean') el[key] = v;
    else el.setAttribute(key, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  // select は option を入れてからでないと value が効かない
  if (value !== undefined) el.value = value;
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  open: 'M14 4h6v6M20 4l-9 9M19 14v6H4V5h6',
  plus: 'M12 5v14M5 12h14',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20l10-10',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

// 選択肢の色つきラベル
export function chip(option, { cell = false, large = false } = {}) {
  const text = (cell && option.short) || option.label;
  return h(
    'span',
    {
      class: ['chip', large && 'large', cell && text.length > 3 && 'long'],
      style: { background: option.color, color: textColorFor(option.color) },
    },
    text,
  );
}

export function weekdayClass(wd) {
  return wd === 0 ? 'sun' : wd === 6 ? 'sat' : null;
}

export function weekdayLabel(wd) {
  return WEEKDAYS[wd];
}
