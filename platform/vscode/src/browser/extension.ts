import * as vscode from 'vscode';
import { registerSimpleAiSlice } from '../ai';
import { analyzeDocument } from '../analysis/simpleAnalysisIndex';
import { SimpleDiagnosticsProvider } from '../fallback/diagnosticsProvider';
import { SimpleSemanticTokensProvider, TOKEN_LEGEND } from '../fallback/semanticTokensProvider';
import { createSimpleBrowserLspController } from '../lsp/simpleLspBrowserLifecycle';
import { findMathBlockAtPosition, MathPreviewPanel, MathSyncPanel } from '../math';
import { SimpleFoldingRangeProvider } from '../nativeFoldingProvider';
import { NativeMathProvider } from '../nativeMathProvider';
import { SimpleOutlineProvider } from '../outline/simpleOutlineProvider';
import { ExtensionHostServices } from '../services/extensionHostServices';
import {
    SimpleDefinitionProvider,
    SimpleDocumentSymbolProvider,
    SimpleHoverProvider,
    SimpleReferenceProvider,
    SimpleWorkspaceSymbolProvider,
} from '../symbols/simpleSymbolProviders';
import { EditorMarkerManager } from '../testing/editorMarkers';

const SIMPLE_SELECTOR: vscode.DocumentSelector = [
    { scheme: 'file', language: 'simple' },
    { scheme: 'untitled', language: 'simple' },
    { scheme: 'vscode-vfs', language: 'simple' },
];

let activeBrowserLsp: ReturnType<typeof createSimpleBrowserLspController> | undefined;

