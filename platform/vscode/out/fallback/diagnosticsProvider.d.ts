import * as vscode from 'vscode';
export declare class SimpleDiagnosticsProvider implements vscode.Disposable {
    private readonly diagnosticCollection;
    private readonly disposables;
    private readonly debounceTimers;
    private enabled;
    constructor();
    diagnose(document: vscode.TextDocument): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
    private debounceDiagnose;
    private checkRenderableBlockSyntax;
    private checkBasicSyntax;
    private checkBrackets;
}
