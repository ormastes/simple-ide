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
exports.MathPreviewPanel = void 0;
const vscode = __importStar(require("vscode"));
const mathPanelHtml_1 = require("./mathPanelHtml");
const mathPanelShared_1 = require("./mathPanelShared");
class MathPreviewPanel {
    constructor(panel) {
        this.disposables = [];
        this.panel = panel;
        this.panel.webview.html = (0, mathPanelHtml_1.buildMathPreviewPanelHtml)((0, mathPanelShared_1.buildEmptyPreviewState)(''));
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection((event) => {
            this.updateForEditor(event.textEditor);
        }));
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.updateForEditor(editor);
            }
        }));
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.updateForEditor(editor);
        }
    }
    static show() {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (MathPreviewPanel.currentPanel) {
            MathPreviewPanel.currentPanel.panel.reveal(column ? column + 1 : vscode.ViewColumn.Beside);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                MathPreviewPanel.currentPanel.updateForEditor(editor);
            }
            return;
        }
        const panel = vscode.window.createWebviewPanel('simpleMathPreview', 'Math Preview', {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
        }, {
            enableScripts: false,
            retainContextWhenHidden: true,
        });
        MathPreviewPanel.currentPanel = new MathPreviewPanel(panel);
    }
    static isVisible() {
        return MathPreviewPanel.currentPanel !== undefined;
    }
    static close() {
        MathPreviewPanel.currentPanel?.panel.dispose();
    }
    updateForEditor(editor) {
        const state = (0, mathPanelShared_1.buildMathPreviewPanelState)(editor.document, editor.selection.active);
        const signature = JSON.stringify([
            state.documentUri,
            state.hasContent,
            state.block?.from ?? -1,
            state.block?.to ?? -1,
            state.block?.pretty ?? '',
        ]);
        if (signature === this.currentSignature) {
            return;
        }
        this.currentSignature = signature;
        this.panel.webview.html = (0, mathPanelHtml_1.buildMathPreviewPanelHtml)(state);
    }
    dispose() {
        MathPreviewPanel.currentPanel = undefined;
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.panel.dispose();
    }
}
exports.MathPreviewPanel = MathPreviewPanel;
//# sourceMappingURL=mathPreviewPanel.js.map