function showUnsupported(message: string): void {
    void vscode.window.showInformationMessage(message);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const services = new ExtensionHostServices();
    context.subscriptions.push(services);

    const outlineProvider = new SimpleOutlineProvider();
    const editorMarkerManager = new EditorMarkerManager(context.workspaceState);
    const mathProvider = new NativeMathProvider();
    const diagnosticsProvider = new SimpleDiagnosticsProvider();
    const semanticTokensProvider = new SimpleSemanticTokensProvider();
    const foldingProvider = new SimpleFoldingRangeProvider();
    const documentSymbolProvider = new SimpleDocumentSymbolProvider();
    const workspaceSymbolProvider = new SimpleWorkspaceSymbolProvider();
    const definitionProvider = new SimpleDefinitionProvider();
    const referenceProvider = new SimpleReferenceProvider();
    const hoverProvider = new SimpleHoverProvider();

    const fallbackControls = [
        diagnosticsProvider,
        semanticTokensProvider,
        documentSymbolProvider,
        workspaceSymbolProvider,
        definitionProvider,
        referenceProvider,
        hoverProvider,
        foldingProvider,
    ];
    for (const control of fallbackControls) {
        control.setEnabled(true);
    }

    const lspController = createSimpleBrowserLspController({
        context,
        services,
        fallbackControls,
    });
    activeBrowserLsp = lspController;
    context.subscriptions.push(lspController);

    let currentOutlineDocument = vscode.window.activeTextEditor?.document;
    const updateOutline = (document?: vscode.TextDocument) => {
        currentOutlineDocument = document;
        outlineProvider.setActiveDocument(document);
    };

    const maybeAutoOpenMathSyncPanel = (editor?: vscode.TextEditor): void => {
        if (!editor || editor.document.languageId !== 'simple') {
            return;
        }
        if (!vscode.workspace.getConfiguration('simple.math').get<boolean>('syncPanel.autoOpen', false)) {
            return;
        }
        if (MathSyncPanel.isVisible()) {
            return;
        }
        if (findMathBlockAtPosition(editor.document, editor.selection.active)) {
            MathSyncPanel.show();
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('simple.richEditor.showOutputChannel', () => {
            services.showOutputChannel();
        }),
        vscode.commands.registerCommand('simple.lsp.showOutputChannel', () => {
            lspController.showOutputChannel();
        }),
        vscode.commands.registerCommand('simple.lsp.restart', async () => {
            const result = await lspController.restartClient();
            if (!result.ok) {
                void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
            }
        }),
        vscode.commands.registerCommand('simple.outline.revealSymbol', () => {
            showUnsupported('Simple outline reveal is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.richEditor.open', () => {
            showUnsupported('Simple Rich Source Editor is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.math.openCustomEditor', () => {
            showUnsupported('Simple Math Custom Editor is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.runFile', () => {
            showUnsupported('Running Simple CLI tests is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.runAtCursor', () => {
            const editor = vscode.window.activeTextEditor;
            const block = editor && editor.document.languageId === 'simple'
                ? analyzeDocument(editor.document).tests.filter((candidate) => candidate.line <= editor.selection.active.line).pop()
                : undefined;
            if (block?.runnableScope === 'none') {
                showUnsupported('Exact test execution is not implemented yet.');
                return;
            }
            showUnsupported('Running Simple CLI tests is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.runSdoctest', () => {
            showUnsupported('Running Simple CLI doctests is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.openWorkspace', () => {
            showUnsupported('Simple Test Workspace is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.refreshWorkspace', () => {
            showUnsupported('Simple Test Workspace is not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.openLatestArtifacts', () => {
            showUnsupported('Simple test artifacts are not available in browser hosts yet.');
        }),
        vscode.commands.registerCommand('simple.test.showScopeInfo', (kind?: string) => {
            showUnsupported(`${kind ?? 'This test node'} is discovered for structure and navigation, but exact-node execution is not implemented yet.`);
        }),
        vscode.commands.registerTextEditorCommand('simple.editor.toggleBreakpoint', (editor, _edit, uri?: vscode.Uri, line?: number) => {
            const targetUri = uri ?? editor.document.uri;
            const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
            if (targetUri && typeof targetLine === 'number') {
                editorMarkerManager.toggleBreakpoint(targetUri, targetLine);
            }
        }),
        vscode.commands.registerTextEditorCommand('simple.editor.toggleBookmark', (editor, _edit, uri?: vscode.Uri, line?: number) => {
            const targetUri = uri ?? editor.document.uri;
            const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
            if (targetUri && typeof targetLine === 'number') {
                editorMarkerManager.toggleBookmark(targetUri, targetLine);
            }
        }),
        vscode.commands.registerTextEditorCommand('simple.editor.togglePointer', (editor, _edit, uri?: vscode.Uri, line?: number) => {
            const targetUri = uri ?? editor.document.uri;
            const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
            if (targetUri && typeof targetLine === 'number') {
                editorMarkerManager.togglePointer(targetUri, targetLine);
            }
        }),
        vscode.commands.registerTextEditorCommand('simple.editor.clearPointer', (editor, _edit, uri?: vscode.Uri) => {
            const targetUri = uri ?? editor.document.uri;
            if (targetUri) {
                editorMarkerManager.clearPointer(targetUri);
            }
        }),
        vscode.commands.registerCommand('simple.editor.nextBookmark', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editorMarkerManager.jumpToNextBookmark(editor);
            }
        }),
        vscode.commands.registerCommand('simple.editor.prevBookmark', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editorMarkerManager.jumpToPreviousBookmark(editor);
            }
        }),
        vscode.commands.registerCommand('simple.math.togglePreview', () => {
            if (MathPreviewPanel.isVisible()) {
                MathPreviewPanel.close();
            } else {
                MathPreviewPanel.show();
            }
        }),
        vscode.commands.registerCommand('simple.math.toggleSyncPanel', () => {
            if (MathSyncPanel.isVisible()) {
                MathSyncPanel.close();
            } else {
                MathSyncPanel.show();
            }
        }),
        vscode.commands.registerCommand('simple.math.toggleInlineRender', async () => {
            const config = vscode.workspace.getConfiguration('simple.math');
            const current = config.get<boolean>('renderInline', true);
            await config.update('renderInline', !current, vscode.ConfigurationTarget.Global);
            void vscode.window.showInformationMessage(`Simple inline math rendering ${!current ? 'enabled' : 'disabled'}`);
        }),
        vscode.window.registerTreeDataProvider('simpleOutline', outlineProvider),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateOutline(editor?.document);
            maybeAutoOpenMathSyncPanel(editor ?? undefined);
        }),
        vscode.window.onDidChangeTextEditorSelection((event) => {
            maybeAutoOpenMathSyncPanel(event.textEditor);
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (currentOutlineDocument && event.document.uri.toString() === currentOutlineDocument.uri.toString()) {
                updateOutline(event.document);
            }
        }),
        diagnosticsProvider,
        vscode.languages.registerDocumentSemanticTokensProvider(SIMPLE_SELECTOR, semanticTokensProvider, TOKEN_LEGEND),
        vscode.languages.registerDocumentSymbolProvider(SIMPLE_SELECTOR, documentSymbolProvider),
        vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider),
        vscode.languages.registerDefinitionProvider(SIMPLE_SELECTOR, definitionProvider),
        vscode.languages.registerReferenceProvider(SIMPLE_SELECTOR, referenceProvider),
        vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, hoverProvider),
        vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, mathProvider),
        vscode.languages.registerFoldingRangeProvider(SIMPLE_SELECTOR, foldingProvider),
        mathProvider,
    );

    updateOutline(vscode.window.activeTextEditor?.document);

    try {
        await registerSimpleAiSlice(context, {
            extensionUri: context.extensionUri,
            documentSelector: SIMPLE_SELECTOR,
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        services.markDegraded('ai', 'Simple AI unavailable in this browser host', 'fallback', detail);
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration('simple.lsp')) {
                return;
            }
            void vscode.window.showInformationMessage(
                'Simple LSP configuration changed. Restart the client to apply changes.',
                'Restart LSP',
            ).then(async (selection) => {
                if (selection === 'Restart LSP') {
                    const result = await lspController.restartClient();
                    if (!result.ok) {
                        void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
                    }
                }
            });
        }),
    );

    const result = await lspController.bootstrapClient();
    if (!result.ok) {
        services.markDegraded('lsp', result.message, 'fallback', result.detail);
    }
}

export async function deactivate(): Promise<void> {
    await activeBrowserLsp?.dispose();
    activeBrowserLsp = undefined;
}
