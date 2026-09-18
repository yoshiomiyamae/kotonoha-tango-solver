/**
 * ことのは単語ソルバーの推論エンジン。
 *
 * 制約を confirmed/included/excluded のような集合で持つと「同じ文字が2回出て
 * 片方だけ黒」という重複情報を表現できず、正解を候補から取りこぼす。
 * そこで「推測語と色パターンの履歴」だけを状態として持ち、
 * 「その履歴を再現できる単語か」で辞書を絞り込む方式にしてある。
 * 判定ロジックが computeFeedback の1本に集約されるので、齟齬が起きない。
 */

export const WORD_LENGTH = 5;

/** hit=緑（位置も一致） / blow=黄（含むが位置違い） / miss=灰（含まない） */
export type Mark = 'hit' | 'blow' | 'miss';

export type Guess = {
    word: string;
    marks: Mark[];
};

export type ScoredGuess = {
    word: string;
    /** この語を出したときに残る候補数の期待値。小さいほど良い。 */
    expected: number;
    /** 終盤のみ計算する、正解までの期待手数。 */
    expectedTurns?: number;
};

export type Suggestion = {
    mostLikely: string;
    likely: string[];
    remaining: number;
};

/**
 * 1手に許す色パターン評価の回数のめやす。
 * 探索語プールの広さはこれを候補数で割って決めるので、候補が多い序盤ほど
 * プールは狭く、候補が絞れた終盤は辞書全体になる。
 * 閾値で分岐するのと違い、候補数に対して計算量が単調になる。
 */
const WORK_BUDGET = 2_000_000;
/** 候補がいくら多くてもこれだけは探索語を評価する */
const MIN_POOL = 200;
/** プールに必ず入れる候補語の数。「ほかの候補」を埋めるのに足りればよい。 */
const CANDIDATE_QUOTA = 50;
/** UIに渡す候補リストの長さ（推奨語1つ＋「ほかの候補」） */
const LIKELY_COUNT = 7;
/** 部分集合の先読みは指数的に増えるため、小さい終盤に限定する。 */
const ENDGAME_LIMIT = 10;

const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;
const PATTERN_COUNT = 3 ** WORD_LENGTH;

/** 色の内部表現。この並び順がそのまま数値になる（逆引き表を手書きしない） */
const MARKS_BY_VALUE: Mark[] = ['miss', 'blow', 'hit'];
const MARK_VALUE = Object.fromEntries(
    MARKS_BY_VALUE.map((mark, value) => [mark, value])
) as Record<Mark, number>;
const BLOW = MARK_VALUE.blow;
const HIT = MARK_VALUE.hit;

export const toKatakana = (text: string): string =>
    text.replace(/[\u3041-\u3096]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_TO_KATAKANA_OFFSET)
    );

/**
 * CSV（表記,読み）から5文字の読みだけを抜き出す。
 * 同音異義語は重複排除する。残しておくと頻度計算が表記の多い読みに偏るため。
 */
export const parseDictionary = (csv: string): string[] => {
    const seen = new Set<string>();
    const words: string[] = [];
    for (const line of csv.split('\n')) {
        const kana = line.split(',')[1];
        if (!kana) continue;
        const word = toKatakana(kana.trim());
        if (word.length !== WORD_LENGTH) continue;
        if (seen.has(word)) continue;
        seen.add(word);
        words.push(word);
    }
    return words;
};

/**
 * 単語を文字IDの数値配列に符号化する。
 * 色パターンの計算は数百万回まわるので、文字列の添字アクセス（毎回1文字の
 * 文字列を生成する）を避けないと桁違いに遅くなる。辞書は使い回されるため
 * 符号化結果はキャッシュする。
 */
const charIds = new Map<string, number>();
const encodeCache = new Map<string, Uint16Array>();

const encode = (word: string): Uint16Array => {
    const cached = encodeCache.get(word);
    if (cached) return cached;
    const encoded = new Uint16Array(WORD_LENGTH);
    for (let i = 0; i < WORD_LENGTH; i++) {
        const ch = word[i]!;
        let id = charIds.get(ch);
        if (id === undefined) {
            id = charIds.size;
            charIds.set(ch, id);
        }
        encoded[i] = id;
    }
    encodeCache.set(word, encoded);
    return encoded;
};

// feedbackCodeOf のワーク領域。毎回確保すると数百万回の呼び出しで効いてくる。
const workMarks = new Uint8Array(WORD_LENGTH);
const workUsed = new Uint8Array(WORD_LENGTH);

/**
 * 色パターンを3進数1整数に符号化して返す。比較とバケツ分けを速くするため。
 * 副作用として workMarks に色を残すので、色そのものが欲しい呼び出し側は
 * 直後にそれを読む（computeFeedback）。
 */
