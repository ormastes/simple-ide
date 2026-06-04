import * as vscode from 'vscode';
import { buildMathPreviewPanelHtml } from './mathPanelHtml';
import { buildEmptyPreviewState, buildMathPreviewPanelState } from './mathPanelShared';

export class MathPreviewPanel implements vscode.Disposable {
    public static currentPanel: MathPreviewPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private currentSignature: string | undefined;

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.panel.webview.html = buildMathPreviewPanelHtml(buildEmptyPreviewState(''));

        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.updateForEditor(event.textEditor);
            }),
        );
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.updateForEditor(editor);
                }
            }),
        );
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.updateForEditor(editor);
        }
    }

    public static show(): void {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (MathPreviewPanel.currentPanel) {
            MathPreviewPanel.currentPanel.panel.reveal(column ? column + 1 : vscode.ViewColumn.Beside);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                MathPreviewPanel.currentPanel.updateForEditor(editor);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'simpleMathPreview',
            'Math Preview',
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true,
            },
            {
                enableScripts: false,
                retainContextWhenHidden: true,
            },
        );

        MathPreviewPanel.currentPanel = new MathPreviewPanel(panel);
    }

    public static isVisible(): boolean {
        return MathPreviewPanel.currentPanel !== undefined;
    }

    public static close(): void {
        MathPreviewPanel.currentPanel?.panel.dispose();
    }

    private updateForEditor(editor: vscode.TextEditor): void {
        const state = buildMathPreviewPanelState(editor.document, editor.selection.active);
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
        this.panel.webview.html = buildMathPreviewPanelHtml(state);
    }

    public dispose(): void {
        MathPreviewPanel.currentPanel = undefined;
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.panel.dispose();
    }
}
