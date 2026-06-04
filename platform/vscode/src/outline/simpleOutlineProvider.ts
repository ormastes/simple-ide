import * as vscode from 'vscode';
import { analyzeDocument, type IndexedSymbol } from '../analysis/simpleAnalysisIndex';

class OutlineItem extends vscode.TreeItem {
    public readonly children: OutlineItem[] = [];

    public constructor(
        public readonly document: vscode.TextDocument,
        public readonly symbol: IndexedSymbol,
    ) {
        super(symbol.name, vscode.TreeItemCollapsibleState.None);
        this.description = symbol.detail;
        this.iconPath = new vscode.ThemeIcon(OutlineItem.iconFor(symbol.kind));
        this.command = {
            command: 'simple.outline.revealSymbol',
            title: 'Reveal Symbol',
            arguments: [document.uri, symbol.selectionRange],
        };
    }

    public static iconFor(kind: vscode.SymbolKind): string {
        switch (kind) {
            case vscode.SymbolKind.Class:
                return 'symbol-class';
            case vscode.SymbolKind.Struct:
                return 'symbol-struct';
            case vscode.SymbolKind.Enum:
                return 'symbol-enum';
            case vscode.SymbolKind.Interface:
                return 'symbol-interface';
            case vscode.SymbolKind.Namespace:
                return 'symbol-namespace';
            case vscode.SymbolKind.Method:
                return 'symbol-method';
            default:
                return 'symbol-function';
        }
    }
}

export class SimpleOutlineProvider implements vscode.TreeDataProvider<OutlineItem> {
    private readonly emitter = new vscode.EventEmitter<OutlineItem | undefined | null | void>();
    public readonly onDidChangeTreeData = this.emitter.event;
    private activeDocument: vscode.TextDocument | undefined;

    public setActiveDocument(document: vscode.TextDocument | undefined): void {
        this.activeDocument = document?.languageId === 'simple' || document?.uri.fsPath.endsWith('.spl')
            ? document
            : undefined;
        this.refresh();
    }

    public refresh(): void {
        this.emitter.fire();
    }

    public getTreeItem(element: OutlineItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: OutlineItem): OutlineItem[] {
        if (!this.activeDocument) {
            return [];
        }

        if (element) {
            return element.children;
        }

        const items = analyzeDocument(this.activeDocument).symbols
            .map((symbol) => new OutlineItem(this.activeDocument!, symbol));
        const byId = new Map(items.map((item) => [item.symbol.id, item]));
        const roots: OutlineItem[] = [];
        for (const item of items) {
            const parent = item.symbol.parentId ? byId.get(item.symbol.parentId) : undefined;
            if (parent) {
                parent.children.push(item);
                parent.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                continue;
            }
            roots.push(item);
        }
        return roots;
    }
}
