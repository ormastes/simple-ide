import * as vscode from 'vscode';
export declare class TestCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly disposables;
    private readonly emitter;
    readonly onDidChangeCodeLenses: vscode.Event<void>;
    constructor();
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[];
    dispose(): void;
}
