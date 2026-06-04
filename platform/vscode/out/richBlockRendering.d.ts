import * as vscode from 'vscode';
import { type BlockKind, type DetectedBlock } from './blockDetector';
export interface RenderableBlock {
    kind: BlockKind;
    from: number;
    to: number;
    content: string;
    prefix: string;
    renderedHtml: string;
    imageUri?: string;
    displayMode: 'inline' | 'block';
    status: 'ok' | 'error';
    errorMessage?: string;
}
export interface RenderRichBlocksOptions {
    document: vscode.TextDocument;
    blocks: DetectedBlock[];
    diagnostics?: readonly vscode.Diagnostic[];
    resolveImageUri?: (imagePath: string, documentUri: vscode.Uri) => string | null;
}
export declare function renderRichBlocks(options: RenderRichBlocksOptions): RenderableBlock[];
export declare function createWebviewImageResolver(webview: vscode.Webview): (imagePath: string, documentUri: vscode.Uri) => string | null;
