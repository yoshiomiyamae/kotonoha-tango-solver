import { atom } from 'nanostores';
import { fetchDictionary } from './dictionarySource';

/**
 * 空で始めて非同期に差し替える。トップレベル await にすると、この島が
 * ハイドレートするまで CSV の取得（約240ms）を待たされるうえ、
 * 取得に失敗したときにコンポーネントが一切マウントされない。
 */
export const $dictionary = atom<string[]>([]);
export const $dictionaryError = atom<string | null>(null);

if (!import.meta.env.SSR) {
    fetchDictionary()
        .then((words) => $dictionary.set(words))
        .catch((error: unknown) => $dictionaryError.set(String(error)));
}
