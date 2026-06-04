import * as vscode from 'vscode';
import { type DetectedBlock } from './blockDetector';
export declare class NativeMathProvider implements vscode.HoverProvider, vscode.Disposable {
    private readonly openDecoration;
    private readonly closeDecoration;
    private readonly contentDecoration;
    private readonly previewDecoration;
    private readonly disposables;
    constructor();
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined;
    findMathBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): DetectedBlock | undefined;
    dispose(): void;
    private refreshVisibleEditors;
    private refreshEditor;
}
