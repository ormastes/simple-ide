"use strict";
/**
 * Simple Rich Editor — crash-contained VS Code extension host.
 */
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
const ai_1 = require("./ai");
const diagnosticsProvider_1 = require("./fallback/diagnosticsProvider");
const semanticTokensProvider_1 = require("./fallback/semanticTokensProvider");
const lsp_1 = require("./lsp");
const math_1 = require("./math");
const nativeFoldingProvider_1 = require("./nativeFoldingProvider");
const nativeMathProvider_1 = require("./nativeMathProvider");
const richCustomEditor_1 = require("./richCustomEditor");
const simpleOutlineProvider_1 = require("./outline/simpleOutlineProvider");
const extensionHostServices_1 = require("./services/extensionHostServices");
const simpleCliService_1 = require("./services/simpleCliService");
const simpleSymbolProviders_1 = require("./symbols/simpleSymbolProviders");
const testCodeLensProvider_1 = require("./testing/testCodeLensProvider");
const testController_1 = require("./testing/testController");
const editorMarkers_1 = require("./testing/editorMarkers");
const testWorkspacePanel_1 = require("./testing/testWorkspacePanel");
const simpleAnalysisIndex_1 = require("./analysis/simpleAnalysisIndex");
const SIMPLE_SELECTOR = [
    { scheme: 'file', language: 'simple' },
    { scheme: 'untitled', language: 'simple' },
];
let activeLspSurface;
async function activate(context) {
    const services = new extensionHostServices_1.ExtensionHostServices();
    context.subscriptions.push(services);
    const lspSurface = (0, lsp_1.createSimpleLspCompatibilitySurface)(context);
    activeLspSurface = lspSurface;
    context.subscriptions.push(lspSurface);
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
    lspSurface.setClientBootstrap((0, lsp_1.createSimpleLspClientBootstrap)({
        services,
        fallbackControls: [
            diagnosticsProvider,
            semanticTokensProvider,
            documentSymbolProvider,
            workspaceSymbolProvider,
            definitionProvider,
            referenceProvider,
            hoverProvider,
            foldingProvider,
        ],
    }));
    services.markDegraded('lsp', 'Compatibility surface ready; bootstrapping configured client', 'fallback');
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
    const cli = new simpleCliService_1.SimpleCliService(services);
    const codeLensProvider = new testCodeLensProvider_1.TestCodeLensProvider();
    const testController = new testController_1.SimpleTestController(cli, services);
    const runCliTestCommand = async (args, resolveFrom) => {
        try {
            await cli.run(args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                resolveFrom,
            });
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            void vscode.window.showWarningMessage(`Simple Rich Editor: ${detail}`);
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand('simple.richEditor.showOutputChannel', () => {
        services.showOutputChannel();
    }), vscode.commands.registerCommand('simple.outline.revealSymbol', async (uri, range) => {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
            preview: false,
            selection: range,
        });
    }), vscode.window.registerTreeDataProvider('simpleOutline', outlineProvider), vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateOutline(editor?.document);
    }), vscode.workspace.onDidChangeTextDocument((event) => {
        if (currentOutlineDocument && event.document.uri.toString() === currentOutlineDocument.uri.toString()) {
            updateOutline(event.document);
        }
    }));
    updateOutline(vscode.window.activeTextEditor?.document);
    await services.safeRegister('lsp', 'LSP compatibility commands', () => {
        return [
            vscode.commands.registerCommand('simple.lsp.showOutputChannel', () => {
                lspSurface.showOutputChannel();
            }),
            vscode.commands.registerCommand('simple.lsp.restart', async () => {
                const result = await lspSurface.restartClient();
                if (!result.ok) {
                    void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
                }
            }),
        ];
    }, context.subscriptions);
    await services.safeRegister('editor', 'custom editor provider', () => {
        return [
            vscode.window.registerCustomEditorProvider(richCustomEditor_1.RichCustomEditorProvider.viewType, new richCustomEditor_1.RichCustomEditorProvider(context.extensionUri, updateOutline, (documentUri) => editorMarkerManager.getState(documentUri), editorMarkerManager.onDidChangeState, (documentUri) => testController.getStatesForDocument(documentUri), testController.onDidChangeTestStates), {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }),
            vscode.commands.registerCommand('simple.richEditor.open', () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }
                void vscode.commands.executeCommand('vscode.openWith', editor.document.uri, richCustomEditor_1.RichCustomEditorProvider.viewType);
            }),
        ];
    }, context.subscriptions);
    await services.safeRegister('diagnostics', 'fallback diagnostics', () => {
        return diagnosticsProvider;
    }, context.subscriptions);
    await services.safeRegister('semanticTokens', 'fallback semantic tokens', () => {
        return vscode.languages.registerDocumentSemanticTokensProvider(SIMPLE_SELECTOR, semanticTokensProvider, semanticTokensProvider_1.TOKEN_LEGEND);
    }, context.subscriptions);
    await services.safeRegister('symbols', 'fallback symbol providers', () => {
        return [
            vscode.languages.registerDocumentSymbolProvider(SIMPLE_SELECTOR, documentSymbolProvider),
            vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider),
            vscode.languages.registerDefinitionProvider(SIMPLE_SELECTOR, definitionProvider),
            vscode.languages.registerReferenceProvider(SIMPLE_SELECTOR, referenceProvider),
            vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, hoverProvider),
            vscode.languages.registerHoverProvider(SIMPLE_SELECTOR, mathProvider),
            vscode.languages.registerFoldingRangeProvider(SIMPLE_SELECTOR, foldingProvider),
            mathProvider,
        ];
    }, context.subscriptions);
    await services.safeRegister('math', 'math preview and sync panels', () => {
        return [
            vscode.commands.registerCommand('simple.math.togglePreview', () => {
                if (math_1.MathPreviewPanel.isVisible()) {
                    math_1.MathPreviewPanel.close();
                }
                else {
                    math_1.MathPreviewPanel.show();
                }
            }),
            vscode.commands.registerCommand('simple.math.toggleSyncPanel', () => {
                if (math_1.MathSyncPanel.isVisible()) {
                    math_1.MathSyncPanel.close();
                }
                else {
                    math_1.MathSyncPanel.show();
                }
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                maybeAutoOpenMathSyncPanel(editor ?? undefined);
            }),
            vscode.window.onDidChangeTextEditorSelection((event) => {
                maybeAutoOpenMathSyncPanel(event.textEditor);
            }),
        ];
    }, context.subscriptions);
    await services.safeRegister('tests', 'test runner UI', () => {
        return [
            codeLensProvider,
            testController,
            vscode.languages.registerCodeLensProvider(SIMPLE_SELECTOR, codeLensProvider),
            vscode.commands.registerCommand('simple.test.runFile', async (uri) => {
                const target = uri ?? vscode.window.activeTextEditor?.document.uri;
                if (!target) {
                    void vscode.window.showWarningMessage('No Simple file is active');
                    return;
                }
                await runCliTestCommand(['test', target.fsPath], target.fsPath);
            }),
            vscode.commands.registerCommand('simple.test.runAtCursor', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'simple') {
                    void vscode.window.showWarningMessage('No Simple file is active');
                    return;
                }
                const block = (0, simpleAnalysisIndex_1.analyzeDocument)(editor.document).tests
                    .filter((candidate) => candidate.line <= editor.selection.active.line)
                    .pop();
                if (block?.runnableScope === 'doctest') {
                    await runCliTestCommand(['test', '--sdoctest', editor.document.uri.fsPath], editor.document.uri.fsPath);
                    return;
                }
                if (block && block.runnableScope !== 'file') {
                    void vscode.window.showWarningMessage('Exact test execution is not implemented yet. Run the file or doctest scope instead.');
                    return;
                }
                await runCliTestCommand(['test', editor.document.uri.fsPath], editor.document.uri.fsPath);
            }),
            vscode.commands.registerCommand('simple.test.runSdoctest', async (uri) => {
                const target = uri ?? vscode.window.activeTextEditor?.document.uri;
                if (!target) {
                    void vscode.window.showWarningMessage('No Simple file is active');
                    return;
                }
                await runCliTestCommand(['test', '--sdoctest', target.fsPath], target.fsPath);
            }),
            vscode.commands.registerCommand('simple.test.openWorkspace', () => {
                testWorkspacePanel_1.TestWorkspacePanel.show(context.extensionUri);
            }),
            vscode.commands.registerCommand('simple.test.refreshWorkspace', () => {
                testWorkspacePanel_1.TestWorkspacePanel.currentPanel?.refresh();
            }),
            vscode.commands.registerCommand('simple.test.openLatestArtifacts', () => {
                if (testWorkspacePanel_1.TestWorkspacePanel.currentPanel) {
                    testWorkspacePanel_1.TestWorkspacePanel.currentPanel.openLatestArtifacts();
                }
                else {
                    testWorkspacePanel_1.TestWorkspacePanel.show(context.extensionUri).openLatestArtifacts();
                }
            }),
            vscode.commands.registerCommand('simple.test.showScopeInfo', (kind) => {
                void vscode.window.showInformationMessage(`${kind ?? 'This test node'} is discovered for structure and navigation, but exact-node execution is not implemented yet.`);
            }),
            vscode.commands.registerTextEditorCommand('simple.editor.toggleBreakpoint', (editor, _edit, uri, line) => {
                const targetUri = uri ?? editor.document.uri;
                const targetLine = typeof line === 'number'
                    ? line
                    : editor.selection.active.line;
                if (!targetUri || typeof targetLine !== 'number') {
                    return;
                }
                editorMarkerManager.toggleBreakpoint(targetUri, targetLine);
            }),
            vscode.commands.registerTextEditorCommand('simple.editor.toggleBookmark', (editor, _edit, uri, line) => {
                const targetUri = uri ?? editor.document.uri;
                const targetLine = typeof line === 'number'
                    ? line
                    : editor.selection.active.line;
                if (!targetUri || typeof targetLine !== 'number') {
                    return;
                }
                editorMarkerManager.toggleBookmark(targetUri, targetLine);
            }),
            vscode.commands.registerTextEditorCommand('simple.editor.togglePointer', (editor, _edit, uri, line) => {
                const targetUri = uri ?? editor.document.uri;
                const targetLine = typeof line === 'number'
                    ? line
                    : editor.selection.active.line;
                if (!targetUri || typeof targetLine !== 'number') {
                    return;
                }
                editorMarkerManager.togglePointer(targetUri, targetLine);
            }),
            vscode.commands.registerTextEditorCommand('simple.editor.clearPointer', (editor, _edit, uri) => {
                const targetUri = uri ?? editor.document.uri;
                if (!targetUri) {
                    return;
                }
                editorMarkerManager.clearPointer(targetUri);
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
            vscode.commands.registerCommand('simple.math.openCustomEditor', () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }
                void vscode.commands.executeCommand('vscode.openWith', editor.document.uri, richCustomEditor_1.RichCustomEditorProvider.viewType);
            }),
            vscode.commands.registerCommand('simple.math.toggleInlineRender', async () => {
                const config = vscode.workspace.getConfiguration('simple.math');
                const current = config.get('renderInline', true);
                await config.update('renderInline', !current, vscode.ConfigurationTarget.Global);
                void vscode.window.showInformationMessage(`Simple inline math rendering ${!current ? 'enabled' : 'disabled'}`);
            }),
        ];
    }, context.subscriptions);
    await services.safeRegister('ai', 'AI feature surface', async () => {
        return (0, ai_1.registerSimpleAiSlice)(context, {
            extensionUri: context.extensionUri,
            documentSelector: SIMPLE_SELECTOR,
        });
    }, context.subscriptions);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('simple.lsp')) {
            return;
        }
        void vscode.window.showInformationMessage('Simple LSP configuration changed. Restart the client to apply changes.', 'Restart LSP').then(async (selection) => {
            if (selection === 'Restart LSP') {
                const result = await lspSurface.restartClient();
                if (!result.ok) {
                    void vscode.window.showWarningMessage(`Simple LSP: ${result.message}`);
                }
            }
        });
    }));
    void lspSurface.bootstrapClient(vscode.window.activeTextEditor?.document.uri.fsPath).then((result) => {
        if (!result.ok) {
            services.markDegraded('lsp', result.message, 'fallback', result.detail);
        }
    });
}
async function deactivate() {
    await activeLspSurface?.dispose();
    activeLspSurface = undefined;
}
//# sourceMappingURL=extension.js.map