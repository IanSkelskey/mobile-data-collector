import { useState, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { appMode, currentSessionData } from '../utils/jotai';
import { db } from '../index';
import { collection, getDocsFromCache, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import RecaptureHistoryModal from './RecaptureHistoryModal';
import toeCodeModel from '../utils/toeCodeModel';

const { footOptions, toeOptions } = toeCodeModel;

export default function ToeCodeInput({
    toeCode,
    setToeCode,
    speciesCode,
    isRecapture,
    setIsRecapture,
}) {
    const [selected, setSelected] = useState(toeCodeModel.getInitialSelection());
    const [errorMsg, setErrorMsg] = useState();
    const [isValid, setIsValid] = useState(false);
    const currentData = useAtomValue(currentSessionData);
    const [recaptureHistoryIsOpen, setRecaptureHistoryIsOpen] = useState(false);
    const [historyButtonText, setHistoryButtonText] = useState('History');
    const [previousLizardEntries, setPreviousLizardEntries] = useState([]);
    const [toeCodeBeforeEdit, setToeCodeBeforeEdit] = useState(toeCode);
    const [isRecaptureBeforeEdit, setIsRecaptureBeforeEdit] = useState(isRecapture);
    const [isCheckingValidity, setIsCheckingValidity] = useState(false);
    const [confirmUnusual, setConfirmUnusual] = useState(false);
    // Fleeting feedback for keypresses we block (e.g. out-of-order letters). Kept
    // separate from errorMsg so a rejected press—which doesn't change the code—
    // can't leave behind a stale message that misdescribes the current code.
    const [keypadHint, setKeypadHint] = useState('');

    const modalToggleRef = useRef(null);
    const validationRequestRef = useRef(0);
    const keypadHintTimerRef = useRef(null);

    const environment = useAtomValue(appMode);

    const showKeypadHint = (message) => {
        setKeypadHint(message);
        clearTimeout(keypadHintTimerRef.current);
        keypadHintTimerRef.current = setTimeout(() => setKeypadHint(''), 1800);
    };

    useEffect(() => {
        checkToeCodeValidity();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toeCode, isRecapture, speciesCode]);

    useEffect(() => () => clearTimeout(keypadHintTimerRef.current), []);

    useEffect(() => {
        setConfirmUnusual(false);
        // A successful press changed the code, so any rejection hint is now stale.
        setKeypadHint('');
        clearTimeout(keypadHintTimerRef.current);
    }, [toeCode]);

    const maxToeCodeLength = toeCodeModel.maxLength;

    const { hasUnusualPattern, detail: unusualPatternDetail } =
        toeCodeModel.getUnusualPattern(toeCode);
    const statusMessage = keypadHint
        ? keypadHint
        : !toeCode
        ? 'Enter or suggest a toe-clip code.'
        : isCheckingValidity
        ? 'Checking toe-clip code availability...'
        : errorMsg
        ? errorMsg
        : hasUnusualPattern && confirmUnusual
        ? `Unusual pattern: ${unusualPatternDetail}. Press Save again to confirm.`
        : hasUnusualPattern
        ? `Unusual pattern: ${unusualPatternDetail}. Double-check this is intentional.`
        : isValid
        ? 'Toe-clip code is valid and ready to save.'
        : 'Enter or suggest a toe-clip code.';
    const statusClassName = keypadHint
        ? 'border-red-700 bg-red-50 text-red-800'
        : !toeCode
        ? 'border-black/30 bg-black/5 text-black/70'
        : isCheckingValidity
        ? 'border-black/30 bg-black/5 text-black/70'
        : errorMsg
        ? 'border-red-700 bg-red-50 text-red-800'
        : hasUnusualPattern
        ? 'border-amber-400 bg-amber-50 text-amber-800'
        : isValid
        ? 'border-green-700 bg-green-50 text-green-800'
        : 'border-black/30 bg-black/5 text-black/70';

    const formattedToeCodes = toeCodeModel.formatForDisplay(toeCode);

    const resetSelected = () => {
        setSelected(toeCodeModel.getInitialSelection());
    };

    const handleToeCodeModalOpen = () => {
        if (!speciesCode) return;
        setToeCodeBeforeEdit(toeCode);
        setIsRecaptureBeforeEdit(isRecapture);
        modalToggleRef.current?.click();
    };

    const cancelToeCodeEntry = () => {
        setToeCode(toeCodeBeforeEdit);
        setIsRecapture(isRecaptureBeforeEdit);
        resetSelected();
        setErrorMsg();
        setConfirmUnusual(false);
    };

    const saveToeCodeEntry = () => {
        if (!isValid) return;
        if (hasUnusualPattern && !confirmUnusual) {
            setConfirmUnusual(true);
            return;
        }
        modalToggleRef.current?.click();
    };

    const generateNewToeCode = async () => {
        if (toeCode.includes('C4') || toeCode.includes('D4')) {
            setErrorMsg('App does not generate toe clip codes with C4 or D4');
        }
        console.log(`Environment: ${environment}`);
        const collectionName =
            environment === 'live'
                ? `${currentData.project.replace(/\s/g, '')}Data`
                : `Test${currentData.project.replace(/\s/g, '')}Data`;
        const lizardSnapshot = await getDocsFromCache(
            query(
                collection(db, collectionName),
                where('site', '==', currentData.site),
                where('speciesCode', '==', speciesCode)
            )
        );
        console.log(
            `${collectionName} from site ${currentData.site} with species code ${speciesCode}`
        );
        const toeCodesArray = [];
        lizardSnapshot.docs.forEach((document) => {
            toeCodesArray.push(toeCodeModel.getCanonicalCode(document.data().toeClipCode));
        });
        console.log(toeCodesArray);
        const toeCodesTemplateSnapshot = await getDocsFromCache(
            query(collection(db, 'AnswerSet'), where('set_name', '==', 'toe clip codes'))
        );

        // if current toe code is nonempty, then there is a toe that is already gone,
        // and we would like to utilize the natural toe loss in the toe clip code.
        // this will also work when toeCode = ''
        for (const templateToeCode of toeCodesTemplateSnapshot.docs[0].data().answers) {
            if (
                templateToeCode.primary.includes(toeCode) && // the template code contains the current toeCode
                !templateToeCode.primary.includes('C4') && // it does not contain "C4"
                !templateToeCode.primary.includes('D4') && // it does not contain "C4"
                !toeCodesArray.includes(templateToeCode.primary) // it has not be already used
            ) {
                setToeCode(templateToeCode.primary);
                resetSelected();
                return;
            }
        }

        console.log('no toe codes available that include what we want, grabbing first available');

        // if we got here then we don't have a template toe code that contains what we want, so just
        // grab the first available
        for (const templateToeCode of toeCodesTemplateSnapshot.docs[0].data().answers) {
            if (
                !toeCodesArray.includes(templateToeCode.primary) &&
                !templateToeCode.primary.includes('C4') &&
                !templateToeCode.primary.includes('D4')
            ) {
                setToeCode(templateToeCode.primary);
                resetSelected();
                return;
            }
        }
    };

    const checkToeCodeValidity = async () => {
        const validationRequestId = ++validationRequestRef.current;
        if (!speciesCode) {
            setIsCheckingValidity(false);
            setIsValid(false);
            setErrorMsg('Select a species before entering a toe-clip code');
            return;
        }
        const validationMessage = toeCodeModel.getValidationMessage(toeCode);
        if (validationMessage) {
            setIsCheckingValidity(false);
            setIsValid(false);
            setErrorMsg(validationMessage);
        } else {
            setIsCheckingValidity(true);
            setIsValid(false);
            setErrorMsg();
            const canonicalToeCode = toeCodeModel.getCanonicalCode(toeCode);
            const collectionName =
                environment === 'live'
                    ? `${currentData.project.replace(/\s/g, '')}Data`
                    : `Test${currentData.project.replace(/\s/g, '')}Data`;
            const lizardSnapshot = await getDocsFromCache(
                query(
                    collection(db, collectionName),
                    where('site', '==', currentData.site),
                    where('speciesCode', '==', speciesCode)
                )
            );
            if (validationRequestId !== validationRequestRef.current) return;
            setIsCheckingValidity(false);
            const matchingLizardEntries = lizardSnapshot.docs.filter((document) => {
                return (
                    toeCodeModel.getCanonicalCode(document.data().toeClipCode) === canonicalToeCode
                );
            });
            if (isRecapture) {
                if (matchingLizardEntries.length > 0) {
                    setIsValid(true);
                    setErrorMsg();
                } else {
                    setErrorMsg(
                        'Toe Clip Code is not previously recorded, please uncheck the recapture box to record a new entry'
                    );
                    setIsValid(false);
                }
            } else {
                if (matchingLizardEntries.length > 0) {
                    setErrorMsg(
                        'Toe Clip Code is already taken, choose another or check recapture box'
                    );
                    setIsValid(false);
                } else {
                    setIsValid(true);
                    setErrorMsg();
                }
            }
        }
    };

    const handleClick = (source) => {
        if (source !== 'backspace' && toeCode.length < maxToeCodeLength) {
            if (Number(source)) {
                if (toeCode.length === 0) {
                    showKeypadHint('Toe Clip Codes must begin with a letter');
                    return;
                }
                if (!Number(toeCode.charAt(toeCode.length - 1))) {
                    const nextToeCode = `${toeCode}${source}`;
                    const validationMessage = toeCodeModel.getValidationMessage(nextToeCode);
                    if (validationMessage) {
                        showKeypadHint(validationMessage);
                        return;
                    }
                    setToeCode(nextToeCode);
                    resetSelected();
                }
            } else {
                if (Number(toeCode.charAt(toeCode.length - 1)) || toeCode.length === 0) {
                    // console.log("letter pressed")
                    const previousLetter = toeCode.charAt(toeCode.length - 2);
                    if (toeCode.length >= 2 && source < previousLetter) {
                        showKeypadHint('Letters must be in alphabetical order');
                        return;
                    }
                    if (
                        toeCode.length >= 2 &&
                        source === previousLetter &&
                        toeCode.charAt(toeCode.length - 1) === '5'
                    ) {
                        showKeypadHint('No higher toe number is available on this foot');
                        return;
                    }
                    setToeCode(`${toeCode}${source}`);
                    setSelected({ ...selected, [source]: !selected[source] });
                }
            }
        } else if (source === 'backspace') {
            setToeCode(toeCode.substring(0, toeCode.length - 1));
            const previousCharacter = toeCode.charAt(toeCode.length - 2);
            const previousLetter =
                previousCharacter && !Number(previousCharacter) ? previousCharacter : '';
            setSelected(toeCodeModel.getInitialSelection(previousLetter));
        }
    };

    const findPreviousLizardEntries = async () => {
        setHistoryButtonText('Querying...');
        const collectionName =
            environment === 'live'
                ? `${currentData.project.replace(/\s/g, '')}Data`
                : `Test${currentData.project.replace(/\s/g, '')}Data`;
        const lizardDataRef = collection(db, collectionName);
        const q = query(
            lizardDataRef,
            where('site', '==', currentData.site),
            where('speciesCode', '==', speciesCode)
        );
        const lizardEntriesSnapshot = await getDocsFromCache(q);
        let tempArray = [];
        const canonicalToeCode = toeCodeModel.getCanonicalCode(toeCode);
        for (const doc of lizardEntriesSnapshot.docs) {
            if (toeCodeModel.getCanonicalCode(doc.data().toeClipCode) !== canonicalToeCode)
                continue;
            console.log(doc.data());
            tempArray.push(doc.data());
        }
        // Chronological order; entries with missing/unparseable dates sort first.
        const entryTime = (entry) => {
            const time = new Date(entry.dateTime).getTime();
            return Number.isNaN(time) ? 0 : time;
        };
        tempArray.sort((a, b) => entryTime(a) - entryTime(b));
        setPreviousLizardEntries(tempArray);
        setRecaptureHistoryIsOpen(true);
        setHistoryButtonText('History');
    };

    return (
        <AnimatePresence>
            <motion.div>
                <AnimatePresence>
                    {recaptureHistoryIsOpen && (
                        <RecaptureHistoryModal
                            currentData={currentData}
                            speciesCode={speciesCode}
                            toeCode={toeCode}
                            previousLizardEntries={previousLizardEntries}
                            onClose={() => setRecaptureHistoryIsOpen(false)}
                        />
                    )}
                </AnimatePresence>

                <button
                    type="button"
                    disabled={!speciesCode}
                    title={!speciesCode ? 'Select a species before entering a toe-clip code' : ''}
                    className="flex min-h-14 min-w-52 flex-col items-center justify-center rounded-lg border-2 border-asu-maroon bg-white px-4 py-2 text-black transition hover:bg-white/50 active:scale-95 disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-black/5 disabled:text-black/60 disabled:hover:bg-black/5 disabled:active:scale-100"
                    onClick={handleToeCodeModalOpen}
                >
                    <span className="text-xl leading-tight">
                        {toeCode ? `Toe-Clip Code: ${toeCode}` : 'Toe-Clip Code'}
                    </span>
                    {!speciesCode && (
                        <span className="text-xs leading-tight">Select species first</span>
                    )}
                </button>

                <input
                    ref={modalToggleRef}
                    type="checkbox"
                    id="my-modal-4"
                    className="
          modal-toggle
          "
                />

                <motion.div className="toe-code-modal modal z-40">
                    <div className="toe-code-modal__panel modal-box relative flex flex-col items-center justify-start gap-1 overflow-y-auto bg-white px-2">
                        <div className="flex w-full max-w-xs items-center gap-2">
                            <div
                                role="status"
                                aria-live="polite"
                                className={`toe-code-modal__status flex flex-1 items-center justify-center rounded-lg border px-2 py-1 text-center text-sm leading-tight ${statusClassName}`}
                            >
                                {statusMessage}
                            </div>
                            <label
                                htmlFor="my-modal-4"
                                aria-label="Cancel toe-clip code entry"
                                className="toe-code-modal__close flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-asu-maroon bg-white text-xl font-semibold leading-none text-asu-maroon active:scale-90"
                                onClick={cancelToeCodeEntry}
                            >
                                X
                            </label>
                        </div>
                        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1">
                            <div className="order-3 w-full max-w-xs">
                                <div className="toe-code-modal__code-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                    <div className="flex min-w-0 flex-col items-center text-center">
                                        <p className="text-xs leading-none text-black/60">
                                            Current toe-clip code
                                        </p>
                                        <p className="mt-2 min-w-0 break-words text-xl leading-tight">
                                            {formattedToeCodes}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isRecapture}
                                        onClick={() => generateNewToeCode()}
                                        className="toe-code-modal__compact-control rounded-lg bg-asu-maroon px-3 text-sm font-semibold leading-tight text-asu-gold transition active:scale-90 active:brightness-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                                    >
                                        Suggest Code
                                    </button>
                                </div>
                            </div>
                            <div className="toe-code-modal__image-region order-2 flex min-h-0 w-full max-w-xs flex-1 flex-col items-center">
                                <img
                                    src="./toe-code-diagram.svg"
                                    alt="Diagram showing a lizard with feed labeled A-D and toes labeled 1-5."
                                    className="toe-code-modal__image min-h-0 w-full flex-1 object-contain"
                                />
                            </div>
                        </div>
                        <div className="flex w-full flex-none flex-col items-center justify-center gap-1">
                            <div className="mt-1 grid w-full max-w-xs grid-cols-[1fr_auto] gap-2">
                                <button
                                    type="button"
                                    aria-pressed={isRecapture}
                                    onClick={() => setIsRecapture(!isRecapture)}
                                    className={`toe-code-modal__standard-control flex min-w-0 items-center justify-between gap-2 rounded-lg border-2 border-asu-maroon px-3 text-left text-asu-maroon transition active:scale-[0.98] ${
                                        isRecapture
                                            ? 'bg-asu-maroon/10'
                                            : 'bg-white hover:bg-asu-maroon/5'
                                    }`}
                                >
                                    <span className="whitespace-nowrap text-sm leading-tight">
                                        Capture type
                                    </span>
                                    <span
                                        className={`rounded px-2 py-1 text-sm font-semibold leading-tight ${
                                            isRecapture ? 'bg-white shadow-sm' : 'bg-asu-maroon/10'
                                        }`}
                                    >
                                        {isRecapture ? 'Recapture' : 'New'}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    disabled={!isRecapture || !isValid}
                                    onClick={() => findPreviousLizardEntries()}
                                    className="toe-code-modal__standard-control w-24 rounded-lg border-2 border-asu-maroon bg-white px-2 text-sm leading-tight text-asu-maroon transition active:scale-90 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                                >
                                    {historyButtonText}
                                </button>
                            </div>
                            <div className="mt-2 grid w-full max-w-xs grid-cols-5 items-center gap-1">
                                {footOptions.map((letter) => (
                                    <Button
                                        key={letter}
                                        prompt={letter}
                                        handler={() => handleClick(letter)}
                                        isSelected={selected[letter]}
                                    />
                                ))}
                                <button
                                    type="button"
                                    aria-label="Delete last toe-code character"
                                    className="toe-code-modal__key w-full rounded-xl bg-asu-maroon text-2xl text-asu-gold brightness-100 transition active:scale-90 active:brightness-50"
                                    onClick={() => handleClick('backspace')}
                                >
                                    <svg
                                        aria-hidden="true"
                                        className="mx-auto h-8 w-8"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
                                        <path d="m18 9-6 6" />
                                        <path d="m12 9 6 6" />
                                    </svg>
                                </button>
                            </div>
                            <div className="grid w-full max-w-xs grid-cols-5 items-center gap-1">
                                {toeOptions.map((number) => (
                                    <Button
                                        key={number}
                                        prompt={number}
                                        handler={() => handleClick(number)}
                                        isSelected={selected[number]}
                                    />
                                ))}
                            </div>
                            <div className="mt-1 w-full max-w-xs">
                                <button
                                    type="button"
                                    disabled={!isValid}
                                    onClick={saveToeCodeEntry}
                                    className={`toe-code-modal__standard-control w-full rounded-xl px-2 text-xl capitalize text-asu-gold transition active:scale-90 active:brightness-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
                                        hasUnusualPattern && confirmUnusual
                                            ? 'bg-amber-900'
                                            : 'bg-asu-maroon'
                                    }`}
                                >
                                    {hasUnusualPattern && confirmUnusual
                                        ? 'Confirm unusual code'
                                        : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function Button({ prompt, handler, isSelected }) {
    return (
        <button
            className={
                isSelected
                    ? `toe-code-modal__key w-full rounded-xl bg-asu-maroon text-2xl capitalize text-asu-gold brightness-50 transition active:scale-90 active:brightness-50`
                    : `toe-code-modal__key w-full rounded-xl bg-asu-maroon text-2xl capitalize text-asu-gold brightness-100 transition active:scale-90 active:brightness-50`
            }
            onClick={handler}
        >
            {prompt}
        </button>
    );
}
