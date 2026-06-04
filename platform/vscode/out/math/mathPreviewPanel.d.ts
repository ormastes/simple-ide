import * as vscode from 'vscode';
export declare class MathPreviewPanel implements vscode.Disposable {
    static currentPanel: MathPreviewPanel | undefined;
    private readonly panel;
    private disposables;
    private currentSignature;
    private constructor();
    static show(): void;
    static isVisible(): boolean;
    static close(): void;
    private updateForEditor;
    dispose(): void;
}
