/* =========================================================
   数字パズル script.js
   ・今日の100パズル（6つの数字で100を作る／毎日更新）
   ・ステージ（いつでも遊べる・各30ステージ）
       テンパズル  ：4つの数字で10を作る
       100パズル   ：6つの数字で100を作る
       1000パズル  ：7つの数字で1000を作る
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */
const FIRST_DAY = '2026-10-13';           // 100パズル No.1 の日（日本時間）
const MS_PER_DAY = 24 * 60 * 60 * 1000;   // 1日のミリ秒
const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // 日本時間は UTC より9時間進んでいる

const DAILY_COUNT = 6;    // 今日の100パズルで使う数字の数
const DAILY_TARGET = 100; // 今日の100パズルで作る数

// localStorage に保存するときの名前（ステージのクリア状況は STAGE_SETS の中）
const STORAGE_KEYS = {
  daily: 'numpuzzle.daily',   // 今日の100パズルの進み具合
  streak: 'numpuzzle.streak', // 連続正解日数
};

// 演算子を画面に出すときの記号
const OP_LABELS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/* ---------------------------------------------------------
   テンパズルのステージ（やさしい順）
   右のコメントは答えの一例です。
   --------------------------------------------------------- */
const TEN_STAGES = [
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
   100パズル・1000パズルのステージ（やさしい順）
   数字が多くスマホで答えを探すと時間がかかるので、
   パソコンで前もって探した答えの一例（answer）を入れてある。
   answer は ＋−×÷ を + - * / で書いた式。
   --------------------------------------------------------- */
const HUNDRED_STAGES = [
  // ---- やさしい ----
  { numbers: [4, 5, 5, 5, 8, 8], answer: '5*8+4*5+5*8' }, // 1  例：5 × 8 + 4 × 5 + 5 × 8
  { numbers: [1, 2, 3, 4, 8, 9], answer: '3*4+8*(9+1*2)' }, // 2  例：3 × 4 + 8 × (9 + 1 × 2)
  { numbers: [2, 3, 6, 7, 8, 9], answer: '7+6*8+9*(2+3)' }, // 3  例：7 + 6 × 8 + 9 × (2 + 3)
  { numbers: [4, 5, 6, 6, 8, 9], answer: '8*(4+6)+9+5+6' }, // 4  例：8 × (4 + 6) + 9 + 5 + 6
  { numbers: [1, 2, 5, 8, 9, 9], answer: '8*9+1*2*(5+9)' }, // 5  例：8 × 9 + 1 × 2 × (5 + 9)
  { numbers: [4, 4, 5, 6, 6, 8], answer: '6+5*6+8*(4+4)' }, // 6  例：6 + 5 × 6 + 8 × (4 + 4)
  { numbers: [2, 4, 5, 5, 7, 7], answer: '5*7+5*(7+2+4)' }, // 7  例：5 × 7 + 5 × (7 + 2 + 4)
  { numbers: [3, 4, 5, 5, 6, 7], answer: '5*6+5*(7+3+4)' }, // 8  例：5 × 6 + 5 × (7 + 3 + 4)
  // ---- ふつう ----
  { numbers: [1, 4, 6, 7, 7, 9], answer: '7*9+7+6*(1+4)' }, // 9  例：7 × 9 + 7 + 6 × (1 + 4)
  { numbers: [2, 2, 6, 6, 7, 7], answer: '2*(2+6)+6*(7+7)' }, // 10 例：2 × (2 + 6) + 6 × (7 + 7)
  { numbers: [2, 3, 5, 6, 9, 9], answer: '9*9+2*5+3+6' }, // 11 例：9 × 9 + 2 × 5 + 3 + 6
  { numbers: [5, 5, 5, 6, 8, 8], answer: '8*8+5*5+5+6' }, // 12 例：8 × 8 + 5 × 5 + 5 + 6
  { numbers: [2, 4, 5, 7, 7, 7], answer: '2+4*7+5*(7+7)' }, // 13 例：2 + 4 × 7 + 5 × (7 + 7)
  { numbers: [2, 3, 3, 4, 9, 9], answer: '4+3*(2+3)+9*9' }, // 14 例：4 + 3 × (2 + 3) + 9 × 9
  { numbers: [5, 7, 8, 8, 8, 9], answer: '8*9+5+7+8+8' }, // 15 例：8 × 9 + 5 + 7 + 8 + 8
  { numbers: [2, 2, 2, 3, 7, 8], answer: '2+2+8*(7+2+3)' }, // 16 例：2 + 2 + 8 × (7 + 2 + 3)
  // ---- むずかしい（引き算が必要） ----
  { numbers: [3, 3, 5, 5, 8, 9], answer: '(5+5*9)*(8-(3+3))' }, // 17 例：(5 + 5 × 9) × (8 − (3 + 3))
  { numbers: [2, 2, 3, 3, 6, 6], answer: '(2+3)*(2+6*(6-3))' }, // 18 例：(2 + 3) × (2 + 6 × (6 − 3))
  { numbers: [1, 6, 7, 8, 8, 8], answer: '8+8+(7-1)*(6+8)' }, // 19 例：8 + 8 + (7 − 1) × (6 + 8)
  { numbers: [2, 3, 3, 3, 6, 9], answer: '3-2+3*(6+3*9)' }, // 20 例：3 − 2 + 3 × (6 + 3 × 9)
  { numbers: [1, 1, 2, 6, 6, 6], answer: '(6-1)*(6+2*(1+6))' }, // 21 例：(6 − 1) × (6 + 2 × (1 + 6))
  // ---- もっとむずかしい（割り算が必要） ----
  { numbers: [2, 7, 8, 8, 8, 9], answer: '(2+8)*(8+(7+9)/8)' }, // 22 例：(2 + 8) × (8 + (7 + 9) ÷ 8)
  { numbers: [3, 3, 6, 6, 9, 9], answer: '9*(6+6)-(9-3/3)' }, // 23 例：9 × (6 + 6) − (9 − 3 ÷ 3)
  { numbers: [7, 8, 8, 8, 9, 9], answer: '(9+8-7)*(9+8/8)' }, // 24 例：(9 + 8 − 7) × (9 + 8 ÷ 8)
  { numbers: [8, 8, 8, 9, 9, 9], answer: '(9+8/8)*(9+9-8)' }, // 25 例：(9 + 8 ÷ 8) × (9 + 9 − 8)
  { numbers: [1, 6, 6, 6, 7, 7], answer: '(6+6)/6*(1+7*7)' }, // 26 例：(6 + 6) ÷ 6 × (1 + 7 × 7)
  // ---- 超むずかしい（途中で分数が出る） ----
  { numbers: [1, 1, 2, 8, 8, 8], answer: '8*(8+(8+1*1)/2)' }, // 27 例：8 × (8 + (8 + 1 × 1) ÷ 2)
  { numbers: [1, 7, 8, 8, 8, 9], answer: '8*(8+9/(8-(7-1)))' }, // 28 例：8 × (8 + 9 ÷ (8 − (7 − 1)))
  { numbers: [1, 1, 7, 8, 8, 8], answer: '8*(8+8-7/(1+1))' }, // 29 例：8 × (8 + 8 − 7 ÷ (1 + 1))
  { numbers: [7, 7, 8, 8, 8, 9], answer: '8*(8+8-7/(9-7))' }, // 30 例：8 × (8 + 8 − 7 ÷ (9 − 7))
];

const THOUSAND_STAGES = [
  // ---- やさしい ----
  { numbers: [1, 5, 5, 5, 7, 7, 8], answer: '8*(1+5+7*(7+5+5))' }, // 1  例：8 × (1 + 5 + 7 × (7 + 5 + 5))
  { numbers: [1, 2, 2, 3, 4, 5, 5], answer: '5*1*2*(2+3)*4*5' }, // 2  例：5 × 1 × 2 × (2 + 3) × 4 × 5
  { numbers: [3, 5, 5, 7, 8, 8, 9], answer: '3+5+8*(7+9*(5+8))' }, // 3  例：3 + 5 + 8 × (7 + 9 × (5 + 8))
  { numbers: [1, 2, 2, 4, 5, 5, 6], answer: '5*5*(4+(1+2)*2*6)' }, // 4  例：5 × 5 × (4 + (1 + 2) × 2 × 6)
  { numbers: [1, 3, 5, 5, 6, 8, 8], answer: '(5+5)*(1+3+6*(8+8))' }, // 5  例：(5 + 5) × (1 + 3 + 6 × (8 + 8))
  { numbers: [2, 2, 4, 5, 5, 7, 8], answer: '5*(2+2+7*(8+4*5))' }, // 6  例：5 × (2 + 2 + 7 × (8 + 4 × 5))
  { numbers: [1, 4, 4, 5, 6, 8, 8], answer: '8*(1+4+8*(6+4+5))' }, // 7  例：8 × (1 + 4 + 8 × (6 + 4 + 5))
  { numbers: [1, 2, 2, 5, 8, 8, 9], answer: '8*(8+9*(1+2+2*5))' }, // 8  例：8 × (8 + 9 × (1 + 2 + 2 × 5))
  // ---- ふつう ----
  { numbers: [1, 4, 5, 6, 9, 9, 9], answer: '(4+6)*(1+9+5*(9+9))' }, // 9  例：(4 + 6) × (1 + 9 + 5 × (9 + 9))
  { numbers: [2, 4, 4, 7, 7, 8, 9], answer: '(8+7*(2+4))*(9+4+7)' }, // 10 例：(8 + 7 × (2 + 4)) × (9 + 4 + 7)
  { numbers: [1, 3, 7, 7, 8, 8, 9], answer: '8*(8*(7+7)+9+1+3)' }, // 11 例：8 × (8 × (7 + 7) + 9 + 1 + 3)
  { numbers: [1, 3, 3, 4, 7, 8, 9], answer: '(3+7)*(4+8*(9+1*3))' }, // 12 例：(3 + 7) × (4 + 8 × (9 + 1 × 3))
  { numbers: [1, 4, 4, 5, 5, 6, 7], answer: '4*(1+4+7*(5+5*6))' }, // 13 例：4 × (1 + 4 + 7 × (5 + 5 × 6))
  { numbers: [1, 1, 2, 4, 5, 6, 9], answer: '5*(4+6)*(1+1+2*9)' }, // 14 例：5 × (4 + 6) × (1 + 1 + 2 × 9)
  { numbers: [2, 3, 4, 4, 5, 6, 9], answer: '5*(4+6)*(2*4+3+9)' }, // 15 例：5 × (4 + 6) × (2 × 4 + 3 + 9)
  { numbers: [1, 5, 6, 7, 7, 8, 9], answer: '(1+7)*(6+7+8*(5+9))' }, // 16 例：(1 + 7) × (6 + 7 + 8 × (5 + 9))
  // ---- むずかしい（引き算が必要） ----
  { numbers: [3, 6, 6, 7, 9, 9, 9], answer: '7-6+9*(3+6*(9+9))' }, // 17 例：7 − 6 + 9 × (3 + 6 × (9 + 9))
  { numbers: [1, 3, 3, 5, 6, 6, 6], answer: '5*(3-1+6*(6*6-3))' }, // 18 例：5 × (3 − 1 + 6 × (6 × 6 − 3))
  { numbers: [1, 2, 2, 3, 3, 4, 7], answer: '2*4*(2*3*3*7-1)' }, // 19 例：2 × 4 × (2 × 3 × 3 × 7 − 1)
  { numbers: [2, 2, 2, 3, 3, 4, 7], answer: '(2+2)*(3*3*4*7-2)' }, // 20 例：(2 + 2) × (3 × 3 × 4 × 7 − 2)
  { numbers: [2, 3, 3, 3, 9, 9, 9], answer: '3-2+9*(3+9*(3+9))' }, // 21 例：3 − 2 + 9 × (3 + 9 × (3 + 9))
  // ---- もっとむずかしい（割り算が必要） ----
  { numbers: [3, 3, 3, 5, 5, 6, 6], answer: '5*5*(3+3/3+6*6)' }, // 22 例：5 × 5 × (3 + 3 ÷ 3 + 6 × 6)
  { numbers: [2, 2, 3, 3, 9, 9, 9], answer: '2/2+9*(3+9*(3+9))' }, // 23 例：2 ÷ 2 + 9 × (3 + 9 × (3 + 9))
  { numbers: [4, 4, 4, 7, 7, 7, 7], answer: '(4+4*4)*(7*7+7/7)' }, // 24 例：(4 + 4 × 4) × (7 × 7 + 7 ÷ 7)
  { numbers: [5, 5, 6, 6, 6, 6, 7], answer: '5*5*(6*7-(6+6)/6)' }, // 25 例：5 × 5 × (6 × 7 − (6 + 6) ÷ 6)
  { numbers: [2, 2, 6, 6, 6, 6, 9], answer: '(2+9*(6+6*6*6))/2' }, // 26 例：(2 + 9 × (6 + 6 × 6 × 6)) ÷ 2
  // ---- 超むずかしい（途中で分数が出る） ----
  { numbers: [6, 6, 6, 7, 9, 9, 9], answer: '(6+6)*(7/(9-6)+9*9)' }, // 27 例：(6 + 6) × (7 ÷ (9 − 6) + 9 × 9)
  { numbers: [2, 3, 3, 9, 9, 9, 9], answer: '(3+9)*((9-2)/3+9*9)' }, // 28 例：(3 + 9) × ((9 − 2) ÷ 3 + 9 × 9)
  { numbers: [5, 6, 6, 9, 9, 9, 9], answer: '(9*9-6)*(5+9-6/9)' }, // 29 例：(9 × 9 − 6) × (5 + 9 − 6 ÷ 9)
  { numbers: [6, 6, 6, 6, 7, 7, 9], answer: '(6+6)*(6*(7+7)-6/9)' }, // 30 例：(6 + 6) × (6 × (7 + 7) − 6 ÷ 9)
];

/* ---------------------------------------------------------
   ステージの種類
   新しい種類を増やすときは、ここに1つ足せばトップ画面にも出る。
   --------------------------------------------------------- */
const STAGE_SETS = {
  ten: {
    name: 'テンパズル',
    target: 10,
    color: 'blue',
    storageKey: 'numpuzzle.stages', // 以前からの保存名をそのまま使う
    // テンパズルは数字が4つで答えをすぐ探せるので、answer は持たない
    stages: TEN_STAGES.map((numbers) => ({ numbers, answer: '' })),
  },
  hundred: {
    name: '100パズル',
    target: 100,
    color: 'green',
    storageKey: 'numpuzzle.stages.hundred',
    stages: HUNDRED_STAGES,
  },
  thousand: {
    name: '1000パズル',
    target: 1000,
    color: 'purple',
    storageKey: 'numpuzzle.stages.thousand',
    stages: THOUSAND_STAGES,
  },
};

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
   ソルバー（その数字で target を作る式を探す）
   考え方：数字の中から2つ選んで1つにまとめる（＋−×÷）のを
   残り1つになるまで繰り返す。全パターンを試せば、
   並び替えやカッコの付け方もすべて調べたことになる。
   数字が6つだとパターンが多いので、一度「ダメ」とわかった
   組み合わせはメモしておき、同じ計算をくり返さないようにする。

   計算途中の値は次の形で持つ（ヒントと答えの表示に使う）
     value : 値（分数）
     text  : 式の文字（例：'(9 − 5 + 1) × 2'）
     prec  : 式のいちばん外側の計算の強さ（1=＋− / 2=×÷ / 3=数字だけ）
     steps : ここまでの計算の手順 [{ a, op, b, result }, …]
   --------------------------------------------------------- */

// 解けるかどうかだけ知りたいとき
function canMakeTarget(numbers, target) {
  return findSolution(numbers, target, true) !== null;
}

// 答えの式を1つ探す（見つからなければ null）
// まずは途中でマイナスにならない式を探し、なければマイナスありで探す
function solvePuzzle(numbers, target) {
  return findSolution(numbers, target, false) || findSolution(numbers, target, true);
}

function findSolution(numbers, target, allowNegative) {
  const items = numbers.map((n) => ({
    value: frac(n),
    text: String(n),
    prec: 3,
    steps: [],
  }));
  return searchSolution(items, target, new Set(), allowNegative);
}

// a と b を演算子 op でまとめたものを作る
function combine(a, op, b) {
  const calc = { '+': add, '-': sub, '*': mul, '/': div };
  const value = calc[op](a.value, b.value);

  // 計算の順番が変わらないよう、必要なところだけカッコを付ける
  const left = needsParen(a, op, 'left') ? `(${a.text})` : a.text;
  const right = needsParen(b, op, 'right') ? `(${b.text})` : b.text;

  return {
    value,
    text: `${left} ${OP_LABELS[op]} ${right}`,
    prec: op === '+' || op === '-' ? 1 : 2,
    steps: [...a.steps, ...b.steps, { a: a.value, op, b: b.value, result: value }],
  };
}

// カッコが必要か（例：(1 + 2) × 3 の左側、8 ÷ (2 × 2) の右側）
function needsParen(item, op, side) {
  if (op === '+') return false;
  if (op === '-') return side === 'right' && item.prec === 1;
  if (op === '*') return item.prec === 1;
  // 割り算：左は＋−のとき、右は数字以外のときにカッコ
  return side === 'left' ? item.prec === 1 : item.prec <= 2;
}

// a が b 以上か（分数どうしの比べ方）
function isGreaterOrEqual(a, b) {
  return a.n * b.d >= b.n * a.d;
}

function searchSolution(items, target, failed, allowNegative) {
  // 残り1つになったら、それが target かどうか
  if (items.length === 1) {
    return equalsInt(items[0].value, target) ? items[0] : null;
  }

  // 同じ数の組み合わせを前に調べてダメだったなら、すぐ終わる
  const key = items.map((it) => `${it.value.n}/${it.value.d}`).sort().join(',');
  if (failed.has(key)) return null;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // 選ばなかった残りの数
      const rest = items.filter((_, k) => k !== i && k !== j);

      // a と b から作れるもの（引き算・割り算は順番を逆にしたものも試す）
      const candidates = [combine(a, '+', b), combine(a, '*', b)];
      if (allowNegative || isGreaterOrEqual(a.value, b.value)) candidates.push(combine(a, '-', b));
      if (allowNegative || isGreaterOrEqual(b.value, a.value)) candidates.push(combine(b, '-', a));
      if (b.value.n !== 0) candidates.push(combine(a, '/', b));
      if (a.value.n !== 0) candidates.push(combine(b, '/', a));

      for (const c of candidates) {
        const found = searchSolution([...rest, c], target, failed, allowNegative);
        if (found) return found;
      }
    }
  }

  failed.add(key);
  return null;
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
  const empty = {
    date: today,
    attempts: 0,
    history: [],
    solved: false,
    answer: '',
    hintsShown: 0,      // 見たヒントの数
    answerShown: false, // 答えを見たか
  };
  const saved = loadData(STORAGE_KEYS.daily, null);
  // 古い形式で保存されていても足りない項目は empty で補う
  if (saved && saved.date === today) return { ...empty, ...saved };
  return empty;
}

