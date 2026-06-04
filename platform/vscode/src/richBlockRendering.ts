import * as vscode from 'vscode';
import { type BlockKind, type DetectedBlock } from './blockDetector';
import { parseImageContent, resolveImageUri } from './imageResolver';
import { resolveMathRenderPolicy } from './mathRenderPolicy';

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

function escapeForHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function renderRichBlocks(options: RenderRichBlocksOptions): RenderableBlock[] {
    const diagnostics = options.diagnostics ?? vscode.languages.getDiagnostics(options.document.uri);
    const imageResolver = options.resolveImageUri ?? (() => null);

    return options.blocks.map((block) => {
        if (block.kind === 'img') {
            const parsed = parseImageContent(block.content);
            if (!parsed) {
                return {
                    ...block,
                    renderedHtml: '',
                    imageUri: undefined,
                    displayMode: 'block' as const,
                    status: 'error' as const,
                    errorMessage: 'Invalid image path',
                };
            }

            const uri = imageResolver(parsed.path, options.document.uri);
            return {
                ...block,
                renderedHtml: '',
                imageUri: uri ?? undefined,
                displayMode: 'block' as const,
                status: uri ? 'ok' as const : 'error' as const,
                errorMessage: uri ? undefined : `Image not found: ${parsed.path}`,
            };
        }

        const renderPolicy = resolveMathRenderPolicy(options.document, block, diagnostics);
        if (!renderPolicy?.shouldRender || !renderPolicy.preview) {
            return {
                ...block,
                renderedHtml: '',
                displayMode: 'inline' as const,
                status: 'error' as const,
                errorMessage: renderPolicy?.errorMessage ?? 'Invalid block syntax',
            };
        }

        return {
            ...block,
            renderedHtml: `<span class="cm-math-pretty-text">${escapeForHtml(renderPolicy.preview.displayText)}</span>`,
            displayMode: 'inline' as const,
            status: 'ok' as const,
        };
    });
}

export function createWebviewImageResolver(
    webview: vscode.Webview,
): (imagePath: string, documentUri: vscode.Uri) => string | null {
    return (imagePath, documentUri) => resolveImageUri(imagePath, documentUri, webview);
}
