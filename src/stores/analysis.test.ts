import { expect, test } from 'bun:test';
import { parseCompletedAnswers } from './analysis';

test('最新2日（当日と翌日）や集計のない行を過去の正解として使わない', () => {
    const csv = [
        'day,tango_title,tango_pro,analysis_ver,no_ans,no_history,ignore_ans,player',
        '1,題名,ショウイン,4,0,0,0,120',
        '2,題名,チョウレイ,4,0,0,0,0',
        '3,題名,サクラモチ,4,0,0,0,130',
        '4,題名,ミメカタチ,4,0,0,0,130',
    ].join('\n');
    expect(parseCompletedAnswers(csv)).toEqual([
        { day: 1, word: 'ショウイン' },
    ]);
});
