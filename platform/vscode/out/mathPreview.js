"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMathLikeBlock = isMathLikeBlock;
exports.indicatorForMathKind = indicatorForMathKind;
exports.labelForMathKind = labelForMathKind;
exports.buildMathPreview = buildMathPreview;
const mathConverter_1 = require("./mathConverter");
function isMathLikeBlock(kind) {
    return kind === 'math' || kind === 'loss' || kind === 'nograd';
}
function indicatorForMathKind(kind) {
    switch (kind) {
        case 'loss':
            return '\u2112';
        case 'nograd':
            return '\u2205';
        default:
            return '\u2202';
    }
}
function labelForMathKind(kind) {
    switch (kind) {
        case 'loss':
            return 'loss{}';
        case 'nograd':
            return 'nograd{}';
        default:
            return 'm{}';
    }
}
function hasBalancedDelimiters(source) {
    const stack = [];
    const closingFor = {
        '(': ')',
        '[': ']',
        '{': '}',
    };
    const openingFor = {
        ')': '(',
        ']': '[',
        '}': '{',
    };
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (closingFor[char]) {
            stack.push(char);
            continue;
        }
        if (openingFor[char]) {
            const expected = openingFor[char];
            const actual = stack.pop();
            if (actual !== expected) {
                return false;
            }
        }
    }
    return stack.length === 0;
}
function buildMathPreview(block) {
    if (!isMathLikeBlock(block.kind)) {
        return undefined;
    }
    if (!hasBalancedDelimiters(block.content)) {
        return undefined;
    }
    const indicator = indicatorForMathKind(block.kind);
    const pretty = (0, mathConverter_1.simpleToUnicode)(block.content);
    return {
        kind: block.kind,
        indicator,
        pretty,
        label: labelForMathKind(block.kind),
        displayText: `${indicator}{${pretty}}`,
    };
}
//# sourceMappingURL=mathPreview.js.map