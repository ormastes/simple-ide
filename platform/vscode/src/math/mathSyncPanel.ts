import * as vscode from 'vscode';
import { buildMathSyncPanelHtml } from './mathPanelHtml';
import {
    buildEmptySyncState,
    buildMathSyncPanelState,
    fullDocumentRange,
    replaceRangeInText,
} from './mathPanelShared';

const timerApi = globalThis as unknown as {
    setTimeout(callback: () => void, delay?: number): number;
    clearTimeout(handle: number | undefined): void;
};

type MathSyncPanelMessage =
    | { type: 'ready' }
    | { type: 'editAll'; source: string; selectionStart: number; selectionEnd: number }
    | { type: 'selectionChanged'; selectionStart: number; selectionEnd: number }
    | { type: 'requestSync' };

type MathSyncPanelHostMessage =
    | { type: 'sync'; state: ReturnType<typeof buildMathSyncPanelState> }
    | { type: 'empty'; state: ReturnType<typeof buildEmptySyncState>; message: string }
    | { type: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function clampOffset(value: unknown, documentLength: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.min(documentLength, Math.trunc(value)));
}

export class MathSyncPanel implements vscode.Disposable {
    public static currentPanel: MathSyncPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private currentDocumentUri: vscode.Uri | undefined;
    private syncTimer: number | undefined;
    private isApplyingEdit = false;
    private lastStateKey: string | undefined;
    private selectionStart = 0;
    private selectionEnd = 0;

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.panel.webview.html = buildMathSyncPanelHtml(buildEmptySyncState(''));

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage((message: unknown) => {
                void this.handleMessage(message);
            }),
        );
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.handleSelectionChange(event);
            }),
        );
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.handleDocumentChange(event);
            }),
        );
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.selectionStart = editor.document.offsetAt(editor.selection.start);
            this.selectionEnd = editor.document.offsetAt(editor.selection.end);
            this.syncFromEditor(editor);
        }
    }

    public static show(): void {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (MathSyncPanel.currentPanel) {
            MathSyncPanel.currentPanel.panel.reveal(column ? column + 1 : vscode.ViewColumn.Beside);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                MathSyncPanel.currentPanel.syncFromEditor(editor);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'simpleMathSyncPanel',
            'Math Sync Panel',
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true,
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        MathSyncPanel.currentPanel = new MathSyncPanel(panel);
    }

    public static isVisible(): boolean {
        return MathSyncPanel.currentPanel !== undefined;
    }

    public static close(): void {
        MathSyncPanel.currentPanel?.panel.dispose();
    }

    private async handleMessage(rawMessage: unknown): Promise<void> {
        if (!isRecord(rawMessage) || typeof rawMessage.type !== 'string') {
            return;
        }
        const message = rawMessage as Partial<MathSyncPanelMessage> & { type: string };
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
            edit.replace(editor.document.uri, fullDocumentRange(editor.document), message.source);
            const applied = await vscode.workspace.applyEdit(edit);
            if (!applied) {
                this.panel.webview.postMessage({
                    type: 'error',
                    message: 'Failed to apply source edit to the backing document.',
                } satisfies MathSyncPanelHostMessage);
            }
        } finally {
            this.isApplyingEdit = false;
        }

        this.syncFromEditor(editor);
    }

    private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
        if (!this.currentDocumentUri || event.textEditor.document.uri.toString() !== this.currentDocumentUri.toString()) {
            return;
        }
        this.scheduleSyncFromEditor(event.textEditor);
    }

    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
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

    private scheduleSyncFromEditor(editor: vscode.TextEditor): void {
        if (this.syncTimer) {
            timerApi.clearTimeout(this.syncTimer);
        }
        this.syncTimer = timerApi.setTimeout(() => {
            this.syncTimer = undefined;
            this.syncFromEditor(editor);
        }, 50);
    }

    private getEditorForCurrentDocument(): vscode.TextEditor | undefined {
        if (!this.currentDocumentUri) {
            return vscode.window.activeTextEditor;
        }
        return vscode.window.visibleTextEditors.find(editor =>
            editor.document.uri.toString() === this.currentDocumentUri?.toString(),
        ) ?? vscode.window.activeTextEditor;
    }

    private syncFromEditor(editor: vscode.TextEditor): void {
        if (editor.document.languageId !== 'simple') {
            this.panel.webview.postMessage({
                type: 'empty',
                state: buildEmptySyncState(editor.document.uri.toString()),
                message: 'Move the cursor onto a math block in the source editor.',
            } satisfies MathSyncPanelHostMessage);
            return;
        }

        if (!this.currentDocumentUri || this.currentDocumentUri.toString() !== editor.document.uri.toString()) {
            this.selectionStart = editor.document.offsetAt(editor.selection.start);
            this.selectionEnd = editor.document.offsetAt(editor.selection.end);
        }

        const state = buildMathSyncPanelState(editor.document, this.selectionStart, this.selectionEnd);
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
        } satisfies MathSyncPanelHostMessage);
    }

    public dispose(): void {
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
