import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { $dictionary, $dictionaryError } from "../stores/Dictionary";
import { WORD_LENGTH, confirmedFromHistory, suggest, type Guess, type Mark } from "../stores/solver";

type MarkSelection = (Mark | null)[];

const INITIAL_MARKS: MarkSelection = Array(WORD_LENGTH).fill(null);

const MARK_LABELS: { value: Mark; label: string }[] = [
    { value: 'hit', label: '確定' },
    { value: 'blow', label: '含む' },
    { value: 'miss', label: '除外' },
];

export const Dictionary = () => {
    const dictionary = useStore($dictionary);
    const dictionaryError = useStore($dictionaryError);
    const [history, setHistory] = useState<Guess[]>([]);
    const [marks, setMarks] = useState<MarkSelection>(INITIAL_MARKS);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

    const { mostLikely, likely, remaining } = useMemo(
        () => suggest(dictionary, history),
        [dictionary, history]
    );
    const confirmed = useMemo(() => confirmedFromHistory(history), [history]);

    // 表示する単語を選択（selectedCandidateがあればそれ、なければmostLikely）
    const displayWord = selectedCandidate || mostLikely;
    const alternatives = likely.filter(word => word !== displayWord);

    // 確定済みの位置は必ず緑が返るので、あらかじめ埋めておく
    useEffect(() => {
        if (!displayWord) return;
        setMarks(displayWord.split('').map((char, i) => (confirmed[i] === char ? 'hit' : null)));
    }, [displayWord, confirmed]);

    const handleNext = useCallback(() => {
        if (!displayWord || marks.some(mark => mark === null)) return;
        setHistory(prev => [...prev, { word: displayWord, marks: marks as Mark[] }]);
        setSelectedCandidate(null);
    }, [displayWord, marks]);

    const handleMarkChange = useCallback((index: number, value: Mark) => {
        // 同じ文字でも位置ごとに色は独立。ここで揃えると重複文字の個数情報が消える
        setMarks(prev => prev.map((mark, i) => (i === index ? value : mark)));
    }, []);

    const handleUndo = useCallback(() => {
        setHistory(prev => prev.slice(0, -1));
        setSelectedCandidate(null);
    }, []);

    const handleReset = useCallback(() => {
        setHistory([]);
        setSelectedCandidate(null);
    }, []);

    const handleCandidateClick = useCallback((word: string) => {
        setSelectedCandidate(word);
    }, []);

    return (
        <div className="uk-container uk-container-small" style={{ padding: '8px' }}>
            {/* ヘッダー - 狭い画面ではタイトルと操作を2段に分ける */}
            <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                <h1 className="uk-margin-remove" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    ことのは単語ソルバー
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="uk-label" style={{ fontSize: '0.75rem' }}>ターン {history.length}</span>
                        <span className="uk-label" style={{ fontSize: '0.75rem' }}>
                            残り {dictionary.length === 0 ? '—' : remaining}
                        </span>
                    </div>
                    {/* 折り返しても右端に寄るように、間を auto マージンで埋める */}
                    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        <button
                            className="uk-button uk-button-default uk-button-small"
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            style={{ padding: '4px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                            戻る
                        </button>
                        <button
                            className="uk-button uk-button-danger uk-button-small"
                            onClick={handleReset}
                            style={{ padding: '4px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                            リセット
                        </button>
                    </div>
                </div>
            </div>

            {dictionaryError ? (
                <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                    <p className="uk-text-danger uk-margin-remove" style={{ fontSize: '0.9rem' }}>
                        辞書を取得できなかったわ。通信を確認して読み込み直して。
                    </p>
                </div>
            ) : dictionary.length === 0 ? (
                <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                    <p className="uk-margin-remove" style={{ fontSize: '0.9rem' }}>辞書を読み込み中…</p>
                </div>
            ) : !displayWord ? (
                <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                    <p className="uk-text-danger uk-margin-remove" style={{ fontSize: '0.9rem' }}>
                        条件を満たす単語がないわ。入力した色のどれかが違うか、辞書に載っていない単語ね。
                        「戻る」で一手戻して確認して。
                    </p>
                </div>
            ) : (
                <>
                    {/* 推奨単語カード - コンパクト化 */}
                    <div className="uk-card uk-card-primary uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                        <div className="uk-text-center" style={{ fontSize: '1.8rem', letterSpacing: '0.4rem', fontWeight: 'bold' }}>
                            {displayWord.split('').map((char, index) => (
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
                        {displayWord.split('').map((char, index) => (
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
                                            {MARK_LABELS.map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    className={`uk-button uk-button-small ${marks[index] === value ? 'uk-button-primary' : 'uk-button-default'}`}
                                                    onClick={() => handleMarkChange(index, value)}
                                                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
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
                            disabled={marks.some(mark => mark === null)}
                            style={{ padding: '12px 16px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        >
                            次へ
                        </button>
                    </div>

                    {/* その他の候補 - ボタン化 */}
                    {alternatives.length > 0 && (
                        <div className="uk-card uk-card-default uk-card-body uk-padding-small" style={{ marginBottom: '8px' }}>
                            <h4 className="uk-margin-remove-bottom" style={{ fontSize: '0.9rem', marginBottom: '6px' }}>ほかの候補</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                {alternatives.map((word, idx) => (
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
                </>
            )}
        </div>
    );
};