const feedbackCodeOf = (guess: Uint16Array, answer: Uint16Array): number => {
    workMarks.fill(0);
    workUsed.fill(0);
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guess[i] === answer[i]) {
            workMarks[i] = HIT;
            workUsed[i] = 1;
        }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (workMarks[i] === HIT) continue;
        for (let j = 0; j < WORD_LENGTH; j++) {
            if (workUsed[j] || answer[j] !== guess[i]) continue;
            workMarks[i] = BLOW;
            workUsed[j] = 1;
            break;
        }
    }
    let code = 0;
    for (let i = 0; i < WORD_LENGTH; i++) code = code * 3 + workMarks[i]!;
    return code;
};

const marksToCode = (marks: Mark[]): number =>
    marks.reduce((code, mark) => code * 3 + MARK_VALUE[mark], 0);

/** 推測語と答えから色パターンを求める。hitを先に確定させてから個数を消費する。 */
export const computeFeedback = (guess: string, answer: string): Mark[] => {
    feedbackCodeOf(encode(guess), encode(answer));
    return Array.from(workMarks, (value) => MARKS_BY_VALUE[value]!);
};

export const filterCandidates = (dictionary: string[], history: Guess[]): string[] => {
    if (history.length === 0) return dictionary;
    const expected = history.map((turn) => ({ word: encode(turn.word), code: marksToCode(turn.marks) }));
    return dictionary.filter((word) => {
        const answer = encode(word);
        return expected.every((turn) => feedbackCodeOf(turn.word, answer) === turn.code);
    });
};

/** word が答えだったと仮定して、履歴の色がすべて再現できるか */
export const isConsistent = (word: string, history: Guess[]): boolean =>
    filterCandidates([word], history).length === 1;

/** hitした位置の文字。未確定の位置は空文字列。 */
export const confirmedFromHistory = (history: Guess[]): string[] => {
    const confirmed: string[] = Array(WORD_LENGTH).fill('');
    for (const turn of history) {
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (turn.marks[i] === 'hit') confirmed[i] = turn.word[i]!;
        }
    }
    return confirmed;
};

/**
 * 位置別出現頻度の表。文字IDで引ける平坦な配列にしてある
 * （1文字の文字列をキーにしたMapより一桁速い）。
 * 文字IDは符号化のたびに増えるので、対象を符号化し終えてから作ること。
 */
const positionalFrequency = (candidates: Uint16Array[], stride: number): Int32Array => {
    const frequency = new Int32Array(WORD_LENGTH * stride);
    for (const word of candidates) {
        for (let i = 0; i < WORD_LENGTH; i++) frequency[i * stride + word[i]!]!++;
    }
    return frequency;
};

/** 位置別頻度スコア。同じ文字の重複は加点しない（情報が増えないため） */
const positionalScore = (word: Uint16Array, frequency: Int32Array, stride: number): number => {
    let score = 0;
    for (let i = 0; i < WORD_LENGTH; i++) {
        let duplicate = false;
        for (let j = 0; j < i; j++) {
            if (word[j] === word[i]) {
                duplicate = true;
                break;
            }
        }
        if (!duplicate) score += frequency[i * stride + word[i]!]!;
    }
    return score;
};

/** スコア上位 limit 件の添字を返す。単語オブジェクトを作らないぶん安い。 */
const topIndices = (
    words: Uint16Array[],
    frequency: Int32Array,
    stride: number,
    limit: number
): number[] => {
    const scores = new Int32Array(words.length);
    for (let i = 0; i < words.length; i++) scores[i] = positionalScore(words[i]!, frequency, stride);
    const order = Array.from({ length: words.length }, (_, i) => i);
    order.sort((a, b) => scores[b]! - scores[a]!);
    return order.slice(0, limit);
};

const buckets = new Int32Array(PATTERN_COUNT);

const expectedRemaining = (guess: Uint16Array, candidates: Uint16Array[]): number => {
    buckets.fill(0);
    for (const candidate of candidates) buckets[feedbackCodeOf(guess, candidate)]!++;
    let sum = 0;
    for (let i = 0; i < PATTERN_COUNT; i++) sum += buckets[i]! * buckets[i]!;
    return sum / candidates.length;
};

/**
 * 全候補を等確率とし、正解までの総手数を最小化する終盤探索。
 * 部分集合をビットマスクでメモ化。同じ分割を作る語はまとめて評価する。
 * 全一致の枝は終了なので除外し、候補が減らない手は再帰させない。
 */