function saveDailyProgress() {
  saveData(STORAGE_KEYS.daily, {
    date: game.dateString,
    attempts: game.attempts,
    history: game.history,
    solved: game.solved,
    answer: game.answerText,
    hintsShown: game.hintsShown,
    answerShown: game.answerShown,
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

// ステージのクリア状況（種類 setKey ごとに別々に保存）
//   cleared  : { ステージ番号: クリアした挑戦回数 }
//   revealed : { ステージ番号: true }（答えを見たステージ）
function loadStageProgress(setKey) {
  const key = STAGE_SETS[setKey].storageKey;
  return { cleared: {}, revealed: {}, ...loadData(key, {}) };
}

function saveStageProgress(setKey, progress) {
  saveData(STAGE_SETS[setKey].storageKey, progress);
}

// クリアしたか、答えを見たか（どちらでも次のステージが開く）
function isStageFinished(id, progress) {
  return Boolean(progress.cleared[id] || progress.revealed[id]);
}

function isStageUnlocked(id, progress) {
  // ステージ1は最初から。それ以外は1つ前を終えていれば遊べる
  return id === 1 || isStageFinished(id - 1, progress);
}

function markStageRevealed(setKey, id) {
  const progress = loadStageProgress(setKey);
  progress.revealed[id] = true;
  saveStageProgress(setKey, progress);
}

function markStageCleared(setKey, id, attempts) {
  const progress = loadStageProgress(setKey);
  const best = progress.cleared[id];
  // 前より少ない回数でクリアしたら記録を更新
  if (!best || attempts < best) progress.cleared[id] = attempts;
  saveStageProgress(setKey, progress);
}

/* ---------------------------------------------------------
   ゲームの状態（100パズル・テンパズル共通）
   --------------------------------------------------------- */
const game = {
  mode: '',        // 'daily'（今日の100パズル）か 'stage'（ステージ）
  setKey: '',      // ステージの種類（'ten' / 'hundred' / 'thousand'）
  stageId: 0,      // ステージ番号
  stageAnswer: '', // ステージに入っている答えの例（なければ空）
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
  hintsShown: 0,      // 見たヒントの数
  answerShown: false, // 答えを見たか（見たらその問題は終了）
  solution: null,     // ソルバーが見つけた答え（ヒントを押したときに作る）
};

// クリアしたか答えを見たかで、もう入力できない状態か
function isFinished() {
  return game.solved || game.answerShown;
}

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
   計算はソルバーと同じ combine() で行うので、
   値だけでなく「式の文字」と「計算の手順」も一緒にできあがる。
   --------------------------------------------------------- */
function parseTokens(tokens) {
  let pos = 0; // 今読んでいる位置

  function peek() {
    return tokens[pos];
  }

  function isOp(token, ops) {
    return token && token.type === 'op' && ops.includes(token.value);
  }

  function parseExpression() {
    let item = parseTerm();
    while (isOp(peek(), ['+', '-'])) {
      const op = tokens[pos++].value;
      item = combine(item, op, parseTerm());
    }
    return item;
  }

  function parseTerm() {
    let item = parseFactor();
    while (isOp(peek(), ['*', '/'])) {
      const op = tokens[pos++].value;
      item = combine(item, op, parseFactor());
    }
    return item;
  }

  function parseFactor() {
    const token = tokens[pos];
    if (!token) throw new Error('式が途中で終わっています');

    if (token.type === 'num') {
      pos++;
      return { value: frac(token.value), text: String(token.value), prec: 3, steps: [] };
    }
    if (token.type === 'lparen') {
      pos++;
      const item = parseExpression();
      if (!peek() || peek().type !== 'rparen') {
        throw new Error('カッコが閉じていません');
      }
      pos++;
      return item;
    }
    throw new Error('式の形が正しくありません');
  }

  const result = parseExpression();
  if (pos < tokens.length) throw new Error('式の形が正しくありません');
  return result;
}

// 式の値だけを求める（答え合わせ用）
function evaluateTokens(tokens) {
  return parseTokens(tokens).value;
}

// "(3+7)*4" のような文字の式をトークンの並びにする（ステージの答え用）
function textToTokens(text) {
  return [...text].map((ch) => {
    if (ch >= '1' && ch <= '9') return { type: 'num', value: Number(ch) };
    if (ch === '(') return { type: 'lparen' };
    if (ch === ')') return { type: 'rparen' };
    return { type: 'op', value: ch };
  });
}

/* ---------------------------------------------------------
   画面の部品を取得
   --------------------------------------------------------- */
const el = {};

function cacheElements() {
  el.screens = {
    home: document.getElementById('screen-home'),
    game: document.getElementById('screen-game'),
  };
  // トップ（タブ）
  el.tabs = document.getElementById('tabs');
  el.tabPanel = document.getElementById('tab-panel');
  el.dailyArea = document.getElementById('daily-area');
  el.dailyDesc = document.getElementById('daily-desc');
  el.streak = document.getElementById('streak');
  // トップ（ステージ一覧）
  el.stagesHeading = document.getElementById('stages-heading');
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
  el.hintBtn = document.getElementById('hint-btn');
  el.answerBtn = document.getElementById('answer-btn');
  el.hintList = document.getElementById('hint-list');
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
   トップ画面（タブで テンパズル / 100パズル / 1000パズル を切り替える）
   --------------------------------------------------------- */
const TAB_STORAGE_KEY = 'numpuzzle.tab'; // 最後に開いたタブ
const DEFAULT_TAB = 'hundred';           // 初めての人は100パズルのタブから

function showHome(setKey) {
  // タブの指定がなければ、前回開いていたタブを開く
  if (!setKey) setKey = loadData(TAB_STORAGE_KEY, DEFAULT_TAB);
  if (!STAGE_SETS[setKey]) setKey = DEFAULT_TAB;
  saveData(TAB_STORAGE_KEY, setKey);

  renderTabs(setKey);

  // 今日の100パズルは、100パズルのタブにだけ出す
  el.dailyArea.hidden = setKey !== 'hundred';
  if (setKey === 'hundred') renderDailyCard();

  renderStageList(setKey);
  showScreen('home');
}

// タブのボタン（STAGE_SETS から作る）
function renderTabs(activeKey) {
  el.tabs.innerHTML = '';
  for (const setKey in STAGE_SETS) {
    const set = STAGE_SETS[setKey];
    const tab = document.createElement('a');
    tab.className = `tab tab-${set.color}`;
    tab.href = `#/set/${setKey}`;
    tab.textContent = set.name;
    if (setKey === activeKey) {
      tab.classList.add('is-active');
      tab.setAttribute('aria-current', 'page');
    }
    el.tabs.appendChild(tab);
  }
  // 中身の枠もタブの色に合わせる
  el.tabPanel.className = `tab-panel panel-${STAGE_SETS[activeKey].color}`;
}

// 今日の100パズルのカードと連続正解日数
function renderDailyCard() {
  const today = getJstDateString();
  const daily = loadDailyProgress(today);
  const no = `No.${getPuzzleNumber(today)}`;
  if (daily.solved) {
    el.dailyDesc.textContent = `${no} クリア済み ✓（${daily.attempts}回目で正解）`;
  } else if (daily.answerShown) {
    el.dailyDesc.textContent = `${no} 答えを見ました・また明日！`;
  } else {
    el.dailyDesc.textContent = `${no}・6つの数字で100を作る`;
  }

  const streak = getCurrentStreak(today);
  el.streak.textContent = streak > 0 ? `🔥 ${streak}日連続正解中` : '';
}

// ステージの一覧
function renderStageList(setKey) {
  const set = STAGE_SETS[setKey];
  const progress = loadStageProgress(setKey);
  const count = set.stages[0].numbers.length;
  el.stagesHeading.textContent =
    `${set.name} ステージ（${count}つの数字で${set.target}を作る）`;
  el.stageGrid.innerHTML = '';
  let clearedCount = 0;

  set.stages.forEach((_, i) => {
    const id = i + 1;
    const cleared = Boolean(progress.cleared[id]);
    const unlocked = isStageUnlocked(id, progress);
    if (cleared) clearedCount++;

    // 遊べるステージはリンク、まだのステージはただの箱
    const cell = document.createElement(unlocked ? 'a' : 'span');
    cell.className = 'stage-cell';
    if (cleared) cell.classList.add('is-cleared');
    if (unlocked) {
      cell.href = `#/set/${setKey}/${id}`;
      cell.textContent = id;
    } else {
      cell.classList.add('is-locked');
      cell.textContent = '🔒';
    }
    // 右上の印：クリアは★、答えを見ただけなら「答」
    const revealedOnly = !cleared && Boolean(progress.revealed[id]);
    if (revealedOnly) cell.classList.add('is-revealed');
    if (cleared || revealedOnly) {
      const mark = document.createElement('span');
      mark.className = 'stage-mark';
      mark.textContent = cleared ? '★' : '答';
      cell.appendChild(mark);
    }
    el.stageGrid.appendChild(cell);
  });

  el.stageProgress.textContent = `クリア ${clearedCount} / ${set.stages.length}`;
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
    hintsShown: 0,
    answerShown: false,
    solution: null,
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
    setKey: '',
    stageId: 0,
    stageAnswer: '',
    dateString: today,
    target: DAILY_TARGET,
    numbers: generateDailyPuzzle(today),
    attempts: progress.attempts,
    history: progress.history,
    solved: progress.solved,
    answerText: progress.answer,
    hintsShown: progress.hintsShown,
    answerShown: progress.answerShown,
  });

  el.gameTitle.textContent = '今日の100パズル';
  el.puzzleInfo.textContent = `No.${getPuzzleNumber(today)}　${today.replace(/-/g, '/')}`;
  el.gameBack.href = '#/set/hundred';

  // もうクリアしていたら、その結果を表示する
  if (game.solved) {
    showMessage(`クリア済み！ ${game.attempts}回目で正解`, 'correct');
    el.expressionBox.classList.add('is-correct');
  } else if (game.answerShown) {
    showMessage('今日は答えを見ました。また明日挑戦しよう！', 'hint');
  }

  showScreen('game');
  renderGame();
}

// ステージ（setKey の種類の id 番目）
function startStage(setKey, id) {
  const set = STAGE_SETS[setKey];
  const stage = set.stages[id - 1];
  setupGame({
    mode: 'stage',
    setKey,
    stageId: id,
    stageAnswer: stage.answer,
    dateString: '',
    target: set.target,
    numbers: stage.numbers,
  });

  el.gameTitle.textContent = `${set.name} ステージ${id}`;
  const best = loadStageProgress(setKey).cleared[id];
  el.puzzleInfo.textContent = best ? `★ クリア済み（最高 ${best}回目で正解）` : `全${set.stages.length}ステージ`;
  el.gameBack.href = `#/set/${setKey}`;

  showScreen('game');
  renderGame();
}

/* ---------------------------------------------------------
   ゲーム中の操作
   --------------------------------------------------------- */
function addToken(token) {
  if (isFinished()) return;
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
  if (isFinished()) return;

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
      markStageCleared(game.setKey, game.stageId, game.attempts);
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
   ヒントと答え
   ヒントは、答えの計算手順を1つずつ見せる。
   （例：「まず 9 − 5 = 4」→「次に 4 + 1 = 5」）
   最後の1手は見せないので、ヒントの数は「手順の数 − 1」。
   ヒントを1つ以上見たら「答えを見る」ボタンが出る。
   --------------------------------------------------------- */

// 答えを用意する（初めて必要になったときに1回だけ計算）
// ステージに答えの例が入っていればそれを使い、なければソルバーで探す
function getSolution() {
  if (!game.solution) {
    game.solution = game.stageAnswer
      ? parseTokens(textToTokens(game.stageAnswer))
      : solvePuzzle(game.numbers, game.target);
  }
  return game.solution;
}

// 出せるヒントの数
// 2つを1つにまとめる手順は「数字の数 − 1」回。最後の1手は見せないので − 2
function maxHints() {
  return game.numbers.length - 2;
}

function showHint() {
  if (isFinished() || game.hintsShown >= maxHints()) return;
  game.hintsShown++;
  if (game.mode === 'daily') saveDailyProgress();
  renderGame();
}

function showAnswer() {
  if (isFinished()) return;

  // うっかり押したときのために確認する
  const warning = game.mode === 'daily'
    ? '答えを見ると、今日の100パズルは終了します（連続正解は途切れます）。見ますか？'
    : '答えを見ますか？（★は付きませんが、次のステージは遊べるようになります）';
  if (!window.confirm(warning)) return;

  game.answerShown = true;
  game.tokens = [];
  clearResult();
  showMessage('↑ 答えの一例です。次はがんばろう！', 'hint');

  if (game.mode === 'daily') {
    saveDailyProgress();
  } else {
    markStageRevealed(game.setKey, game.stageId);
  }
  renderGame();
}

// 計算手順1つを文字にする（例：9 − 5 = 4）
function stepToText(step) {
  return `${formatFraction(step.a)} ${OP_LABELS[step.op]} ${formatFraction(step.b)} = ${formatFraction(step.result)}`;
}

// ヒント・答えの表示を更新する
function renderHelp() {
  // 見たヒントの一覧（答えを見たら、最後の手順まで全部出す）
  el.hintList.innerHTML = '';
  const solution = game.hintsShown > 0 || game.answerShown ? getSolution() : null;
  if (solution) {
    const count = game.answerShown ? solution.steps.length : game.hintsShown;
    solution.steps.slice(0, count).forEach((step, i) => {
      const item = document.createElement('li');
      const order = i === 0 ? 'まず' : i === solution.steps.length - 1 ? '最後に' : '次に';
      item.textContent = `${order} ${stepToText(step)}`;
      el.hintList.appendChild(item);
    });
  }

  // ボタン（クリアしたか答えを見たら隠す）
  const finished = isFinished();
  const remaining = maxHints() - game.hintsShown;
  el.hintBtn.hidden = finished;
  el.hintBtn.disabled = remaining <= 0;
  el.hintBtn.textContent = remaining > 0
    ? `💡 ヒント（あと${remaining}回）`
    : '💡 ヒントはここまで';
  el.answerBtn.hidden = finished || game.hintsShown === 0;
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

// クリア後（または答えを見た後）に出すボタンを作る
function renderAfterClear() {
  el.afterClear.hidden = !isFinished();
  if (!isFinished()) return;

  if (game.mode === 'daily') {
    el.afterClear.innerHTML =
      '<p class="attempts">次の問題は明日の0時（日本時間）に出ます</p>' +
      '<a class="link-btn is-primary" href="#/set/hundred">100パズルのステージで遊ぶ</a>';
    return;
  }

  const listLink = `<a class="link-btn" href="#/set/${game.setKey}">ステージ一覧</a>`;
  const stageCount = STAGE_SETS[game.setKey].stages.length;

  if (game.stageId < stageCount) {
    el.afterClear.innerHTML =
      `<a class="link-btn is-primary" href="#/set/${game.setKey}/${game.stageId + 1}">次のステージへ ▶</a>` +
      listLink;
  } else if (game.solved) {
    el.afterClear.innerHTML =
      '<p class="message is-correct">🏆 全ステージクリア！</p>' + listLink;
  } else {
    el.afterClear.innerHTML =
      // 同じURLへのリンクでは画面が切り替わらないので、ボタンにする
      '<button class="link-btn is-primary" data-action="retry">もう一度挑戦する</button>' +
      listLink;
  }
}

// 状態に合わせてゲーム画面を更新する
function renderGame() {
  // 式の表示（クリア済みなら正解した式、答えを見たなら答えの式を出す）
  let text = tokensToText(game.tokens);
  if (!text && game.solved) text = game.answerText;
  if (!text && game.answerShown) text = `${getSolution().text} = ${game.target}`;
  el.expressionBox.classList.toggle('is-answer', game.answerShown);

  if (!text) {
    el.expression.textContent = '数字と記号をタップして式を作ろう';
    el.expression.className = 'expression is-empty';
  } else {
    el.expression.textContent = text;
    // 式が長いほど文字を小さくする
    let size = '';
    if (text.length > 30) size = ' is-very-long';
    else if (text.length > 16) size = ' is-long';
    el.expression.className = `expression${size}`;
  }

  // クリアしたか答えを見たら、もう入力できない
  const finished = isFinished();

  // 数字カード：使ったものは薄く、置けないときは押せなくする
  el.numberButtons.forEach((button, index) => {
    button.classList.toggle('is-used', isNumberUsed(index));
    button.disabled = finished || !canAddNumber(index);
  });

  // 演算子・カッコ
  el.opButtons.forEach((button) => {
    button.disabled = finished || !canAddOperator();
  });
  el.leftParen.disabled = finished || !canAddLeftParen();
  el.rightParen.disabled = finished || !canAddRightParen();

  // 編集ボタン・答え合わせ
  const isEmpty = game.tokens.length === 0;
  el.undoBtn.disabled = finished || isEmpty;
  el.clearBtn.disabled = finished || isEmpty;
  el.checkBtn.disabled = finished || isEmpty;

  // 挑戦回数
  el.attempts.textContent = game.attempts > 0 ? `挑戦回数：${game.attempts}回` : '';

  renderHelp();
  renderAfterClear();
}

/* ---------------------------------------------------------
   画面の切り替え（URLの # の部分で決める）
     #/          → トップ（前回開いていたタブ）
     #/daily     → 今日の100パズル
     #/set/ten        → トップのテンパズルのタブ
     #/set/ten/5      → テンパズル ステージ5
     （ten の部分は hundred・thousand も同じ）
   こうしておくと、スマホの「戻る」でも前の画面に戻れる。
   --------------------------------------------------------- */
function route() {
  const hash = location.hash;
  // 例："#/set/hundred/5" → setKey = "hundred", id = "5"
  const setMatch = hash.match(/^#\/set\/(\w+)(?:\/(\d+))?$/);

  if (hash === '#/daily') {
    startDaily();
  } else if (setMatch && STAGE_SETS[setMatch[1]]) {
    const setKey = setMatch[1];
    const id = Number(setMatch[2]);
    const progress = loadStageProgress(setKey);
    // 番号があり、そのステージが遊べるならゲームへ。それ以外はトップのそのタブ
    if (id >= 1 && id <= STAGE_SETS[setKey].stages.length && isStageUnlocked(id, progress)) {
      startStage(setKey, id);
    } else {
      showHome(setKey);
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
  el.hintBtn.addEventListener('click', showHint);
  el.answerBtn.addEventListener('click', showAnswer);

  // 「もう一度挑戦する」ボタン（あとから作られるので、親要素でクリックを受け取る）
  el.afterClear.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) startStage(game.setKey, game.stageId);
  });

  // 念のため：ステージの答えの例が正しいか確認（開発用。結果はコンソールに出る）
  // 答えの例をそのまま計算するだけなので軽い
  for (const setKey in STAGE_SETS) {
    STAGE_SETS[setKey].stages.forEach((stage, i) => {
      if (!stage.answer) return;
      const used = stage.answer.replace(/[^1-9]/g, '').split('').sort().join('');
      const value = evaluateTokens(textToTokens(stage.answer));
      if (used !== [...stage.numbers].sort().join('') || !equalsInt(value, STAGE_SETS[setKey].target)) {
        console.error(`${STAGE_SETS[setKey].name} ステージ${i + 1} の答えが合っていません`, stage);
      }
    });
  }

  window.addEventListener('hashchange', route);
  route();
}

// HTMLの準備ができたら開始
document.addEventListener('DOMContentLoaded', init);
