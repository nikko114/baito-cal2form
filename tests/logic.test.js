process.env.TZ = 'Asia/Tokyo';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countUsage,
  fillWithPattern,
  monthRows,
  monthStats,
  monthText,
  paintDay,
  paintWeekday,
  removeOption,
  textColorFor,
} from '../js/logic.js';

function sample() {
  return {
    version: 1,
    options: [
      { id: 'ok', label: '○', short: '', note: '', color: '#2e9d5b', off: false },
      { id: 'no', label: '×', short: '', note: '', color: '#8a8f98', off: true },
      { id: 'late', label: '17-', short: '', note: '', color: '#2f7de1', off: false },
    ],
    entries: {
      '2026-11-01': 'ok',
      '2026-11-02': 'late',
      '2026-11-03': 'no',
      '2026-10-31': 'ok', // 別の月
    },
    pattern: [null, null, null, null, null, null, null],
    months: { '2026-11': { checked: { 1: true }, memo: '', editUrl: '' } },
    settings: { weekStartsOn: 0, dateFormat: 'D日(W)', hideInstallTip: false },
  };
}

test('月の行: 全日そろって、未入力は null', () => {
  const rows = monthRows(sample(), '2026-11');
  assert.equal(rows.length, 30);
  assert.equal(rows[0].ymd, '2026-11-01');
  assert.equal(rows[0].wd, 0);
  assert.equal(rows[0].option.label, '○');
  assert.equal(rows[0].checked, true);
  assert.equal(rows[1].checked, false);
  assert.equal(rows[3].option, null);
});

test('集計: 出勤できる日は休み扱い以外を数える', () => {
  const s = monthStats(sample(), '2026-11');
  assert.equal(s.total, 30);
  assert.equal(s.filled, 3);
  assert.equal(s.unset, 27);
  assert.equal(s.available, 2);
  assert.deepEqual(
    s.counts.map((c) => [c.option.id, c.count]),
    [
      ['ok', 1],
      ['no', 1],
      ['late', 1],
    ],
  );
});

test('コピー用テキスト', () => {
  const lines = monthText(sample(), '2026-11').split('\n');
  assert.equal(lines[0], '2026年11月のシフト希望');
  assert.equal(lines[1], '1日(日) ○');
  assert.equal(lines[2], '2日(月) 17-');
  assert.equal(lines[3], '3日(火) ×');
  assert.equal(lines[4], '4日(水) （未入力）');
  assert.equal(lines.length, 31);
});

test('コピー用テキストは日付の書き方の設定に従う', () => {
  const data = sample();
  data.settings.dateFormat = 'M/D(W)';
  assert.equal(monthText(data, '2026-11').split('\n')[1], '11/1(日) ○');
});

test('1日を塗る: 同じ選択肢なら空に戻す・元のオブジェクトは変えない', () => {
  const entries = { '2026-11-01': 'ok' };
  const a = paintDay(entries, '2026-11-02', 'no');
  assert.deepEqual(a, { '2026-11-01': 'ok', '2026-11-02': 'no' });
  const b = paintDay(a, '2026-11-02', 'no');
  assert.deepEqual(b, { '2026-11-01': 'ok' });
  const c = paintDay(a, '2026-11-01', null);
  assert.deepEqual(c, { '2026-11-02': 'no' });
  assert.deepEqual(entries, { '2026-11-01': 'ok' });
});

test('曜日でまとめて塗る: 全部同じなら空に戻す', () => {
  const tuesdays = ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'];
  const a = paintWeekday({ '2026-11-03': 'ok' }, '2026-11', 2, 'no');
  assert.deepEqual(Object.keys(a).sort(), tuesdays);
  assert.ok(tuesdays.every((d) => a[d] === 'no'));
  const b = paintWeekday(a, '2026-11', 2, 'no');
  assert.deepEqual(b, {});
  const c = paintWeekday(a, '2026-11', 2, null);
  assert.deepEqual(c, {});
});

test('曜日パターンで空いている日だけ埋める', () => {
  const data = sample();
  data.pattern = ['no', 'late', null, null, null, null, 'ok']; // 日=×, 月=17-, 土=○
  const { entries, filled } = fillWithPattern(data, '2026-11');
  assert.equal(entries['2026-11-01'], 'ok'); // 入力済みは変えない
  assert.equal(entries['2026-11-02'], 'late');
  assert.equal(entries['2026-11-03'], 'no'); // 入力済み
  assert.equal(entries['2026-11-04'], undefined); // 水曜はパターンなし
  assert.equal(entries['2026-11-07'], 'ok'); // 土曜
  assert.equal(entries['2026-11-08'], 'no'); // 日曜
  // 日曜 5日のうち1日(11/1)は入力済み、月曜 5日のうち1日(11/2)は入力済み、土曜 4日
  assert.equal(filled, 4 + 4 + 4);
  assert.equal(data.entries['2026-11-07'], undefined); // 元は変えない
});

test('選択肢を消すと、その日は空になりパターンからも外れる', () => {
  const data = sample();
  data.pattern = ['no', null, null, null, null, null, null];
  assert.equal(countUsage(data, 'no'), 1);
  const next = removeOption(data, 'no');
  assert.deepEqual(
    next.options.map((o) => o.id),
    ['ok', 'late'],
  );
  assert.equal(next.entries['2026-11-03'], undefined);
  assert.equal(next.entries['2026-11-01'], 'ok');
  assert.equal(next.pattern[0], null);
});

test('文字色: 濃い色には白、明るい色には黒', () => {
  assert.equal(textColorFor('#5b5bd6'), '#ffffff');
  assert.equal(textColorFor('#2e9d5b'), '#ffffff');
  assert.equal(textColorFor('#c79a1e'), '#1c1c22');
  assert.equal(textColorFor('#ffffff'), '#1c1c22');
});
