// 起動・画面の切り替え・操作（actions）のまとめ役。
// 状態が変わったら render() で今の画面を作り直す。

import { addMonths, currentMonthKey, daysInMonth, parseYmd, toYmd } from './dates.js';
import { countUsage, fillWithPattern, paintDay, paintWeekday, removeOption } from './logic.js';
import { PALETTE, emptyMonth, load, newId, save } from './store.js';
import { ERASE, renderCalendar } from './ui/calendar.js';
import { toast } from './ui/common.js';
import { renderList, scrollToNextUnchecked } from './ui/list.js';
import { renderSettings } from './ui/settings.js';
import { renderSheet } from './ui/sheet.js';

const loaded = load();
const state = {
  data: loaded.data,
  notice: loaded.error, // 画面上部に出すお知らせ
  tab: 'calendar',
  month: addMonths(currentMonthKey(), 1), // シフトを出すのはたいてい来月の分
  mode: 'tap', // 'tap' = タップで選ぶ / 'paint' = 塗る
  brush: null, // 塗りモードで選んでいる選択肢の id か ERASE
  sheetDate: null, // 選択肢パネルを開いている日
  undo: [], // 元に戻す用（entries の履歴）
};

function persist() {
  if (!save(state.data)) {
    state.notice = '保存できなかった。プライベートブラウズになっていないか確認してね';
  }
}

// 入力（entries）を変える操作はここを通して、元に戻せるようにする
function setEntries(entries) {
  state.undo.push(state.data.entries);
  if (state.undo.length > 100) state.undo.shift();
  state.data.entries = entries;
  persist();
}

function monthData(key) {
  state.data.months[key] ??= emptyMonth();
  return state.data.months[key];
}

// 同じ月の中で日をずらす。月の外に出たら null
function stepDay(ymd, delta) {
  const { y, m, d } = parseYmd(ymd);
  const next = d + delta;
  return next >= 1 && next <= daysInMonth(y, m) ? toYmd(y, m, next) : null;
}

const brushOption = () => (state.brush === ERASE ? null : state.brush);

const actions = {
  setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    state.sheetDate = null;
    render();
    window.scrollTo(0, 0);
    if (tab === 'list') scrollToNextUnchecked();
  },
  moveMonth(delta) {
    state.month = addMonths(state.month, delta);
    state.sheetDate = null;
    render();
  },
  setMode(mode) {
    state.mode = mode;
    state.sheetDate = null;
    if (mode === 'paint' && state.brush !== ERASE && !state.data.options.some((o) => o.id === state.brush)) {
      state.brush = state.data.options[0]?.id ?? ERASE;
    }
    render();
  },
  setBrush(brush) {
    state.brush = brush;
    render();
  },
  tapDay(ymd) {
    if (state.mode === 'paint') setEntries(paintDay(state.data.entries, ymd, brushOption()));
    else state.sheetDate = ymd;
    render();
  },
  paintWeekday(wd) {
    setEntries(paintWeekday(state.data.entries, state.month, wd, brushOption()));
    render();
  },
  choose(optionId) {
    const ymd = state.sheetDate;
    if (!ymd) return;
    setEntries({ ...state.data.entries, [ymd]: optionId });
    state.sheetDate = stepDay(ymd, 1);
    if (!state.sheetDate) toast(`${parseYmd(ymd).m}月の最後の日まで入れた`);
    render();
  },
  clearDay() {
    const ymd = state.sheetDate;
    if (!ymd || !state.data.entries[ymd]) return;
    setEntries(paintDay(state.data.entries, ymd, null));
    render();
  },
  sheetStep(delta) {
    const next = stepDay(state.sheetDate, delta);
    if (!next) return;
    state.sheetDate = next;
    render();
  },
  closeSheet() {
    state.sheetDate = null;
    render();
  },
  fillPattern() {
    const { entries, filled } = fillWithPattern(state.data, state.month);
    if (!filled) {
      toast('曜日パターンで埋められる日がなかった');
      return;
    }
    setEntries(entries);
    render();
    toast(`曜日パターンで ${filled}日分 埋めた`);
  },
  undo() {
    const previous = state.undo.pop();
    if (!previous) return;
    state.data.entries = previous;
    persist();
    render();
    toast('元に戻した');
  },
  jumpToDay(ymd) {
    state.tab = 'calendar';
    state.mode = 'tap';
    state.month = ymd.slice(0, 7);
    state.sheetDate = ymd;
    window.scrollTo(0, 0);
    render();
  },
  toggleCheck(day) {
    const { checked } = monthData(state.month);
    if (checked[day]) delete checked[day];
    else checked[day] = true;
    persist();
    renderKeepingScroll();
  },
  resetChecks() {
    if (!confirm('この月の ✓ を全部外す？')) return;
    monthData(state.month).checked = {};
    persist();
    renderKeepingScroll();
  },
  setMemo(text) {
    monthData(state.month).memo = text;
    persist();
  },
  setEditUrl(url) {
    monthData(state.month).editUrl = url.trim();
    persist();
  },
  saveOption(option) {
    const { options } = state.data;
    const index = options.findIndex((o) => o.id === option.id);
    if (index >= 0) options[index] = { ...options[index], ...option };
    else options.push({ ...option, id: newId() });
    persist();
    render();
  },
  deleteOption(id) {
    const option = state.data.options.find((o) => o.id === id);
    if (!option) return false;
    const used = countUsage(state.data, id);
    const message = used
      ? `「${option.label}」は ${used}日分 で使われている。消すとその日は未入力に戻る。消していい？`
      : `「${option.label}」を消していい？`;
    if (!confirm(message)) return false;
    state.data = removeOption(state.data, id);
    state.undo = []; // 消した選択肢を指す履歴が残らないように
    if (state.brush === id) state.brush = null;
    persist();
    render();
    return true;
  },
  moveOption(id, delta) {
    const { options } = state.data;
    const i = options.findIndex((o) => o.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= options.length) return;
    [options[i], options[j]] = [options[j], options[i]];
    persist();
    render();
  },
  addOptions(lines) {
    const existing = new Set(state.data.options.map((o) => o.label));
    let added = 0;
    for (const line of lines) {
      const label = line.trim().slice(0, 40);
      if (!label || existing.has(label)) continue;
      existing.add(label);
      state.data.options.push({
        id: newId(),
        label,
        short: '',
        note: '',
        color: PALETTE[state.data.options.length % PALETTE.length],
        off: false,
      });
      added++;
    }
    if (added) {
      persist();
      render();
    }
    return added;
  },
  setPattern(wd, id) {
    state.data.pattern[wd] = id;
    persist();
    render();
  },
  setSetting(key, value) {
    state.data.settings[key] = value;
    persist();
    render();
  },
  replaceData(data) {
    state.data = data;
    state.undo = [];
    state.sheetDate = null;
    state.brush = null;
    persist();
    render();
  },
  dismissInstallTip() {
    state.data.settings.hideInstallTip = true;
    persist();
    render();
  },
  dismissNotice() {
    state.notice = null;
    render();
  },
};

