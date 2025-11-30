import { atom } from 'nanostores';

const loadDictionary = async () => {
    const res = await fetch('https://raw.githubusercontent.com/plumchloride/tango/refs/heads/main/kotonoha-tango/public/data/Q_fil_ippan.csv');
    if (!res.ok) {
        throw new Error('Failed to fetch dictionary data');
    }
    const text = await res.text();
    const lines = text.split('\n');
    const entries = lines.map(line => {
        const [_, kana] = line.split(',');
        // ひらがなの場合はカタカナに変換
        return kana.replace(/[\u3041-\u3096]/g, (ch) => {
            return String.fromCharCode(ch.charCodeAt(0) + 0x60);
        });
    });

    return entries;
}

export const $dictionary = atom<string[]>(await loadDictionary());

/**
 * @param dictionary 文字列の配列で構成される辞書データ。
 * @param confirmed 5文字の文字列の配列で、各文字はその位置に確定している文字を表す。未確定の位置は空文字列。
 * @param included 含まれているが位置が未確定な文字の配列。
 * @param excluded 含まれていない文字の配列。
 * @returns 最も可能性の高い5文字の仮名文字列。
 */
export const computeMostLikelyKana = (dictionary: string[], confirmed: string[], included: string[], excluded: string[]) => {
    const filterByConfirmed = (word: string) => {
        for (let i = 0; i < 5; i++) {
            if (confirmed[i] !== '' && word[i] !== confirmed[i]) {
                return false;
            }
        }
        return true;
    }
    const filterByIncluded = (word: string) => {
        for (const char of included) {
            if (!word.includes(char)) {
                return false;
            }
        }
        return true;
    };
    const filterByExcluded = (word: string) => {
        for (const char of excluded) {
            if (word.includes(char)) {
                return false;
            }
        }
        return true;
    }
    const filteredDictionary = dictionary.filter(filterByConfirmed).filter(filterByIncluded).filter(filterByExcluded);
    const joinedEntries = filteredDictionary.join('');
    const characterCount: Record<string, number> = {};
    for (const char of joinedEntries) {
        characterCount[char] = (characterCount[char] || 0) + 1;
    }
    const sortedCharacters = Object.entries(characterCount).sort((a, b) => b[1] - a[1]);

    // 1文字目に来られない文字を判定する関数（小文字、伸ばし棒、ン）
    const canBeFirstChar = (char: string) => {
        const smallKana = /[ァィゥェォッヵヶャュョヮ]/;
        const specialChars = /[ーン]/;
        return !smallKana.test(char) && !specialChars.test(char);
    };

    // 候補文字リストから正規表現パターンを構築し、辞書検索を行う
    const searchWithCandidates = (candidates: string[]): string | undefined => {
        const firstPosChars = candidates.filter(c => canBeFirstChar(c)).join('');
        const allPosChars = candidates.join('');

        let pattern = '^';
        for (let i = 0; i < 5; i++) {
            if (confirmed[i] !== '') {
                pattern += confirmed[i];
            } else {
                pattern += i === 0 ? `[${firstPosChars}]` : `[${allPosChars}]`;
            }
        }
        pattern += '$';

        const regex = new RegExp(pattern);
        const matchingWords = filteredDictionary.filter(word => regex.test(word));

        return matchingWords.length !== 0 ? matchingWords[0] : undefined;
    };

    // 全候補文字のリスト（確定文字も含む）
    const availableChars = sortedCharacters.map(entry => entry[0]);

    // availableCharsが5文字以下の場合は、全てを候補として使用
    if (availableChars.length <= 5) {
        return searchWithCandidates(availableChars);
    }

    // 候補5文字の組み合わせのインデックスを保持
    const positions: number[] = [0, 0, 0, 0, 0];

    // 全ての組み合わせを試す
    while (true) {
        // 現在の5文字の候補を選択
        const selectedCandidates: string[] = [];
        let valid = true;
        const seenChars = new Set<string>();

        for (let i = 0; i < 5; i++) {
            if (positions[i] >= availableChars.length) {
                valid = false;
                break;
            }
            const char = availableChars[positions[i]];
            if (seenChars.has(char)) {
                valid = false;
                break;
            }
            selectedCandidates.push(char);
            seenChars.add(char);
        }

        if (valid) {
            const result = searchWithCandidates(selectedCandidates);
            if (result) return result;
        }

        // 次の組み合わせへ（右から左へインクリメント）
        let incrementPos = 4;
        while (incrementPos >= 0) {
            positions[incrementPos]++;
            if (positions[incrementPos] < availableChars.length) {
                break;
            }
            positions[incrementPos] = 0;
            incrementPos--;
        }

        // 全ての組み合わせを試し終わった
        if (incrementPos < 0) {
            break;
        }
    }
}
