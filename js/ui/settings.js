// 設定画面

import { DATE_FORMATS, WEEKDAYS, currentMonthKey, formatDay, parseMonthKey, todayYmd, weekdayOrder } from '../dates.js';
import { PALETTE, defaultData, exportJson, importJson } from '../store.js';
import { copyText, downloadText, notice, openDialog, toast } from './common.js';
import { chip, h, icon, weekdayClass } from './dom.js';

export function renderSettings({ state, actions }) {
  const { data } = state;
  return h(
    'div',
    { class: 'view-settings' },
    notice(state, actions),
    h('h1', { class: 'page-title' }, '設定'),
    optionsSection(data, actions),
    patternSection(data, actions),
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
            if (!confirm('選択肢・入力・メモなど、全部のデータを消して最初の状態に戻す。元に戻せないけどいい？')) return;
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
      h(
        'div',
        { class: 'move-btns' },
        h(
          'button',
          { class: 'mini-btn', 'aria-label': `${o.label}を上へ`, disabled: i === 0, onclick: () => actions.moveOption(o.id, -1) },
          icon('up', 18),
        ),
        h(
          'button',
          {
            class: 'mini-btn',
            'aria-label': `${o.label}を下へ`,
            disabled: i === data.options.length - 1,
            onclick: () => actions.moveOption(o.id, 1),
          },
          icon('down', 18),
        ),
      ),
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
    const swatches = h(
      'div',
      { class: 'swatches', role: 'radiogroup', 'aria-label': '色' },
      PALETTE.map((c) =>
        h('button', {
          type: 'button',
          class: 'swatch',
          role: 'radio',
          'aria-checked': String(c === color),
          'aria-label': c,
          style: { background: c },
          onclick: (e) => {
            color = c;
            for (const s of swatches.children) s.setAttribute('aria-checked', String(s === e.currentTarget));
          },
        }),
      ),
    );
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
