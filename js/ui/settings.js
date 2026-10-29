// 設定画面

import {
  DATE_FORMATS,
  WEEKDAYS,
  addMonths,
  currentMonthKey,
  formatDay,
  isYmd,
  parseMonthKey,
  parseYmd,
  todayYmd,
  toYmd,
  weekdayOrder,
} from '../dates.js';
import { END_HOURS, START_HOURS, formatDuration, formatRange, isValidTimes, shortRange } from '../pay.js';
import { PALETTE, defaultData, exportJson, importJson } from '../store.js';
import { copyText, downloadText, notice, openDialog, toast } from './common.js';
import { chip, colorChip, h, icon, weekdayClass } from './dom.js';
import { breakSelect, timePicker } from './shift-parts.js';

export function renderSettings({ state, actions }) {
  const { data } = state;
  return h(
    'div',
    { class: 'view-settings' },
    notice(state, actions),
    h('h1', { class: 'page-title' }, '設定'),
    optionsSection(data, actions),
    patternSection(data, actions),
    paySection(data, actions),
    templatesSection(data, actions),
    displaySection(data, actions),
    installSection(),
    backupSection(data, actions),
    section(
      'リセット',
      null,
      h(
        'button',
        {
          class: 'btn danger',
          onclick: () => {
            if (!confirm('希望・確定シフト・給料の設定・メモなど、全部のデータを消して最初の状態に戻す。元に戻せないけどいい？')) return;
            actions.replaceData(defaultData());
            toast('最初の状態に戻した');
          },
        },
        '全部のデータを消す',
      ),
    ),
    h(
      'p',
      { class: 'footer' },
      'データはこの端末のブラウザの中にだけ保存される（どこにも送信しない）',
      h('br'),
      h('a', { href: 'https://github.com/nikko114/baito-cal2form', target: '_blank', rel: 'noopener' }, 'ソースコード（GitHub）'),
    ),
  );
}

function section(title, description, ...children) {
  return h(
    'section',
    { class: 'settings-section' },
    h('h2', { class: 'section-title' }, title),
    description && h('p', { class: 'hint' }, description),
    ...children,
  );
}

function optionsSection(data, actions) {
  const items = data.options.map((o, i) =>
    h(
      'div',
      { class: 'list-item' },
      h(
        'button',
        { class: 'item-main', onclick: () => editOption(data, actions, o) },
        chip(o, { large: true }),
        h(
          'span',
          { class: 'item-text' },
          h('span', {}, o.note || '（説明なし）'),
          (o.short || o.off) &&
            h('span', { class: 'sub' }, [o.short && `カレンダーでは「${o.short}」`, o.off && '休み扱い'].filter(Boolean).join(' ・ ')),
        ),
      ),
      moveButtons(o.label, i, data.options.length, (delta) => actions.moveOption(o.id, delta)),
    ),
  );
  return section(
    '選択肢',
    'フォームのプルダウンと同じ文字・同じ順番にしておく。タップで編集',
    h('div', { class: 'list' }, items.length ? items : h('p', { class: 'empty' }, 'まだない')),
    h(
      'div',
      { class: 'toolbar' },
      h('button', { class: 'btn', onclick: () => editOption(data, actions, null) }, icon('plus', 18), '追加'),
      h('button', { class: 'btn', onclick: () => bulkAdd(actions) }, 'まとめて追加'),
    ),
  );
}

function field(label, input) {
  return h('div', { class: 'field' }, h('label', { class: 'field-label', for: input.id }, label), input);
}

function moveButtons(name, index, count, onmove) {
  return h(
    'div',
    { class: 'move-btns' },
    h('button', { class: 'mini-btn', 'aria-label': `${name}を上へ`, disabled: index === 0, onclick: () => onmove(-1) }, icon('up', 18)),
    h(
      'button',
      { class: 'mini-btn', 'aria-label': `${name}を下へ`, disabled: index === count - 1, onclick: () => onmove(1) },
      icon('down', 18),
    ),
  );
}

