/* =========================================================
   数字パズル script.js
   ・今日の100パズル（6つの数字で100を作る／毎日更新）
   ・テンパズル（4つの数字で10を作る／全30ステージ）
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */
const FIRST_DAY = '2026-10-13';           // 100パズル No.1 の日（日本時間）
const MS_PER_DAY = 24 * 60 * 60 * 1000;   // 1日のミリ秒
const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // 日本時間は UTC より9時間進んでいる

const DAILY_COUNT = 6;    // 100パズルで使う数字の数
const DAILY_TARGET = 100; // 100パズルで作る数
const STAGE_TARGET = 10;  // テンパズルで作る数

// localStorage に保存するときの名前
const STORAGE_KEYS = {
  daily: 'numpuzzle.daily',   // 今日の100パズルの進み具合
  streak: 'numpuzzle.streak', // 連続正解日数
  stages: 'numpuzzle.stages', // テンパズルのクリア状況
};

// 演算子を画面に出すときの記号
const OP_LABELS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/* ---------------------------------------------------------
   テンパズルのステージ（やさしい順）
   右のコメントは答えの一例です。
   --------------------------------------------------------- */
const STAGES = [
  // ---- やさしい ----
  [1, 2, 3, 4], // 1  例：1+2+3+4
  [2, 2, 2, 4], // 2  例：2+2+2+4
  [1, 1, 3, 5], // 3  例：1+1+3+5
  [5, 5, 5, 5], // 4  例：5+5+5−5
  [2, 2, 7, 7], // 5  例：7+7−2−2
  [1, 2, 3, 9], // 6  例：9+3−2×1
  [2, 3, 4, 9], // 7  例：9−4+3+2
  [1, 3, 4, 8], // 8  例：8+4−3+1
  [3, 3, 8, 8], // 9  例：8+8−3−3
  [1, 1, 2, 5], // 10 例：2×5×1×1
  // ---- ふつう ----
  [1, 2, 5, 7], // 11 例：(7+5−2)×1
  [1, 4, 6, 9], // 12 例：9−1+6−4
  [1, 5, 6, 7], // 13 例：(7−5)×(6−1)
  [4, 6, 8, 9], // 14 例：(9−8)×(6+4)
  [1, 6, 6, 8], // 15 例：(8−6)×(6−1)
  [1, 4, 5, 6], // 16 例：5×(6−4)×1
  [1, 2, 5, 9], // 17 例：(9−5+1)×2
  [3, 4, 6, 8], // 18 例：3×4−8+6
  [3, 3, 9, 9], // 19 例：3×3+9÷9
  [2, 3, 5, 8], // 20 例：5×(8−3×2)
  // ---- むずかしい ----
  [2, 2, 5, 6], // 21 例：5×(6−2×2)
  [2, 4, 8, 8], // 22 例：(8÷8+4)×2
  [2, 3, 4, 4], // 23 例：4×3−4÷2
  [2, 4, 6, 7], // 24 例：4×6−7×2
  [9, 9, 9, 9], // 25 例：(9×9+9)÷9
  // ---- 超むずかしい（分数を使う） ----
  [1, 2, 5, 6], // 26 例：6÷(1−2÷5)
  [1, 3, 3, 7], // 27 例：(1+7÷3)×3
  [1, 1, 9, 9], // 28 例：(1+1÷9)×9
  [3, 4, 7, 8], // 29 例：(3−7÷4)×8
  [1, 1, 5, 8], // 30 例：8÷(1−1÷5)
];

/* ---------------------------------------------------------
   日付（日本時間）
   --------------------------------------------------------- */

