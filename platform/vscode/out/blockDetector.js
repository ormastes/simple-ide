"use strict";
/**
 * Unified block detection for renderable content in Simple source files.
 *
 * Detects: m{}, loss{}, nograd{}, img{}, graph{} blocks.
 * Supports one level of nested braces (e.g., m{ x^{2} }).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectBlocks = detectBlocks;
exports.findBlockAtOffset = findBlockAtOffset;
const BLOCK_REGEX = /\b(?<prefix>m|loss|nograd|img|graph)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
function detectBlocks(text) {
    const blocks = [];
    BLOCK_REGEX.lastIndex = 0;
    let match;
    while ((match = BLOCK_REGEX.exec(text)) !== null) {
        const prefix = match.groups?.prefix ?? 'm';
        const kind = prefix === 'loss' ? 'loss' :
            prefix === 'nograd' ? 'nograd' :
                prefix === 'img' ? 'img' :
                    prefix === 'graph' ? 'graph' : 'math';
        blocks.push({
            kind,
            from: match.index,
            to: match.index + match[0].length,
            prefixEnd: match.index + prefix.length + 1,
            content: match[2].trim(),
            prefix,
        });
    }
    return blocks;
}
function findBlockAtOffset(text, offset) {
    const clipped = Math.max(0, Math.min(text.length, offset));
    return detectBlocks(text).find(b => clipped >= b.from && clipped <= b.to);
}
//# sourceMappingURL=blockDetector.js.map