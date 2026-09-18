import { describe, expect, test } from 'bun:test';
import {
    computeFeedback,
    confirmedFromHistory,
    filterCandidates,
    isConsistent,
    parseDictionary,
    rankGuesses,
    suggest,
    toKatakana,
    type Guess,
} from './solver';

describe('toKatakana', () => {
    test('ひらがなをカタカナに変換する', () => {
        expect(toKatakana('しょうがっこう')).toBe('ショウガッコウ');
    });

    test('カタカナと長音記号はそのまま', () => {
        expect(toKatakana('コーヒーカップ')).toBe('コーヒーカップ');
    });
});

describe('parseDictionary', () => {
    test('2列目の読みを取り出してカタカナに揃える', () => {
        expect(parseDictionary('十字路,ジュウジロ\n桜餅,さくらもち')).toEqual(['ジュウジロ', 'サクラモチ']);
    });

    test('5文字以外・空行・不正行を捨てる', () => {
        expect(parseDictionary('猫,ネコ\n\n読みなし\n十字路,ジュウジロ\n')).toEqual(['ジュウジロ']);
    });

    test('同音異義語を重複排除する（頻度計算の偏りを防ぐ）', () => {
        expect(parseDictionary('工業,コウギョウ\n鉱業,コウギョウ\n興業,コウギョウ')).toEqual(['コウギョウ']);
    });
});