// 今の日本時間の日付を "2026-10-13" の形で返す
// （端末のタイムゾーンがどこでも、日本時間の日付になる）
function getJstDateString(now = new Date()) {
  // 9時間足した時刻を「UTCとして」読むと、日本時間の年月日になる
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 日付の文字列を days 日ずらす（-1 なら前の日）
function addDays(dateString, days) {
  const time = Date.parse(dateString) + days * MS_PER_DAY;
  return new Date(time).toISOString().slice(0, 10);
}

// 問題番号（FIRST_DAY を No.1 として、何日目か）
function getPuzzleNumber(dateString) {
  const diff = Date.parse(dateString) - Date.parse(FIRST_DAY);
  return Math.round(diff / MS_PER_DAY) + 1;
}

/* ---------------------------------------------------------
   分数の計算
   小数を使うと 8 ÷ 3 × 3 が 9.999999… になることがあるので、
   すべての数を「分子 n / 分母 d」の分数で扱う。
   --------------------------------------------------------- */

// 最大公約数（約分に使う）
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

// 分数を作る（自動で約分し、分母は必ずプラスにする）
function frac(n, d = 1) {
  if (d === 0) throw new Error('0で割ることはできません');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

// 分数の四則演算
function add(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }
function div(a, b) {
  if (b.n === 0) throw new Error('0で割ることはできません');
  return frac(a.n * b.d, a.d * b.n);
}

// 分数がちょうど整数 value と等しいか
function equalsInt(f, value) {
  return f.d === 1 && f.n === value;
}

// 分数を画面用の文字にする（例：10、8/3）
function formatFraction(f) {
  if (f.d === 1) return String(f.n);
  return `${f.n}/${f.d}`;
}

/* ---------------------------------------------------------
   ソルバー（その数字で target が作れるか調べる）
   考え方：数字の中から2つ選んで1つにまとめる（＋−×÷）のを
   残り1つになるまで繰り返す。全パターンを試せば、
   並び替えやカッコの付け方もすべて調べたことになる。
   数字が6つだとパターンが多いので、一度「ダメ」とわかった
   組み合わせはメモしておき、同じ計算をくり返さないようにする。
   --------------------------------------------------------- */
function canMakeTarget(numbers, target) {
  return searchTarget(numbers.map((n) => frac(n)), target, new Set());
}

function searchTarget(list, target, failed) {
  // 残り1つになったら、それが target かどうか
  if (list.length === 1) return equalsInt(list[0], target);

  // 同じ数の組み合わせを前に調べてダメだったなら、すぐ終わる
  const key = list.map((f) => `${f.n}/${f.d}`).sort().join(',');
  if (failed.has(key)) return false;

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      // 選ばなかった残りの数
      const rest = list.filter((_, k) => k !== i && k !== j);

      // a と b から作れる数（引き算・割り算は順番を逆にしたものも試す）
      const candidates = [add(a, b), sub(a, b), sub(b, a), mul(a, b)];
      if (b.n !== 0) candidates.push(div(a, b));
      if (a.n !== 0) candidates.push(div(b, a));

      for (const c of candidates) {
        if (searchTarget([...rest, c], target, failed)) return true;
      }
    }
  }

  failed.add(key);
  return false;
}

/* ---------------------------------------------------------
   出題（日付から毎日同じ問題を作る）
   --------------------------------------------------------- */

// 文字列から数値（シード）を作る（FNV-1a というハッシュ）
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// シード付きの乱数（同じシードなら、いつでも同じ乱数の並びになる）
// Mulberry32 という小さな乱数アルゴリズム
function createRandom(seed) {
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 0以上1未満
  };
}

// その日の100パズル（1〜9の数字6つ）を作る
function generateDailyPuzzle(dateString) {
  const random = createRandom(hashString(`hundred-${dateString}`));

  // 解ける組み合わせが出るまで作り直す
  for (let tries = 0; tries < 1000; tries++) {
    const numbers = [];
    for (let i = 0; i < DAILY_COUNT; i++) {
      numbers.push(1 + Math.floor(random() * 9)); // 1〜9
    }
    if (canMakeTarget(numbers, DAILY_TARGET)) {
      return numbers.sort((a, b) => a - b); // 小さい順に並べて出題
    }
  }
  // 念のため（ここに来ることはまずない）
  return [1, 2, 3, 4, 5, 9];
}

/* ---------------------------------------------------------
   保存（localStorage）
   プライベートモードなどで使えないこともあるので、
   失敗してもゲームは止まらないようにしておく。
   --------------------------------------------------------- */
