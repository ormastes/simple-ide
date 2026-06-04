import * as vscode from 'vscode';
import { detectBlocks, type DetectedBlock } from './blockDetector';
import { buildMathPreview, isMathLikeBlock } from './mathPreview';
import { resolveMathRenderPolicy } from './mathRenderPolicy';

interface MathBlockDecoration {
    block: DetectedBlock;
    fullRange: vscode.Range;
    openRange: vscode.Range;
    contentRange: vscode.Range;
    closeRange: vscode.Range;
}

function makeRange(document: vscode.TextDocument, from: number, to: number): vscode.Range {
    return new vscode.Range(document.positionAt(from), document.positionAt(to));
}

function asDecorationBlock(document: vscode.TextDocument, block: DetectedBlock): MathBlockDecoration | undefined {
    if (!isMathLikeBlock(block.kind)) {
        return undefined;
    }
    const fullRange = makeRange(document, block.from, block.to);
    const openRange = makeRange(document, block.from, block.prefixEnd);
    const contentRange = makeRange(document, block.prefixEnd, block.to - 1);
    const closeRange = makeRange(document, block.to - 1, block.to);
    return { block, fullRange, openRange, contentRange, closeRange };
}

function rangesOverlap(a: vscode.Range, b: vscode.Range): boolean {
    return !(a.end.isBeforeOrEqual(b.start) || b.end.isBeforeOrEqual(a.start));
}

function diagnosticDecorationForRange(
    diagnostics: readonly vscode.Diagnostic[],
    range: vscode.Range,
): string | undefined {
    let severity: vscode.DiagnosticSeverity | undefined;
    for (const diagnostic of diagnostics) {
        if (!rangesOverlap(diagnostic.range, range)) {
            continue;
        }
        if (severity === undefined || diagnostic.severity < severity) {
            severity = diagnostic.severity;
        }
    }

    if (severity === vscode.DiagnosticSeverity.Error) {
        return 'text-decoration: underline wavy var(--vscode-editorError-foreground);';
    }
    if (severity === vscode.DiagnosticSeverity.Warning) {
        return 'text-decoration: underline wavy var(--vscode-editorWarning-foreground);';
    }
    if (severity === vscode.DiagnosticSeverity.Information) {
        return 'text-decoration: underline dotted var(--vscode-editorInfo-foreground);';
    }
    if (severity === vscode.DiagnosticSeverity.Hint) {
        return 'text-decoration: underline dotted var(--vscode-editorHint-foreground);';
    }
    return undefined;
}

function selectionIntersectsBlock(
    document: vscode.TextDocument,
    selections: readonly vscode.Selection[],
    block: DetectedBlock,
): boolean {
    for (const selection of selections) {
        const selectionStart = document.offsetAt(selection.start);
        const selectionEnd = document.offsetAt(selection.end);
        if (selection.isEmpty) {
            if (selectionStart >= block.from && selectionStart <= block.to) {
                return true;
            }
            continue;
        }
        if (selectionStart < block.to && selectionEnd > block.from) {
            return true;
        }
    }
    return false;
}

function buildMathHoverMarkdown(
    block: DetectedBlock,
    preview: ReturnType<typeof buildMathPreview>,
): vscode.MarkdownString | undefined {
    if (!preview) {
        return undefined;
    }
    const markdown = new vscode.MarkdownString(undefined, true);
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    markdown.appendMarkdown(`**Math Block** \`${preview.label}\`\n\n`);
    markdown.appendMarkdown('---\n\n');
    markdown.appendCodeblock(preview.displayText, 'text');
    markdown.appendMarkdown('\n');
    markdown.appendMarkdown(`**Pretty:** ${preview.pretty}\n\n`);
    markdown.appendMarkdown(`**Source:** \`${block.content}\`\n\n`);
    markdown.appendMarkdown('[Open Math Preview Panel](command:simple.math.togglePreview)\n\n');
    markdown.appendMarkdown('[Open Synced Math Panel](command:simple.math.toggleSyncPanel)');
    return markdown;
}

export class NativeMathProvider implements vscode.HoverProvider, vscode.Disposable {
    private readonly openDecoration = vscode.window.createTextEditorDecorationType({
        opacity: '0',
    });

