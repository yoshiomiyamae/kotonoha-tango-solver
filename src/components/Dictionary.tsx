import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { $dictionary, computeMostLikelyKana } from "../stores/Dictionary";

type SelectionType = 'confirmed' | 'included' | 'excluded';
type RadioSelection = (SelectionType | null)[];

const INITIAL_POSITIONS: string[] = ['', '', '', '', ''];
const INITIAL_RADIO: RadioSelection = [null, null, null, null, null];

const removeFromArray = (arr: string[], item: string): string[] => {
    const index = arr.indexOf(item);
    return index !== -1 ? [...arr.slice(0, index), ...arr.slice(index + 1)] : arr;
};

export const Dictionary = () => {
    const dictionary = useStore($dictionary);
    const [confirmed, setConfirmed] = useState<string[]>(INITIAL_POSITIONS);
    const [included, setIncluded] = useState<string[]>([]);
    const [excluded, setExcluded] = useState<string[]>([]);
    const [radioSelection, setRadioSelection] = useState<RadioSelection>(INITIAL_RADIO);
    const [turn, setTurn] = useState<number>(0);

    const mostLikely = useMemo(
        () => computeMostLikelyKana(dictionary, confirmed, included, excluded),
        [dictionary, confirmed, included, excluded]
    );

    useEffect(() => {
        if (!mostLikely) return;

        const newRadioSelection = mostLikely.split('').map((char, i) => {
            if (confirmed[i] !== '') return 'confirmed';
            if (included.includes(char) || confirmed.includes(char)) return 'included';
            return null;
        }) as RadioSelection;

        setRadioSelection(newRadioSelection);
    }, [mostLikely, confirmed, included]);

    const handleNext = useCallback(() => {
        if (!mostLikely || radioSelection.some(sel => sel === null)) return;

        let newConfirmed = [...confirmed];
        let newIncluded = [...included];
        let newExcluded = [...excluded];

        mostLikely.split('').forEach((char, i) => {
            const selection = radioSelection[i];
            if (!selection) return;

            switch (selection) {
                case 'confirmed':
                    newConfirmed[i] = char;
                    newIncluded = removeFromArray(newIncluded, char);
                    newExcluded = removeFromArray(newExcluded, char);
                    break;
                case 'included':
                    if (!newIncluded.includes(char) && newConfirmed[i] !== char) {
                        newIncluded.push(char);
                    }
                    if (newConfirmed[i] === char) {
                        newConfirmed[i] = '';
                    }
                    newExcluded = removeFromArray(newExcluded, char);
                    break;
                case 'excluded':
                    if (!newExcluded.includes(char)) {
                        newExcluded.push(char);
                    }
                    if (newConfirmed[i] === char) {
                        newConfirmed[i] = '';
                    }
                    newIncluded = removeFromArray(newIncluded, char);
                    break;
            }
        });

        setConfirmed(newConfirmed);
        setIncluded(newIncluded);
        setExcluded(newExcluded);
        setRadioSelection(newConfirmed.map(c => c !== '' ? 'confirmed' : null) as RadioSelection);
        setTurn(turn + 1);
    }, [radioSelection, mostLikely, confirmed, included, excluded, turn]);

    const handleRadioChange = useCallback((index: number, value: SelectionType) => {
        setRadioSelection(prev => {
            const newSelection = [...prev];
            newSelection[index] = value;
            return newSelection;
        });
    }, []);

    const handleReset = useCallback(() => {
        setConfirmed(INITIAL_POSITIONS);
        setIncluded([]);
        setExcluded([]);
        setRadioSelection(INITIAL_RADIO);
        setTurn(0);
    }, []);

    const isCharAlreadyConstrained = (char: string) => {
        return included.includes(char) || confirmed.includes(char);
    };

    return (
        <div>
            <div>ターン: {turn}</div>
            <div>
                <span>たぶんこれ:</span>
                {mostLikely?.split('').map((char, index) => (
                    <span
                        key={`candidate-${index}`}
                        style={{ color: confirmed[index] === char ? 'green' : 'black' }}
                    >
                        {char}
                    </span>
                ))}
            </div>
            <div>
                {mostLikely?.split('').map((char, index) => (
                    <div key={`char-${index}`}>
                        <span>{char}</span>
                        {confirmed[index] === char ? (
                            <span>（確定）</span>
                        ) : (
                            <>
                                <input
                                    type="radio"
                                    style={{ backgroundColor: 'lightgreen' }}
                                    name={`char-${index}`}
                                    value="confirmed"
                                    checked={radioSelection[index] === 'confirmed'}
                                    onChange={() => handleRadioChange(index, 'confirmed')}
                                />
                                確定
                                <input
                                    type="radio"
                                    style={{ backgroundColor: 'orange' }}
                                    name={`char-${index}`}
                                    value="included"
                                    checked={radioSelection[index] === 'included'}
                                    onChange={() => handleRadioChange(index, 'included')}
                                />
                                含む
                                {!isCharAlreadyConstrained(char) && (
                                    <>
                                        <input
                                            type="radio"
                                            style={{ backgroundColor: 'silver' }}
                                            name={`char-${index}`}
                                            value="excluded"
                                            checked={radioSelection[index] === 'excluded'}
                                            onChange={() => handleRadioChange(index, 'excluded')}
                                        />
                                        含まない
                                    </>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
            <button type="button" onClick={handleNext}>
                次へ
            </button>
            <button type="button" onClick={handleReset}>
                リセット
            </button>
        </div>
    );
};
