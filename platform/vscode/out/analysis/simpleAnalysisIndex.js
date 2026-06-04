"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexDocumentSymbols = indexDocumentSymbols;
exports.detectTestBlocks = detectTestBlocks;
exports.collectFoldingRanges = collectFoldingRanges;
exports.analyzeDocument = analyzeDocument;
const vscode = __importStar(require("vscode"));
const SYMBOL_PATTERNS = [
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
function leadingIndent(text) {
    const match = text.match(/^\s*/);
    return match ? match[0].length : 0;
}
function findIndentedBlockEnd(document, startLine, baseIndent) {
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
function findTripleStringEnd(document, startLine) {
    for (let line = startLine + 1; line < document.lineCount; line++) {
        if (document.lineAt(line).text.includes('"""')) {
            return line;
        }
    }
    return undefined;
}
function indexDocumentSymbols(document) {
    const text = document.getText();
    const symbols = [];
    for (const pattern of SYMBOL_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
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
    const stack = [];
    for (const symbol of sorted) {
        while (stack.length > 0 && stack[stack.length - 1].indent >= symbol.indent) {
            stack.pop();
        }
        symbol.parentId = stack[stack.length - 1]?.id;
        stack.push({ id: symbol.id, indent: symbol.indent });
    }
    return sorted;
}
function detectTestBlocks(document) {
    const blocks = [];
    const stack = [];
    const syncParent = (indent) => {
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        return stack[stack.length - 1]?.id;
    };
    const createId = (kind, label, line) => `${document.uri.toString()}::${kind}::${label}::${line}`;
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
function collectFoldingRanges(document) {
    const folds = [];
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
function analyzeDocument(document) {
    return {
        symbols: indexDocumentSymbols(document),
        tests: detectTestBlocks(document),
        folds: collectFoldingRanges(document),
    };
}
//# sourceMappingURL=simpleAnalysisIndex.js.map