describe('computeFeedback', () => {
    test('全一致', () => {
        expect(computeFeedback('アイウエオ', 'アイウエオ')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    });

    test('全不一致', () => {
        expect(computeFeedback('アイウエオ', 'カキクケコ')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
    });

    test('位置違いはblow', () => {
        expect(computeFeedback('アイウエオ', 'オエウイア')).toEqual(['blow', 'blow', 'hit', 'blow', 'blow']);
    });

    test('推測側に重複がある場合、答えの個数を超えた分はmiss', () => {
        // 答えの ア は1個。推測の ア は2個 → 1個目がhit、2個目はmiss
        expect(computeFeedback('アアイイウ', 'アイウエオ')).toEqual(['hit', 'miss', 'blow', 'miss', 'blow']);
    });

    test('hitを優先して個数を消費する', () => {
        // 答え アイアエオ の ア は2個。推測の ア 3個のうち hit する2個が優先
        expect(computeFeedback('アアアエオ', 'アイアエオ')).toEqual(['hit', 'miss', 'hit', 'hit', 'hit']);
    });
});

describe('isConsistent / filterCandidates', () => {
    // 旧実装が詰んだ実例：答え コヨウヌシ
    const history: Guess[] = [
        { word: 'インショウ', marks: ['miss', 'miss', 'blow', 'miss', 'blow'] },
        { word: 'シュウシャ', marks: ['blow', 'miss', 'hit', 'miss', 'miss'] },
    ];

    test('同じ文字がblowとmissで同時に出ても正解を除外しない', () => {
        expect(isConsistent('コヨウヌシ', history)).toBe(true);
    });

    test('「シはちょうど1個」を満たさない単語は除外する', () => {
        expect(isConsistent('シヨウヌシ', history)).toBe(false);
    });

    test('missの文字を含む単語は除外する', () => {
        expect(isConsistent('コヨウヌイ', history)).toBe(false);
    });

    test('filterCandidatesは矛盾しない単語だけを返す', () => {
        const dict = ['コヨウヌシ', 'シヨウヌシ', 'コヨウヌイ', 'ジムショウ'];
        expect(filterCandidates(dict, history)).toEqual(['コヨウヌシ']);
    });

    test('履歴が空なら辞書をそのまま返す', () => {
        const dict = ['コヨウヌシ', 'ジムショウ'];
        expect(filterCandidates(dict, [])).toEqual(dict);
    });
});

describe('confirmedFromHistory', () => {
    test('hitした位置の文字を集める', () => {
        const history: Guess[] = [
            { word: 'インショウ', marks: ['miss', 'miss', 'blow', 'miss', 'blow'] },
            { word: 'シュウシャ', marks: ['blow', 'miss', 'hit', 'miss', 'miss'] },
        ];
        expect(confirmedFromHistory(history)).toEqual(['', '', 'ウ', '', '']);
    });
});

describe('rankGuesses', () => {
    const best = (dictionary: string[], candidates: string[]) => rankGuesses(dictionary, candidates)[0]!.word;

    test('11候補では、同じ1手目の分割でも2手後に多く絞れる語を選ぶ', () => {
        const candidates = [
            'チョウザイ', 'チョウセイ', 'チョウゼイ', 'チョウテイ', 'チョウアイ',
            'チョウレイ', 'チョウヘイ', 'チョウケイ', 'チョウルイ', 'チョウエイ', 'チョウナイ',
        ];
        const ranking = rankGuesses(
            ['エアメール', 'ムカエザケ', 'テイレベル', 'マゼアワセ', ...candidates],
            candidates,
        );
        const oldChoice = ranking.find(entry => entry.word === 'エアメール')!;
        expect(ranking[0]!.expected).toBe(oldChoice.expected);
        expect(ranking[0]!.expectedAfterTwo!).toBeLessThan(oldChoice.expectedAfterTwo!);
    });

    test('同じ分割でも、その後を短く解ける探索語を選ぶ', () => {
        const candidates = ['チョウザイ', 'チョウセイ', 'チョウゼイ', 'チョウテイ',
            'チョウアイ', 'チョウレイ', 'チョウヘイ', 'チョウケイ', 'チョウルイ', 'チョウエイ'];
        const dictionary = ['エアメール', 'ムカエザケ', 'テイレベル', 'マゼアワセ', ...candidates];
        const ranked = rankGuesses(dictionary, candidates);
        const greedy = ranked.find(entry => entry.word === 'エアメール')!;
        // 次の1手の期待残候補数は同じでも、先読みした手数には差がある。
        expect(ranked[0]!.expected).toBe(greedy.expected);
        expect(ranked[0]!.expectedTurns!).toBeLessThan(greedy.expectedTurns!);
    });

    test('候補が1つならそれを返す', () => {
        expect(best(['アイウエオ', 'カキクケコ'], ['アイウエオ'])).toBe('アイウエオ');
    });

    test('先読みの手数が、小辞書の全探索と一致する', () => {
        const candidates = ['サクラモチ', 'サクラモメ', 'サクラモリ', 'サクラモル'];
        const dictionary = [...candidates, 'チメリルナ', 'アイウエオ'];
        // ビットマスクやメモ化を使わない参照実装。正解の枝では追加手数は不要。
        const turns = (word: string, answers: string[]): number => {
            const groups = new Map<string, string[]>();
            for (const answer of answers) {
                if (answer === word) continue;
                const key = computeFeedback(word, answer).join(',');
                groups.set(key, [...(groups.get(key) ?? []), answer]);
            }
            if ([...groups.values()].some(group => group.length === answers.length)) return Infinity;
            return 1 + [...groups.values()].reduce((sum, group) => sum + group.length *
                Math.min(...dictionary.map(next => turns(next, group))), 0) / answers.length;
        };
        for (const entry of rankGuesses(dictionary, candidates)) {
            expect(entry.expectedTurns).toBe(turns(entry.word, candidates));
        }
    });

    test('候補を一度に切り分けられる探索専用語を選ぶ', () => {
        // 候補は4文字共通で末尾だけ違う。候補から選ぶと最悪4手かかる
        const candidates = ['サクラモチ', 'サクラモメ', 'サクラモリ', 'サクラモル'];
        // 末尾4種をまとめて含む探索語（候補ではない）
        const probe = 'チメリルナ';
        expect(best([...candidates, probe], candidates)).toBe(probe);
    });

    test('情報量が同じなら候補側を優先する', () => {
        const candidates = ['アイウエオ', 'カキクケコ'];
        expect(candidates).toContain(best([...candidates, 'サシスセソ'], candidates));
    });
});

describe('suggest', () => {
    const dict = ['コヨウヌシ', 'シヨウヌシ', 'コヨウヌイ', 'ジムショウ', 'サクラモチ'];

    test('履歴と矛盾しない単語を提案する', () => {
        const history: Guess[] = [
            { word: 'インショウ', marks: ['miss', 'miss', 'blow', 'miss', 'blow'] },
            { word: 'シュウシャ', marks: ['blow', 'miss', 'hit', 'miss', 'miss'] },
        ];
        const result = suggest(dict, history);
        expect(result.mostLikely).toBe('コヨウヌシ');
        expect(result.remaining).toBe(1);
    });

    test('候補が尽きたら空を返す', () => {
        const history: Guess[] = [
            { word: 'アイウエオ', marks: ['hit', 'hit', 'hit', 'hit', 'hit'] },
        ];
        const result = suggest(dict, history);
        expect(result.mostLikely).toBe('');
        expect(result.remaining).toBe(0);
    });

    test('likelyには候補だけが並び、先頭はmostLikely', () => {
        const history: Guess[] = [
            { word: 'サクラモチ', marks: ['hit', 'hit', 'hit', 'miss', 'miss'] },
        ];
        const result = suggest(['サクラモチ', 'サクライヌ', 'サクラモメ', 'ジムショウ'], history);
        expect(result.likely[0]).toBe(result.mostLikely);
        expect(result.likely).toContain('サクライヌ');
        expect(result.likely).not.toContain('ジムショウ');
    });

    test('辞書が空でも落ちない', () => {
        expect(suggest([], [])).toEqual({ mostLikely: '', likely: [], remaining: 0 });
    });
});
