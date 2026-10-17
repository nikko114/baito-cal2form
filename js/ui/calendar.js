// カレンダー画面

import { WEEKDAYS, monthWeeks, parseMonthKey, todayYmd, toYmd, weekdayOrder } from '../dates.js';
import { monthStats, optionMap } from '../logic.js';
import { monthNav, notice } from './common.js';
import { chip, h, icon, weekdayClass } from './dom.js';

// 塗りモードの「消す」
export const ERASE = 'erase';

export function renderCalendar({ state, actions }) {
  const { data } = state;
  const { y, m } = parseMonthKey(state.month);
  const options = optionMap(data);
  const order = weekdayOrder(data.settings.weekStartsOn);
  const today = todayYmd();
  const painting = state.mode === 'paint';
  const stats = monthStats(data, state.month);
  const hasPattern = data.pattern.some(Boolean);

  const head = h(
    'div',
    { class: 'cal-head' },
    order.map((wd) =>
      painting
        ? h(
            'button',
            { class: ['wd', weekdayClass(wd)], 'aria-label': `${WEEKDAYS[wd]}曜日をまとめて塗る`, onclick: () => actions.paintWeekday(wd) },
            WEEKDAYS[wd],
          )
        : h('div', { class: ['wd', weekdayClass(wd)] }, WEEKDAYS[wd]),
    ),
  );

  const body = h(
    'div',
    { class: 'cal-body' },
    monthWeeks(y, m, data.settings.weekStartsOn).map((week) =>
      h(
        'div',
        { class: 'cal-week' },
        week.map((d, i) => {
          if (d == null) return h('div', { class: 'cell empty', 'aria-hidden': 'true' });
          const ymd = toYmd(y, m, d);
          const wd = order[i];
          const option = options.get(data.entries[ymd]);
          return h(
            'button',
            {
              class: ['cell', weekdayClass(wd), ymd === today && 'today', ymd === state.sheetDate && 'selected', !option && 'unset'],
              'aria-label': `${m}月${d}日 ${WEEKDAYS[wd]}曜日 ${option ? option.label : '未入力'}`,
              onclick: () => actions.tapDay(ymd),
            },
            h('span', { class: 'num' }, d),
            option ? chip(option, { cell: true }) : h('span', { class: 'chip-empty' }),
          );
        }),
      ),
    ),
  );

  const summary = h(
    'p',
    { class: 'cal-summary' },
    h('span', {}, `入力 ${stats.filled}/${stats.total}日`),
    stats.unset > 0 && h('span', { class: 'warn' }, `未入力 ${stats.unset}日`),
    h('span', {}, `出勤できる日 ${stats.available}日`),
  );

  const undoButton = h('button', { class: 'btn', disabled: state.undo.length === 0, onclick: actions.undo }, icon('undo', 18), '元に戻す');

  const tools = painting
    ? h(
        'div',
        { class: 'palette' },
        h(
          'div',
          { class: 'brushes', role: 'group', 'aria-label': '塗る選択肢' },
          data.options.map((o) =>
            h(
              'button',
              {
                class: 'brush',
                'aria-pressed': String(state.brush === o.id),
                'aria-label': `${o.label}で塗る`,
                onclick: () => actions.setBrush(o.id),
              },
              chip(o, { large: true }),
            ),
          ),
          h(
            'button',
            { class: 'brush erase', 'aria-pressed': String(state.brush === ERASE), onclick: () => actions.setBrush(ERASE) },
            '消す',
          ),
        ),
        h('div', { class: 'palette-foot' }, h('p', { class: 'hint' }, '曜日の見出しをタップすると、その曜日をまとめて塗れる'), undoButton),
      )
    : h(
        'div',
        {},
        h('p', { class: 'hint tool-hint' }, '日付をタップして選ぶ。選ぶと次の日に進む'),
        h(
          'div',
          { class: 'toolbar' },
          undoButton,
          hasPattern && h('button', { class: 'btn', onclick: actions.fillPattern }, icon('wand', 18), '曜日パターンで埋める'),
        ),
        !hasPattern && h('p', { class: 'hint tool-hint' }, '設定で「曜日パターン」を決めておくと、空いている日をまとめて埋められる'),
      );

  return h(
    'div',
    { class: 'view-calendar' },
    notice(state, actions),
    installTip(state, actions),
    monthNav(state, actions),
    h(
      'div',
      { class: 'segmented', role: 'group', 'aria-label': '入力のしかた' },
      [
        ['tap', 'タップで選ぶ'],
        ['paint', '塗る'],
      ].map(([mode, label]) => h('button', { 'aria-pressed': String(state.mode === mode), onclick: () => actions.setMode(mode) }, label)),
    ),
    data.options.length === 0 &&
      h(
        'div',
        { class: 'banner' },
        h('div', { class: 'grow' }, '選択肢がまだない。先に設定で、フォームのプルダウンの選択肢を登録してね'),
        h('button', { class: 'btn small', onclick: () => actions.setTab('settings') }, '設定へ'),
      ),
    h('div', { class: 'cal' }, head, body),
    summary,
    tools,
  );
}

// iPhone の Safari で開いているときだけ、ホーム画面への追加をすすめる
function installTip(state, actions) {
  if (navigator.standalone !== false || state.data.settings.hideInstallTip) return null;
  return h(
    'div',
    { class: 'banner' },
    h(
      'div',
      { class: 'grow' },
      h('strong', {}, 'ホーム画面に追加して使うのがおすすめ'),
      h('br'),
      'Safari のままだと、しばらく開かないうちにデータが消えることがある。共有ボタン →「ホーム画面に追加」',
    ),
    h('button', { class: 'icon-btn small', 'aria-label': '閉じる', onclick: actions.dismissInstallTip }, icon('close', 18)),
  );
}
