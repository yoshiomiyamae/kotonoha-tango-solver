/**
 * 公開された過去の正解でソルバーを時系列評価する。当日行は含めない。
 * bun scripts/evaluateHistory.ts [件数]
 */
import { parseCompletedAnswers } from '../src/stores/analysis';
import { fetchDictionary } from '../src/stores/dictionarySource';
import { computeFeedback, suggest, type Guess } from '../src/stores/solver';

const ANALYSIS_URL = 'https://plum-chloride.jp/kotonoha-tango/public/data/analysis.csv';
const count = Number(process.argv[2] ?? 200);
const [dictionary, response] = await Promise.all([
    fetchDictionary(),
    fetch(`${ANALYSIS_URL}?ver=${Date.now()}`),
]);
if (!response.ok) throw new Error(`Analysis CSV: HTTP ${response.status}`);
const known = new Set(dictionary);
const completed = parseCompletedAnswers(await response.text());
const sample = completed.filter(row => known.has(row.word)).slice(-count);
const histogram = new Map<number, number>();
let total = 0;
let failed = 0;
for (const { word: answer } of sample) {
    const history: Guess[] = [];
    let result = 11;
    for (let turn = 1; turn <= 10; turn++) {
        const { mostLikely } = suggest(dictionary, history);
        if (!mostLikely) break;
        if (mostLikely === answer) {
            result = turn;
            break;
        }
        history.push({ word: mostLikely, marks: computeFeedback(mostLikely, answer) });
    }
    total += result;
    if (result === 11) failed++;
    histogram.set(result, (histogram.get(result) ?? 0) + 1);
}
const over6 = [...histogram].reduce((sum, [turn, n]) => sum + (turn > 6 ? n : 0), 0);
console.log(`公開済み ${completed.length} 回 / 評価 ${sample.length} 回 (${sample[0]?.day}〜${sample.at(-1)?.day})`);
console.log(`平均 ${(total / sample.length).toFixed(3)} 手 / 6手以内 ${((sample.length - over6) / sample.length * 100).toFixed(1)}% / 10手以内未解決 ${failed}`);
console.log([...histogram].sort((a, b) => a[0] - b[0]).map(([turn, n]) => `${turn}手:${n}`).join(' '));
