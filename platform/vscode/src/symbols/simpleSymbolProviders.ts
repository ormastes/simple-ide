import * as vscode from 'vscode';
import { analyzeDocument, type IndexedSymbol } from '../analysis/simpleAnalysisIndex';
import { detectBlocks } from '../blockDetector';
import { isMathLikeBlock } from '../mathPreview';

function wordRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
    return document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
}

async function collectWorkspaceSymbols(query?: string): Promise<IndexedSymbol[]> {
    const uris = await vscode.workspace.findFiles('**/*.spl', '**/{node_modules,out,.git,target,build}/**', 200);
    const symbols: IndexedSymbol[] = [];
    for (const uri of uris) {
        const document = await vscode.workspace.openTextDocument(uri);
        symbols.push(...analyzeDocument(document).symbols);
    }
    if (!query) {
        return symbols;
    }
    const lowered = query.toLowerCase();
    return symbols.filter((symbol) => symbol.name.toLowerCase().includes(lowered));
}

function exactSymbolMatches(symbols: IndexedSymbol[], name: string): IndexedSymbol[] {
    return symbols.filter((symbol) => symbol.name === name);
}

export class SimpleDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    private enabled = true;

    public provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
        if (!this.enabled) {
            return [];
        }
        const indexedSymbols = analyzeDocument(document).symbols;
        const symbols = indexedSymbols.map((symbol) => new vscode.DocumentSymbol(
            symbol.name,
            symbol.detail,
            symbol.kind,
            symbol.range,
            symbol.selectionRange,
        ));
        const byId = new Map<string, vscode.DocumentSymbol>();
        const roots: vscode.DocumentSymbol[] = [];
        for (let i = 0; i < indexedSymbols.length; i++) {
            byId.set(indexedSymbols[i].id, symbols[i]);
        }
        for (let i = 0; i < indexedSymbols.length; i++) {
            const symbol = indexedSymbols[i];
            const node = symbols[i];
            const parent = symbol.parentId ? byId.get(symbol.parentId) : undefined;
            if (parent) {
                parent.children.push(node);
                continue;
            }
            roots.push(node);
        }
        return roots;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

export class SimpleWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider<vscode.SymbolInformation> {
    private enabled = true;

    public async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
        if (!this.enabled) {
            return [];
        }
        const symbols = await collectWorkspaceSymbols(query);
        return symbols.map((symbol) => new vscode.SymbolInformation(
            symbol.name,
            symbol.kind,
            symbol.detail,
            new vscode.Location(symbol.uri, symbol.selectionRange),
        ));
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

export class SimpleDefinitionProvider implements vscode.DefinitionProvider {
    private enabled = true;

    public async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        const range = wordRange(document, position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const currentDocumentHit = analyzeDocument(document).symbols.find((symbol) => symbol.name === word);
        if (currentDocumentHit) {
            return new vscode.Location(currentDocumentHit.uri, currentDocumentHit.selectionRange);
        }

        const workspaceHits = await collectWorkspaceSymbols(word);
        const exact = exactSymbolMatches(workspaceHits, word);
        return exact.map((symbol) => new vscode.Location(symbol.uri, symbol.selectionRange));
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

export class SimpleReferenceProvider implements vscode.ReferenceProvider {
    private enabled = true;

    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
    ): Promise<vscode.Location[]> {
        if (!this.enabled) {
            return [];
        }
        const range = wordRange(document, position);
        if (!range) {
            return [];
        }

        const word = document.getText(range);
        const workspaceHits = exactSymbolMatches(await collectWorkspaceSymbols(word), word);
        const currentDocumentHits = exactSymbolMatches(analyzeDocument(document).symbols, word);
        const merged = [...currentDocumentHits, ...workspaceHits];
        const seen = new Set<string>();
        const locations: vscode.Location[] = [];

        for (const symbol of merged) {
            const key = `${symbol.uri.toString()}:${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            locations.push(new vscode.Location(symbol.uri, symbol.selectionRange));
        }

        if (context.includeDeclaration) {
            return locations;
        }

        return locations.filter((location) => !location.range.isEqual(range) || location.uri.toString() !== document.uri.toString());
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

export class SimpleHoverProvider implements vscode.HoverProvider {
    private enabled = true;

    public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        const offset = document.offsetAt(position);
        const isInsideMath = detectBlocks(document.getText()).some((block) =>
            isMathLikeBlock(block.kind) && offset >= block.from && offset <= block.to,
        );
        if (isInsideMath) {
            return undefined;
        }

        const range = wordRange(document, position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const allSymbols = [
            ...analyzeDocument(document).symbols,
            ...(await collectWorkspaceSymbols(word)),
        ];
        const symbol = allSymbols.find((candidate) => candidate.name === word);
        if (!symbol) {
            return undefined;
        }

        const markdown = new vscode.MarkdownString(undefined, true);
        markdown.appendMarkdown(`**${symbol.name}**\n\n`);
        markdown.appendMarkdown(`Kind: \`${vscode.SymbolKind[symbol.kind]}\`\n\n`);
        markdown.appendMarkdown(`Source: \`${symbol.uri.fsPath}\`:${symbol.selectionRange.start.line + 1}`);
        return new vscode.Hover(markdown, range);
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}
