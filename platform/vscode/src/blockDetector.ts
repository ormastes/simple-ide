/**
 * Unified block detection for renderable content in Simple source files.
 *
 * Detects: m{}, loss{}, nograd{}, img{}, graph{} blocks.
 * Supports one level of nested braces (e.g., m{ x^{2} }).
 */

export type BlockKind = 'math' | 'loss' | 'nograd' | 'img' | 'graph';

export interface DetectedBlock {
    kind: BlockKind;
    from: number;          // absolute char offset start (includes prefix)
    to: number;            // absolute char offset end (includes closing brace)
    prefixEnd: number;     // end of "m{" / "loss{" / "img{" etc.
    content: string;       // trimmed inner content
    prefix: string;        // raw prefix: "m" | "loss" | "nograd" | "img" | "graph"
}

const BLOCK_REGEX = /\b(?<prefix>m|loss|nograd|img|graph)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

export function detectBlocks(text: string): DetectedBlock[] {
    const blocks: DetectedBlock[] = [];
    BLOCK_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = BLOCK_REGEX.exec(text)) !== null) {
        const prefix = match.groups?.prefix ?? 'm';
        const kind: BlockKind =
            prefix === 'loss' ? 'loss' :
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

export function findBlockAtOffset(text: string, offset: number): DetectedBlock | undefined {
    const clipped = Math.max(0, Math.min(text.length, offset));
    return detectBlocks(text).find(b => clipped >= b.from && clipped <= b.to);
}
