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

const SYMBOL_PATTERNS: Array<{
    regex: RegExp;
    kind: vscode.SymbolKind;
    detail: string;
}> = [
    { regex: /^(\s*)fn\s+([A-Za-z_][A-Za-z0-9_]*)/gm, kind: vscode.SymbolKind.Function, detail: 'fn' },
    { regex: /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)/gm, kind: vscode.SymbolKind.Class, detail: 'class' },
    { regex: /^(\s*)struct\s+([A-Za-z_][A-Za-z0-9_]*)/gm, kind: vscode.SymbolKind.Struct, detail: 'struct' },
    { regex: /^(\s*)enum\s+([A-Za-z_][A-Za-z0-9_]*)/gm, kind: vscode.SymbolKind.Enum, detail: 'enum' },
    { regex: /^(\s*)trait\s+([A-Za-z_][A-Za-z0-9_]*)/gm, kind: vscode.SymbolKind.Interface, detail: 'trait' },
    { regex: /^(\s*)describe\s+"([^"]+)"/gm, kind: vscode.SymbolKind.Namespace, detail: 'describe' },
    { regex: /^(\s*)context\s+"([^"]+)"/gm, kind: vscode.SymbolKind.Namespace, detail: 'context' },
    { regex: /^(\s*)it\s+"([^"]+)"/gm, kind: vscode.SymbolKind.Method, detail: 'it' },
];

const DESCRIBE_RE = /^(\s*)(describe)\s+"([^"]+)":/;
const CONTEXT_RE = /^(\s*)(context)\s+"([^"]+)":/;
const IT_RE = /^(\s*)(it)\s+"([^"]+)":/;
const SDOCTEST_RE = /^\s*"""\s*sdoctest:/;

function leadingIndent(text: string): number {
    const match = text.match(/^\s*/);
    return match ? match[0].length : 0;
}

function findIndentedBlockEnd(document: vscode.TextDocument, startLine: number, baseIndent: number): number {
    let endLine = startLine;
    for (let line = startLine + 1; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        const trimmed = text.trim();
        if (!trimmed) {
            endLine = line;
            continue;
        }
        const indent = leadingIndent(text);
        if (indent <= baseIndent) {
            break;
        }
        endLine = line;
    }
    return endLine;
}

function findTripleStringEnd(document: vscode.TextDocument, startLine: number): number | undefined {
    for (let line = startLine + 1; line < document.lineCount; line++) {
        if (document.lineAt(line).text.includes('"""')) {
            return line;
        }
    }
    return undefined;
}

export function indexDocumentSymbols(document: vscode.TextDocument): IndexedSymbol[] {
    const text = document.getText();
    const symbols: IndexedSymbol[] = [];

    for (const pattern of SYMBOL_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(text)) !== null) {
            const symbolName = match[2];
            const indent = match[1]?.length ?? 0;
            const start = document.positionAt(match.index + match[0].lastIndexOf(symbolName));
            const end = start.translate(0, symbolName.length);
            const line = document.lineAt(start.line);
            symbols.push({
                id: `${document.uri.toString()}::symbol::${pattern.detail}::${symbolName}::${start.line}`,
                name: symbolName,
                kind: pattern.kind,
                range: line.range,
                selectionRange: new vscode.Range(start, end),
                detail: pattern.detail,
                uri: document.uri,
                indent,
            });
        }
    }

    const sorted = symbols.sort((left, right) => left.range.start.line - right.range.start.line);
    const stack: Array<{ id: string; indent: number }> = [];
    for (const symbol of sorted) {
        while (stack.length > 0 && stack[stack.length - 1].indent >= symbol.indent) {
            stack.pop();
        }
        symbol.parentId = stack[stack.length - 1]?.id;
        stack.push({ id: symbol.id, indent: symbol.indent });
    }
    return sorted;
}

export function detectTestBlocks(document: vscode.TextDocument): TestBlock[] {
    const blocks: TestBlock[] = [];
    const stack: Array<{ id: string; indent: number; kind: TestBlockKind }> = [];

    const syncParent = (indent: number): string | undefined => {
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        return stack[stack.length - 1]?.id;
    };

    const createId = (kind: TestBlockKind, label: string, line: number): string =>
        `${document.uri.toString()}::${kind}::${label}::${line}`;

    for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        let match = text.match(DESCRIBE_RE);
        if (match) {
            const indent = match[1].length;
            const id = createId('describe', match[3], line);
            const parentId = syncParent(indent);
            blocks.push({ id, kind: 'describe', label: match[3], line, indent, parentId, runnableScope: 'file' });
            stack.push({ id, indent, kind: 'describe' });
            continue;
        }

        match = text.match(CONTEXT_RE);
        if (match) {
            const indent = match[1].length;
            const id = createId('context', match[3], line);
            const parentId = syncParent(indent);
            blocks.push({ id, kind: 'context', label: match[3], line, indent, parentId, runnableScope: 'none' });
            stack.push({ id, indent, kind: 'context' });
            continue;
        }

        match = text.match(IT_RE);
        if (match) {
            const indent = match[1].length;
            const id = createId('it', match[3], line);
            const parentId = syncParent(indent);
            blocks.push({ id, kind: 'it', label: match[3], line, indent, parentId, runnableScope: 'none' });
            continue;
        }

        if (SDOCTEST_RE.test(text)) {
            const indent = leadingIndent(text);
            const id = createId('sdoctest', 'sdoctest', line);
            const parentId = syncParent(indent);
            blocks.push({ id, kind: 'sdoctest', label: 'sdoctest', line, indent, parentId, runnableScope: 'doctest' });
        }
    }
    return blocks;
}

export function collectFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const folds: vscode.FoldingRange[] = [];

    for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        const trimmed = text.trim();
        if (!trimmed) {
            continue;
        }

        if (trimmed.startsWith('"""')) {
            const end = findTripleStringEnd(document, line);
            if (typeof end === 'number' && end > line) {
                folds.push(new vscode.FoldingRange(line, end, vscode.FoldingRangeKind.Region));
                line = end;
            }
            continue;
        }

        if (!trimmed.endsWith(':')) {
            continue;
        }

        const endLine = findIndentedBlockEnd(document, line, leadingIndent(text));
        if (endLine > line) {
            folds.push(new vscode.FoldingRange(line, endLine, vscode.FoldingRangeKind.Region));
        }
    }

    return folds;
}

export function analyzeDocument(document: vscode.TextDocument): AnalysisIndex {
    return {
        symbols: indexDocumentSymbols(document),
        tests: detectTestBlocks(document),
        folds: collectFoldingRanges(document),
    };
}