    private readonly closeDecoration = vscode.window.createTextEditorDecorationType({
        opacity: '0',
    });

    private readonly contentDecoration = vscode.window.createTextEditorDecorationType({
        opacity: '0',
    });

    private readonly previewDecoration = vscode.window.createTextEditorDecorationType({});

    private readonly disposables: vscode.Disposable[] = [];

    public constructor() {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.refreshEditor(editor);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.refreshEditor(event.textEditor);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                for (const editor of vscode.window.visibleTextEditors) {
                    if (editor.document.uri.toString() === event.document.uri.toString()) {
                        this.refreshEditor(editor);
                    }
                }
            }),
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (
                    event.affectsConfiguration('simple.math.enabled') ||
                    event.affectsConfiguration('simple.math.renderInline')
                ) {
                    this.refreshVisibleEditors();
                }
            }),
        );

        this.refreshVisibleEditors();
    }

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Hover | undefined {
        const config = vscode.workspace.getConfiguration('simple.math');
        if (!config.get<boolean>('enabled', true) || !config.get<boolean>('previewOnHover', true)) {
            return undefined;
        }

        const block = this.findMathBlockAtPosition(document, position);
        if (!block) {
            return undefined;
        }

        const preview = buildMathPreview(block);
        if (!preview) {
            return undefined;
        }

        const markdown = buildMathHoverMarkdown(block, preview);
        if (!markdown) {
            return undefined;
        }
        return new vscode.Hover(markdown, makeRange(document, block.from, block.to));
    }

    public findMathBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): DetectedBlock | undefined {
        const offset = document.offsetAt(position);
        return detectBlocks(document.getText()).find((block) =>
            isMathLikeBlock(block.kind) && offset >= block.from && offset <= block.to,
        );
    }

    public dispose(): void {
        this.openDecoration.dispose();
        this.closeDecoration.dispose();
        this.contentDecoration.dispose();
        this.previewDecoration.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    private refreshVisibleEditors(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.refreshEditor(editor);
        }
    }

    private refreshEditor(editor: vscode.TextEditor): void {
        if (editor.document.languageId !== 'simple') {
            return;
        }

        const config = vscode.workspace.getConfiguration('simple.math');
        if (!config.get<boolean>('enabled', true) || !config.get<boolean>('renderInline', true)) {
            editor.setDecorations(this.openDecoration, []);
            editor.setDecorations(this.closeDecoration, []);
            editor.setDecorations(this.contentDecoration, []);
            editor.setDecorations(this.previewDecoration, []);
            return;
        }

        const openDecorations: vscode.DecorationOptions[] = [];
        const closeDecorations: vscode.Range[] = [];
        const contentDecorations: vscode.Range[] = [];
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const previewOnHover = config.get<boolean>('previewOnHover', true);

        for (const block of detectBlocks(editor.document.getText())) {
            const decoration = asDecorationBlock(editor.document, block);
            if (!decoration) {
                continue;
            }

            const renderPolicy = resolveMathRenderPolicy(editor.document, block, diagnostics);
            if (!renderPolicy?.shouldRender || !renderPolicy.preview) {
                continue;
            }

            if (selectionIntersectsBlock(editor.document, editor.selections, block)) {
                continue;
            }

            openDecorations.push({
                range: decoration.openRange,
                hoverMessage: previewOnHover ? buildMathHoverMarkdown(block, renderPolicy.preview) : undefined,
                renderOptions: {
                    before: {
                        contentText: renderPolicy.preview.displayText,
                        color: new vscode.ThemeColor('editorLineNumber.foreground'),
                        margin: '0 0.25rem 0 0',
                        textDecoration: diagnosticDecorationForRange(diagnostics, decoration.fullRange),
                    },
                },
            });
            closeDecorations.push(decoration.closeRange);
            contentDecorations.push(decoration.contentRange);
        }

        editor.setDecorations(this.openDecoration, openDecorations);
        editor.setDecorations(this.closeDecoration, closeDecorations);
        editor.setDecorations(this.contentDecoration, contentDecorations);
        editor.setDecorations(this.previewDecoration, []);
    }
}
