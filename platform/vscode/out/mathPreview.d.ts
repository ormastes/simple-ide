import { type BlockKind, type DetectedBlock } from './blockDetector';
export interface MathPreview {
    kind: Extract<BlockKind, 'math' | 'loss' | 'nograd'>;
    indicator: string;
    pretty: string;
    label: string;
    displayText: string;
}
export declare function isMathLikeBlock(kind: BlockKind): kind is Extract<BlockKind, 'math' | 'loss' | 'nograd'>;
export declare function indicatorForMathKind(kind: Extract<BlockKind, 'math' | 'loss' | 'nograd'>): string;
export declare function labelForMathKind(kind: Extract<BlockKind, 'math' | 'loss' | 'nograd'>): string;
export declare function buildMathPreview(block: Pick<DetectedBlock, 'kind' | 'content'>): MathPreview | undefined;
