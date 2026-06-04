"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ai_1 = require("../ai");
const simpleAnalysisIndex_1 = require("../analysis/simpleAnalysisIndex");
const diagnosticsProvider_1 = require("../fallback/diagnosticsProvider");
const semanticTokensProvider_1 = require("../fallback/semanticTokensProvider");
const simpleLspBrowserLifecycle_1 = require("../lsp/simpleLspBrowserLifecycle");
const math_1 = require("../math");
const nativeFoldingProvider_1 = require("../nativeFoldingProvider");
const nativeMathProvider_1 = require("../nativeMathProvider");
const simpleOutlineProvider_1 = require("../outline/simpleOutlineProvider");
const extensionHostServices_1 = require("../services/extensionHostServices");
const simpleSymbolProviders_1 = require("../symbols/simpleSymbolProviders");
const editorMarkers_1 = require("../testing/editorMarkers");
const SIMPLE_SELECTOR = [
    { scheme: 'file', language: 'simple' },
    { scheme: 'untitled', language: 'simple' },
    { scheme: 'vscode-vfs', language: 'simple' },
];
let activeBrowserLsp;
function showUnsupported(message) {
    void vscode.window.showInformationMessage(message);
}
async function activate(context) {
    const services = new extensionHostServices_1.ExtensionHostServices();
    context.subscriptions.push(services);
    const outlineProvider = new simpleOutlineProvider_1.SimpleOutlineProvider();
    const editorMarkerManager = new editorMarkers_1.EditorMarkerManager(context.workspaceState);
    const mathProvider = new nativeMathProvider_1.NativeMathProvider();
    const diagnosticsProvider = new diagnosticsProvider_1.SimpleDiagnosticsProvider();
    const semanticTokensProvider = new semanticTokensProvider_1.SimpleSemanticTokensProvider();
    const foldingProvider = new nativeFoldingProvider_1.SimpleFoldingRangeProvider();
    const documentSymbolProvider = new simpleSymbolProviders_1.SimpleDocumentSymbolProvider();
    const workspaceSymbolProvider = new simpleSymbolProviders_1.SimpleWorkspaceSymbolProvider();
    const definitionProvider = new simpleSymbolProviders_1.SimpleDefinitionProvider();
    const referenceProvider = new simpleSymbolProviders_1.SimpleReferenceProvider();
    const hoverProvider = new simpleSymbolProviders_1.SimpleHoverProvider();
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
    const lspController = (0, simpleLspBrowserLifecycle_1.createSimpleBrowserLspController)({
        context,
        services,
        fallbackControls,
    });
    activeBrowserLsp = lspController;
    context.subscriptions.push(lspController);
    let currentOutlineDocument = vscode.window.activeTextEditor?.document;
    const updateOutline = (document) => {
        currentOutlineDocument = document;
        outlineProvider.setActiveDocument(document);
    };
    const maybeAutoOpenMathSyncPanel = (editor) => {
        if (!editor || editor.document.languageId !== 'simple') {
            return;
        }
        if (!vscode.workspace.getConfiguration('simple.math').get('syncPanel.autoOpen', false)) {
            return;
        }
        if (math_1.MathSyncPanel.isVisible()) {
            return;
        }
        if ((0, math_1.findMathBlockAtPosition)(editor.document, editor.selection.active)) {
            math_1.MathSyncPanel.show();
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand('simple.richEditor.showOutputChannel', () => {
        services.showOutputChannel();
    }), vscode.commands.registerCommand('simple.lsp.showOutputChannel', () => {
        lspController.showOutputChannel();
    }), vscode.commands.registerCommand('simple.lsp.restart', async () => {
        const result = await lspController.restartClient();
        if (!result.ok) {
            void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
        }
    }), vscode.commands.registerCommand('simple.outline.revealSymbol', () => {
        showUnsupported('Simple outline reveal is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.richEditor.open', () => {
        showUnsupported('Simple Rich Source Editor is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.math.openCustomEditor', () => {
        showUnsupported('Simple Math Custom Editor is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.runFile', () => {
        showUnsupported('Running Simple CLI tests is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.runAtCursor', () => {
        const editor = vscode.window.activeTextEditor;
        const block = editor && editor.document.languageId === 'simple'
            ? (0, simpleAnalysisIndex_1.analyzeDocument)(editor.document).tests.filter((candidate) => candidate.line <= editor.selection.active.line).pop()
            : undefined;
        if (block?.runnableScope === 'none') {
            showUnsupported('Exact test execution is not implemented yet.');
            return;
        }
        showUnsupported('Running Simple CLI tests is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.runSdoctest', () => {
        showUnsupported('Running Simple CLI doctests is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.openWorkspace', () => {
        showUnsupported('Simple Test Workspace is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.refreshWorkspace', () => {
        showUnsupported('Simple Test Workspace is not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.openLatestArtifacts', () => {
        showUnsupported('Simple test artifacts are not available in browser hosts yet.');
    }), vscode.commands.registerCommand('simple.test.showScopeInfo', (kind) => {
        showUnsupported(`${kind ?? 'This test node'} is discovered for structure and navigation, but exact-node execution is not implemented yet.`);
    }), vscode.commands.registerTextEditorCommand('simple.editor.toggleBreakpoint', (editor, _edit, uri, line) => {
        const targetUri = uri ?? editor.document.uri;
        const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
        if (targetUri && typeof targetLine === 'number') {
            editorMarkerManager.toggleBreakpoint(targetUri, targetLine);
        }
    }), vscode.commands.registerTextEditorCommand('simple.editor.toggleBookmark', (editor, _edit, uri, line) => {
        const targetUri = uri ?? editor.document.uri;
        const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
        if (targetUri && typeof targetLine === 'number') {
            editorMarkerManager.toggleBookmark(targetUri, targetLine);
        }
    }), vscode.commands.registerTextEditorCommand('simple.editor.togglePointer', (editor, _edit, uri, line) => {
        const targetUri = uri ?? editor.document.uri;
        const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
        if (targetUri && typeof targetLine === 'number') {
            editorMarkerManager.togglePointer(targetUri, targetLine);
        }
    }), vscode.commands.registerTextEditorCommand('simple.editor.clearPointer', (editor, _edit, uri) => {
        const targetUri = uri ?? editor.document.uri;
        if (targetUri) {
            editorMarkerManager.clearPointer(targetUri);
        }
    }), vscode.commands.registerCommand('simple.editor.nextBookmark', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editorMarkerManager.jumpToNextBookmark(editor);
        }
    }), vscode.commands.registerCommand('simple.editor.prevBookmark', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editorMarkerManager.jumpToPreviousBookmark(editor);
        }
    }), vscode.commands.registerCommand('simple.math.togglePreview', () => {
        if (math_1.MathPreviewPanel.isVisible()) {
            math_1.MathPreviewPanel.close();
        }
        else {
            math_1.MathPreviewPanel.show();
        }
    }), vscode.commands.registerCommand('simple.math.toggleSyncPanel', () => {
        if (math_1.MathSyncPanel.isVisible()) {
            math_1.MathSyncPanel.close();
        }
        else {
            math_1.MathSyncPanel.show();
        }
    }), vscode.commands.registerCommand('simple.math.toggleInlineRender', async () => {
        const config = vscode.workspace.getConfiguration('simple.math');
        const current = config.get('renderInline', true);
        await config.update('renderInline', !current, vscode.ConfigurationTarget.Global);
        void vscode.window.showInformationMessage(`Simple inline math rendering ${!current ? 'enabled' : 'disabled'}`);
    }), vscode.window.registerTreeDataProvider('simpleOutline', outlineProvider), vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateOutline(editor?.document);
        maybeAutoOpenMathSyncPanel(editor ?? undefined);
    }), vscode.window.onDidChangeTextEditorSelection((event) => {
        maybeAutoOpenMathSyncPanel(event.textEditor);
    }), vscode.workspace.onDidChangeTextDocument((event) => {
        if (currentOutlineDocument && event.document.uri.toString() === currentOutlineDocument.uri.toString()) {
            updateOutline(event.document);
        }
    }), diagnosticsProvider, vscode.languages.registerDocumentSemanticTokensProvider(SIMPLE_SELECTOR, semanticTokensProvider, semanticTokensProvider_1.TOKEN_LEGEND), vscode.languages.registerDocumentSymbolProvider(SIMPLE_SELECTOR, documentSymbolProvider), vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider), vscode.languages.registerDefinitionProvider(SIMPLE_SELECTOR, definitionProvider), vscode.languages.registerReferenceProvider(SIMPLE_SELECTOR, referenceProvider), vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, hoverProvider), vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, mathProvider), vscode.languages.registerFoldingRangeProvider(SIMPLE_SELECTOR, foldingProvider), mathProvider);
    updateOutline(vscode.window.activeTextEditor?.document);
    try {
        await (0, ai_1.registerSimpleAiSlice)(context, {
            extensionUri: context.extensionUri,
            documentSelector: SIMPLE_SELECTOR,
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        services.markDegraded('ai', 'Simple AI unavailable in this browser host', 'fallback', detail);
    }
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('simple.lsp')) {
            return;
        }
        void vscode.window.showInformationMessage('Simple LSP configuration changed. Restart the client to apply changes.', 'Restart LSP').then(async (selection) => {
            if (selection === 'Restart LSP') {
                const result = await lspController.restartClient();
                if (!result.ok) {
                    void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
                }
            }
        });
    }));
    const result = await lspController.bootstrapClient();
    if (!result.ok) {
        services.markDegraded('lsp', result.message, 'fallback', result.detail);
    }
}
async function deactivate() {
    await activeBrowserLsp?.dispose();
    activeBrowserLsp = undefined;
}
//# sourceMappingURL=extension.js.map