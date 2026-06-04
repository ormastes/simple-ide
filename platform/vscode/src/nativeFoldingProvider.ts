import * as vscode from 'vscode';
import { analyzeDocument } from './analysis/simpleAnalysisIndex';

export class SimpleFoldingRangeProvider implements vscode.FoldingRangeProvider {
    private enabled = true;

    public provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        if (!this.enabled) {
            return [];
        }
        return analyzeDocument(document).folds;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}
