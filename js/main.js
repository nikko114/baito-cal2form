// 起動・画面の切り替え・操作（actions）のまとめ役。
// 状態が変わったら render() で今の画面を作り直す。

import { addMonths, currentMonthKey, daysInMonth, parseYmd, toYmd } from './dates.js';
import { countUsage, fillWithPattern, paintDay, paintWeekday, removeOption } from './logic.js';
import { formatRange, isValidTimes } from './pay.js';
import { PALETTE, emptyMonth, load, newId, save } from './store.js';
import { ERASE, renderCalendar } from './ui/calendar.js';
import { toast } from './ui/common.js';
import { renderList, scrollToNextUnchecked } from './ui/list.js';
import { renderSalary } from './ui/salary.js';
import { renderSettings } from './ui/settings.js';
import { renderShiftSheet } from './ui/shift-sheet.js';
import { renderShifts } from './ui/shifts.js';
import { renderSheet } from './ui/sheet.js';

const loaded = load();
const state = {
  data: loaded.data,
  notice: loaded.error, // 画面上部に出すお知らせ
  tab: 'calendar', // calendar = 希望 / list = 一覧 / shifts = 確定シフト / pay = 給料 / settings = 設定
  month: addMonths(currentMonthKey(), 1), // シフトを出すのはたいてい来月の分
  mode: 'tap', // 'tap' = タップで選ぶ / 'paint' = 塗る
  brush: null, // 塗りモードで選んでいる選択肢の id か ERASE
  sheetDate: null, // 希望のパネルを開いている日
  undo: [], // 元に戻す用（entries の履歴）
  shiftDate: null, // 確定シフトのパネルを開いている日
  shiftUndo: [], // 元に戻す用（shifts の履歴）
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

// 確定シフト（shifts）も同じく、元に戻せるようにする
function setShifts(shifts) {
  state.shiftUndo.push(state.data.shifts);
  if (state.shiftUndo.length > 100) state.shiftUndo.shift();
  state.data.shifts = shifts;
  persist();
}

// 時間が勤務パターンと同じなら、そのパターンの色で出す
function matchTemplate({ start, end, breakMin }) {
  return state.data.templates.find((t) => t.start === start && t.end === end && t.breakMin === breakMin)?.id ?? null;
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
    state.shiftDate = null;
    render();
    window.scrollTo(0, 0);
    if (tab === 'list') scrollToNextUnchecked();
  },
  moveMonth(delta) {
    state.month = addMonths(state.month, delta);
    state.sheetDate = null;
    state.shiftDate = null;
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
  // 確定シフト
  tapShiftDay(ymd) {
    state.shiftDate = ymd;
    render();
  },
  shiftStep(delta) {
    const next = stepDay(state.shiftDate, delta);
    if (!next) return;
    state.shiftDate = next;
    render();
  },
  closeShiftSheet() {
    state.shiftDate = null;
    render();
  },
  applyTemplate(templateId) {
    const t = state.data.templates.find((x) => x.id === templateId);
    if (!t || !state.shiftDate) return;
    setShifts({ ...state.data.shifts, [state.shiftDate]: { start: t.start, end: t.end, breakMin: t.breakMin, templateId: t.id } });
    render();
  },
  addCustomShift() {
    if (!state.shiftDate) return;
    const shift = { start: 9 * 60, end: 17 * 60, breakMin: 45 };
    setShifts({ ...state.data.shifts, [state.shiftDate]: { ...shift, templateId: matchTemplate(shift) } });
    render();
  },
  updateShift(patch) {
    const current = state.data.shifts[state.shiftDate];
    if (!current) return;
    const next = { ...current, ...patch };
    if (!isValidTimes(next)) {
      toast('終わりは始まりより後に、休憩は勤務時間より短くしてね');
      render(); // セレクトを元の値に戻す
      return;
    }
    setShifts({ ...state.data.shifts, [state.shiftDate]: { ...next, templateId: matchTemplate(next) } });
    render();
  },
  removeShift() {
    if (!state.data.shifts[state.shiftDate]) return;
    const shifts = { ...state.data.shifts };
    delete shifts[state.shiftDate];
    setShifts(shifts);
    render();
  },
  undoShift() {
    const previous = state.shiftUndo.pop();
    if (!previous) return;
    state.data.shifts = previous;
    persist();
    render();
    toast('元に戻した');
  },
  // 給料の設定
  setPay(key, value) {
    state.data.pay[key] = value;
    persist();
    render();
  },
  setBaseWage(hourly) {
    state.data.pay.wages[0].hourly = hourly;
    persist();
    render();
  },
  // from の日から hourly 円（同じ日がもうあれば置き換える）
  setWage(from, hourly) {
    const wages = state.data.pay.wages.filter((w) => w.from !== from);
    wages.push({ from, hourly });
    wages.sort((a, b) => (a.from < b.from ? -1 : 1));
    state.data.pay.wages = wages;
    persist();
    render();
  },
  removeWage(from) {
    if (!from) return;
    state.data.pay.wages = state.data.pay.wages.filter((w) => w.from !== from);
    persist();
    render();
  },
  saveTemplate(template) {
    const { templates } = state.data;
    const index = templates.findIndex((t) => t.id === template.id);
    if (index < 0) {
      templates.push({ ...template, id: newId() });
    } else {
      templates[index] = { ...templates[index], ...template };
      // 時間を変えたとき、このパターンで入れてあるシフトも合わせるか聞く（休憩を直したときなど）
      const sameTimes = (s) => s.start === template.start && s.end === template.end && s.breakMin === template.breakMin;
      const linked = Object.entries(state.data.shifts).filter(([, s]) => s.templateId === template.id && !sameTimes(s));
      if (linked.length) {
        const update = confirm(
          `このパターンで入れてあるシフトが ${linked.length}日分 ある。そのシフトの時間も ${formatRange(template)}（休憩 ${template.breakMin}分）に変える？\n` +
            '（キャンセルを押すと、入れてあるシフトの時間はそのまま）',
        );
        const shifts = { ...state.data.shifts };
        for (const [ymd, s] of linked) {
          shifts[ymd] = update
            ? { start: template.start, end: template.end, breakMin: template.breakMin, templateId: template.id }
            : { ...s, templateId: null };
        }
        setShifts(shifts);
      }
    }
    persist();
    render();
  },
  deleteTemplate(id) {
    const template = state.data.templates.find((t) => t.id === id);
    if (!template) return false;
    if (!confirm(`勤務パターン「${template.name || '（名前なし）'}」を消していい？（入れてあるシフトの時間はそのまま残る）`)) return false;
    state.data.templates = state.data.templates.filter((t) => t.id !== id);
    // 入れてあるシフトは時間を残して、パターンとのつながりだけ外す
    const shifts = {};
    for (const [ymd, s] of Object.entries(state.data.shifts)) shifts[ymd] = s.templateId === id ? { ...s, templateId: null } : s;
    state.data.shifts = shifts;
    state.shiftUndo = [];
    persist();
    render();
    return true;
  },
  moveTemplate(id, delta) {
    const { templates } = state.data;
    const i = templates.findIndex((t) => t.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= templates.length) return;
    [templates[i], templates[j]] = [templates[j], templates[i]];
    persist();
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
    state.shiftUndo = [];
    state.sheetDate = null;
    state.shiftDate = null;
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

const views = {
  calendar: renderCalendar,
  list: renderList,
  shifts: renderShifts,
  pay: renderSalary,
  settings: renderSettings,
};

function render() {
  const ctx = { state, actions };
  for (const b of tabButtons) b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false');
  viewEl.replaceChildren(views[state.tab](ctx));
  renderSheetArea(ctx);
}

function renderKeepingScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// 下から出るパネル（希望の選択肢 / 確定シフトの時間）
function currentSheet() {
  if (state.tab === 'calendar' && state.mode === 'tap' && state.sheetDate !== null) return renderSheet;
  if (state.tab === 'shifts' && state.shiftDate !== null) return renderShiftSheet;
  return null;
}

function renderSheetArea(ctx) {
  const sheet = currentSheet();
  document.body.classList.toggle('sheet-open', sheet !== null);
  if (!sheet) {
    sheetEl.hidden = true;
    sheetEl.replaceChildren();
    return;
  }
  const opening = sheetEl.hidden;
  sheetEl.replaceChildren(sheet(ctx));
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

// PC で使うとき用: ← → で日を移動、1〜9 で選択肢（確定シフトでは勤務パターン）、Esc で閉じる
document.addEventListener('keydown', (e) => {
  const sheet = currentSheet();
  if (!sheet || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
  const shifts = sheet === renderShiftSheet;
  const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
  const pick = shifts ? state.data.templates[n] : state.data.options[n];
  if (e.key === 'Escape') (shifts ? actions.closeShiftSheet : actions.closeSheet)();
  else if (e.key === 'ArrowLeft') (shifts ? actions.shiftStep : actions.sheetStep)(-1);
  else if (e.key === 'ArrowRight') (shifts ? actions.shiftStep : actions.sheetStep)(1);
  else if (pick) (shifts ? actions.applyTemplate : actions.choose)(pick.id);
  else return;
  e.preventDefault();
});

// フォームから戻ってきたら、一覧の次に入れる行を見せる
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.tab === 'list') scrollToNextUnchecked();
});

// 初めて開いたときと、古い形式のデータを読み替えたときは保存し直す
if (loaded.fresh || loaded.migrated) persist();
// 対応しているブラウザでは、データを消されにくくするようお願いしておく
navigator.storage?.persist?.().catch(() => {});

render();
