import * as vscode from 'vscode';
import { detectBlocks, findBlockAtOffset } from '../blockDetector';
import { buildMathPreview, type MathPreview } from '../mathPreview';

export type MathBlockKind = MathPreview['kind'];

export type MathPanelStatusKind = 'info' | 'ok' | 'error';

export interface MathPanelBlockSnapshot {
    kind: MathBlockKind;
    from: number;
    to: number;
    prefix: string;
    content: string;
    indicator: string;
    label: string;
    pretty: string;
}

export interface MathPanelBlock extends MathPanelBlockSnapshot {
    fullRange: vscode.Range;
    contentRange: vscode.Range;
}

export interface MathPreviewPanelState {
    documentUri: string;
    hasContent: boolean;
    block: MathPanelBlockSnapshot | null;
    statusKind: MathPanelStatusKind;
    statusMessage: string;
}

export interface MathSyncPanelState {
    documentUri: string;
    sourceText: string;
    selectionStart: number;
    selectionEnd: number;
    blocks: MathPanelBlockSnapshot[];
    hasContent: boolean;
    activeBlock: MathPanelBlockSnapshot | null;
    activeSelectionStart: number;
    activeSelectionEnd: number;
    statusKind: MathPanelStatusKind;
    statusMessage: string;
}

function clampOffset(text: string, offset: number): number {
    return Math.max(0, Math.min(text.length, offset));
}

export function escapeForHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function serializeForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
    const lastLine = document.lineCount > 0 ? document.lineAt(document.lineCount - 1) : undefined;
    const end = lastLine
        ? new vscode.Position(document.lineCount - 1, lastLine.text.length)
        : new vscode.Position(0, 0);
    return new vscode.Range(new vscode.Position(0, 0), end);
}

export function replaceRangeInText(text: string, range: vscode.Range, replacement: string): string {
    const start = clampOffset(text, textOffsetAt(text, range.start));
    const end = Math.max(start, clampOffset(text, textOffsetAt(text, range.end)));
    return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function textOffsetAt(text: string, position: vscode.Position): number {
    let line = 0;
    let character = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (line === position.line && character === position.character) {
            return i;
        }
        if (text[i] === '\n') {
            line += 1;
            character = 0;
        } else {
            character += 1;
        }
    }
    return text.length;
}

function blockToSnapshot(block: Pick<MathPanelBlock, 'kind' | 'from' | 'to' | 'prefix' | 'content' | 'indicator' | 'label' | 'pretty'>): MathPanelBlockSnapshot {
    return {
        kind: block.kind,
        from: block.from,
        to: block.to,
        prefix: block.prefix,
        content: block.content,
        indicator: block.indicator,
        label: block.label,
        pretty: block.pretty,
    };
}

export function detectMathBlocks(document: vscode.TextDocument): MathPanelBlock[] {
    const text = document.getText();
    const blocks: MathPanelBlock[] = [];

    for (const block of detectBlocks(text)) {
        const preview = buildMathPreview(block);
        if (!preview) {
            continue;
        }

        const from = document.positionAt(block.from);
        const to = document.positionAt(block.to);
        const contentEnd = document.positionAt(Math.max(block.prefixEnd, block.to - 1));

        blocks.push({
            kind: preview.kind,
            from: block.from,
            to: block.to,
            prefix: block.prefix,
            content: block.content,
            indicator: preview.indicator,
            label: preview.label,
            pretty: preview.displayText,
            fullRange: new vscode.Range(from, to),
            contentRange: new vscode.Range(document.positionAt(block.prefixEnd), contentEnd),
        });
    }

    return blocks;
}

export function findMathBlockAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): MathPanelBlock | undefined {
    return detectMathBlocks(document).find(block => block.fullRange.contains(position));
}