function swatchPicker(initial, onchange) {
  const group = h(
    'div',
    { class: 'swatches', role: 'radiogroup', 'aria-label': '色' },
    PALETTE.map((c) =>
      h('button', {
        type: 'button',
        class: 'swatch',
        role: 'radio',
        'aria-checked': String(c === initial),
        'aria-label': c,
        style: { background: c },
        onclick: (e) => {
          onchange(c);
          for (const s of group.children) s.setAttribute('aria-checked', String(s === e.currentTarget));
        },
      }),
    ),
  );
  return group;
}

function editOption(data, actions, option) {
  openDialog(option ? '選択肢を編集' : '選択肢を追加', (close) => {
    let color = option?.color ?? PALETTE[data.options.length % PALETTE.length];
    const label = h('input', { type: 'text', id: 'opt-label', maxlength: 40, autocomplete: 'off', value: option?.label ?? '' });
    const short = h('input', {
      type: 'text',
      id: 'opt-short',
      maxlength: 8,
      autocomplete: 'off',
      placeholder: '空ならフォームの文字をそのまま出す',
      value: option?.short ?? '',
    });
    const note = h('input', {
      type: 'text',
      id: 'opt-note',
      maxlength: 60,
      autocomplete: 'off',
      placeholder: '例: 早番 8-17',
      value: option?.note ?? '',
    });
    const off = h('input', { type: 'checkbox', id: 'opt-off', checked: option?.off ?? false });
    const error = h('p', { class: 'error', role: 'alert' });
    const swatches = swatchPicker(color, (c) => (color = c));
    return h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (e) => {
          e.preventDefault();
          const value = label.value.trim();
          if (!value) {
            error.textContent = 'フォームの選択肢の文字を入れてね';
            return;
          }
          if (data.options.some((o) => o.label === value && o.id !== option?.id)) {
            error.textContent = `「${value}」はもうある`;
            return;
          }
          actions.saveOption({ id: option?.id, label: value, short: short.value.trim(), note: note.value.trim(), color, off: off.checked });
          close();
        },
      },
      field('フォームの選択肢の文字（一字一句同じに）', label),
      field('説明（選ぶときに出る）', note),
      field('カレンダーでの表示（短くしたいときだけ）', short),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '色'), swatches),
      h('label', { class: 'check-field', for: 'opt-off' }, off, h('span', {}, '休み扱い（「出勤できる日」に数えない）')),
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        option &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn danger',
              onclick: () => {
                if (actions.deleteOption(option.id)) close();
              },
            },
            '削除',
          ),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'キャンセル'),
        h('button', { type: 'submit', class: 'btn primary' }, '保存'),
      ),
    );
  });
}

function bulkAdd(actions) {
  openDialog('まとめて追加', (close) => {
    const area = h('textarea', { rows: 8, placeholder: '○\n×\n早\n遅' });
    return h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (e) => {
          e.preventDefault();
          const added = actions.addOptions(area.value.split('\n'));
          close();
          toast(added ? `${added}個追加した` : '追加するものがなかった');
        },
      },
      h('p', { class: 'hint' }, 'フォームのプルダウンの選択肢を、上から順に1行に1つずつ書く。もうあるものは飛ばす'),
      area,
      h(
        'div',
        { class: 'dialog-actions' },
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'キャンセル'),
        h('button', { type: 'submit', class: 'btn primary' }, '追加'),
      ),
    );
  });
}

function patternSection(data, actions) {
  const rows = weekdayOrder(data.settings.weekStartsOn).map((wd) =>
    h(
      'div',
      { class: 'list-item' },
      h('label', { class: ['wd-label', weekdayClass(wd)], for: `pattern-${wd}` }, `${WEEKDAYS[wd]}曜日`),
      h(
        'select',
        { id: `pattern-${wd}`, value: data.pattern[wd] ?? '', onchange: (e) => actions.setPattern(wd, e.target.value || null) },
        h('option', { value: '' }, '（なし）'),
        data.options.map((o) => h('option', { value: o.id }, o.note ? `${o.label}（${o.note}）` : o.label)),
      ),
    ),
  );
  return section(
    '曜日パターン',
    '毎週決まっている曜日（授業がある日は×、など）を入れておくと、カレンダーの「曜日パターンで埋める」で、その月の空いている日にまとめて入る',
    h('div', { class: 'list' }, rows),
  );
}