function loadData(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 保存できなくても遊べるので何もしない
  }
}

// 今日の100パズルの進み具合（日付が変わっていたら新しく始める）
function loadDailyProgress(today) {
  const saved = loadData(STORAGE_KEYS.daily, null);
  if (saved && saved.date === today) return saved;
  return { date: today, attempts: 0, history: [], solved: false, answer: '' };
}

function saveDailyProgress() {
  saveData(STORAGE_KEYS.daily, {
    date: game.dateString,
    attempts: game.attempts,
    history: game.history,
    solved: game.solved,
    answer: game.answerText,
  });
}

// 今の連続正解日数（昨日も今日も解いていなければ 0 に戻る）
function getCurrentStreak(today) {
  const streak = loadData(STORAGE_KEYS.streak, { count: 0, lastDate: '' });
  if (streak.lastDate === today || streak.lastDate === addDays(today, -1)) {
    return streak.count;
  }
  return 0;
}

// 今日の100パズルを解いたときに連続正解日数を更新する
function updateStreak(today) {
  const streak = loadData(STORAGE_KEYS.streak, { count: 0, lastDate: '' });
  if (streak.lastDate === today) return; // 今日の分は記録済み
  streak.count = streak.lastDate === addDays(today, -1) ? streak.count + 1 : 1;
  streak.lastDate = today;
  saveData(STORAGE_KEYS.streak, streak);
}

// テンパズルのクリア状況 { cleared: { ステージ番号: クリアした挑戦回数 } }
function loadStageProgress() {
  return loadData(STORAGE_KEYS.stages, { cleared: {} });
}

function isStageUnlocked(id, progress = loadStageProgress()) {
  // ステージ1は最初から。それ以外は1つ前をクリアしていれば遊べる
  return id === 1 || Boolean(progress.cleared[id - 1]);
}

function markStageCleared(id, attempts) {
  const progress = loadStageProgress();
  const best = progress.cleared[id];
  // 前より少ない回数でクリアしたら記録を更新
  if (!best || attempts < best) progress.cleared[id] = attempts;
  saveData(STORAGE_KEYS.stages, progress);
}

/* ---------------------------------------------------------
   ゲームの状態（100パズル・テンパズル共通）
   --------------------------------------------------------- */
const game = {
  mode: '',        // 'daily'（100パズル）か 'stage'（テンパズル）
  stageId: 0,      // テンパズルのステージ番号
  dateString: '',  // 100パズルの日付
  target: 10,      // 作る数
  numbers: [],     // 使う数字
  // 組み立て中の式。1つ1つを「トークン」として配列に入れる
  //   数字   { type: 'num', value: 8, index: 0 }（index は何番目のカードか）
  //   演算子 { type: 'op', value: '+' }
  //   カッコ { type: 'lparen' } / { type: 'rparen' }
  tokens: [],
  attempts: 0,     // 答え合わせをした回数
  history: [],     // 各回の結果（true=正解 / false=不正解）。シェアで使う
  solved: false,   // クリアしたか
  answerText: '',  // 正解した式（100パズルで再表示する用）
};

/* ---------------------------------------------------------
   入力のルール（今その位置に置けるボタンかどうか）
   --------------------------------------------------------- */
function lastToken() {
  return game.tokens[game.tokens.length - 1];
}

// まだ閉じていない「(」の数
function openParenCount() {
  let count = 0;
  for (const t of game.tokens) {
    if (t.type === 'lparen') count++;
    if (t.type === 'rparen') count--;
  }
  return count;
}

// 「数の始まり」を置ける位置か（最初・演算子の後・「(」の後）
function canStartValue() {
  const last = lastToken();
  return !last || last.type === 'op' || last.type === 'lparen';
}

// 「数の終わり」の直後か（数字の後・「)」の後）
function isAfterValue() {
  const last = lastToken();
  return !!last && (last.type === 'num' || last.type === 'rparen');
}

function isNumberUsed(index) {
  return game.tokens.some((t) => t.type === 'num' && t.index === index);
}

