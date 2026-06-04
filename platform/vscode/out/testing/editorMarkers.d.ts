import * as vscode from 'vscode';
export interface EditorMarkerState {
    breakpoints: number[];
    bookmarks: number[];
    pointerLine: number | null;
}
export declare class EditorMarkerManager implements vscode.Disposable {
    private readonly storage?;
    private static readonly storageKey;
    private readonly decorations;
    private readonly states;
    private readonly disposables;
    private readonly didChangeStateEmitter;
    readonly onDidChangeState: vscode.Event<vscode.Uri>;
    constructor(storage?: vscode.Memento | undefined);
    toggleBreakpoint(documentUri: vscode.Uri, line: number): EditorMarkerState;
    toggleBookmark(documentUri: vscode.Uri, line: number): EditorMarkerState;
    togglePointer(documentUri: vscode.Uri, line: number): EditorMarkerState;
    clearPointer(documentUri: vscode.Uri): EditorMarkerState;
    jumpToNextBookmark(editor: vscode.TextEditor): void;
    jumpToPreviousBookmark(editor: vscode.TextEditor): void;
    refresh(editor: vscode.TextEditor): void;
    getState(documentUri: vscode.Uri): EditorMarkerState;
    dispose(): void;
    private refreshVisible;
    private getOrCreateState;
    private toggleLine;
    private jumpToBookmark;
    private restorePersistedState;
    private persistState;
}
