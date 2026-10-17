// 一覧画面（フォームに書き写すための1日1行のリスト）

import { DATE_FORMATS, formatDay, parseMonthKey } from '../dates.js';
import { monthRows, monthStats, monthText } from '../logic.js';
import { copyText, monthNav, notice, toast } from './common.js';
import { chip, h, icon, weekdayClass } from './dom.js';

export function renderList({ state, actions }) {
  const { data } = state;
  const { y, m } = parseMonthKey(state.month);
  const rows = monthRows(data, state.month);
  const stats = monthStats(data, state.month);
  const month = data.months[state.month];
  const format = data.settings.dateFormat;
  const checkedCount = rows.filter((r) => r.checked).length;
  const firstUnset = rows.find((r) => !r.option);
  const hasPattern = data.pattern.some(Boolean);

  const summary = h(
    'section',
    { class: 'card' },
    stats.unset > 0
      ? h('div', { class: 'summary-main warn' }, `未入力が ${stats.unset}日 ある`)
      : h('div', { class: 'summary-main ok' }, icon('check', 18), '全部の日が入力済み'),
    h('div', { class: 'summary-sub' }, `出勤できる日 ${stats.available}日 / ${stats.total}日`),
    h(
      'div',
      { class: 'counts' },
      stats.counts.filter((c) => c.count > 0).map((c) => h('span', { class: 'count' }, chip(c.option), `${c.count}日`)),
    ),
    firstUnset &&
      h(
        'div',
        { class: 'toolbar' },
        h('button', { class: 'btn primary', onclick: () => actions.jumpToDay(firstUnset.ymd) }, `${firstUnset.d}日から入れる`),
        hasPattern && h('button', { class: 'btn', onclick: actions.fillPattern }, icon('wand', 18), '曜日パターンで埋める'),
      ),
  );

  const missing = 31 - stats.total;
  const list = h(
    'section',
    { class: 'rows-wrap' },
    h(
      'div',
      { class: 'rows-head' },
      h('span', {}, 'フォームに入れたら、行をタップして ✓'),
      h('span', { class: 'progress' }, `${checkedCount}/${stats.total}`),
    ),
    h(
      'div',
      { class: ['rows', `fmt-${DATE_FORMATS.indexOf(format)}`] },
      rows.map((r, i) =>
        h(
          'button',
          {
            class: ['row', r.checked && 'checked', !r.option && 'unset', i > 0 && r.wd === data.settings.weekStartsOn && 'week-start'],
            'aria-pressed': String(r.checked),
            onclick: () => actions.toggleCheck(r.d),
          },
          h('span', { class: ['date', weekdayClass(r.wd)] }, formatDay(y, m, r.d, format)),
          h('span', { class: 'value' }, r.option ? chip(r.option, { large: true }) : '未入力'),
          h('span', { class: 'check', 'aria-hidden': 'true' }, r.checked && icon('check', 16)),
        ),
      ),
    ),
    missing > 0 &&
      h(
        'p',
        { class: 'hint' },
        `※ ${m}月は${stats.total}日まで。フォームに${missing === 1 ? '31日' : `${stats.total + 1}〜31日`}の質問があっても選ばない`,
      ),
    h(
      'div',
      { class: 'toolbar' },
      h(
        'button',
        {
          class: 'btn primary',
          onclick: async () => toast((await copyText(monthText(data, state.month))) ? '一覧をコピーした' : 'コピーできなかった'),
        },
        icon('copy', 18),
        '一覧をコピー',
      ),
      checkedCount > 0 && h('button', { class: 'btn', onclick: actions.resetChecks }, '✓を全部外す'),
    ),
  );

  const memoArea = h('textarea', {
    rows: 3,
    placeholder: '例: 希望出勤日数は週3日くらいです',
    value: month?.memo ?? '',
    oninput: (e) => actions.setMemo(e.target.value),
  });
  const memo = h(
    'section',
    { class: 'card' },
    h('h2', {}, '備考欄の下書き'),
    h('p', { class: 'hint' }, `出勤できる日は ${stats.available}日。備考欄に書くこと（希望出勤日数など）をここで考えておける`),
    memoArea,
    h(
      'div',
      { class: 'toolbar' },
      h(
        'button',
        { class: 'btn', onclick: async () => toast((await copyText(memoArea.value)) ? '備考をコピーした' : 'コピーできなかった') },
        icon('copy', 18),
        '備考をコピー',
      ),
    ),
  );

  const urlInput = h('input', {
    type: 'url',
    inputmode: 'url',
    autocomplete: 'off',
    placeholder: 'https://docs.google.com/forms/...',
    value: month?.editUrl ?? '',
    oninput: (e) => actions.setEditUrl(e.target.value),
  });
  const editLink = h(
    'section',
    { class: 'card' },
    h('h2', {}, '送信後の「回答を編集」リンク'),
    h(
      'p',
      { class: 'hint' },
      '送信したあとのページにある「回答を編集」を長押ししてリンクをコピーし、ここに貼っておく。あとで直したいときにすぐ開ける',
    ),
    urlInput,
    h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => openUrl(urlInput.value) }, icon('open', 18), '開く')),
  );

  return h('div', { class: 'view-list' }, notice(state, actions), monthNav(state, actions), summary, list, memo, editLink);
}

function openUrl(value) {
  const url = value.trim();
  if (!/^https:\/\/\S+$/.test(url)) {
    toast('https:// から始まるリンクを貼ってね');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

// フォームとアプリを行き来したとき、次に入れる行（最初の未チェックの行）まで移動する
export function scrollToNextUnchecked() {
  // 備考やリンクを入力している途中なら動かさない
  if (document.activeElement?.matches('input, textarea, select')) return;
  const rows = [...document.querySelectorAll('.rows .row')];
  const done = rows.filter((r) => r.classList.contains('checked')).length;
  if (done === 0 || done === rows.length) return;
  const next = rows.find((r) => !r.classList.contains('checked'));
  const rect = next.getBoundingClientRect();
  const tabbar = document.getElementById('tabbar').offsetHeight;
  if (rect.top >= 0 && rect.bottom <= window.innerHeight - tabbar) return; // もう見えている
  next.scrollIntoView({ block: 'center' });
}
