/* =========================================================
   テンパズル（1日1問） script.js
   ステップ1：出題 → 式を組む → 答え合わせ
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */
const TARGET = 10;                      // 作る数
const FIRST_DAY = '2026-10-12';         // No.1 の日（日本時間）
const MS_PER_DAY = 24 * 60 * 60 * 1000; // 1日のミリ秒
const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // 日本時間は UTC より9時間進んでいる

// 演算子を画面に出すときの記号
const OP_LABELS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/* ---------------------------------------------------------
   日付（日本時間）
   --------------------------------------------------------- */

// 今の日本時間の日付を "2026-10-12" の形で返す
// （端末のタイムゾーンがどこでも、日本時間の日付になる）
function getJstDateString(now = new Date()) {
  // 9時間足した時刻を「UTCとして」読むと、日本時間の年月日になる
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
   ソルバー（その4つの数字で10が作れるか調べる）
   考え方：数字の中から2つ選んで1つにまとめる（＋−×÷）のを
   残り1つになるまで繰り返す。全パターンを試せば、
   並び替えやカッコの付け方もすべて調べたことになる。
   --------------------------------------------------------- */
function canMakeTarget(numbers) {
  return searchTarget(numbers.map((n) => frac(n)));
}

function searchTarget(list) {
  // 残り1つになったら、それが10かどうか
  if (list.length === 1) return equalsInt(list[0], TARGET);

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
        if (searchTarget([...rest, c])) return true;
      }
    }
  }
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

// その日の問題（1〜9の数字4つ）を作る
function generatePuzzle(dateString) {
  const random = createRandom(hashString(`tenpuzzle-${dateString}`));

  // 解ける組み合わせが出るまで作り直す
  for (let tries = 0; tries < 1000; tries++) {
    const numbers = [];
    for (let i = 0; i < 4; i++) {
      numbers.push(1 + Math.floor(random() * 9)); // 1〜9
    }
    if (canMakeTarget(numbers)) {
      return numbers.sort((a, b) => a - b); // 小さい順に並べて出題
    }
  }
  // 念のため（ここに来ることはまずない）
  return [1, 2, 3, 4];
}

/* ---------------------------------------------------------
   ゲームの状態
   --------------------------------------------------------- */
const state = {
  dateString: '',  // 今日の日付（日本時間）
  numbers: [],     // 今日の4つの数字
  // 組み立て中の式。1つ1つを「トークン」として配列に入れる
  //   数字   { type: 'num', value: 8, index: 0 }（index は何番目のカードか）
  //   演算子 { type: 'op', value: '+' }
  //   カッコ { type: 'lparen' } / { type: 'rparen' }
  tokens: [],
  attempts: 0,     // 答え合わせをした回数
  history: [],     // 各回の結果（true=正解 / false=不正解）。シェアで使う
  solved: false,   // 今日の問題をクリアしたか
};

/* ---------------------------------------------------------
   入力のルール（今その位置に置けるボタンかどうか）
   --------------------------------------------------------- */
function lastToken() {
  return state.tokens[state.tokens.length - 1];
}

