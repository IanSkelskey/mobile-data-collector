const footOptions = ['A', 'B', 'C', 'D'];
const toeOptions = ['1', '2', '3', '4', '5'];
const maxLength = 16;
const criticalPairs = ['C4', 'D4'];

const getPairs = (code = '') => {
    const pairs = [];
    for (let index = 0; index < code.length; index += 2) {
        pairs.push({
            foot: code.charAt(index),
            toe: code.charAt(index + 1),
            toeNumber: Number(code.charAt(index + 1)),
            pair: code.slice(index, index + 2),
        });
    }
    return pairs;
};

const hasInvalidPair = (pairs) =>
    pairs.some(({ foot, toe }) => !footOptions.includes(foot) || !toeOptions.includes(toe));

const hasCriticalPair = (code = '') => criticalPairs.some((pair) => code.includes(pair));

const getCanonicalCode = (code = '') => {
    if (!code || code.length % 2) return code;
    const pairs = getPairs(code);
    if (hasInvalidPair(pairs)) return code;

    return pairs
        .sort((first, second) => {
            if (first.foot === second.foot) return first.toeNumber - second.toeNumber;
            return first.foot < second.foot ? -1 : 1;
        })
        .map(({ pair }) => pair)
        .join('');
};

const getValidationMessage = (code = '') => {
    if (code && !footOptions.includes(code.charAt(0))) {
        return 'Toe Clip Code must begin with a letter';
    }
    if (code.length < 2) return 'Toe Clip Code needs to be at least 2 characters long';
    if (code.length % 2) return 'Toe Clip Code must have an even number of characters';

    const pairs = getPairs(code);
    const clippedToes = new Set();
    const previousToeByFoot = {};
    let previousFoot = '';

    for (const { foot, toe, toeNumber, pair } of pairs) {
        if (!footOptions.includes(foot) || !toeOptions.includes(toe)) {
            return 'Toe Clip Code contains an invalid foot or toe number';
        }
        if (previousFoot && foot < previousFoot) {
            return 'Toe Clip Code letters must be in alphabetical order';
        }
        if (clippedToes.has(pair)) {
            return 'Toe Clip Code cannot include the same toe twice';
        }
        if (previousToeByFoot[foot] !== undefined && toeNumber <= previousToeByFoot[foot]) {
            return 'Toe numbers on the same foot must be in ascending order';
        }

        clippedToes.add(pair);
        previousToeByFoot[foot] = toeNumber;
        previousFoot = foot;
    }

    return '';
};

const getUnusualPattern = (code = '') => {
    const footLetters = code.match(/[A-D]/g) ?? [];
    const hasRepeatedFoot = new Set(footLetters).size !== footLetters.length;
    const hasCriticalToe = hasCriticalPair(code);
    const hasUnusualPattern = hasRepeatedFoot || hasCriticalToe;
    const detail =
        hasRepeatedFoot && hasCriticalToe
            ? 'more than one toe on a foot, and a C4/D4 toe'
            : hasCriticalToe
            ? 'a C4 or D4 toe, which is important to survival'
            : 'more than one toe on a foot';

    return {
        hasRepeatedFoot,
        hasCriticalToe,
        hasUnusualPattern,
        detail,
    };
};

const formatForDisplay = (code = '', placeholder = 'EX: A1-B2-C3') => {
    if (!code) return placeholder;
    if (code === 'N/A') return code;

    return code.split('').reduce((formattedCode, character, index, characters) => {
        if (index % 2 && index < characters.length - 1) {
            return `${formattedCode}${character}-`;
        }
        return `${formattedCode}${character}`;
    }, '');
};

const getInitialSelection = (selectedKey) => {
    const selection = {};
    [...footOptions, ...toeOptions].forEach((option) => {
        selection[option] = false;
    });
    if (selectedKey) selection[selectedKey] = true;
    return selection;
};

const toeCodeModel = {
    criticalPairs,
    footOptions,
    maxLength,
    toeOptions,
    formatForDisplay,
    getCanonicalCode,
    getInitialSelection,
    getPairs,
    getUnusualPattern,
    getValidationMessage,
    hasCriticalPair,
};

export default toeCodeModel;