// 全角数字やカンマが入っても数字だけ取り出す
function parseAmount(text) {
  const digits = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9]/g, '');
  return Math.min(Number(digits || 0), 100000);
}

function yenInput(id, value, onchange) {
  return h('input', {
    type: 'text',
    id,
    class: 'num-input',
    inputmode: 'numeric',
    autocomplete: 'off',
    placeholder: '0',
    value: value ? String(value) : '',
    onchange: (e) => onchange(parseAmount(e.target.value)),
  });
}

const slashDate = (ymd) => {
  const { y, m, d } = parseYmd(ymd);
  return `${y}/${m}/${d}`;
};

function paySection(data, actions) {
  const { pay } = data;
  const select = (id, value, choices, onchange, ariaLabel) =>
    h(
      'select',
      { id, 'aria-label': ariaLabel, value: String(value), onchange: (e) => onchange(Number(e.target.value)) },
      choices.map(([v, label]) => h('option', { value: String(v) }, label)),
    );
  const days = Array.from({ length: 31 }, (_, i) => [i + 1, `${i + 1}日`]);
  return section(
    '給料',
    '確定シフトから給料の見込みを出すときに使う',
    h(
      'div',
      { class: 'list' },
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'pay-hourly' }, '時給'),
        yenInput('pay-hourly', pay.wages[0].hourly, actions.setBaseWage),
        h('span', { class: 'unit' }, '円'),
      ),
      pay.wages.slice(1).map((w) =>
        h(
          'div',
          { class: 'list-item' },
          h('label', { class: 'grow', for: `pay-wage-${w.from}` }, `${slashDate(w.from)}から`),
          yenInput(`pay-wage-${w.from}`, w.hourly, (v) => actions.setWage(w.from, v)),
          h('span', { class: 'unit' }, '円'),
          h(
            'button',
            { class: 'mini-btn', 'aria-label': `${slashDate(w.from)}からの時給を消す`, onclick: () => actions.removeWage(w.from) },
            icon('close', 16),
          ),
        ),
      ),
      h(
        'div',
        { class: 'list-item' },
        h(
          'button',
          { class: 'btn small', onclick: () => addWageDialog(actions) },
          icon('plus', 16),
          '時給が変わる日を追加（研修明け・昇給など）',
        ),
      ),
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'pay-transport' }, '交通費（出勤1日・往復）'),
        yenInput('pay-transport', pay.transportPerDay, (v) => actions.setPay('transportPerDay', v)),
        h('span', { class: 'unit' }, '円'),
      ),
      h(
        'label',
        { class: 'list-item check-field', for: 'pay-night' },
        h('input', {
          type: 'checkbox',
          id: 'pay-night',
          checked: pay.nightPremium,
          onchange: (e) => actions.setPay('nightPremium', e.target.checked),
        }),
        h('span', {}, '深夜（22時〜翌5時）は25%増し'),
      ),
      h(
        'label',
        { class: 'list-item check-field', for: 'pay-overtime' },
        h('input', {
          type: 'checkbox',
          id: 'pay-overtime',
          checked: pay.overtimePremium,
          onchange: (e) => actions.setPay('overtimePremium', e.target.checked),
        }),
        h('span', {}, '1日8時間を超えた分は25%増し'),
      ),
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'pay-closing' }, '締め日'),
        select('pay-closing', pay.closingDay, [[0, '月末'], ...days.slice(0, 27)], (v) => actions.setPay('closingDay', v)),
      ),
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'pay-offset' }, '給料日'),
        select(
          'pay-offset',
          pay.payMonthOffset,
          [
            [0, '当月'],
            [1, '翌月'],
            [2, '翌々月'],
          ],
          (v) => actions.setPay('payMonthOffset', v),
        ),
        select('pay-day', pay.payDay, [...days, [0, '月末']], (v) => actions.setPay('payDay', v), '給料日（日）'),
      ),
    ),
  );
}

