import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { $dictionary, computeMostLikelyKana } from "../stores/Dictionary";

export const Dictionary = () => {
    const dictionary = useStore($dictionary);
    const [confirmed, setConfirmed] = useState<string[]>(['', '', '', '', '']);
    const [included, setIncluded] = useState<string[]>([]);
    const [excluded, setExcluded] = useState<string[]>([]);
    const [radioSelection, setRadioSelection] = useState<(string | null)[]>([null, null, null, null, null]);
    const [turn, setTurn] = useState<number>(0);

    const mostLikely = useMemo(() => computeMostLikelyKana(dictionary, confirmed, included, excluded), [dictionary, confirmed, included, excluded]);
    useEffect(() => {
        if (!mostLikely) {
            return;
        }
        const newRadioSelection = [...radioSelection];
        for (let i = 0; i < 5; i++) {
            if (confirmed[i] !== '') {
                newRadioSelection[i] = 'confirmed';
            } else if (included.includes(mostLikely![i])) {
                newRadioSelection[i] = 'included';
            } else {
                newRadioSelection[i] = null;
            }
        }
        setRadioSelection(newRadioSelection);
    }, [mostLikely]);
    const handleNext = useCallback(() => {
        // 選ばれていないradioがある場合は何もしない
        for (let i = 0; i < 5; i++) {
            if (radioSelection[i] === null) {
                return;
            }
        }
        const newConfirmed = [...confirmed];
        const newIncluded = [...included];
        const newExcluded = [...excluded];
        for (let i = 0; i < 5; i++) {
            const char = mostLikely![i];
            const selection = radioSelection[i];
            if (selection === 'confirmed') {
                newConfirmed[i] = char;
                // 確定した文字は含む・含まないリストから削除
                const includedIndex = newIncluded.indexOf(char);
                if (includedIndex !== -1) {
                    newIncluded.splice(includedIndex, 1);
                }
                const excludedIndex = newExcluded.indexOf(char);
                if (excludedIndex !== -1) {
                    newExcluded.splice(excludedIndex, 1);
                }
            } else if (selection === 'included') {
                if (!newIncluded.includes(char) && newConfirmed[i] !== char) {
                    newIncluded.push(char);
                }
                // 含むに追加した文字は確定リストから削除
                if (newConfirmed[i] === char) {
                    newConfirmed[i] = '';
                }
                // 含むに追加した文字は含まないリストから削除
                const excludedIndex = newExcluded.indexOf(char);
                if (excludedIndex !== -1) {
                    newExcluded.splice(excludedIndex, 1);
                }
            } else if (selection === 'excluded') {
                if (!newExcluded.includes(char)) {
                    newExcluded.push(char);
                }
                // 含まないに追加した文字は確定リストから削除
                if (newConfirmed[i] === char) {
                    newConfirmed[i] = '';
                }
                // 含まないに追加した文字は含むリストから削除
                const includedIndex = newIncluded.indexOf(char);
                if (includedIndex !== -1) {
                    newIncluded.splice(includedIndex, 1);
                }
            }
        }
        setConfirmed(newConfirmed);
        setIncluded(newIncluded);
        setExcluded(newExcluded);
        const newRadioSelection = [...radioSelection];
        for (let i = 0; i < 5; i++) {
            if (newConfirmed[i] !== '') {
                newRadioSelection[i] = 'confirmed';
            } else {
                newRadioSelection[i] = null;
            }
        }
        setRadioSelection(newRadioSelection);
        setTurn(turn + 1);
    }, [radioSelection, mostLikely, confirmed, included, excluded, turn]);

    const handleRadioChange = useCallback((index: number, value: string) => {
        const newRadioSelection = [...radioSelection];
        newRadioSelection[index] = value;
        setRadioSelection(newRadioSelection);
    }, [radioSelection]);

    return <div>
        <div>ターン: {turn}</div>
        <div>
            <span>たぶんこれ:</span>
            {mostLikely?.split('').map((char, index) => (
                <span key={`candidate-${index}`} style={{ color: confirmed[index] === char ? 'green' : 'black' }}>{char}</span>
            ))}
        </div>
        <div>
            {mostLikely?.split('').map((char, index) => (
                <div key={`char-${index}`}>
                    <span>{char}</span>
                    {confirmed[index] === char ? <span>（確定）</span> : <>
                        <input type="radio" style={{ backgroundColor: 'lightgreen' }} name={`char-${index}`} value="confirmed" checked={radioSelection[index] === 'confirmed'} onChange={() => handleRadioChange(index, 'confirmed')} />確定
                        <input type="radio" style={{ backgroundColor: 'orange' }} name={`char-${index}`} value="included" checked={radioSelection[index] === 'included'} onChange={() => handleRadioChange(index, 'included')} />含む
                        {included.includes(char) ? null : <><input type="radio" style={{ backgroundColor: 'silver' }} name={`char-${index}`} value="excluded" checked={radioSelection[index] === 'excluded'} onChange={() => handleRadioChange(index, 'excluded')} />含まない</>}
                    </>}
                </div>
            ))}
        </div>
        <button type="button" onClick={handleNext}>次へ</button>
        <button type="button" onClick={() => {
            setConfirmed(['', '', '', '', '']);
            setIncluded([]);
            setExcluded([]);
            setRadioSelection([null, null, null, null, null]);
            setTurn(0);
        }}>リセット</button>
    </div >
}
