/**
 * ソルバーの実力測定。辞書の全単語からランダムに出題して平均手数を測る。
 *
 *   bun run simulate            # 200問
 *   bun run simulate 1000       # 問題数を指定
 *
 * アルゴリズムを変えたらこれを回して、平均手数と6手以内クリア率が
 * 悪化していないか確認すること。
 */
import { fetchDictionary } from '../src/stores/dictionarySource';
import { computeFeedback, isConsistent, suggest, type Guess } from '../src/stores/solver';

const MAX_TURNS = 10;

const games = Number(process.argv[2] ?? 200);

const dictionary = await fetchDictionary();
console.log(`辞書 ${dictionary.length} 語 / 出題 ${games} 問`);

// 再現性のための固定シード線形合同法
let seed = 20260914;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const histogram = new Map<number, number>();
let totalTurns = 0;
let failed = 0;
let openingMs = 0;
let slowestTurnMs = 0;
const startedAt = Date.now();

for (let g = 0; g < games; g++) {
    const answer = dictionary[Math.floor(random() * dictionary.length)]!;
    const history: Guess[] = [];
    let turns = 0;
    let solved = false;

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
        const at = Date.now();
        const { mostLikely } = suggest(dictionary, history);
        const elapsed = Date.now() - at;
        // 初手は辞書ごとに一度しか計算しない（以降はメモ済み）ので分けて測る
        if (g === 0 && turn === 1) openingMs = elapsed;
        else slowestTurnMs = Math.max(slowestTurnMs, elapsed);
        if (!mostLikely) break;
        turns = turn;
        if (mostLikely === answer) {
            solved = true;
            break;
        }
        history.push({ word: mostLikely, marks: computeFeedback(mostLikely, answer) });
        if (!isConsistent(answer, history)) {
            throw new Error(`正解 ${answer} が候補から消えた: ${JSON.stringify(history)}`);
        }
    }

    if (!solved) failed++;
    const bucket = solved ? turns : MAX_TURNS + 1;
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
    totalTurns += bucket;
}

const over6 = [...histogram].filter(([turns]) => turns > 6).reduce((a, [, n]) => a + n, 0);
const distribution = [...histogram]
    .sort((a, b) => a[0] - b[0])
    .map(([turns, n]) => `${turns}手:${n}`)
    .join(' ');

console.log(`平均 ${(totalTurns / games).toFixed(3)} 手 / 6手以内 ${((games - over6) / games * 100).toFixed(1)}% / 未解決 ${failed}`);
console.log(`分布 ${distribution}`);
console.log(`初手 ${openingMs}ms（辞書ごとに1回） / 2手目以降の最大 ${slowestTurnMs}ms / 所要 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