const rankEndgame = (scored: ScoredGuess[], candidates: Uint16Array[]): void => {
    const full = (1 << candidates.length) - 1;
    const partitions = new Map<string, number[]>();
    const byWord = new Map<string, number[]>();
    for (const { word } of scored) {
        const groups = new Map<number, number>();
        const guess = encode(word);
        for (let i = 0; i < candidates.length; i++) {
            const code = feedbackCodeOf(guess, candidates[i]!);
            if (code === PATTERN_COUNT - 1) continue;
            groups.set(code, (groups.get(code) ?? 0) | (1 << i));
        }
        const masks = [...groups.values()].sort((a, b) => a - b);
        const key = masks.join(',');
        if (!partitions.has(key)) partitions.set(key, masks);
        byWord.set(word, partitions.get(key)!);
    }
    const sizes = new Uint8Array(full + 1);
    for (let mask = 1; mask <= full; mask++) sizes[mask] = sizes[mask >> 1]! + (mask & 1);
    const memo = new Float64Array(full + 1).fill(-1);
    memo[0] = 0;
    const cost = (mask: number): number => {
        if (memo[mask]! >= 0) return memo[mask]!;
        if (sizes[mask] === 1) return (memo[mask] = 1);
        let best = Infinity;
        for (const groups of partitions.values()) {
            let total = sizes[mask]!;
            for (const group of groups) {
                const child = mask & group;
                if (child === mask) { total = Infinity; break; }
                total += cost(child);
                if (total >= best) break;
            }
            best = Math.min(best, total);
        }
        return (memo[mask] = best);
    };
    for (const entry of scored) {
        const groups = byWord.get(entry.word)!;
        entry.expectedTurns = groups.includes(full) ? Infinity
            : 1 + groups.reduce((sum, mask) => sum + cost(mask), 0) / candidates.length;
    }
    scored.sort((a, b) => a.expectedTurns! - b.expectedTurns! || a.expected - b.expected);
};

/**
 * 次に出す語の候補を、期待残候補数の小さい順に並べて返す。
 *
 * 探索語のプールには答えになり得ない語も入る。候補が同じ4文字を共有していて
 * 末尾だけ違うような場面では、1つずつ潰すより一度に切り分けたほうが総手数が短い。
 * プールが辞書全体に届かないときは位置別頻度で粗選別するが、候補側からも
 * 上位を必ず入れる（候補が1つも評価されないと「ほかの候補」が空になる）。
 */
export const rankGuesses = (dictionary: string[], candidates: string[]): ScoredGuess[] => {
    if (candidates.length === 0) return [];

    // 文字IDが確定してから頻度表を作る必要があるので、先に全部符号化する
    const encodedDictionary = dictionary.map((word) => encode(word));
    const encodedCandidates = candidates.map((word) => encode(word));
    const stride = charIds.size;
    const frequency = positionalFrequency(encodedCandidates, stride);

    const poolLimit = Math.max(
        MIN_POOL,
        Math.min(dictionary.length, Math.floor(WORK_BUDGET / candidates.length))
    );

    const pool = new Map<string, Uint16Array>();
    if (poolLimit >= dictionary.length) {
        for (let i = 0; i < dictionary.length; i++) pool.set(dictionary[i]!, encodedDictionary[i]!);
    } else {
        for (const i of topIndices(encodedDictionary, frequency, stride, poolLimit)) {
            pool.set(dictionary[i]!, encodedDictionary[i]!);
        }
        for (const i of topIndices(encodedCandidates, frequency, stride, CANDIDATE_QUOTA)) {
            pool.set(candidates[i]!, encodedCandidates[i]!);
        }
    }

    const candidateSet = new Set(candidates);
    // 自分が当たりだった場合はその場で終わるぶん、候補語をわずかに優遇する
    const bonus = 1 / candidates.length;

    const scored: ScoredGuess[] = [];
    for (const [word, encoded] of pool) {
        const expected =
            expectedRemaining(encoded, encodedCandidates) - (candidateSet.has(word) ? bonus : 0);
        scored.push({ word, expected });
    }
    scored.sort((a, b) => a.expected - b.expected);
    if (candidates.length <= ENDGAME_LIMIT) rankEndgame(scored, encodedCandidates);
    return scored;
};

/**
 * 初手は履歴が空なので結果が辞書だけで決まる。辞書は取得元のCSV次第で変わるため
 * 定数に焼かず、辞書ごとに一度だけ計算して覚えておく。
 */
const openingRanking = new WeakMap<string[], ScoredGuess[]>();

export const suggest = (dictionary: string[], history: Guess[]): Suggestion => {
    const candidates = filterCandidates(dictionary, history);
    if (candidates.length === 0) return { mostLikely: '', likely: [], remaining: 0 };

    let ranking: ScoredGuess[];
    if (history.length === 0) {
        ranking = openingRanking.get(dictionary) ?? rankGuesses(dictionary, candidates);
        openingRanking.set(dictionary, ranking);
    } else {
        ranking = rankGuesses(dictionary, candidates);
    }

    const candidateSet = new Set(candidates);
    const likely: string[] = [];
    for (const { word } of ranking) {
        if (!candidateSet.has(word)) continue;
        likely.push(word);
        if (likely.length === LIKELY_COUNT) break;
    }

    return { mostLikely: ranking[0]!.word, likely, remaining: candidates.length };
};