function addWageDialog(actions) {
  openDialog('時給が変わる日を追加', (close) => {
    const { y, m } = parseMonthKey(addMonths(currentMonthKey(), 1));
    const from = h('input', { type: 'date', id: 'wage-from', value: toYmd(y, m, 1) });
    const hourly = h('input', { type: 'text', id: 'wage-hourly', inputmode: 'numeric', autocomplete: 'off', placeholder: '例: 1150' });
    const error = h('p', { class: 'error', role: 'alert' });
    return h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (e) => {
          e.preventDefault();
          const amount = parseAmount(hourly.value);
          if (!isYmd(from.value)) {
            error.textContent = '日付を選んでね';
            return;
          }
          if (!amount) {
            error.textContent = '新しい時給を入れてね';
            return;
          }
          actions.setWage(from.value, amount);
          close();
        },
      },
      field('変わる日（この日の勤務から新しい時給）', from),
      field('新しい時給（円）', hourly),
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'キャンセル'),
        h('button', { type: 'submit', class: 'btn primary' }, '追加'),
      ),
    );
  });
}

function templatesSection(data, actions) {
  const items = data.templates.map((t, i) =>
    h(
      'div',
      { class: 'list-item' },
      h(
        'button',
        { class: 'item-main', onclick: () => editTemplate(data, actions, t) },
        colorChip(shortRange(t), t.color, { large: true }),
        h(
          'span',
          { class: 'item-text' },
          h('span', {}, t.name || formatRange(t)),
          h('span', { class: 'sub' }, `${formatRange(t)} ・ 休憩 ${t.breakMin ? formatDuration(t.breakMin) : 'なし'}`),
        ),
      ),
      moveButtons(t.name || shortRange(t), i, data.templates.length, (delta) => actions.moveTemplate(t.id, delta)),
    ),
  );
  return section(
    '勤務パターン',
    '確定シフトを入れるときに1タップで選べる時間のセット。休憩の長さは仮で入れてあるので、職場のルールに合わせて直してね',
    h('div', { class: 'list' }, items.length ? items : h('p', { class: 'empty' }, 'まだない')),
    h(
      'div',
      { class: 'toolbar' },
      h('button', { class: 'btn', onclick: () => editTemplate(data, actions, null) }, icon('plus', 18), '追加'),
    ),
  );
}

function editTemplate(data, actions, template) {
  openDialog(template ? '勤務パターンを編集' : '勤務パターンを追加', (close) => {
    const draft = {
      start: template?.start ?? 9 * 60,
      end: template?.end ?? 17 * 60,
      breakMin: template?.breakMin ?? 45,
      color: template?.color ?? PALETTE[data.templates.length % PALETTE.length],
    };
    const name = h('input', {
      type: 'text',
      id: 'tpl-name',
      maxlength: 20,
      autocomplete: 'off',
      placeholder: '例: 早番',
      value: template?.name ?? '',
    });
    const error = h('p', { class: 'error', role: 'alert' });
    return h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (e) => {
          e.preventDefault();
          if (!isValidTimes(draft)) {
            error.textContent = '終わりは始まりより後に、休憩は勤務時間より短くしてね';
            return;
          }
          actions.saveTemplate({ id: template?.id, name: name.value.trim(), ...draft });
          close();
        },
      },
      field('名前', name),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, '時間（25:00 = 翌1時）'),
        h(
          'div',
          { class: 'time-row' },
          timePicker({ id: 'tpl-start', label: '始まり', value: draft.start, hours: START_HOURS, onchange: (v) => (draft.start = v) }),
          h('span', {}, '〜'),
          timePicker({ id: 'tpl-end', label: '終わり', value: draft.end, hours: END_HOURS, onchange: (v) => (draft.end = v) }),
        ),
      ),
      field('休憩', breakSelect({ id: 'tpl-break', value: draft.breakMin, onchange: (v) => (draft.breakMin = v) })),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, '色'),
        swatchPicker(draft.color, (c) => (draft.color = c)),
      ),
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        template &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn danger',
              onclick: () => {
                if (actions.deleteTemplate(template.id)) close();
              },
            },
            '削除',
          ),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'キャンセル'),
        h('button', { type: 'submit', class: 'btn primary' }, '保存'),
      ),
    );
  });
}