export function findMathBlockAtOffset(text: string, offset: number): MathPanelBlockSnapshot | undefined {
    const block = findBlockAtOffset(text, offset);
    if (!block) {
        return undefined;
    }
    const preview = buildMathPreview(block);
    if (!preview) {
        return undefined;
    }
    return blockToSnapshot({
        kind: preview.kind,
        from: block.from,
        to: block.to,
        prefix: block.prefix,
        content: block.content,
        indicator: preview.indicator,
        label: preview.label,
        pretty: preview.displayText,
    });
}

export function buildHighlightedSourcePreview(
    text: string,
    selectionStart: number,
    selectionEnd: number,
): string {
    const start = clampOffset(text, selectionStart);
    const end = Math.max(start, clampOffset(text, selectionEnd));
    const before = escapeForHtml(text.slice(0, start));
    const selected = escapeForHtml(text.slice(start, end));
    const after = escapeForHtml(text.slice(end));
    const selectionHtml = selected.length > 0
        ? `<span class="selection-highlight">${selected}</span>`
        : '<span class="selection-caret">|</span>';
    return `${before}${selectionHtml}${after}`;
}

export function buildMathPreviewPanelState(
    document: vscode.TextDocument,
    position: vscode.Position,
): MathPreviewPanelState {
    if (document.languageId !== 'simple') {
        return {
            documentUri: document.uri.toString(),
            hasContent: false,
            block: null,
            statusKind: 'info',
            statusMessage: 'Move the caret into a math block to render it.',
        };
    }

    const activeBlock = findMathBlockAtPosition(document, position);
    if (!activeBlock) {
        return {
            documentUri: document.uri.toString(),
            hasContent: false,
            block: null,
            statusKind: 'info',
            statusMessage: 'Move the caret into a math block to render it.',
        };
    }

    return {
        documentUri: document.uri.toString(),
        hasContent: true,
        block: blockToSnapshot(activeBlock),
        statusKind: 'ok',
        statusMessage: 'Rendered active math block.',
    };
}

export function buildMathSyncPanelState(
    document: vscode.TextDocument,
    selectionStartOffset: number,
    selectionEndOffset: number,
): MathSyncPanelState {
    const text = document.getText();
    const selectionStart = clampOffset(text, selectionStartOffset);
    const selectionEnd = clampOffset(text, selectionEndOffset);
    const blocks = detectMathBlocks(document).map(blockToSnapshot);
    const activeBlock = findMathBlockAtOffset(text, selectionStart);

    if (!activeBlock) {
        return {
            documentUri: document.uri.toString(),
            sourceText: text,
            selectionStart,
            selectionEnd,
            blocks,
            hasContent: false,
            activeBlock: null,
            activeSelectionStart: 0,
            activeSelectionEnd: 0,
            statusKind: 'info',
            statusMessage: 'Move the cursor onto a math block in the source editor.',
        };
    }

    const activeSelectionStart = Math.max(0, selectionStart - activeBlock.from - activeBlock.prefix.length - 1);
    const activeSelectionEnd = Math.max(activeSelectionStart, selectionEnd - activeBlock.from - activeBlock.prefix.length - 1);

    return {
        documentUri: document.uri.toString(),
        sourceText: text,
        selectionStart,
        selectionEnd,
        blocks,
        hasContent: true,
        activeBlock,
        activeSelectionStart,
        activeSelectionEnd,
        statusKind: 'ok',
        statusMessage: 'Active math block is mirrored from the source editor.',
    };
}

export function buildEmptyPreviewState(documentUri: string): MathPreviewPanelState {
    return {
        documentUri,
        hasContent: false,
        block: null,
        statusKind: 'info',
        statusMessage: 'Move the caret into a math block to render it.',
    };
}

export function buildEmptySyncState(documentUri: string): MathSyncPanelState {
    return {
        documentUri,
        sourceText: '',
        selectionStart: 0,
        selectionEnd: 0,
        blocks: [],
        hasContent: false,
        activeBlock: null,
        activeSelectionStart: 0,
        activeSelectionEnd: 0,
        statusKind: 'info',
        statusMessage: 'Move the cursor onto a math block in the source editor.',
    };
}

export { fullDocumentRange };
