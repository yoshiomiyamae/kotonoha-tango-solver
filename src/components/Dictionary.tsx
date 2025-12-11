import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { $dictionary, computeMostLikelyKana } from "../stores/Dictionary";

type SelectionType = 'confirmed' | 'included' | 'excluded';
type RadioSelection = (SelectionType | null)[];

const WORD_LENGTH = 5;
const INITIAL_POSITIONS: string[] = Array(WORD_LENGTH).fill('');
const INITIAL_RADIO: RadioSelection = Array(WORD_LENGTH).fill(null);
const INITIAL_EXCLUDED_POSITIONS: string[][] = Array(WORD_LENGTH).fill([]).map(() => []);

const removeFromArray = (arr: string[], item: string): string[] => {
    const index = arr.indexOf(item);
    return index !== -1 ? [...arr.slice(0, index), ...arr.slice(index + 1)] : arr;
};

const isCharConfirmedOrIncluded = (char: string, confirmed: string[], included: string[]): boolean => {
    return included.includes(char) || confirmed.includes(char);
};

export const Dictionary = () => {
    const dictionary = useStore($dictionary);
    const [confirmed, setConfirmed] = useState<string[]>(INITIAL_POSITIONS);
    const [included, setIncluded] = useState<string[]>([]);
    const [excluded, setExcluded] = useState<string[]>([]);
    const [excludedPositions, setExcludedPositions] = useState<string[][]>(INITIAL_EXCLUDED_POSITIONS);
    const [radioSelection, setRadioSelection] = useState<RadioSelection>(INITIAL_RADIO);
    const [turn, setTurn] = useState<number>(0);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

    const { mostLikely, likely } = useMemo(
        () => computeMostLikelyKana(dictionary, confirmed, included, excluded, excludedPositions),
        [dictionary, confirmed, included, excluded, excludedPositions]
    );

    // 表示する単語を選択（selectedCandidateがあればそれ、なければmostLikely）
    const displayWord = selectedCandidate || mostLikely;

    useEffect(() => {
        // mostLikelyが変わったらselectedCandidateをリセット
        setSelectedCandidate(null);
    }, [mostLikely]);

    useEffect(() => {
        if (!displayWord) return;

        const newRadioSelection = displayWord.split('').map((char, i) => {
            if (confirmed[i] !== '') return 'confirmed';
            if (isCharConfirmedOrIncluded(char, confirmed, included)) return 'included';
            return null;
        }) as RadioSelection;

        setRadioSelection(newRadioSelection);
    }, [displayWord, confirmed, included]);

    const handleNext = useCallback(() => {
        if (!displayWord || radioSelection.some(sel => sel === null)) return;

        let newConfirmed = [...confirmed];
        let newIncluded = [...included];
        let newExcluded = [...excluded];
        let newExcludedPositions = excludedPositions.map(pos => [...pos]);

        displayWord.split('').forEach((char, i) => {
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
                    // 「含む」を選んだ位置には、その文字は来ない
                    if (!newExcludedPositions[i].includes(char)) {
                        newExcludedPositions[i].push(char);
                    }
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
        setExcludedPositions(newExcludedPositions);
        setRadioSelection(newConfirmed.map(c => c !== '' ? 'confirmed' : null) as RadioSelection);
        setTurn(turn + 1);
        setSelectedCandidate(null); // 次へを押したら選択をリセット
    }, [radioSelection, displayWord, confirmed, included, excluded, excludedPositions, turn]);

    const handleRadioChange = useCallback((index: number, value: SelectionType) => {
        setRadioSelection(prev => {
            const newSelection = [...prev];
            newSelection[index] = value;

            // 同じ文字が複数出現する場合の処理
            if (displayWord) {
                const char = displayWord[index];

                // 確定または含むを選択した場合、同じ文字の他の位置を含むに変更
                if (value === 'confirmed' || value === 'included') {
                    displayWord.split('').forEach((c, i) => {
                        if (c === char && i !== index && confirmed[i] !== char) {
                            // すでに確定されている位置は変更しない
                            if (newSelection[i] !== 'confirmed') {
                                newSelection[i] = 'included';
                            }
                        }
                    });
                }

                // 除外を選択した場合、同じ文字の他の位置も除外に変更
                if (value === 'excluded') {
                    displayWord.split('').forEach((c, i) => {
                        if (c === char && i !== index && confirmed[i] !== char) {
                            // すでに確定されている位置は変更しない
                            if (newSelection[i] !== 'confirmed') {
                                newSelection[i] = 'excluded';
                            }
                        }
                    });
                }
            }

            return newSelection;
        });
    }, [displayWord, confirmed]);

    const handleReset = useCallback(() => {
        setConfirmed(INITIAL_POSITIONS);
        setIncluded([]);
        setExcluded([]);
        setExcludedPositions(INITIAL_EXCLUDED_POSITIONS);
        setRadioSelection(INITIAL_RADIO);
        setTurn(0);
        setSelectedCandidate(null);
    }, []);

    const handleCandidateClick = useCallback((word: string) => {
        setSelectedCandidate(word);
    }, []);


    return (
        <div className="uk-container uk-container-small" style={{ padding: '8px', maxHeight: '100vh', overflow: 'auto' }}>
            {/* ヘッダー - コンパクト化 */}
            <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                <div className="uk-flex uk-flex-between uk-flex-middle">
                    <h1 className="uk-margin-remove" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        ことのは単語ソルバー
                    </h1>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="uk-badge" style={{ fontSize: '0.9rem' }}>ターン {turn}</span>
                        <button
                            className="uk-button uk-button-danger uk-button-small"
                            onClick={handleReset}
                            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        >
                            リセット
                        </button>
                    </div>
                </div>
            </div>

            {/* 推奨単語カード - コンパクト化 */}
            <div className="uk-card uk-card-primary uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                <div className="uk-text-center" style={{ fontSize: '1.8rem', letterSpacing: '0.4rem', fontWeight: 'bold' }}>
                    {displayWord?.split('').map((char, index) => (
                        <span
                            key={`candidate-${index}`}
                            style={{
                                color: confirmed[index] === char ? '#32d296' : 'white',
                                textShadow: confirmed[index] === char ? '0 0 10px #32d296' : 'none'
                            }}
                        >
                            {char}
                        </span>
                    ))}
                </div>
            </div>

            {/* 文字選択カード - コンパクト化 */}
            <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                {displayWord?.split('').map((char, index) => (
                    <div key={`char-${index}`} style={{ marginBottom: '6px' }}>
                        <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                            <div style={{
                                fontSize: '1.3rem',
                                fontWeight: 'bold',
                                minWidth: '32px',
                                textAlign: 'center'
                            }}>
                                {char}
                            </div>
                            {confirmed[index] === char ? (
                                <span className="uk-label uk-label-success" style={{ fontSize: '0.75rem' }}>確定</span>
                            ) : (
                                <div className="uk-button-group" style={{ flex: 1 }}>
                                    <button
                                        className={`uk-button uk-button-small ${radioSelection[index] === 'confirmed' ? 'uk-button-primary' : 'uk-button-default'}`}
                                        onClick={() => handleRadioChange(index, 'confirmed')}
                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                        確定
                                    </button>
                                    <button
                                        className={`uk-button uk-button-small ${radioSelection[index] === 'included' ? 'uk-button-primary' : 'uk-button-default'}`}
                                        onClick={() => handleRadioChange(index, 'included')}
                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                        含む
                                    </button>
                                    {!isCharConfirmedOrIncluded(char, confirmed, included) && (
                                        <button
                                            className={`uk-button uk-button-small ${radioSelection[index] === 'excluded' ? 'uk-button-primary' : 'uk-button-default'}`}
                                            onClick={() => handleRadioChange(index, 'excluded')}
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                        >
                                            除外
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 次へボタン */}
            <div style={{ marginBottom: '8px' }}>
                <button
                    className="uk-button uk-button-primary uk-width-1-1"
                    onClick={handleNext}
                    disabled={!displayWord || radioSelection.some(sel => sel === null)}
                    style={{ padding: '12px 16px', fontSize: '1.1rem', fontWeight: 'bold' }}
                >
                    次へ
                </button>
            </div>

            {/* その他の候補 - ボタン化 */}
            {likely.filter(word => word !== displayWord).length > 0 && (
                <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                    <h4 className="uk-margin-remove-bottom" style={{ fontSize: '0.9rem', marginBottom: '6px' }}>ほかの候補</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {likely.filter(word => word !== displayWord).slice(0, 6).map((word, idx) => (
                            <button
                                key={`likely-${idx}`}
                                className="uk-button uk-button-secondary uk-button-small"
                                onClick={() => handleCandidateClick(word)}
                                style={{
                                    fontSize: '0.85rem',
                                    padding: '4px 8px',
                                    flex: '0 0 calc(50% - 2px)',
                                    cursor: 'pointer'
                                }}
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
