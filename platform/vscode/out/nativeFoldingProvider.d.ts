import * as vscode from 'vscode';
export declare class SimpleFoldingRangeProvider implements vscode.FoldingRangeProvider {
    private enabled;
    provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[];
    setEnabled(enabled: boolean): void;
}