const viewEl = document.getElementById('view');
const sheetEl = document.getElementById('sheet');
const tabButtons = [...document.querySelectorAll('#tabbar [data-tab]')];

function render() {
  const ctx = { state, actions };
  for (const b of tabButtons) b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false');
  const view = state.tab === 'list' ? renderList(ctx) : state.tab === 'settings' ? renderSettings(ctx) : renderCalendar(ctx);
  viewEl.replaceChildren(view);
  renderSheetArea(ctx);
}

function renderKeepingScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

function renderSheetArea(ctx) {
  const open = state.tab === 'calendar' && state.mode === 'tap' && state.sheetDate !== null;
  document.body.classList.toggle('sheet-open', open);
  if (!open) {
    sheetEl.hidden = true;
    sheetEl.replaceChildren();
    return;
  }
  const opening = sheetEl.hidden;
  sheetEl.replaceChildren(renderSheet(ctx));
  sheetEl.hidden = false;
  // パネルの高さぶん下に余白を作り、選んでいる日がパネルに隠れないようにする
  document.documentElement.style.setProperty('--sheet-h', `${sheetEl.offsetHeight}px`);
  revealSelectedCell(opening ? 'auto' : 'smooth');
}

// 選んでいる日がパネルの裏や画面の上に隠れていたら、見える位置までスクロールする。
// （scrollIntoView の block: 'nearest' は scroll-margin を見てくれないブラウザがあるので自分で計算する）
function revealSelectedCell(behavior) {
  const cell = viewEl.querySelector('.cell.selected');
  if (!cell) return;
  const gap = 12;
  const rect = cell.getBoundingClientRect();
  const visibleBottom = window.innerHeight - sheetEl.offsetHeight - gap;
  let delta = 0;
  if (rect.bottom > visibleBottom) delta = rect.bottom - visibleBottom;
  else if (rect.top < gap) delta = rect.top - gap;
  if (delta) window.scrollBy({ top: delta, behavior });
}

for (const b of tabButtons) b.addEventListener('click', () => actions.setTab(b.dataset.tab));

// PC で使うとき用: ← → で日を移動、1〜9 で選択肢、Esc で閉じる
document.addEventListener('keydown', (e) => {
  if (state.tab !== 'calendar' || !state.sheetDate || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
  const option = /^[1-9]$/.test(e.key) ? state.data.options[Number(e.key) - 1] : null;
  if (e.key === 'Escape') actions.closeSheet();
  else if (e.key === 'ArrowLeft') actions.sheetStep(-1);
  else if (e.key === 'ArrowRight') actions.sheetStep(1);
  else if (option) actions.choose(option.id);
  else return;
  e.preventDefault();
});

// フォームから戻ってきたら、一覧の次に入れる行を見せる
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.tab === 'list') scrollToNextUnchecked();
});

if (loaded.fresh) persist();
// 対応しているブラウザでは、データを消されにくくするようお願いしておく
navigator.storage?.persist?.().catch(() => {});

render();
