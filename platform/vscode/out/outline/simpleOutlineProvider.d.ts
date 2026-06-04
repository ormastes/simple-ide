import * as vscode from 'vscode';
import { type IndexedSymbol } from '../analysis/simpleAnalysisIndex';
declare class OutlineItem extends vscode.TreeItem {
    readonly document: vscode.TextDocument;
    readonly symbol: IndexedSymbol;
    readonly children: OutlineItem[];
    constructor(document: vscode.TextDocument, symbol: IndexedSymbol);
    static iconFor(kind: vscode.SymbolKind): string;
}
export declare class SimpleOutlineProvider implements vscode.TreeDataProvider<OutlineItem> {
    private readonly emitter;
    readonly onDidChangeTreeData: vscode.Event<void | OutlineItem | null | undefined>;
    private activeDocument;
    setActiveDocument(document: vscode.TextDocument | undefined): void;
    refresh(): void;
    getTreeItem(element: OutlineItem): vscode.TreeItem;
    getChildren(element?: OutlineItem): OutlineItem[];
}
export {};
