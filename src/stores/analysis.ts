/** 過去回の分析データだけを実力測定に使う。末尾には当日・翌日が含まれ得る。 */
export type CompletedAnswer = { day: number; word: string };

export const parseCompletedAnswers = (csv: string): CompletedAnswer[] => {
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift()?.split(',') ?? [];
    const dayIndex = headers.indexOf('day');
    const wordIndex = headers.indexOf('tango_pro');
    const playerIndex = headers.indexOf('player');
    if (Math.min(dayIndex, wordIndex, playerIndex) < 0) throw new Error('Unexpected analysis CSV');

    const rows = lines.map(line => line.split(','));
    const days = [...new Set(rows.map(row => Number(row[dayIndex])))]
        .filter(Number.isInteger)
        .sort((a, b) => a - b);
    // CSV は翌日分まで載ることがある。プレイヤー数があっても最新2日を使わない。
    const firstExcludedDay = days.at(-2) ?? Infinity;
    return rows.flatMap(row => {
        const day = Number(row[dayIndex]);
        const word = row[wordIndex] ?? '';
        return day < firstExcludedDay && Number(row[playerIndex]) > 0 && word.length === 5
            ? [{ day, word }]
            : [];
    });
};