function displaySection(data, actions) {
  const { y, m } = parseMonthKey(currentMonthKey());
  return section(
    '表示',
    null,
    h(
      'div',
      { class: 'list' },
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'set-week' }, '週の始まり'),
        h(
          'select',
          {
            id: 'set-week',
            value: String(data.settings.weekStartsOn),
            onchange: (e) => actions.setSetting('weekStartsOn', Number(e.target.value)),
          },
          h('option', { value: '0' }, '日曜日'),
          h('option', { value: '1' }, '月曜日'),
        ),
      ),
      h(
        'div',
        { class: 'list-item' },
        h('label', { class: 'grow', for: 'set-format' }, '一覧の日付の書き方'),
        h(
          'select',
          { id: 'set-format', value: data.settings.dateFormat, onchange: (e) => actions.setSetting('dateFormat', e.target.value) },
          DATE_FORMATS.map((f) => h('option', { value: f }, formatDay(y, m, 1, f))),
        ),
      ),
    ),
  );
}

function installSection() {
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  return section(
    'ホーム画面に追加（iPhone）',
    null,
    h(
      'div',
      { class: 'card' },
      standalone
        ? h('p', { class: 'summary-main ok' }, icon('check', 18), 'いまホーム画面のアプリとして開いている')
        : h(
            'ol',
            { class: 'steps' },
            h('li', {}, 'Safari でこのページを開く'),
            h('li', {}, '画面下の共有ボタン（四角から上向きの矢印が出ているアイコン）をタップ'),
            h('li', {}, '「ホーム画面に追加」をタップ'),
          ),
      h(
        'p',
        { class: 'hint install-note' },
        'Safari のままだと、しばらく開かないうちにデータが消えることがある。ホーム画面に追加したほうは消えにくい。' +
          'Safari とホーム画面版は保存場所が別なので、Safari で入れたデータは「バックアップ」で書き出して、ホーム画面版で読み込む',
      ),
    ),
  );
}

function backupSection(data, actions) {
  return section(
    'バックアップ',
    '機種変更やもしものときのために、ときどき書き出しておくと安心',
    h(
      'div',
      { class: 'toolbar' },
      h(
        'button',
        {
          class: 'btn',
          onclick: async () =>
            toast((await copyText(exportJson(data))) ? 'コピーした。メモアプリなどに貼っておいてね' : 'コピーできなかった'),
        },
        icon('copy', 18),
        '書き出してコピー',
      ),
      h('button', { class: 'btn', onclick: () => downloadText(`baito-cal2form-${todayYmd()}.json`, exportJson(data)) }, 'ファイルに保存'),
      h('button', { class: 'btn', onclick: () => importDialog(actions) }, '読み込む'),
    ),
  );
}

function importDialog(actions) {
  openDialog('バックアップを読み込む', (close) => {
    const area = h('textarea', { rows: 6, placeholder: '書き出した文字をここに貼り付け' });
    const error = h('p', { class: 'error', role: 'alert' });
    const file = h('input', {
      type: 'file',
      accept: '.json,application/json',
      onchange: async (e) => {
        const f = e.target.files?.[0];
        if (f) area.value = await f.text();
      },
    });
    return h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (e) => {
          e.preventDefault();
          let imported;
          try {
            imported = importJson(area.value);
          } catch (err) {
            error.textContent = err.message;
            return;
          }
          if (!confirm('いまのデータを、読み込んだ内容で置き換える。いい？')) return;
          actions.replaceData(imported);
          close();
          toast('読み込んだ');
        },
      },
      area,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'またはファイルから'), file),
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'キャンセル'),
        h('button', { type: 'submit', class: 'btn primary' }, '読み込む'),
      ),
    );
  });
}
