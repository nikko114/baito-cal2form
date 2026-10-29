// 画面をまたいで使う部品（月の切り替え、お知らせ、トースト、ダイアログ、コピー）

import { currentMonthKey, addMonths, parseMonthKey } from '../dates.js';
import { h, icon } from './dom.js';

// suffix: 給料画面では「11月分」のように後ろにつける
export function monthNav(state, actions, { suffix = '' } = {}) {
  const { y, m } = parseMonthKey(state.month);
  const now = currentMonthKey();
  const relative =
    state.month === now ? '今月' : state.month === addMonths(now, 1) ? '来月' : state.month === addMonths(now, -1) ? '先月' : '';
  return h(
    'div',
    { class: 'month-nav' },
    h('button', { class: 'icon-btn', 'aria-label': '前の月', onclick: () => actions.moveMonth(-1) }, icon('left', 22)),
    h('h1', {}, `${y}年${m}月${suffix}`, relative && h('span', { class: 'relative' }, relative)),
    h('button', { class: 'icon-btn', 'aria-label': '次の月', onclick: () => actions.moveMonth(1) }, icon('right', 22)),
  );
}

// 保存まわりの問題など、画面上部に出すお知らせ
export function notice(state, actions) {
  if (!state.notice) return null;
  return h(
    'div',
    { class: 'banner warn-banner', role: 'alert' },
    h('div', { class: 'grow' }, state.notice),
    h('button', { class: 'icon-btn small', 'aria-label': 'お知らせを閉じる', onclick: actions.dismissNotice }, icon('close', 18)),
  );
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// <dialog> を使ったモーダル。build(close) が中身を返す。
export function openDialog(title, build) {
  const dialog = h('dialog', { class: 'dialog' });
  const close = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove());
  // 背景をタップしたら閉じる
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  // 最初に見出しへフォーカスさせて、いきなりキーボードが出ないようにする
  dialog.append(h('h2', { class: 'dialog-title', tabindex: '-1', autofocus: true }, title), build(close));
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 古いブラウザ向けの予備の方法
    const area = h('textarea', { readonly: 'readonly', style: { position: 'fixed', top: '0', opacity: '0' } });
    area.value = text;
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function downloadText(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
