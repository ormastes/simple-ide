/**
 * Unified block detection for renderable content in Simple source files.
 *
 * Detects: m{}, loss{}, nograd{}, img{}, graph{} blocks.
 * Supports one level of nested braces (e.g., m{ x^{2} }).
 */
export type BlockKind = 'math' | 'loss' | 'nograd' | 'img' | 'graph';
export interface DetectedBlock {
    kind: BlockKind;
    from: number;
    to: number;
    prefixEnd: number;
    content: string;
    prefix: string;
}
export declare function detectBlocks(text: string): DetectedBlock[];
export declare function findBlockAtOffset(text: string, offset: number): DetectedBlock | undefined;
