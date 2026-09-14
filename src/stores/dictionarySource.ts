import { parseDictionary } from './solver';

/** このプロジェクト唯一の外部依存。アプリもシミュレーションもここから引く。 */
export const DICTIONARY_URL =
    'https://raw.githubusercontent.com/plumchloride/tango/refs/heads/main/kotonoha-tango/public/data/Q_fil_ippan.csv';

export const fetchDictionary = async (): Promise<string[]> => {
    const res = await fetch(DICTIONARY_URL);
    if (!res.ok) {
        throw new Error('Failed to fetch dictionary data');
    }
    return parseDictionary(await res.text());
};
