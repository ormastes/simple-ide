import * as vscode from 'vscode';
import { type MathPreview } from '../mathPreview';
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
export declare function escapeForHtml(text: string): string;
export declare function serializeForScript(value: unknown): string;
declare function fullDocumentRange(document: vscode.TextDocument): vscode.Range;
export declare function replaceRangeInText(text: string, range: vscode.Range, replacement: string): string;
export declare function detectMathBlocks(document: vscode.TextDocument): MathPanelBlock[];
export declare function findMathBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): MathPanelBlock | undefined;
export declare function findMathBlockAtOffset(text: string, offset: number): MathPanelBlockSnapshot | undefined;
export declare function buildHighlightedSourcePreview(text: string, selectionStart: number, selectionEnd: number): string;
export declare function buildMathPreviewPanelState(document: vscode.TextDocument, position: vscode.Position): MathPreviewPanelState;
export declare function buildMathSyncPanelState(document: vscode.TextDocument, selectionStartOffset: number, selectionEndOffset: number): MathSyncPanelState;
export declare function buildEmptyPreviewState(documentUri: string): MathPreviewPanelState;
export declare function buildEmptySyncState(documentUri: string): MathSyncPanelState;
export { fullDocumentRange };