// まだ閉じていない「(」の数
function openParenCount() {
  let count = 0;
  for (const t of state.tokens) {
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
  return state.tokens.some((t) => t.type === 'num' && t.index === index);
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
  el.puzzleInfo = document.getElementById('puzzle-info');
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
  el.confetti = document.getElementById('confetti');
  el.numberButtons = [];
}

/* ---------------------------------------------------------
   操作
   --------------------------------------------------------- */
function addToken(token) {
  if (state.solved) return;
  state.tokens.push(token);
  clearResult(); // 式を変えたら前回の結果表示は消す
  render();
}

function undo() {
  state.tokens.pop();
  clearResult();
  render();
}

function clearAll() {
  state.tokens = [];
  clearResult();
  render();
}

function checkAnswer() {
  if (state.solved) return;

  // 4つの数字を全部使っているか
  const usedCount = state.tokens.filter((t) => t.type === 'num').length;
  if (usedCount < state.numbers.length) {
    showMessage('4つの数字をすべて使ってください', 'hint');
    return;
  }

  // 計算する（カッコの閉じ忘れや 0 で割った場合はここでエラー）
  let result;
  try {
    result = evaluateTokens(state.tokens);
  } catch (error) {
    showMessage(error.message, 'hint');
    return;
  }

  // ちゃんと計算できた式だけを「挑戦1回」として数える
  state.attempts++;
  const isCorrect = equalsInt(result, TARGET);
  state.history.push(isCorrect);

  if (isCorrect) {
    state.solved = true;
    showMessage(`🎉 正解！ ${state.attempts}回目でクリア`, 'correct');
    flashBox('is-correct');
    launchConfetti();
  } else {
    // 割り切れないときは小数の目安も出す（判定は分数なので正確）
    let text = `= ${formatFraction(result)}`;
    if (result.d !== 1) text += `（約${(result.n / result.d).toFixed(2)}）`;
    showMessage(`${text}　おしい！もう一度`, 'wrong');
    flashBox('is-wrong');
  }
  render();
}

/* ---------------------------------------------------------
   表示
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
  if (!state.solved) el.expressionBox.classList.remove('is-wrong');
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

// 状態に合わせて画面全体を更新する
function render() {
  // 式の表示
  if (state.tokens.length === 0) {
    el.expression.textContent = '数字と記号をタップして式を作ろう';
    el.expression.classList.add('is-empty');
  } else {
    el.expression.textContent = tokensToText(state.tokens);
    el.expression.classList.remove('is-empty');
  }

  // 数字カード：使ったものは薄く、置けないときは押せなくする
  el.numberButtons.forEach((button, index) => {
    button.classList.toggle('is-used', isNumberUsed(index));
    button.disabled = state.solved || !canAddNumber(index);
  });

  // 演算子・カッコ
  el.opButtons.forEach((button) => {
    button.disabled = state.solved || !canAddOperator();
  });
  el.leftParen.disabled = state.solved || !canAddLeftParen();
  el.rightParen.disabled = state.solved || !canAddRightParen();

  // 編集ボタン・答え合わせ
  const isEmpty = state.tokens.length === 0;
  el.undoBtn.disabled = state.solved || isEmpty;
  el.clearBtn.disabled = state.solved || isEmpty;
  el.checkBtn.disabled = state.solved || isEmpty;

  // 挑戦回数
  el.attempts.textContent = state.attempts > 0 ? `挑戦回数：${state.attempts}回` : '';
}

/* ---------------------------------------------------------
   はじめに1回だけ動く処理
   --------------------------------------------------------- */
function init() {
  cacheElements();

  // 今日の問題を作る
  state.dateString = getJstDateString();
  state.numbers = generatePuzzle(state.dateString);

  const number = getPuzzleNumber(state.dateString);
  el.puzzleInfo.textContent = `No.${number}　${state.dateString.replace(/-/g, '/')}`;

  // 数字カードを作る
  state.numbers.forEach((value, index) => {
    const button = document.createElement('button');
    button.className = 'num-card';
    button.textContent = value;
    button.addEventListener('click', () => {
      addToken({ type: 'num', value, index });
    });
    el.numbers.appendChild(button);
    el.numberButtons.push(button);
  });

  // 演算子ボタン
  el.opButtons.forEach((button) => {
    button.addEventListener('click', () => {
      addToken({ type: 'op', value: button.dataset.op });
    });
  });

  // カッコ・編集・答え合わせ
  el.leftParen.addEventListener('click', () => addToken({ type: 'lparen' }));
  el.rightParen.addEventListener('click', () => addToken({ type: 'rparen' }));
  el.undoBtn.addEventListener('click', undo);
  el.clearBtn.addEventListener('click', clearAll);
  el.checkBtn.addEventListener('click', checkAnswer);

  render();
}

// HTMLの準備ができたら開始
document.addEventListener('DOMContentLoaded', init);