function canAddNumber(index) {
  return canStartValue() && !isNumberUsed(index);
}
function canAddOperator() {
  return isAfterValue();
}
function canAddLeftParen() {
  return canStartValue();
}
function canAddRightParen() {
  return isAfterValue() && openParenCount() > 0;
}

/* ---------------------------------------------------------
   式の計算（トークンの並びを読んで分数で計算する）
   ×÷ を ＋− より先に計算し、カッコの中を最優先にする。
     式   = 項 （＋ か − 項）の繰り返し
     項   = 因子（× か ÷ 因子）の繰り返し
     因子 = 数字 または「( 式 )」
   --------------------------------------------------------- */
function evaluateTokens(tokens) {
  let pos = 0; // 今読んでいる位置

  function peek() {
    return tokens[pos];
  }

  function isOp(token, ops) {
    return token && token.type === 'op' && ops.includes(token.value);
  }

  function parseExpression() {
    let value = parseTerm();
    while (isOp(peek(), ['+', '-'])) {
      const op = tokens[pos++].value;
      const right = parseTerm();
      value = op === '+' ? add(value, right) : sub(value, right);
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (isOp(peek(), ['*', '/'])) {
      const op = tokens[pos++].value;
      const right = parseFactor();
      value = op === '*' ? mul(value, right) : div(value, right);
    }
    return value;
  }

  function parseFactor() {
    const token = tokens[pos];
    if (!token) throw new Error('式が途中で終わっています');

    if (token.type === 'num') {
      pos++;
      return frac(token.value);
    }
    if (token.type === 'lparen') {
      pos++;
      const value = parseExpression();
      if (!peek() || peek().type !== 'rparen') {
        throw new Error('カッコが閉じていません');
      }
      pos++;
      return value;
    }
    throw new Error('式の形が正しくありません');
  }

  const result = parseExpression();
  if (pos < tokens.length) throw new Error('式の形が正しくありません');
  return result;
}

/* ---------------------------------------------------------
   画面の部品を取得
   --------------------------------------------------------- */
const el = {};

function cacheElements() {
  el.screens = {
    home: document.getElementById('screen-home'),
    stages: document.getElementById('screen-stages'),
    game: document.getElementById('screen-game'),
  };
  // トップ
  el.dailyDesc = document.getElementById('daily-desc');
  el.stagesDesc = document.getElementById('stages-desc');
  el.streak = document.getElementById('streak');
  // ステージ選択
  el.stageProgress = document.getElementById('stage-progress');
  el.stageGrid = document.getElementById('stage-grid');
  // ゲーム
  el.gameBack = document.getElementById('game-back');
  el.gameTitle = document.getElementById('game-title');
  el.puzzleInfo = document.getElementById('puzzle-info');
  el.gameLead = document.getElementById('game-lead');
  el.numbers = document.getElementById('numbers');
  el.expressionBox = document.getElementById('expression-box');
  el.expression = document.getElementById('expression');
  el.opButtons = document.querySelectorAll('[data-op]');
  el.leftParen = document.querySelector('[data-paren="("]');
  el.rightParen = document.querySelector('[data-paren=")"]');
  el.undoBtn = document.getElementById('undo-btn');
  el.clearBtn = document.getElementById('clear-btn');
  el.checkBtn = document.getElementById('check-btn');
  el.message = document.getElementById('message');
  el.attempts = document.getElementById('attempts');
  el.afterClear = document.getElementById('after-clear');
  el.confetti = document.getElementById('confetti');
  el.numberButtons = [];
}

// 指定した画面だけを表示する
function showScreen(name) {
  for (const key in el.screens) {
    el.screens[key].hidden = key !== name;
  }
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------
   トップ画面
   --------------------------------------------------------- */
function showHome() {
  const today = getJstDateString();

  // 100パズル：今日クリア済みかどうか
  const daily = loadDailyProgress(today);
  el.dailyDesc.textContent = daily.solved
    ? `No.${getPuzzleNumber(today)} クリア済み ✓（${daily.attempts}回目で正解）`
    : `No.${getPuzzleNumber(today)}・6つの数字で100を作る`;

  // テンパズル：クリアしたステージ数
  const clearedCount = Object.keys(loadStageProgress().cleared).length;
  el.stagesDesc.textContent = `4つの数字で10を作る・クリア ${clearedCount} / ${STAGES.length}`;

  // 連続正解日数
  const streak = getCurrentStreak(today);
  el.streak.textContent = streak > 0 ? `🔥 100パズル ${streak}日連続正解中` : '';

  showScreen('home');
}

/* ---------------------------------------------------------
   ステージ選択画面
   --------------------------------------------------------- */
function showStageList() {
  const progress = loadStageProgress();
  el.stageGrid.innerHTML = '';
  let clearedCount = 0;

  STAGES.forEach((_, i) => {
    const id = i + 1;
    const cleared = Boolean(progress.cleared[id]);
    const unlocked = isStageUnlocked(id, progress);
    if (cleared) clearedCount++;

    // 遊べるステージはリンク、まだのステージはただの箱
    const cell = document.createElement(unlocked ? 'a' : 'span');
    cell.className = 'stage-cell';
    if (cleared) cell.classList.add('is-cleared');
    if (unlocked) {
      cell.href = `#/stage/${id}`;
      cell.textContent = id;
    } else {
      cell.classList.add('is-locked');
      cell.textContent = '🔒';
    }
    if (cleared) {
      const mark = document.createElement('span');
      mark.className = 'stage-mark';
      mark.textContent = '★';
      cell.appendChild(mark);
    }
    el.stageGrid.appendChild(cell);
  });

  el.stageProgress.textContent = `クリア ${clearedCount} / ${STAGES.length}`;
  showScreen('stages');
}

/* ---------------------------------------------------------
   ゲームを始める
   --------------------------------------------------------- */

// 100パズル・テンパズル共通の準備
function setupGame(config) {
  Object.assign(game, {
    tokens: [],
    attempts: 0,
    history: [],
    solved: false,
    answerText: '',
  }, config);

  // 説明文（例：6つの数字を全部使って 100 を作ろう）
  el.gameLead.innerHTML =
    `${game.numbers.length}つの数字を全部使って <strong>${game.target}</strong> を作ろう`;

  // 数字カードを作り直す
  el.numbers.innerHTML = '';
  el.numbers.className = `numbers count-${game.numbers.length}`;
  el.numberButtons = game.numbers.map((value, index) => {
    const button = document.createElement('button');
    button.className = 'num-card';
    button.textContent = value;
    button.addEventListener('click', () => {
      addToken({ type: 'num', value, index });
    });
    el.numbers.appendChild(button);
    return button;
  });

  // 前回の結果表示を消す
  el.expressionBox.classList.remove('is-correct', 'is-wrong');
  clearResult();
}

// 今日の100パズル
function startDaily() {
  const today = getJstDateString();
  const progress = loadDailyProgress(today);

  setupGame({
    mode: 'daily',
    stageId: 0,
    dateString: today,
    target: DAILY_TARGET,
    numbers: generateDailyPuzzle(today),
    attempts: progress.attempts,
    history: progress.history,
    solved: progress.solved,
    answerText: progress.answer,
  });

  el.gameTitle.textContent = '今日の100パズル';
  el.puzzleInfo.textContent = `No.${getPuzzleNumber(today)}　${today.replace(/-/g, '/')}`;
  el.gameBack.href = '#/';

  // もうクリアしていたら、その結果を表示する
  if (game.solved) {
    showMessage(`クリア済み！ ${game.attempts}回目で正解`, 'correct');
    el.expressionBox.classList.add('is-correct');
  }

  showScreen('game');
  renderGame();
}

// テンパズルのステージ
function startStage(id) {
  setupGame({
    mode: 'stage',
    stageId: id,
    dateString: '',
    target: STAGE_TARGET,
    numbers: STAGES[id - 1],
  });

  el.gameTitle.textContent = `テンパズル ステージ${id}`;
  const best = loadStageProgress().cleared[id];
  el.puzzleInfo.textContent = best ? `★ クリア済み（最高 ${best}回目で正解）` : `全${STAGES.length}ステージ`;
  el.gameBack.href = '#/stages';

  showScreen('game');
  renderGame();
}

/* ---------------------------------------------------------
   ゲーム中の操作
   --------------------------------------------------------- */
function addToken(token) {
  if (game.solved) return;
  game.tokens.push(token);
  clearResult(); // 式を変えたら前回の結果表示は消す
  renderGame();
}

function undo() {
  game.tokens.pop();
  clearResult();
  renderGame();
}

function clearAll() {
  game.tokens = [];
  clearResult();
  renderGame();
}

function checkAnswer() {
  if (game.solved) return;

  // 数字を全部使っているか
  const usedCount = game.tokens.filter((t) => t.type === 'num').length;
  if (usedCount < game.numbers.length) {
    showMessage(`${game.numbers.length}つの数字をすべて使ってください`, 'hint');
    return;
  }

  // 計算する（カッコの閉じ忘れや 0 で割った場合はここでエラー）
  let result;
  try {
    result = evaluateTokens(game.tokens);
  } catch (error) {
    showMessage(error.message, 'hint');
    return;
  }

  // ちゃんと計算できた式だけを「挑戦1回」として数える
  game.attempts++;
  const isCorrect = equalsInt(result, game.target);
  game.history.push(isCorrect);

  if (isCorrect) {
    game.solved = true;
    game.answerText = tokensToText(game.tokens);
    showMessage(`🎉 正解！ ${game.attempts}回目でクリア`, 'correct');
    flashBox('is-correct');
    launchConfetti();

    if (game.mode === 'daily') {
      updateStreak(game.dateString);
    } else {
      markStageCleared(game.stageId, game.attempts);
    }
  } else {
    // 割り切れないときは小数の目安も出す（判定は分数なので正確）
    let text = `= ${formatFraction(result)}`;
    if (result.d !== 1) text += `（約${(result.n / result.d).toFixed(2)}）`;
    showMessage(`${text}　おしい！もう一度`, 'wrong');
    flashBox('is-wrong');
  }

  // 100パズルは途中経過も保存（ページを閉じても挑戦回数が残る）
  if (game.mode === 'daily') saveDailyProgress();

  renderGame();
}

/* ---------------------------------------------------------
   ゲーム画面の表示
   --------------------------------------------------------- */

// トークンの並びを「(8 ÷ 3) × 3」のような文字にする
function tokensToText(tokens) {
  return tokens
    .map((t) => {
      if (t.type === 'num') return String(t.value);
      if (t.type === 'op') return ` ${OP_LABELS[t.value]} `;
      if (t.type === 'lparen') return '(';
      return ')';
    })
    .join('')
    .trim();
}

function showMessage(text, kind) {
  el.message.textContent = text;
  el.message.className = `message is-${kind}`;
}

function clearResult() {
  el.message.textContent = '';
  el.message.className = 'message';
  // 正解後は枠の色を残す
  if (!game.solved) el.expressionBox.classList.remove('is-wrong');
}

// 式の枠を光らせる（同じクラスを付け直してアニメーションをもう一度動かす）
function flashBox(className) {
  el.expressionBox.classList.remove('is-correct', 'is-wrong');
  void el.expressionBox.offsetWidth; // ブラウザに再描画させる小技
  el.expressionBox.classList.add(className);
}

// 紙吹雪を降らせる
function launchConfetti() {
  const colors = ['#ff7a3d', '#3d6bff', '#2fb36b', '#ffc93d', '#e5484d'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    el.confetti.appendChild(piece);
    // アニメーションが終わったら消す
    setTimeout(() => piece.remove(), 2500);
  }
}

// クリア後に出すボタンを作る
function renderAfterClear() {
  el.afterClear.hidden = !game.solved;
  if (!game.solved) return;

  if (game.mode === 'daily') {
    el.afterClear.innerHTML =
      '<p class="attempts">次の問題は明日の0時（日本時間）に出ます</p>' +
      '<a class="link-btn is-primary" href="#/stages">テンパズルで遊ぶ</a>' +
      '<a class="link-btn" href="#/">トップへ</a>';
  } else if (game.stageId < STAGES.length) {
    el.afterClear.innerHTML =
      `<a class="link-btn is-primary" href="#/stage/${game.stageId + 1}">次のステージへ ▶</a>` +
      '<a class="link-btn" href="#/stages">ステージ一覧</a>';
  } else {
    el.afterClear.innerHTML =
      '<p class="message is-correct">🏆 全ステージクリア！</p>' +
      '<a class="link-btn" href="#/stages">ステージ一覧</a>';
  }
}

// 状態に合わせてゲーム画面を更新する
function renderGame() {
  // 式の表示（クリア済みで式が空なら、正解した式を出す）
  let text = tokensToText(game.tokens);
  if (!text && game.solved) text = game.answerText;

  if (!text) {
    el.expression.textContent = '数字と記号をタップして式を作ろう';
    el.expression.className = 'expression is-empty';
  } else {
    el.expression.textContent = text;
    el.expression.className = text.length > 16 ? 'expression is-long' : 'expression';
  }

  // 数字カード：使ったものは薄く、置けないときは押せなくする
  el.numberButtons.forEach((button, index) => {
    button.classList.toggle('is-used', isNumberUsed(index));
    button.disabled = game.solved || !canAddNumber(index);
  });

  // 演算子・カッコ
  el.opButtons.forEach((button) => {
    button.disabled = game.solved || !canAddOperator();
  });
  el.leftParen.disabled = game.solved || !canAddLeftParen();
  el.rightParen.disabled = game.solved || !canAddRightParen();

  // 編集ボタン・答え合わせ
  const isEmpty = game.tokens.length === 0;
  el.undoBtn.disabled = game.solved || isEmpty;
  el.clearBtn.disabled = game.solved || isEmpty;
  el.checkBtn.disabled = game.solved || isEmpty;

  // 挑戦回数
  el.attempts.textContent = game.attempts > 0 ? `挑戦回数：${game.attempts}回` : '';

  renderAfterClear();
}

/* ---------------------------------------------------------
   画面の切り替え（URLの # の部分で決める）
     #/          → トップ
     #/daily     → 今日の100パズル
     #/stages    → ステージ選択
     #/stage/5   → テンパズル ステージ5
   こうしておくと、スマホの「戻る」でも前の画面に戻れる。
   --------------------------------------------------------- */
function route() {
  const hash = location.hash;
  const stageMatch = hash.match(/^#\/stage\/(\d+)$/);

  if (hash === '#/daily') {
    startDaily();
  } else if (hash === '#/stages') {
    showStageList();
  } else if (stageMatch) {
    const id = Number(stageMatch[1]);
    // 存在しない・まだ遊べないステージは一覧に戻す
    if (id >= 1 && id <= STAGES.length && isStageUnlocked(id)) {
      startStage(id);
    } else {
      showStageList();
    }
  } else {
    showHome();
  }
}

/* ---------------------------------------------------------
   はじめに1回だけ動く処理
   --------------------------------------------------------- */
function init() {
  cacheElements();

  // 演算子・カッコ・編集・答え合わせのボタン（数字カードは setupGame で作る）
  el.opButtons.forEach((button) => {
    button.addEventListener('click', () => {
      addToken({ type: 'op', value: button.dataset.op });
    });
  });
  el.leftParen.addEventListener('click', () => addToken({ type: 'lparen' }));
  el.rightParen.addEventListener('click', () => addToken({ type: 'rparen' }));
  el.undoBtn.addEventListener('click', undo);
  el.clearBtn.addEventListener('click', clearAll);
  el.checkBtn.addEventListener('click', checkAnswer);

  // 念のため：ステージの問題が本当に解けるか確認（開発用。結果はコンソールに出る）
  STAGES.forEach((numbers, i) => {
    if (!canMakeTarget(numbers, STAGE_TARGET)) {
      console.error(`ステージ${i + 1} は解けない問題です`, numbers);
    }
  });

  window.addEventListener('hashchange', route);
  route();
}

// HTMLの準備ができたら開始
document.addEventListener('DOMContentLoaded', init);
