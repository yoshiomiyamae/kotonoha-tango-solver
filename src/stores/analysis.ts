/** 過去回の分析データだけを実力測定に使う。当日行は未確定でも含まれ得る。 */
export type CompletedAnswer = { day: number; word: string };

export const parseCompletedAnswers = (csv: string): CompletedAnswer[] => {
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift()?.split(',') ?? [];
    const dayIndex = headers.indexOf('day');
    const wordIndex = headers.indexOf('tango_pro');
    const playerIndex = headers.indexOf('player');
    if (Math.min(dayIndex, wordIndex, playerIndex) < 0) throw new Error('Unexpected analysis CSV');

    const rows = lines.map(line => line.split(','));
    const newestDay = Math.max(...rows.map(row => Number(row[dayIndex])));
    return rows.flatMap(row => {
        const day = Number(row[dayIndex]);
        const word = row[wordIndex] ?? '';
        return day < newestDay && Number(row[playerIndex]) > 0 && word.length === 5
            ? [{ day, word }]
            : [];
    });
};
