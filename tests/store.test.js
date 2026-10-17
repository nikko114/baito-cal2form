import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultData, exportJson, importJson, load, normalize, save, STORAGE_KEY } from '../js/store.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    map,
  };
}

test('初期データは正規化しても変わらない', () => {
  const data = defaultData();
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(data))), data);
  assert.deepEqual(
    data.options.map((o) => o.label),
    ['○', '×', '早', '中', '遅', '9-', '17-', '17:30-', '18-'],
  );
  assert.equal(data.options.find((o) => o.label === '×').off, true);
  assert.equal(data.options.filter((o) => o.off).length, 1);
});

test('おかしな値は捨てる', () => {
  const data = normalize({
    options: [
      { id: 'a', label: ' ○ ', color: 'red' },
      { id: 'a', label: '×', color: '#ABCDEF', off: true }, // id がかぶっている
      { label: '' }, // 文言が空
      'x',
    ],
    // 存在しない日・存在しない選択肢・"__proto__" キーを含む
    entries: JSON.parse('{"2026-11-01":"a","2026-11-31":"a","2026-11-02":"nope","__proto__":"a"}'),
    pattern: ['a', 'nope'],
    months: { '2026-11': { checked: { 1: true, 40: true, 2: 'yes' }, memo: 3 }, bad: {} },
    settings: { weekStartsOn: 5, dateFormat: '???' },
  });
  assert.equal(data.options.length, 2);
  assert.equal(data.options[0].label, '○');
  assert.equal(data.options[0].color, '#2e9d5b'); // パレットの色になる
  assert.notEqual(data.options[1].id, 'a');
  assert.equal(data.options[1].color, '#abcdef');
  assert.deepEqual(data.entries, { '2026-11-01': 'a' });
  assert.deepEqual(data.pattern, ['a', null, null, null, null, null, null]);
  assert.deepEqual(data.months, { '2026-11': { checked: { 1: true }, memo: '', editUrl: '' } });
  assert.deepEqual(data.settings, { weekStartsOn: 0, dateFormat: 'D日(W)', hideInstallTip: false });
});

test('このアプリのデータでなければエラー', () => {
  assert.throws(() => normalize(null));
  assert.throws(() => normalize({ entries: {} }));
  assert.throws(() => importJson('not json'), /JSONとして読めなかった/);
  assert.throws(() => importJson('{"app":"other","options":[]}'), /バックアップではない/);
});

test('書き出したものを読み込むと元に戻る', () => {
  const data = defaultData();
  data.entries['2026-11-01'] = data.options[0].id;
  data.months['2026-11'] = { checked: { 1: true }, memo: '週3日希望', editUrl: '' };
  assert.deepEqual(importJson(exportJson(data)), data);
});

test('保存と読み込み', () => {
  const storage = memoryStorage();
  const first = load(storage);
  assert.equal(first.fresh, true);
  assert.equal(first.error, null);
  first.data.entries['2026-11-01'] = first.data.options[1].id;
  assert.ok(save(first.data, storage));
  const again = load(storage);
  assert.equal(again.fresh, false);
  assert.deepEqual(again.data, first.data);
});

test('壊れた保存データは退避して最初の状態で開く', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{broken' });
  const result = load(storage);
  assert.match(result.error, /壊れていた/);
  assert.equal(storage.map.get(`${STORAGE_KEY}:broken`), '{broken');
  assert.equal(result.data.options.length, 9);
});

test('保存できない環境でも落ちない', () => {
  const throwing = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  assert.match(load(throwing).error, /読めなかった/);
  assert.equal(save(defaultData(), throwing), false);
  assert.match(load(null).error, /保存できない/);
});
