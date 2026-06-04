import * as vscode from 'vscode';
export declare class MathSyncPanel implements vscode.Disposable {
    static currentPanel: MathSyncPanel | undefined;
    private readonly panel;
    private disposables;
    private currentDocumentUri;
    private syncTimer;
    private isApplyingEdit;
    private lastStateKey;
    private selectionStart;
    private selectionEnd;
    private constructor();
    static show(): void;
    static isVisible(): boolean;
    static close(): void;
    private handleMessage;
    private handleSelectionChange;
    private handleDocumentChange;
    private scheduleSyncFromEditor;
    private getEditorForCurrentDocument;
    private syncFromEditor;
    dispose(): void;
}
