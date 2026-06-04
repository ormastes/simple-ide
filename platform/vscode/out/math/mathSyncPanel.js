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
exports.MathSyncPanel = void 0;
const vscode = __importStar(require("vscode"));
const mathPanelHtml_1 = require("./mathPanelHtml");
const mathPanelShared_1 = require("./mathPanelShared");
const timerApi = globalThis;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function clampOffset(value, documentLength) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.min(documentLength, Math.trunc(value)));
}
class MathSyncPanel {
    constructor(panel) {
        this.disposables = [];
        this.isApplyingEdit = false;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.panel = panel;
        this.panel.webview.html = (0, mathPanelHtml_1.buildMathSyncPanelHtml)((0, mathPanelShared_1.buildEmptySyncState)(''));
        this.disposables.push(this.panel.webview.onDidReceiveMessage((message) => {
            void this.handleMessage(message);
        }));
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection((event) => {
            this.handleSelectionChange(event);
        }));
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        }));
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.selectionStart = editor.document.offsetAt(editor.selection.start);
            this.selectionEnd = editor.document.offsetAt(editor.selection.end);
            this.syncFromEditor(editor);
        }
    }
    static show() {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (MathSyncPanel.currentPanel) {
            MathSyncPanel.currentPanel.panel.reveal(column ? column + 1 : vscode.ViewColumn.Beside);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                MathSyncPanel.currentPanel.syncFromEditor(editor);
            }
            return;
        }
        const panel = vscode.window.createWebviewPanel('simpleMathSyncPanel', 'Math Sync Panel', {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
        }, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        MathSyncPanel.currentPanel = new MathSyncPanel(panel);
    }
    static isVisible() {
        return MathSyncPanel.currentPanel !== undefined;
    }
    static close() {
        MathSyncPanel.currentPanel?.panel.dispose();
    }
    async handleMessage(rawMessage) {
        if (!isRecord(rawMessage) || typeof rawMessage.type !== 'string') {
            return;
        }
        const message = rawMessage;
        if (message.type === 'ready' || message.type === 'requestSync') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                this.selectionStart = editor.document.offsetAt(editor.selection.start);
                this.selectionEnd = editor.document.offsetAt(editor.selection.end);
                this.syncFromEditor(editor);
            }
            return;
        }
        const editor = this.getEditorForCurrentDocument();
        const documentLength = editor?.document.getText().length ?? 0;
        if (message.type === 'selectionChanged') {
            const selectionStart = clampOffset(message.selectionStart, documentLength);
            const selectionEnd = clampOffset(message.selectionEnd, documentLength);
            if (selectionStart === undefined || selectionEnd === undefined) {
                return;
            }
            this.selectionStart = selectionStart;
            this.selectionEnd = selectionEnd;
            if (editor) {
                this.syncFromEditor(editor);
            }
            return;
        }
        if (message.type !== 'editAll' || typeof message.source !== 'string') {
            return;
        }
        if (!editor || !this.currentDocumentUri) {
            return;
        }
        const selectionStart = clampOffset(message.selectionStart, editor.document.getText().length);
        const selectionEnd = clampOffset(message.selectionEnd, editor.document.getText().length);
        if (selectionStart === undefined || selectionEnd === undefined) {
            return;
        }
        if (message.source === editor.document.getText()) {
            this.selectionStart = selectionStart;
            this.selectionEnd = selectionEnd;
            this.syncFromEditor(editor);
            return;
        }
        this.selectionStart = selectionStart;
        this.selectionEnd = selectionEnd;
        this.isApplyingEdit = true;
        try {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, (0, mathPanelShared_1.fullDocumentRange)(editor.document), message.source);
            const applied = await vscode.workspace.applyEdit(edit);
            if (!applied) {
                this.panel.webview.postMessage({
                    type: 'error',
                    message: 'Failed to apply source edit to the backing document.',
                });
            }
        }
        finally {
            this.isApplyingEdit = false;
        }
        this.syncFromEditor(editor);
    }
    handleSelectionChange(event) {
        if (!this.currentDocumentUri || event.textEditor.document.uri.toString() !== this.currentDocumentUri.toString()) {
            return;
        }
        this.scheduleSyncFromEditor(event.textEditor);
    }
    handleDocumentChange(event) {
        if (!this.currentDocumentUri || event.document.uri.toString() !== this.currentDocumentUri.toString()) {
            return;
        }
        if (this.isApplyingEdit) {
            return;
        }
        const editor = this.getEditorForCurrentDocument();
        if (editor) {
            this.scheduleSyncFromEditor(editor);
        }
    }
    scheduleSyncFromEditor(editor) {
        if (this.syncTimer) {
            timerApi.clearTimeout(this.syncTimer);
        }
        this.syncTimer = timerApi.setTimeout(() => {
            this.syncTimer = undefined;
            this.syncFromEditor(editor);
        }, 50);
    }
    getEditorForCurrentDocument() {
        if (!this.currentDocumentUri) {
            return vscode.window.activeTextEditor;
        }
        return vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === this.currentDocumentUri?.toString()) ?? vscode.window.activeTextEditor;
    }
    syncFromEditor(editor) {
        if (editor.document.languageId !== 'simple') {
            this.panel.webview.postMessage({
                type: 'empty',
                state: (0, mathPanelShared_1.buildEmptySyncState)(editor.document.uri.toString()),
                message: 'Move the cursor onto a math block in the source editor.',
            });
            return;
        }
        if (!this.currentDocumentUri || this.currentDocumentUri.toString() !== editor.document.uri.toString()) {
            this.selectionStart = editor.document.offsetAt(editor.selection.start);
            this.selectionEnd = editor.document.offsetAt(editor.selection.end);
        }
        const state = (0, mathPanelShared_1.buildMathSyncPanelState)(editor.document, this.selectionStart, this.selectionEnd);
        this.currentDocumentUri = editor.document.uri;
        const stateKey = JSON.stringify([
            state.documentUri,
            state.sourceText,
            state.selectionStart,
            state.selectionEnd,
            state.activeBlock?.from ?? -1,
            state.activeBlock?.to ?? -1,
            state.activeSelectionStart,
            state.activeSelectionEnd,
            state.statusKind,
        ]);
        if (stateKey === this.lastStateKey) {
            return;
        }
        this.lastStateKey = stateKey;
        this.panel.webview.postMessage({
            type: 'sync',
            state,
        });
    }
    dispose() {
        MathSyncPanel.currentPanel = undefined;
        if (this.syncTimer) {
            timerApi.clearTimeout(this.syncTimer);
            this.syncTimer = undefined;
        }
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.panel.dispose();
    }
}
exports.MathSyncPanel = MathSyncPanel;
//# sourceMappingURL=mathSyncPanel.js.map