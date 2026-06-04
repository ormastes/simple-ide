import * as vscode from 'vscode';
export interface IndexedSymbol {
    id: string;
    name: string;
    kind: vscode.SymbolKind;
    range: vscode.Range;
    selectionRange: vscode.Range;
    detail: string;
    uri: vscode.Uri;
    indent: number;
    parentId?: string;
}
export type TestBlockKind = 'describe' | 'context' | 'it' | 'sdoctest';
export type TestRunnableScope = 'file' | 'doctest' | 'exact' | 'none';
export interface TestBlock {
    id: string;
    kind: TestBlockKind;
    label: string;
    line: number;
    indent: number;
    parentId?: string;
    runnableScope: TestRunnableScope;
}
export interface AnalysisIndex {
    symbols: IndexedSymbol[];
    tests: TestBlock[];
    folds: vscode.FoldingRange[];
}
export declare function indexDocumentSymbols(document: vscode.TextDocument): IndexedSymbol[];
export declare function detectTestBlocks(document: vscode.TextDocument): TestBlock[];
export declare function collectFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[];
export declare function analyzeDocument(document: vscode.TextDocument): AnalysisIndex;
